import { isIntensity, isMoodId, isSymptomId, LEGACY_MOOD_CODES, MOODS, SYMPTOMS } from './catalog';
import { isLocalDate } from './dates';
import { MAX_NOTE_LENGTH, type DayEntry, type Intensity, type LocalDate, type MoodId, type SymptomId } from './types';

// Запись дня v6 (фича 009) — specs/009-day-marks/contracts/day-entry.md.
// Мягкий разбор: всё непонятное становится пустым, функция никогда не бросает исключение.

export const emptyDayEntry = (date: LocalDate): DayEntry => ({
  date,
  symptoms: [],
  intensity: {},
  moods: [],
  sex: false,
  note: '',
});

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Известные коды без повторов, в порядке справочника. */
function pick<T extends string>(catalog: ReadonlyArray<{ id: T }>, wanted: ReadonlySet<string>): T[] {
  return catalog.filter((item) => wanted.has(item.id)).map((item) => item.id);
}

function coerceSymptoms(raw: unknown): SymptomId[] {
  if (!Array.isArray(raw)) return [];
  return pick(SYMPTOMS, new Set(raw.filter(isSymptomId)));
}

function coerceIntensity(raw: unknown, symptoms: SymptomId[]): Partial<Record<SymptomId, Intensity>> {
  if (!isRecord(raw)) return {};
  const out: Partial<Record<SymptomId, Intensity>> = {};
  for (const id of symptoms) {
    const value = raw[id];
    if (isIntensity(value)) out[id] = value;
  }
  return out;
}

/** Код настроения v1–v9 → код справочника или null. */
function moodCode(raw: unknown): MoodId | null {
  if (isMoodId(raw)) return raw;
  if (typeof raw === 'string' && Object.hasOwn(LEGACY_MOOD_CODES, raw)) return LEGACY_MOOD_CODES[raw] ?? null;
  return null;
}

function coerceMoods(e: Record<string, unknown>): MoodId[] {
  // До 009 настроение было одно — поле `mood`; новое поле `moods` имеет приоритет.
  const raw = Array.isArray(e.moods) ? e.moods : [e.mood];
  const codes = new Set<string>();
  for (const value of raw) {
    const code = moodCode(value);
    if (code) codes.add(code);
  }
  return pick(MOODS, codes);
}

function coerceNote(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_NOTE_LENGTH);
}

/**
 * Приводит любое значение к корректной записи дня (009 FR-003). `null` — только если нет корректной
 * даты. Используется при переносе базы, чтении, импорте и сохранении.
 */
export function coerceDayEntry(raw: unknown): DayEntry | null {
  try {
    if (!isRecord(raw) || !isLocalDate(raw.date)) return null;
    const symptoms = coerceSymptoms(raw.symptoms);
    return {
      date: raw.date,
      symptoms,
      intensity: coerceIntensity(raw.intensity, symptoms),
      moods: coerceMoods(raw),
      sex: raw.sex === true,
      note: coerceNote(raw.note),
    };
  } catch {
    return null;
  }
}

/** Пустая запись не хранится: нет самочувствия, настроений, отметки секса и заметки. */
export const isEmptyDayEntry = (e: DayEntry) =>
  e.symptoms.length === 0 && e.moods.length === 0 && !e.sex && e.note === '';
