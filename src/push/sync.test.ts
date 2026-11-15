import 'fake-indexeddb/auto';
import { liveQuery } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Адрес воркера и VAPID-ключ читаются при загрузке `subscribe.ts` — задаются до импортов.
vi.hoisted(() => {
  vi.stubEnv('VITE_PUSH_API_URL', 'https://push.example/');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BCUejqVmnkm5H6gRhzCwIhY3DQD6_WQzvdtr2TfxrCUFsEsWD7TbTZk3iJ-iriHJGmI5mA-rQopAJzr5Vpns71A');
});

import { toLocalDate } from '../domain/dates';
import { buildForecast } from '../domain/forecast';
import { planReminders, toServerReminders } from '../domain/reminders';
import type { LocalDate, Period } from '../domain/types';
import { db } from '../storage/db';
import {
  getPeriods,
  getPushState,
  getSettings,
  savePeriods,
  savePushState,
  setDevMode,
  updateSettings,
  type PushState,
} from '../storage/repository';
import { disableReminders, enableReminders } from './subscribe';
import { reminderDataQuery, syncReminders } from './sync';

// Фича 018 (шаг 5 рефакторинга): синхронизация расписания на настоящем репозитории с подменённым
// браузером. Правила прохода, включение и выключение — характеризация (зелёные до и после правок).

const ID = '6f1c2b8e-3a4d-4c5e-9f00-0123456789ab';
const S0: PushState = { clientId: ID, token: 'tok_secret_value_1234567890', subscribed: true, pendingSync: true, lastSyncedHash: null };
const CLIENT_URL = `https://push.example/v1/clients/${ID}`;
const NOW = new Date(2026, 9, 23, 9);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const p = (id: string, start: string, end: string | null = null): Period => ({
  id,
  start: start as LocalDate,
  end: end as LocalDate | null,
  endEstimated: false,
});
const PERIODS = [p('a', '2026-10-15')];

// Подписка браузера — как в браузере: после `unsubscribe()` её нет, новая подписка — с новым endpoint.
interface BrowserSub {
  toJSON(): unknown;
  unsubscribe: Mock<() => Promise<boolean>>;
}
const subJson = (path: string) => ({ endpoint: `https://web.push.apple.com/${path}`, expirationTime: null, keys: { p256dh: 'p256', auth: 'auth' } });
let current: BrowserSub | null = null;
let n = 0;
const makeSub = (path: string): BrowserSub => {
  const sub: BrowserSub = {
    toJSON: () => subJson(path),
    unsubscribe: vi.fn(async () => {
      if (current === sub) current = null;
      return true;
    }),
  };
  return sub;
};
const pushManager = {
  getSubscription: vi.fn(async () => current),
  subscribe: vi.fn(async (_options: unknown) => (current = makeSub(`new-${++n}`))),
};
let permission: NotificationPermission = 'granted';
let fetchMock: Mock<(url: string, init: RequestInit) => Promise<Response>>;

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  n = 0;
  permission = 'granted';
  current = makeSub('abc');
  pushManager.getSubscription.mockClear();
  pushManager.subscribe.mockClear();
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('window', { PushManager: class {}, Notification: {} });
  vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => permission) });
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager }) } });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Тело `PUT` по данным в базе — так, как его строит синхронизация. */
async function expectedBody(path = 'abc'): Promise<string> {
  const [periods, settings] = [await getPeriods(), await getSettings()];
  const forecast = buildForecast({ periods, settings, today: toLocalDate(NOW) });
  const reminders = forecast ? toServerReminders(planReminders(forecast, settings, NOW)) : [];
  return JSON.stringify({ subscription: subJson(path), reminders });
}

const putInit = (body: string) => ({
  method: 'PUT',
  headers: { Authorization: `Bearer ${S0.token}`, 'Content-Type': 'application/json' },
  body,
});

describe('syncReminders — правила прохода как раньше', () => {
  it('нет состояния — ничего не делает', async () => {
    await syncReminders();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getPushState()).toBeUndefined();
  });

  it('напоминания выключены — ничего не делает', async () => {
    const state = { ...S0, subscribed: false };
    await savePushState(state);
    await syncReminders();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getPushState()).toEqual(state);
  });

  it('браузер потерял подписку — напоминания выключены, запроса нет', async () => {
    current = null;
    await savePushState(S0);
    await syncReminders();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getPushState()).toEqual({ ...S0, subscribed: false });
  });

  it('первый проход — PUT расписания, затем «отправлено» и отпечаток тела', async () => {
    await savePeriods(PERIODS);
    await savePushState(S0);
    await syncReminders();
    const body = await expectedBody();
    expect(JSON.parse(body).reminders.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(CLIENT_URL, putInit(body));
    expect(await getPushState()).toEqual({ ...S0, pendingSync: false, lastSyncedHash: await sha256(body) });
  });

  it('неизменное расписание повторно не отправляется', async () => {
    await savePeriods(PERIODS);
    await savePushState(S0);
    await syncReminders();
    const after = await getPushState();
    await syncReminders();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getPushState()).toEqual(after);
  });

  it('изменение данных — новое расписание уходит следующим проходом', async () => {
    await savePeriods(PERIODS);
    await savePushState(S0);
    await syncReminders();
    await updateSettings({ remindOvulation: false });
    await syncReminders();
    const body = await expectedBody();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(CLIENT_URL, putInit(body));
    expect((await getPushState())?.lastSyncedHash).toBe(await sha256(body));
  });

  it.each([400, 401, 500])('ответ %i — «ждёт отправки», отпечаток прежний', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await savePeriods(PERIODS);
    await savePushState({ ...S0, lastSyncedHash: 'old' });
    await syncReminders();
    expect(await getPushState()).toEqual({ ...S0, pendingSync: true, lastSyncedHash: 'old' });
  });

  it('нет сети — «ждёт отправки»', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await savePeriods(PERIODS);
    await savePushState({ ...S0, pendingSync: false, lastSyncedHash: 'old' });
    await syncReminders();
    expect(await getPushState()).toEqual({ ...S0, pendingSync: true, lastSyncedHash: 'old' });
  });

  it('«ждёт отправки» при том же отпечатке — отправляется снова', async () => {
    await savePeriods(PERIODS);
    await savePushState({ ...S0, pendingSync: true, lastSyncedHash: await sha256(await expectedBody()) });
    await syncReminders();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await getPushState())?.pendingSync).toBe(false);
  });

  it('нет месячных — уходит пустое расписание', async () => {
    await savePushState(S0);
    await syncReminders();
    expect(fetchMock).toHaveBeenCalledWith(CLIENT_URL, putInit(JSON.stringify({ subscription: subJson('abc'), reminders: [] })));
  });
});

describe('enableReminders / disableReminders — как раньше', () => {
  it('включение на пустом устройстве — подписка браузера, новые clientId и токен, «ждёт отправки»', async () => {
    current = null;
    expect(await enableReminders()).toBe('granted');
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    expect(pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(await getPushState()).toEqual({
      clientId: expect.stringMatching(UUID_RE),
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      subscribed: true,
      pendingSync: true,
      lastSyncedHash: null,
    });
  });

  it('включение при существующем состоянии — те же clientId и токен', async () => {
    await savePushState({ ...S0, subscribed: false, pendingSync: false, lastSyncedHash: 'h' });
    expect(await enableReminders()).toBe('granted');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(await getPushState()).toEqual({ ...S0, subscribed: true, pendingSync: true, lastSyncedHash: null });
  });

  it('уведомления запрещены — состояние не меняется', async () => {
    permission = 'denied';
    const state = { ...S0, subscribed: false };
    await savePushState(state);
    expect(await enableReminders()).toBe('denied');
    expect(await getPushState()).toEqual(state);
  });

  it('выключение — DELETE на воркер, напоминания выключены, подписка браузера отменена', async () => {
    const sub = current!;
    await savePushState({ ...S0, pendingSync: false, lastSyncedHash: 'h' });
    await disableReminders();
    expect(fetchMock).toHaveBeenCalledWith(CLIENT_URL, { method: 'DELETE', headers: { Authorization: `Bearer ${S0.token}` } });
    expect(await getPushState()).toEqual({ ...S0, subscribed: false, pendingSync: false, lastSyncedHash: null });
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('выключение без сети — то же состояние', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const sub = current!;
    await savePushState(S0);
    await disableReminders();
    expect(await getPushState()).toEqual({ ...S0, subscribed: false, pendingSync: false, lastSyncedHash: null });
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('выключение без состояния — запроса нет, подписка браузера отменена', async () => {
    const sub = current!;
    await disableReminders();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getPushState()).toBeUndefined();
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('гонки', () => {
  /** Первый PUT отвечает, когда тест разрешит; остальные запросы — сразу 204. */
  function holdFirstPut() {
    const answer = deferred<Response>();
    let held = false;
    fetchMock.mockImplementation(async (_url, init) => {
      if (init.method === 'PUT' && !held) {
        held = true;
        return answer.promise;
      }
      return new Response(null, { status: 204 });
    });
    return () => answer.resolve(new Response(null, { status: 204 }));
  }
  const puts = () => fetchMock.mock.calls.filter(([, init]) => init.method === 'PUT');

  beforeEach(async () => {
    await savePeriods(PERIODS);
    await savePushState(S0);
  });

  it('выключение во время синхронизации не отменяется', async () => {
    const answer = holdFirstPut();
    const run = syncReminders();
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    await disableReminders();
    answer();
    await run;
    expect((await getPushState())?.subscribed).toBe(false);
  });

  it('изменение во время синхронизации отправляется повторным проходом', async () => {
    const answer = holdFirstPut();
    const first = syncReminders();
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    await updateSettings({ remindOvulation: false });
    const again = syncReminders();
    answer();
    await Promise.all([first, again]);
    const body = await expectedBody();
    expect(puts()).toHaveLength(2);
    expect(fetchMock).toHaveBeenLastCalledWith(CLIENT_URL, putInit(body));
    expect((await getPushState())?.lastSyncedHash).toBe(await sha256(body));
  });

  it('три запроса во время синхронизации — один повторный проход', async () => {
    const answer = holdFirstPut();
    const first = syncReminders();
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    await updateSettings({ remindOvulation: false });
    const queued = [syncReminders(), syncReminders(), syncReminders()];
    answer();
    await Promise.all([first, ...queued]);
    expect(puts()).toHaveLength(2);
  });

  it('выключение и включение во время синхронизации — расписание уходит с новой подпиской', async () => {
    const answer = holdFirstPut();
    const first = syncReminders();
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    await disableReminders();
    expect(await enableReminders()).toBe('granted');
    const again = syncReminders();
    answer();
    await Promise.all([first, again]);
    const body = await expectedBody('new-1');
    expect(puts()).toHaveLength(2);
    expect(fetchMock).toHaveBeenLastCalledWith(CLIENT_URL, putInit(body));
    expect(await getPushState()).toEqual({ ...S0, subscribed: true, pendingSync: false, lastSyncedHash: await sha256(body) });
  });
});

describe('reminderDataQuery — наблюдение', () => {
  it('срабатывает на месячные и настройки, но не на состояние push и режим разработчика', async () => {
    await savePeriods([p('a', '2026-10-01')]);
    let count = 0;
    const subscription = liveQuery(reminderDataQuery).subscribe({ next: () => count++ });
    const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
    try {
      await settle();
      expect(count).toBe(1);
      await savePushState(S0);
      await settle();
      expect(count).toBe(1);
      await setDevMode(true);
      await settle();
      expect(count).toBe(1);
      await updateSettings({ remindPeriod: false });
      await settle();
      expect(count).toBe(2);
      await savePeriods([p('a', '2026-10-01', '2026-10-05')]);
      await settle();
      expect(count).toBe(3);
    } finally {
      subscription.unsubscribe();
    }
  });
});
