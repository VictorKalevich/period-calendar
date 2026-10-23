import { isMoodId, isSymptomId } from './catalog';
import { isLocalDate } from './dates';
import { MAX_NOTE_LENGTH, type DayEntry, type SymptomId } from './types';

/** Проверяет и нормализует запись дня (data-model.md «DayEntry»): дубли симптомов убираются, заметка обрезается. */
export function normalizeDayEntry(input: unknown): { ok: true; value: DayEntry } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, error: 'entry is not an object' };
  const e = input as Record<string, unknown>;
  if (!isLocalDate(e.date)) return { ok: false, error: `invalid date: ${String(e.date)}` };
  if (!Array.isArray(e.symptoms)) return { ok: false, error: 'symptoms must be an array' };
  const symptoms: SymptomId[] = [];
  for (const s of e.symptoms) {
    if (!isSymptomId(s)) return { ok: false, error: `unknown symptom: ${String(s)}` };
    if (!symptoms.includes(s)) symptoms.push(s);
  }
  if (e.mood !== null && !isMoodId(e.mood)) return { ok: false, error: `unknown mood: ${String(e.mood)}` };
  if (typeof e.note !== 'string') return { ok: false, error: 'note must be a string' };
  const note = e.note.trim();
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: `note longer than ${MAX_NOTE_LENGTH}` };
  return { ok: true, value: { date: e.date, symptoms, mood: e.mood, note } };
}

export const isEmptyDayEntry = (e: DayEntry) => e.symptoms.length === 0 && e.mood === null && e.note === '';
