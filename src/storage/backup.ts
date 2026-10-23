import { normalizeDayEntry } from '../domain/dayEntry';
import { normalizePeriods, periodEnd } from '../domain/periods';
import { diffDays, isLocalDate, toLocalDate } from '../domain/dates';
import {
  CYCLE_LENGTH_RANGE,
  MAX_PERIOD_DAYS,
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

function parseDays(input: unknown): DayEntry[] | string {
  if (!Array.isArray(input)) return 'нет списка записей дней';
  const out: DayEntry[] = [];
  const dates = new Set<string>();
  for (const raw of input) {
    const r = normalizeDayEntry(raw);
    if (!r.ok) return r.error;
    if (dates.has(r.value.date)) return `повторная запись дня: ${r.value.date}`;
    dates.add(r.value.date);
    out.push(r.value);
  }
  return out;
}

function parseSettings(input: unknown): Settings | string {
  if (!isObject(input)) return 'нет настроек';
  const { defaultCycleLength, defaultPeriodLength, remindPeriod, remindOvulation } = input;
  if (!isIntIn(defaultCycleLength, CYCLE_LENGTH_RANGE)) return 'длина цикла вне 21…45';
  if (!isIntIn(defaultPeriodLength, PERIOD_LENGTH_RANGE)) return 'длина месячных вне 2…10';
  if (typeof remindPeriod !== 'boolean' || typeof remindOvulation !== 'boolean') return 'некорректные настройки напоминаний';
  return {
    defaultCycleLength: defaultCycleLength as number,
    defaultPeriodLength: defaultPeriodLength as number,
    remindPeriod,
    remindOvulation,
  };
}

/** Проверяет файл целиком; при любой ошибке данные не меняются (FR-030). */
export function parseBackup(text: string): { ok: true; value: ParsedBackup } | { ok: false; error: string } {
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

  const settings = parseSettings(data.settings);
  if (typeof settings === 'string') return { ok: false, error: corrupted(settings) };
  const parsed = parsePeriods(data.periods);
  if (typeof parsed === 'string') return { ok: false, error: corrupted(parsed) };
  const periods = mergeImported(parsed, settings.defaultPeriodLength);
  if (typeof periods === 'string') return { ok: false, error: corrupted(periods) };
  const days = parseDays(data.days);
  if (typeof days === 'string') return { ok: false, error: corrupted(days) };

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
