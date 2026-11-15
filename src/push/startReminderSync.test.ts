import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Фича 018 (FR-014): фоновая синхронизация запускается как раньше — через 2 с после изменения данных
// (в том числе первого значения подписки при старте), сразу при появлении сети и при возврате в
// приложение. Характеризация: зелёная до и после правок `sync.ts`. Отдельный файл: подписку
// `startReminderSync` не отменить, она не должна попасть в другие тесты.

const h = vi.hoisted(() => {
  vi.stubEnv('VITE_PUSH_API_URL', 'https://push.example/');
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BCUejqVmnkm5H6gRhzCwIhY3DQD6_WQzvdtr2TfxrCUFsEsWD7TbTZk3iJ-iriHJGmI5mA-rQopAJzr5Vpns71A');
  return { onData: undefined as (() => void) | undefined };
});

vi.mock('dexie', async (importOriginal) => ({
  ...(await importOriginal<typeof import('dexie')>()),
  liveQuery: vi.fn(() => ({
    subscribe: ({ next }: { next: () => void }) => {
      h.onData = next;
      return { unsubscribe() {} };
    },
  })),
}));

// Каждый проход синхронизации читает состояние push ровно один раз; состояния нет — проход сразу
// заканчивается. По числу чтений считаются проходы.
vi.mock('../storage/repository', () => ({
  getPushState: vi.fn(async () => undefined),
  getPeriods: vi.fn(async () => []),
  getSettings: vi.fn(async () => ({})),
  savePushState: vi.fn(async () => {}),
  updatePushState: vi.fn(async () => {}),
}));

import { liveQuery } from 'dexie';
import { getPushState } from '../storage/repository';
import { reminderDataQuery, startReminderSync } from './sync';

const windowStub = { addEventListener: vi.fn() };
const documentStub = { visibilityState: 'visible', addEventListener: vi.fn() };
const passes = () => vi.mocked(getPushState).mock.calls.length;
/** Дождаться конца начатых проходов: `setImmediate` не подменён и идёт после всех микрозадач. */
const flush = () => new Promise((resolve) => setImmediate(resolve));
const handler = (target: typeof windowStub, type: string) =>
  target.addEventListener.mock.calls.find((call) => call[0] === type)?.[1] as (() => void) | undefined;

// Vitest 5 очищает историю вызовов подмен перед каждым тестом (`clearMocks: true` по умолчанию) —
// вызовы из `startReminderSync` запоминаются сразу.
let started: { queries: unknown[]; online?: () => void; visibility?: () => void };

beforeAll(() => {
  vi.stubGlobal('window', windowStub);
  vi.stubGlobal('document', documentStub);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  startReminderSync();
  started = {
    queries: vi.mocked(liveQuery).mock.calls.map((call) => call[0]),
    online: handler(windowStub, 'online'),
    visibility: handler(documentStub, 'visibilitychange'),
  };
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  await flush();
  vi.mocked(getPushState).mockClear();
  documentStub.visibilityState = 'visible';
});

describe('startReminderSync — триггеры как раньше', () => {
  it('подписывается на данные расписания и на события «онлайн» и возврата в приложение', () => {
    expect(started.queries).toEqual([reminderDataQuery]);
    expect(started.online).toBeTypeOf('function');
    expect(started.visibility).toBeTypeOf('function');
  });

  it('изменение данных — проход через 2 с', async () => {
    h.onData!();
    await vi.advanceTimersByTimeAsync(1999);
    await flush();
    expect(passes()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(passes()).toBe(1);
  });

  it('изменения подряд — один проход через 2 с после последнего', async () => {
    h.onData!();
    await vi.advanceTimersByTimeAsync(1000);
    h.onData!();
    await vi.advanceTimersByTimeAsync(1000);
    h.onData!();
    await vi.advanceTimersByTimeAsync(1999);
    await flush();
    expect(passes()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(passes()).toBe(1);
  });

  it('появилась сеть — проход сразу', async () => {
    started.online!();
    await flush();
    expect(passes()).toBe(1);
  });

  it('возврат в приложение — проход, только если оно видно', async () => {
    const onVisibility = started.visibility!;
    documentStub.visibilityState = 'hidden';
    onVisibility();
    await flush();
    expect(passes()).toBe(0);
    documentStub.visibilityState = 'visible';
    onVisibility();
    await flush();
    expect(passes()).toBe(1);
  });
});
