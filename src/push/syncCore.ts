import { toLocalDate } from '../domain/dates';
import { buildForecast } from '../domain/forecast';
import { planReminders, toServerReminders } from '../domain/reminders';
import type { Period, Settings } from '../domain/types';
import type { PushState, PushStatePatch } from '../storage/repository';

// Ядро синхронизации расписания с воркером (research.md R10 фичи 001; фича 018): полный идемпотентный PUT,
// без сети — «ждёт отправки». Внешние зависимости внедряются — ядро проверяется без браузера, сети и базы
// (specs/018-push-sync-contract/contracts/sync-core.md). Обвязка — `sync.ts`.

export interface SyncDeps {
  /** Push настроен в сборке (адрес воркера и VAPID-ключ). */
  isConfigured(): boolean;
  getState(): Promise<PushState | undefined>;
  /** Только изменённые поля поверх актуального состояния, неделимо. */
  updateState(patch: PushStatePatch): Promise<void>;
  /** Подписка браузера; `null` — подписки нет. */
  getSubscription(): Promise<{ toJSON(): unknown } | null>;
  loadData(): Promise<{ periods: Period[]; settings: Settings }>;
  /** Сетевой запрос; исключение — нет сети. */
  send(url: string, init: RequestInit): Promise<{ ok: boolean }>;
  url(state: PushState): string;
  now(): Date;
}

async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Один проход синхронизации. Снимок состояния, прочитанный в начале, нужен только до запроса (токен, адрес,
 * сравнение отпечатка); после ожидания сети пишутся только поля прохода поверх актуального состояния —
 * выключение напоминаний во время синхронизации не отменяется.
 */
export async function syncPass(deps: SyncDeps): Promise<void> {
  if (!deps.isConfigured()) return;
  const state = await deps.getState();
  if (!state?.subscribed) return;
  const subscription = await deps.getSubscription();
  if (!subscription) {
    await deps.updateState({ subscribed: false });
    return;
  }

  const now = deps.now();
  const { periods, settings } = await deps.loadData();
  const forecast = buildForecast({ periods, settings, today: toLocalDate(now) });
  const reminders = forecast ? toServerReminders(planReminders(forecast, settings, now)) : [];
  const body = JSON.stringify({ subscription: subscription.toJSON(), reminders });
  const hash = await sha256(body);
  if (hash === state.lastSyncedHash && !state.pendingSync) return;

  try {
    const res = await deps.send(deps.url(state), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error('push api rejected');
    await deps.updateState({ pendingSync: false, lastSyncedHash: hash });
  } catch {
    await deps.updateState({ pendingSync: true });
  }
}

const ignore = () => {};

/**
 * Запуск проходов по одному: запрос во время идущего прохода приводит к одному повторному проходу после
 * него — изменение, пришедшее во время синхронизации, уходит на сервер. Все запросы во время прохода ждут
 * этот повторный проход.
 */
export function createSyncRunner(pass: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let queued: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (!running) {
      running = pass().finally(() => {
        running = null;
      });
      return running;
    }
    queued ??= running.then(ignore, ignore).then(() => {
      queued = null;
      return run();
    });
    return queued;
  };
  return run;
}
