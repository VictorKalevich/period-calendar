import { coerceDayEntry } from '../domain/dayEntry';
import { toLocalDate } from '../domain/dates';
import { isObject } from '../domain/guards';
import { validatePeriods, type PeriodValidationError } from '../domain/periodValidation';
import { coerceSettings } from '../domain/settings';
import { DEFAULT_SETTINGS, type DayEntry, type Period, type Settings } from '../domain/types';
import { db, SCHEMA_VERSION } from './db';
import { migrateData } from './migrations';
import { getDayEntries, getPeriods, getSettings, SETTINGS_KEY } from './repository';

// Формат резервной копии — contracts/backup-format.md. PushState (токен) в файл не попадает.

export const BACKUP_FORMAT = 'cycle-calendar-backup';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  data: { periods: Period[]; days: DayEntry[]; settings: Settings };
}

export interface ParsedBackup {
  periods: Period[];
  days: DayEntry[];
  settings: Settings;
  summary: { periods: number; days: number };
}

const NOT_A_BACKUP = 'Это не резервная копия Календаря цикла';
const TOO_NEW = 'Резервная копия создана более новой версией приложения. Обновите приложение';
const corrupted = (detail: string) => `Файл резервной копии повреждён: ${detail}`;

export async function buildBackup(now: Date = new Date()): Promise<BackupFile> {
  const [periods, days, settings] = await Promise.all([getPeriods(), getDayEntries(), getSettings()]);
  return { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data: { periods, days, settings } };
}

export async function exportBackup(now: Date = new Date()): Promise<File> {
  const json = JSON.stringify(await buildBackup(now), null, 2);
  return new File([json], `cycle-calendar-${toLocalDate(now)}.json`, { type: 'application/json' });
}

/** Текст ошибки проверки месячных (правила — `validatePeriods` в домене). */
function periodErrorText(e: PeriodValidationError): string {
  switch (e.code) {
    case 'not-a-list':
      return 'нет списка месячных';
    case 'not-an-object':
      return 'запись месячных не объект';
    case 'invalid-id':
    case 'duplicate-id':
      return `некорректный или повторный id: ${String(e.id)}`;
    case 'invalid-start':
      return `некорректная дата начала: ${String(e.start)}`;
    case 'invalid-end':
      return `некорректная дата конца: ${String(e.end)}`;
    case 'invalid-end-estimated':
      return 'нет признака endEstimated';
    case 'end-before-start':
      return `конец раньше начала: ${e.start}`;
    case 'too-long':
      return `месячные длиннее ${e.maxDays} дней: ${e.start}`;
    case 'overlap':
      return `месячные пересекаются: ${e.first} и ${e.second}`;
  }
}

/**
 * Записи дней импортируются мягко (009 FR-005): каждая — через coerceDayEntry, запись без корректной
 * даты пропускается, при повторе даты берётся первая. Нет списка — записей нет.
 */
function parseDays(input: unknown): DayEntry[] {
  if (!Array.isArray(input)) return [];
  const out: DayEntry[] = [];
  const dates = new Set<string>();
  for (const raw of input) {
    const entry = coerceDayEntry(raw);
    if (!entry || dates.has(entry.date)) continue;
    dates.add(entry.date);
    out.push(entry);
  }
  return out;
}

/**
 * Проверяет файл; данные устройства не меняются до applyBackup (FR-030). Месячные — строго: при ошибке
 * импорт отклоняется. Записи дней — мягко, настройки — с запасом из `current` (009 FR-005). Правила
 * корректности — в домене (фича 016). Любая непредвиденная ошибка перехватывается (009 FR-006).
 */
export function parseBackup(
  text: string,
  current: Settings = DEFAULT_SETTINGS,
): { ok: true; value: ParsedBackup } | { ok: false; error: string } {
  try {
    return parseBackupUnsafe(text, current);
  } catch (e) {
    return { ok: false, error: corrupted(e instanceof Error ? e.message : String(e)) };
  }
}

function parseBackupUnsafe(text: string, current: Settings): { ok: true; value: ParsedBackup } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_A_BACKUP };
  }
  if (!isObject(json) || json.format !== BACKUP_FORMAT) return { ok: false, error: NOT_A_BACKUP };
  const version = json.schemaVersion;
  if (!Number.isInteger(version) || (version as number) < 1) return { ok: false, error: corrupted('нет версии схемы') };
  if ((version as number) > SCHEMA_VERSION) return { ok: false, error: TOO_NEW };
  if (!isObject(json.data)) return { ok: false, error: corrupted('нет данных') };

  let data: Record<string, unknown>;
  try {
    data = migrateData(json.data, version as number, SCHEMA_VERSION);
  } catch (e) {
    return { ok: false, error: corrupted((e as Error).message) };
  }

  // Старые копии получают недостающие поля настроек миграциями (migrations[1…5]); для оценки незакрытых
  // месячных при объединении — длина по умолчанию из файла.
  const settings = coerceSettings(data.settings, current);
  const checked = validatePeriods(data.periods, toLocalDate(new Date()), settings.defaultPeriodLength);
  if (!checked.ok) return { ok: false, error: corrupted(periodErrorText(checked.error)) };
  const periods = checked.value;
  const days = parseDays(data.days);

  return { ok: true, value: { periods, days, settings, summary: { periods: periods.length, days: days.length } } };
}

/** Заменяет месячные, записи дней и настройки одной транзакцией. Состояние push не меняется. */
export async function applyBackup(b: ParsedBackup): Promise<void> {
  await db.transaction('rw', db.periods, db.days, db.kv, async () => {
    await db.periods.clear();
    await db.days.clear();
    await db.periods.bulkPut(b.periods);
    await db.days.bulkPut(b.days);
    await db.kv.put({ key: SETTINGS_KEY, value: b.settings });
  });
}
