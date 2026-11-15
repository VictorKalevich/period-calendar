import { db } from './db';
import { coerceDayEntry, emptyDayEntry, isEmptyDayEntry } from '../domain/dayEntry';
import { effectivePeriodLength } from '../domain/forecast';
import { normalizePeriods } from '../domain/periods';
import { coerceSettings, extraSettingFields } from '../domain/settings';
import { DEFAULT_SETTINGS, type DayEntry, type LocalDate, type Period, type Settings } from '../domain/types';

/** Ключ записи настроек в `kv`; им же пишет `applyBackup` (фича 016). */
export const SETTINGS_KEY = 'settings';
const PUSH_KEY = 'push';
const DEV_MODE_KEY = 'devMode';
const FIRST_PERIOD_HINT_KEY = 'firstPeriodHintDismissed';

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

/**
 * Приводит сохранённые месячные к инварианту «нет пересекающихся и соседних» (003 FR-016).
 * Вызывается при запуске; пишет в базу, только если что-то объединилось. Чтение, расчёт и запись —
 * в одной транзакции, чтобы запись, начатая параллельно, не перемежалась с ними (фича 015).
 */
export async function normalizeStoredPeriods(today: LocalDate): Promise<boolean> {
  return db.transaction('rw', db.periods, db.kv, async () => {
    const periods = await getPeriods();
    const settings = await getSettings();
    const periodLength = effectivePeriodLength(periods, settings);
    const normalized = normalizePeriods(periods, today, periodLength);
    if (JSON.stringify(normalized) === JSON.stringify(periods)) return false;
    await savePeriods(normalized);
    return true;
  });
}

// Записи дня читаются мягко (009 FR-003/FR-004): запись старой формы или испорченная не ломает экран.
export async function getDayEntry(date: LocalDate): Promise<DayEntry | undefined> {
  return coerceDayEntry(await db.days.get(date)) ?? undefined;
}

export async function getDayEntries(): Promise<DayEntry[]> {
  const out: DayEntry[] = [];
  for (const raw of await db.days.toArray()) {
    const entry = coerceDayEntry(raw);
    if (entry) out.push(entry);
  }
  return out;
}

/**
 * Сохраняет запись дня, приведённую мягким разбором (009 FR-003): непонятные части становятся
 * пустыми. Пустая запись удаляется. Исключение — только если нет корректной даты.
 */
export async function saveDayEntry(entry: DayEntry): Promise<void> {
  const value = coerceDayEntry(entry);
  if (!value) throw new Error(`Invalid day entry date: ${String(entry?.date)}`);
  if (isEmptyDayEntry(value)) {
    await db.days.delete(value.date);
    return;
  }
  await db.days.put(value);
}

/** Изменение записи дня: только изменённые поля; дата задаётся отдельно (фича 015). */
export type DayEntryPatch = Partial<Omit<DayEntry, 'date'>>;

/**
 * Меняет поля записи дня поверх актуально сохранённой (в одной транзакции), чтобы одновременные
 * сохранения не затирали друг друга, а изменение не попадало в другой день (по образцу `updateSettings`).
 * Приведение и удаление пустой записи — как в `saveDayEntry`.
 */
export async function updateDayEntry(date: LocalDate, patch: DayEntryPatch): Promise<void> {
  await db.transaction('rw', db.days, async () => {
    const current = (await getDayEntry(date)) ?? emptyDayEntry(date);
    await saveDayEntry({ ...current, ...patch, date });
  });
}

/**
 * Настройки читаются по правилам домена (фича 016): некорректное или отсутствующее поле — значение по
 * умолчанию. Неизвестные поля записи сохраняются после известных, чтобы не потеряться при `updateSettings`,
 * который пишет запись целиком.
 */
export async function getSettings(): Promise<Settings> {
  const raw = (await db.kv.get(SETTINGS_KEY))?.value;
  return { ...coerceSettings(raw, DEFAULT_SETTINGS), ...extraSettingFields(raw) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await db.kv.put({ key: SETTINGS_KEY, value: settings });
}

/**
 * Меняет часть настроек поверх актуально сохранённых (в одной транзакции), чтобы быстрые
 * переключения подряд не затирали друг друга.
 */
export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const current = await getSettings();
    await db.kv.put({ key: SETTINGS_KEY, value: { ...current, ...patch } });
  });
}

/** Скрытый режим разработчика — только на устройстве, в резервную копию не входит (002 FR-003). */
export async function getDevMode(): Promise<boolean> {
  return (await db.kv.get(DEV_MODE_KEY))?.value === true;
}

export async function setDevMode(on: boolean): Promise<void> {
  await db.kv.put({ key: DEV_MODE_KEY, value: on });
}

/** Подсказка «отметьте последние месячные» закрыта — только на устройстве, не в резервной копии (010 FR-005). */
export async function getFirstPeriodHintDismissed(): Promise<boolean> {
  return (await db.kv.get(FIRST_PERIOD_HINT_KEY))?.value === true;
}

export async function dismissFirstPeriodHint(): Promise<void> {
  await db.kv.put({ key: FIRST_PERIOD_HINT_KEY, value: true });
}

export async function getPushState(): Promise<PushState | undefined> {
  return (await db.kv.get(PUSH_KEY))?.value as PushState | undefined;
}

export async function savePushState(state: PushState): Promise<void> {
  await db.kv.put({ key: PUSH_KEY, value: state });
}

/** Изменение состояния push: идентификатор клиента и токен им не меняются (фича 018). */
export type PushStatePatch = Partial<Omit<PushState, 'clientId' | 'token'>>;
export type PushIdentity = Pick<PushState, 'clientId' | 'token'>;

/**
 * Меняет поля состояния push поверх актуально сохранённого (в одной транзакции, по образцу `updateSettings`),
 * чтобы запись после сетевого запроса не возвращала устаревший снимок — например, не включала обратно
 * напоминания, выключенные во время синхронизации. Состояния нет — создаётся из `identity`, если он передан
 * (у одновременных созданий остаётся первая идентичность), иначе ничего не пишется.
 */
export async function updatePushState(patch: PushStatePatch, identity?: PushIdentity): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const current = await getPushState();
    const base = current ?? (identity && { ...identity, subscribed: false, pendingSync: false, lastSyncedHash: null });
    if (!base) return;
    await db.kv.put({ key: PUSH_KEY, value: { ...base, ...patch } });
  });
}
