import { liveQuery } from 'dexie';
import { toLocalDate } from '../domain/dates';
import { buildForecast } from '../domain/forecast';
import { planReminders, toServerReminders } from '../domain/reminders';
import { db } from '../storage/db';
import { getPeriods, getPushState, getSettings, savePushState } from '../storage/repository';
import { clientUrl, currentSubscription, isPushConfigured } from './subscribe';

// Синхронизация расписания с воркером (research.md R10): полный идемпотентный PUT после любых
// изменений (debounce 2 с), при запуске и при появлении сети. Без сети — pendingSync.

const DEBOUNCE_MS = 2000;

async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let running: Promise<void> | null = null;

export function syncReminders(): Promise<void> {
  running ??= doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<void> {
  if (!isPushConfigured()) return;
  const state = await getPushState();
  if (!state?.subscribed) return;
  const subscription = await currentSubscription();
  if (!subscription) {
    await savePushState({ ...state, subscribed: false });
    return;
  }

  const now = new Date();
  const [periods, settings] = await Promise.all([getPeriods(), getSettings()]);
  const forecast = buildForecast({ periods, settings, today: toLocalDate(now) });
  const reminders = forecast ? toServerReminders(planReminders(forecast, settings, now)) : [];
  const body = JSON.stringify({ subscription: subscription.toJSON(), reminders });
  const hash = await sha256(body);
  if (hash === state.lastSyncedHash && !state.pendingSync) return;

  try {
    const res = await fetch(clientUrl(state), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${state.token}`, 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`push api ${res.status}`);
    await savePushState({ ...state, pendingSync: false, lastSyncedHash: hash });
  } catch {
    await savePushState({ ...state, pendingSync: true });
  }
}

/** Запускает фоновую синхронизацию: при старте, при изменениях данных и при появлении сети. */
export function startReminderSync(): void {
  if (!isPushConfigured()) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncReminders(), DEBOUNCE_MS);
  };
  liveQuery(() => Promise.all([db.periods.toArray(), db.kv.get('settings')])).subscribe({ next: schedule });
  window.addEventListener('online', () => void syncReminders());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncReminders();
  });
}
