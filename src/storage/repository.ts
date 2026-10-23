import { db } from './db';
import { DEFAULT_SETTINGS, type DayEntry, type LocalDate, type Period, type Settings } from '../domain/types';

const SETTINGS_KEY = 'settings';
const PUSH_KEY = 'push';

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

/** Сохраняет запись дня; пустая запись удаляется. */
export async function saveDayEntry(entry: DayEntry): Promise<void> {
  if (entry.symptoms.length === 0 && entry.mood === null && entry.note === '') {
    await db.days.delete(entry.date);
    return;
  }
  await db.days.put(entry);
}

export async function getSettings(): Promise<Settings> {
  const rec = await db.kv.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(rec?.value as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value: settings });
}

export async function getPushState(): Promise<PushState | undefined> {
  return (await db.kv.get(PUSH_KEY))?.value as PushState | undefined;
}

export async function savePushState(state: PushState): Promise<void> {
  await db.kv.put({ key: PUSH_KEY, value: state });
}
