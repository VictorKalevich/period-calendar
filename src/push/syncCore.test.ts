import { describe, expect, it, vi } from 'vitest';
import { toLocalDate } from '../domain/dates';
import { buildForecast } from '../domain/forecast';
import { planReminders, toServerReminders } from '../domain/reminders';
import { DEFAULT_SETTINGS, type LocalDate, type Period, type Settings } from '../domain/types';
import type { PushState, PushStatePatch } from '../storage/repository';
import { createSyncRunner, syncPass, type SyncDeps } from './syncCore';

// Фича 018 (шаг 5 рефакторинга): ядро синхронизации без браузера, сети и базы — все внешние зависимости
// подменены (specs/018-push-sync-contract/contracts/sync-core.md).

const NOW = new Date(2026, 9, 23, 9);
const SUB_JSON = { endpoint: 'https://web.push.apple.com/abc', expirationTime: null, keys: { p256dh: 'p256', auth: 'auth' } };
const S0: PushState = { clientId: 'c-1', token: 'tok_secret_value_1234567890', subscribed: true, pendingSync: true, lastSyncedHash: null };
const URL_OF = (s: PushState) => `https://push.example/v1/clients/${s.clientId}`;

const p = (id: string, start: string): Period => ({ id, start: start as LocalDate, end: null, endEstimated: false });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Data {
  periods: Period[];
  settings: Settings;
}

function bodyFor(data: Data, now = NOW): string {
  const forecast = buildForecast({ periods: data.periods, settings: data.settings, today: toLocalDate(now) });
  const reminders = forecast ? toServerReminders(planReminders(forecast, data.settings, now)) : [];
  return JSON.stringify({ subscription: SUB_JSON, reminders });
}

const putInit = (body: string) => ({
  method: 'PUT',
  headers: { Authorization: `Bearer ${S0.token}`, 'Content-Type': 'application/json' },
  body,
});

/**
 * Подменённые зависимости: состояние в памяти, изменение — поверх актуального, как `updatePushState`.
 * `null` — состояния нет.
 */
function fake(initial: PushState | null = S0) {
  const data: Data = { periods: [p('a', '2026-10-15')], settings: { ...DEFAULT_SETTINGS } };
  const box: { state: PushState | undefined } = { state: initial ? { ...initial } : undefined };
  const patches: PushStatePatch[] = [];
  const deps = {
    isConfigured: vi.fn(() => true),
    getState: vi.fn(async () => box.state && { ...box.state }),
    updateState: vi.fn(async (patch: PushStatePatch) => {
      patches.push(patch);
      if (box.state) box.state = { ...box.state, ...patch };
    }),
    getSubscription: vi.fn(async (): Promise<{ toJSON(): unknown } | null> => ({ toJSON: () => SUB_JSON })),
    loadData: vi.fn(async () => ({ periods: data.periods, settings: data.settings })),
    send: vi.fn(async (_url: string, _init: RequestInit): Promise<{ ok: boolean }> => ({ ok: true })),
    url: URL_OF,
    now: () => NOW,
  } satisfies SyncDeps;
  return { deps, box, data, patches };
}

describe('syncPass — правила прохода', () => {
  it('push не настроен — состояние не читается, запроса нет', async () => {
    const { deps } = fake();
    deps.isConfigured.mockReturnValue(false);
    await syncPass(deps);
    expect(deps.getState).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
  });

  it.each([
    ['нет состояния', null],
    ['напоминания выключены', { ...S0, subscribed: false }],
  ])('%s — ни запроса, ни записи', async (_name, state) => {
    const { deps } = fake(state);
    await syncPass(deps);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.updateState).not.toHaveBeenCalled();
  });

  it('браузер потерял подписку — только { subscribed: false }, запроса нет', async () => {
    const { deps, patches } = fake();
    deps.getSubscription.mockResolvedValue(null);
    await syncPass(deps);
    expect(patches).toStrictEqual([{ subscribed: false }]);
    expect(deps.send).not.toHaveBeenCalled();
  });

  it('первый проход — PUT расписания, затем только «отправлено» и отпечаток', async () => {
    const { deps, data, patches } = fake();
    await syncPass(deps);
    const body = bodyFor(data);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.send).toHaveBeenCalledWith(URL_OF(S0), putInit(body));
    expect(patches).toStrictEqual([{ pendingSync: false, lastSyncedHash: await sha256(body) }]);
  });

  it('отпечаток совпадает и ничего не ждёт отправки — ни запроса, ни записи', async () => {
    const hash = await sha256(bodyFor({ periods: [p('a', '2026-10-15')], settings: DEFAULT_SETTINGS }));
    const { deps } = fake({ ...S0, pendingSync: false, lastSyncedHash: hash });
    await syncPass(deps);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.updateState).not.toHaveBeenCalled();
  });

  it('«ждёт отправки» при том же отпечатке — отправляется', async () => {
    const hash = await sha256(bodyFor({ periods: [p('a', '2026-10-15')], settings: DEFAULT_SETTINGS }));
    const { deps } = fake({ ...S0, pendingSync: true, lastSyncedHash: hash });
    await syncPass(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it('отказ сервера (не 2xx) — только { pendingSync: true }', async () => {
    const { deps, patches } = fake();
    deps.send.mockResolvedValue({ ok: false });
    await syncPass(deps);
    expect(patches).toStrictEqual([{ pendingSync: true }]);
  });

  it('часы внедрены: расписание считается от deps.now()', async () => {
    const later = new Date(2026, 10, 30, 9);
    const { deps, data } = fake();
    await syncPass({ ...deps, now: () => later });
    const body = bodyFor(data, later);
    expect(body).not.toBe(bodyFor(data, NOW));
    expect(deps.send).toHaveBeenCalledWith(URL_OF(S0), putInit(body));
  });

  it('нет месячных — уходит пустое расписание', async () => {
    const { deps, data } = fake();
    data.periods = [];
    await syncPass(deps);
    expect(deps.send).toHaveBeenCalledWith(URL_OF(S0), putInit(JSON.stringify({ subscription: SUB_JSON, reminders: [] })));
  });

  it('выключение во время синхронизации не отменяется', async () => {
    const { deps, box, patches } = fake();
    const answer = deferred<{ ok: boolean }>();
    deps.send.mockImplementationOnce(() => answer.promise);
    const run = syncPass(deps);
    await vi.waitFor(() => expect(deps.send).toHaveBeenCalledTimes(1));
    // Выключение, пока ответ сервера не пришёл.
    box.state = { ...box.state!, subscribed: false, pendingSync: false, lastSyncedHash: null };
    answer.resolve({ ok: true });
    await run;
    expect(box.state?.subscribed).toBe(false);
    for (const patch of patches) {
      expect(Object.keys(patch)).not.toContain('subscribed');
      expect(Object.keys(patch)).not.toContain('clientId');
      expect(Object.keys(patch)).not.toContain('token');
    }
  });

  it('без сети ставится «ждёт отправки»', async () => {
    const { deps, box } = fake({ ...S0, pendingSync: false, lastSyncedHash: 'old' });
    deps.send.mockRejectedValue(new TypeError('Failed to fetch'));
    await syncPass(deps);
    expect(box.state).toStrictEqual({ ...S0, pendingSync: true, lastSyncedHash: 'old' });
  });

  it('неизменное расписание повторно не отправляется', async () => {
    const { deps } = fake();
    await syncPass(deps);
    await syncPass(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it('отказ чтения состояния или данных — проход отклоняется', async () => {
    const a = fake();
    a.deps.getState.mockRejectedValue(new Error('db'));
    await expect(syncPass(a.deps)).rejects.toThrow('db');
    const b = fake();
    b.deps.loadData.mockRejectedValue(new Error('db'));
    await expect(syncPass(b.deps)).rejects.toThrow('db');
    expect(b.deps.send).not.toHaveBeenCalled();
  });
});

/** Проходы с ручным завершением и счётчиком одновременных. */
function manualPasses() {
  const calls: Array<ReturnType<typeof deferred<void>>> = [];
  const stats = { active: 0, maxActive: 0 };
  const pass = vi.fn(() => {
    const d = deferred<void>();
    calls.push(d);
    stats.active++;
    stats.maxActive = Math.max(stats.maxActive, stats.active);
    return d.promise.finally(() => {
      stats.active--;
    });
  });
  return { pass, calls, stats };
}

/** Разрешился ли промис к этому моменту. */
function track(promise: Promise<unknown>) {
  const state = { settled: false };
  promise.then(
    () => (state.settled = true),
    () => (state.settled = true),
  );
  return state;
}

describe('createSyncRunner — повторный проход', () => {
  it('без идущего прохода — один проход, вызов разрешается вместе с ним', async () => {
    const { pass, calls } = manualPasses();
    const run = createSyncRunner(pass);
    const r = run();
    const t = track(r);
    expect(pass).toHaveBeenCalledTimes(1);
    await tick();
    expect(t.settled).toBe(false);
    calls[0]!.resolve();
    await r;
    expect(pass).toHaveBeenCalledTimes(1);
  });

  it('три вызова во время прохода — ровно один повторный, все ждут его; одновременно не больше одного', async () => {
    const { pass, calls, stats } = manualPasses();
    const run = createSyncRunner(pass);
    const first = run();
    const queued = [run(), run(), run()];
    const t = queued.map(track);
    expect(pass).toHaveBeenCalledTimes(1);
    calls[0]!.resolve();
    await first;
    await vi.waitFor(() => expect(pass).toHaveBeenCalledTimes(2));
    await tick();
    expect(t.every((x) => !x.settled)).toBe(true);
    calls[1]!.resolve();
    await Promise.all(queued);
    expect(pass).toHaveBeenCalledTimes(2);
    expect(stats.maxActive).toBe(1);
  });

  it('вызов во время повторного прохода — ещё один проход', async () => {
    const { pass, calls, stats } = manualPasses();
    const run = createSyncRunner(pass);
    void run();
    const second = run();
    calls[0]!.resolve();
    await vi.waitFor(() => expect(pass).toHaveBeenCalledTimes(2));
    const third = run();
    calls[1]!.resolve();
    await second;
    await vi.waitFor(() => expect(pass).toHaveBeenCalledTimes(3));
    calls[2]!.resolve();
    await third;
    expect(stats.maxActive).toBe(1);
  });

  it('первый проход отклонён — его вызов получает ошибку, вызов во время него — результат повторного', async () => {
    const { pass, calls } = manualPasses();
    const run = createSyncRunner(pass);
    const first = run();
    const queued = run();
    calls[0]!.reject(new Error('db'));
    await expect(first).rejects.toThrow('db');
    await vi.waitFor(() => expect(pass).toHaveBeenCalledTimes(2));
    calls[1]!.resolve();
    await expect(queued).resolves.toBeUndefined();
  });

  it('после завершения всех проходов новый вызов запускает новый проход', async () => {
    const { pass, calls } = manualPasses();
    const run = createSyncRunner(pass);
    const r1 = run();
    calls[0]!.resolve();
    await r1;
    const r2 = run();
    expect(pass).toHaveBeenCalledTimes(2);
    calls[1]!.resolve();
    await r2;
  });

  it('изменение во время синхронизации отправляется повторным проходом', async () => {
    const { deps, data, box } = fake();
    const answer = deferred<{ ok: boolean }>();
    deps.send.mockImplementationOnce(() => answer.promise);
    const sync = createSyncRunner(() => syncPass(deps));
    const first = sync();
    await vi.waitFor(() => expect(deps.send).toHaveBeenCalledTimes(1));
    data.settings = { ...data.settings, remindOvulation: false };
    const again = sync();
    answer.resolve({ ok: true });
    await Promise.all([first, again]);
    const body = bodyFor(data);
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.send).toHaveBeenLastCalledWith(URL_OF(S0), putInit(body));
    expect(box.state?.lastSyncedHash).toBe(await sha256(body));
  });
});
