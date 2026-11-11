import { coerceDayEntry } from '../domain/dayEntry';
import { normalizePeriods, periodEnd } from '../domain/periods';
import { diffDays, isLocalDate, toLocalDate } from '../domain/dates';
import {
  CYCLE_LENGTH_RANGE,
  DEFAULT_SETTINGS,
  MAX_PERIOD_DAYS,
  OVULATION_SHIFT_RANGE,
  PERIOD_LENGTH_RANGE,
  type DayEntry,
  type Period,
  type Settings,
} from '../domain/types';
import { db, SCHEMA_VERSION } from './db';
import { migrateData } from './migrations';
import { getDayEntries, getPeriods, getSettings } from './repository';

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

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIntIn = (v: unknown, r: { min: number; max: number }) => Number.isInteger(v) && (v as number) >= r.min && (v as number) <= r.max;

function parsePeriods(input: unknown): Period[] | string {
  if (!Array.isArray(input)) return 'нет списка месячных';
  const out: Period[] = [];
  const ids = new Set<string>();
  for (const raw of input) {
    if (!isObject(raw)) return 'запись месячных не объект';
    const { id, start, end, endEstimated } = raw;
    if (typeof id !== 'string' || id === '' || ids.has(id)) return `некорректный или повторный id: ${String(id)}`;
    if (!isLocalDate(start)) return `некорректная дата начала: ${String(start)}`;
    if (end !== null && !isLocalDate(end)) return `некорректная дата конца: ${String(end)}`;
    if (typeof endEstimated !== 'boolean') return 'нет признака endEstimated';
    if (end !== null && end < start) return `конец раньше начала: ${start}`;
    if (end !== null && diffDays(end, start) + 1 > MAX_PERIOD_DAYS) return `месячные длиннее ${MAX_PERIOD_DAYS} дней: ${start}`;
    ids.add(id);
    out.push({ id, start, end, endEstimated });
  }
  return out;
}

/**
 * Импорт объединяет пересекающиеся и соседние месячные (003 FR-015); для оценки незакрытых —
 * длина по умолчанию из файла. Пересечения, которые нельзя объединить (> 15 дней), — ошибка.
 */
function mergeImported(periods: Period[], periodLength: number): Period[] | string {
  const out = normalizePeriods(periods, toLocalDate(new Date()), periodLength);
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!;
    if (periodEnd(prev, periodLength) >= out[i]!.start) return `месячные пересекаются: ${prev.start} и ${out[i]!.start}`;
  }
  return out;
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

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Правила полей настроек; старые копии получают недостающие поля миграциями (migrations[1…5]). */
const SETTING_RULES: { readonly [K in keyof Settings]: (v: unknown) => boolean } = {
  defaultCycleLength: (v) => isIntIn(v, CYCLE_LENGTH_RANGE),
  defaultPeriodLength: (v) => isIntIn(v, PERIOD_LENGTH_RANGE),
  remindPeriod: isBool,
  remindOvulation: isBool,
  showWellbeing: isBool,
  showNotes: isBool,
  ovulationShiftEnabled: isBool,
  ovulationShift: (v) => isIntIn(v, OVULATION_SHIFT_RANGE),
  ovulationFromNextPeriod: isBool,
  remindMissedPeriod: isBool,
  showMood: isBool,
  showIntensity: isBool,
  showSex: isBool,
};

/** Каждое поле проверяется отдельно; некорректное или отсутствующее — значение устройства (009 FR-005). */
function parseSettings(input: unknown, current: Settings): Settings {
  const out: Record<string, unknown> = { ...current };
  if (!isObject(input)) return current;
  for (const key of Object.keys(SETTING_RULES) as Array<keyof Settings>) {
    if (SETTING_RULES[key](input[key])) out[key] = input[key];
  }
  return out as unknown as Settings;
}

/**
 * Проверяет файл; данные устройства не меняются до applyBackup (FR-030). Месячные — строго: при ошибке
 * импорт отклоняется. Записи дней — мягко, настройки — с запасом из `current` (009 FR-005). Любая
 * непредвиденная ошибка перехватывается (009 FR-006).
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

  const settings = parseSettings(data.settings, current);
  const parsed = parsePeriods(data.periods);
  if (typeof parsed === 'string') return { ok: false, error: corrupted(parsed) };
  const periods = mergeImported(parsed, settings.defaultPeriodLength);
  if (typeof periods === 'string') return { ok: false, error: corrupted(periods) };
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
    await db.kv.put({ key: 'settings', value: b.settings });
  });
}
