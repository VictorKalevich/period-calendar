import { liveQuery } from 'dexie';
import { getPeriods, getPushState, getSettings, updatePushState } from '../storage/repository';
import { clientUrl, currentSubscription, isPushConfigured } from './subscribe';
import { createSyncRunner, syncPass, type SyncDeps } from './syncCore';

// Синхронизация расписания с воркером (research.md R10): полный идемпотентный PUT после любых
// изменений (debounce 2 с), при запуске и при появлении сети. Без сети — pendingSync.
// Правила прохода и повторный проход — `syncCore.ts` (фича 018); здесь — подключение к браузеру и базе.

const DEBOUNCE_MS = 2000;

const deps: SyncDeps = {
  isConfigured: isPushConfigured,
  getState: getPushState,
  updateState: (patch) => updatePushState(patch),
  getSubscription: currentSubscription,
  loadData: async () => {
    const [periods, settings] = await Promise.all([getPeriods(), getSettings()]);
    return { periods, settings };
  },
  send: (url, init) => fetch(url, init),
  url: clientUrl,
  now: () => new Date(),
};

/** Синхронизация; запрос во время идущей — ещё один проход после неё. */
export const syncReminders = createSyncRunner(() => syncPass(deps));

/** Данные, от которых зависит расписание: их изменение запускает синхронизацию. */
export const reminderDataQuery = () => Promise.all([getPeriods(), getSettings()]);

/** Запускает фоновую синхронизацию: при старте, при изменениях данных и при появлении сети. */
export function startReminderSync(): void {
  if (!isPushConfigured()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncReminders(), DEBOUNCE_MS);
  };
  liveQuery(reminderDataQuery).subscribe({ next: schedule });
  window.addEventListener('online', () => void syncReminders());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncReminders();
  });
}
