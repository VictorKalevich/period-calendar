import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, runSchedule, TEST_NOTIFICATION } from '../src/index';
import { validatePutBody } from '../src/validate';
import { sendPush } from '../src/webpush';
import { toLocalDate } from '../../src/domain/dates';
import { buildForecast } from '../../src/domain/forecast';
import { MAX_REMINDERS, planReminders, toServerReminders } from '../../src/domain/reminders';
import { DEFAULT_SETTINGS, type LocalDate, type Period, type Settings } from '../../src/domain/types';
import { notificationFromPush } from '../../src/pwa/pushNotification';
import { makeEnv, MemoryKV, putRequest, subscription, uuid } from './support';

// Фича 018 (шаг 5 рефакторинга): расписание, которое строит приложение, принимает воркер, а уведомление
// воркера показывает service worker приложения. Тест воркера импортирует домен приложения — названное
// исключение из правила слоёв (specs/018-push-sync-contract/research.md R1); рабочий код воркера — нет.

// Шифрование покрыто эталонными векторами (webpush.test.ts); здесь нужен только payload, который
// рассылка передаёт на отправку.
vi.mock('../src/webpush', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/webpush')>()),
  sendPush: vi.fn(async () => ({ status: 201, detail: '' })),
}));

type Kind = 'period' | 'ovulation' | 'missed-period';
const ALL: Kind[] = ['period', 'ovulation', 'missed-period'];
const S = DEFAULT_SETTINGS;
const DAY_MS = 24 * 3600 * 1000;

const p = (id: string, start: string, end: string | null = null): Period => ({
  id,
  start: start as LocalDate,
  end: end as LocalDate | null,
  endEstimated: false,
});

/** Местные 09:00 даты `YYYY-MM-DD` — «сегодня» одно и то же в любом часовом поясе. */
const nowOf = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), 9);

/** Расписание — так же, как его строит синхронизация приложения (`src/push/sync.ts`). */
function schedule(periods: Period[], settings: Settings, now: Date) {
  const forecast = buildForecast({ periods, settings, today: toLocalDate(now) });
  return forecast ? toServerReminders(planReminders(forecast, settings, now)) : [];
}

/** Тело `PUT` приложения; подписка — в форме `PushSubscription.toJSON()`. */
const bodyOf = (reminders: ReturnType<typeof schedule>) => ({ subscription: { ...subscription(), expirationTime: null }, reminders });

const kindOf = (id: string) => id.slice(0, id.lastIndexOf(':'));

interface Case {
  name: string;
  periods: Period[];
  today: string;
  settings: Settings;
  kinds: Kind[];
  check?: (reminders: ReturnType<typeof schedule>, now: Date) => void;
}

const usual = [p('a', '2026-10-15')];

const CASES: Case[] = [
  { name: 'обычный цикл', periods: usual, today: '2026-10-23', settings: S, kinds: ALL, check: (r) => expect(r).toHaveLength(18) },
  { name: 'самый короткий цикл в настройках', periods: [p('a', '2026-10-20')], today: '2026-10-23', settings: { ...S, defaultCycleLength: 21 }, kinds: ALL },
  {
    name: 'самый короткий учитываемый цикл (15 дней)',
    periods: [p('a', '2026-09-23', '2026-09-26'), p('b', '2026-10-08', '2026-10-11')],
    today: '2026-10-09',
    settings: S,
    kinds: ALL,
  },
  { name: 'самый длинный цикл в настройках', periods: usual, today: '2026-10-23', settings: { ...S, defaultCycleLength: 45 }, kinds: ALL },
  {
    name: 'самый длинный учитываемый цикл (60 дней), сегодня — первый день месячных',
    periods: [p('a', '2026-06-24', '2026-06-28'), p('b', '2026-08-23')],
    today: '2026-08-23',
    settings: S,
    kinds: ALL,
    check: (r, now) => {
      // Самое дальнее — напоминание о неотмеченном начале шестого цикла: ≈ 362 дня при пределе воркера 400.
      const ahead = Math.max(...r.map((x) => Date.parse(x.sendAt))) - now.getTime();
      expect(ahead).toBeGreaterThan(300 * DAY_MS);
      expect(ahead).toBeLessThanOrEqual(400 * DAY_MS);
    },
  },
  {
    name: 'задержка 1 день',
    periods: [p('a', '2026-09-24', '2026-09-28')],
    today: '2026-10-23',
    settings: S,
    kinds: ['missed-period'],
    check: (r) => expect(r.map((x) => x.id)).toEqual(['missed-period:2026-10-24']),
  },
  { name: 'сдвиг овуляции +5', periods: usual, today: '2026-10-23', settings: { ...S, ovulationShiftEnabled: true, ovulationShift: 5 }, kinds: ALL },
  {
    name: 'овуляция от следующей менструации, сдвиг −5',
    periods: usual,
    today: '2026-10-23',
    settings: { ...S, ovulationFromNextPeriod: true, ovulationShiftEnabled: true, ovulationShift: -5 },
    kinds: ALL,
  },
  {
    name: 'только о месячных',
    periods: usual,
    today: '2026-10-23',
    settings: { ...S, remindPeriod: true, remindOvulation: false, remindMissedPeriod: false },
    kinds: ['period'],
  },
  {
    name: 'только об овуляции',
    periods: usual,
    today: '2026-10-23',
    settings: { ...S, remindPeriod: false, remindOvulation: true, remindMissedPeriod: false },
    kinds: ['ovulation'],
  },
  {
    name: 'только о неотмеченном начале',
    periods: usual,
    today: '2026-10-23',
    settings: { ...S, remindPeriod: false, remindOvulation: false, remindMissedPeriod: true },
    kinds: ['missed-period'],
  },
  {
    name: 'все выключены',
    periods: usual,
    today: '2026-10-23',
    settings: { ...S, remindPeriod: false, remindOvulation: false, remindMissedPeriod: false },
    kinds: [],
  },
  { name: 'нет месячных', periods: [], today: '2026-10-23', settings: S, kinds: [] },
];

const ZONES = ['UTC', 'Europe/Moscow', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
// Типов Node в пакете воркера нет; тесты идут в Node, где смена TZ действует сразу.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const originalTZ = env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete env.TZ;
  else env.TZ = originalTZ;
});

describe.each(ZONES)('расписание приложения принимает воркер — %s', (zone) => {
  beforeEach(() => {
    env.TZ = zone;
  });

  it.each(CASES)('$name', async (c) => {
    const now = nowOf(c.today);
    const reminders = schedule(c.periods, c.settings, now);
    const body = bodyOf(reminders);

    const res = await handleRequest(putRequest(uuid(1), body), await makeEnv(new MemoryKV()), now.getTime());
    expect(res.status).toBe(204);
    expect(validatePutBody(JSON.parse(JSON.stringify(body)), now.getTime())?.reminders).toEqual(reminders);
    expect(new Set(reminders.map((r) => kindOf(r.id)))).toEqual(new Set(c.kinds));
    expect(reminders.length).toBeLessThanOrEqual(MAX_REMINDERS);
    c.check?.(reminders, now);
  });
});

describe('ограничения домена и воркера совпадают', () => {
  it('предел числа напоминаний домена равен пределу воркера', () => {
    const now = nowOf('2026-10-23');
    const r = schedule(usual, S, now)[0]!;
    const sub = subscription();
    expect(validatePutBody({ subscription: sub, reminders: Array(MAX_REMINDERS).fill(r) }, now.getTime())).not.toBeNull();
    expect(validatePutBody({ subscription: sub, reminders: Array(MAX_REMINDERS + 1).fill(r) }, now.getTime())).toBeNull();
  });
});

describe('уведомление воркера', () => {
  beforeEach(() => {
    vi.mocked(sendPush).mockClear();
  });

  it('рассылка отправляет payload { title, body, id } каждого наступившего напоминания', async () => {
    const now = nowOf('2026-10-23');
    const reminders = schedule(usual, S, now);
    const env = await makeEnv(new MemoryKV());
    expect((await handleRequest(putRequest(uuid(1), bodyOf(reminders)), env, now.getTime())).status).toBe(204);

    // Момент, к которому наступило хотя бы одно напоминание каждого вида.
    const at = Math.max(...ALL.map((k) => Date.parse(reminders.find((r) => kindOf(r.id) === k)!.sendAt)));
    await runSchedule(env, at, vi.fn());

    const due = reminders.filter((r) => Date.parse(r.sendAt) <= at);
    expect(new Set(due.map((r) => kindOf(r.id)))).toEqual(new Set(ALL));
    const payloads = vi.mocked(sendPush).mock.calls.map((call) => call[1]);
    expect(payloads).toStrictEqual(due.map((r) => ({ title: r.title, body: r.body, id: r.id })));

    // Service worker приложения показывает каждое с заголовком и текстом напоминания, метка — его id.
    const shown = payloads.map((payload) => {
      const wire = JSON.stringify(payload);
      return notificationFromPush({ json: () => JSON.parse(wire), text: () => wire });
    });
    expect(shown).toStrictEqual(due.map((r) => ({ title: r.title, body: r.body, tag: r.id })));
  });

  it('тестовое уведомление service worker показывает с текстами сервера', () => {
    const wire = JSON.stringify(TEST_NOTIFICATION);
    expect(notificationFromPush({ json: () => JSON.parse(wire), text: () => wire })).toStrictEqual({
      title: 'Календарь цикла',
      body: 'Уведомления работают',
      tag: 'test',
    });
  });
});

describe('слои', () => {
  it('рабочий код воркера не импортирует код приложения', async () => {
    // Типов Node в пакете воркера нет: модуль подключается по вычисляемому имени, тип задан вручную.
    const NODE_FS = 'node:fs';
    const fs = (await import(/* @vite-ignore */ NODE_FS)) as {
      readdirSync(path: URL): string[];
      readFileSync(path: URL, encoding: 'utf8'): string;
    };
    const dir = new URL('../src/', (import.meta as unknown as { url: string }).url);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = fs.readFileSync(new URL(f, dir), 'utf8');
      expect(src, f).not.toMatch(/from\s+['"]\.\.\//);
      expect(src, f).not.toMatch(/import\(\s*['"]\.\.\//);
    }
  });
});
