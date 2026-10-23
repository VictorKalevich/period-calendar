import { db } from './db';
import { isEmptyDayEntry, normalizeDayEntry } from '../domain/dayEntry';
import { DEFAULT_SETTINGS, type DayEntry, type LocalDate, type Period, type Settings } from '../domain/types';

const SETTINGS_KEY = 'settings';
const PUSH_KEY = 'push';
const DEV_MODE_KEY = 'devMode';

export interface PushState {
  clientId: string;
  /** 32 байта base64url; никогда не экспортируется в резервную копию. */
  token: string;
  subscribed: boolean;
  pendingSync: boolean;
  lastSyncedHash: string | null;
}

export async function getPeriods(): Promise<Period[]> {
  return db.periods.orderBy('start').toArray();
}

/** Заменяет все месячные одной транзакцией. */
export async function savePeriods(periods: Period[]): Promise<void> {
  await db.transaction('rw', db.periods, async () => {
    await db.periods.clear();
    await db.periods.bulkPut(periods);
  });
}

export async function getDayEntry(date: LocalDate): Promise<DayEntry | undefined> {
  return db.days.get(date);
}

export async function getDayEntries(): Promise<DayEntry[]> {
  return db.days.toArray();
}

/** Проверяет и сохраняет запись дня; пустая запись удаляется. Некорректная — исключение. */
export async function saveDayEntry(entry: DayEntry): Promise<void> {
  const res = normalizeDayEntry(entry);
  if (!res.ok) throw new Error(`Invalid day entry: ${res.error}`);
  if (isEmptyDayEntry(res.value)) {
    await db.days.delete(res.value.date);
    return;
  }
  await db.days.put(res.value);
}

export async function getSettings(): Promise<Settings> {
  const rec = await db.kv.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(rec?.value as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value: settings });
}

/** Скрытый режим разработчика — только на устройстве, в резервную копию не входит (002 FR-003). */
export async function getDevMode(): Promise<boolean> {
  return (await db.kv.get(DEV_MODE_KEY))?.value === true;
}

export async function setDevMode(on: boolean): Promise<void> {
  await db.kv.put({ key: DEV_MODE_KEY, value: on });
}

export async function getPushState(): Promise<PushState | undefined> {
  return (await db.kv.get(PUSH_KEY))?.value as PushState | undefined;
}

export async function savePushState(state: PushState): Promise<void> {
  await db.kv.put({ key: PUSH_KEY, value: state });
}
