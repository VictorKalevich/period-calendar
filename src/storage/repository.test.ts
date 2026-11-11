import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  getDayEntries,
  getDayEntry,
  getDevMode,
  getPeriods,
  normalizeStoredPeriods,
  saveDayEntry,
  savePeriods,
  setDevMode,
} from './repository';
import { emptyDayEntry } from '../domain/dayEntry';
import type { DayEntry, LocalDate, MoodId, SymptomId } from '../domain/types';

const date = '2026-10-23' as LocalDate;
const entry = (over: Partial<DayEntry>): DayEntry => ({ ...emptyDayEntry(date), ...over });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('saveDayEntry', () => {
  it('stores symptoms, intensity, moods, sex and note', async () => {
    const e = entry({ symptoms: ['cramps', 'fatigue'], intensity: { cramps: 'severe' }, moods: ['calm', 'anxious'], sex: true, note: 'устала' });
    await saveDayEntry(e);
    expect(await getDayEntry(date)).toEqual(e);
  });

  it('dedupes symptoms', async () => {
    await saveDayEntry(entry({ symptoms: ['cramps', 'cramps', 'acne'] }));
    expect((await getDayEntry(date))!.symptoms).toEqual(['cramps', 'acne']);
  });

  it('drops unknown symptom and mood codes instead of failing (009 FR-003)', async () => {
    await saveDayEntry(entry({ symptoms: ['sneezing' as SymptomId, 'acne'], moods: ['great' as MoodId, 'nope' as MoodId] }));
    expect(await getDayEntry(date)).toEqual(entry({ symptoms: ['acne'], moods: ['joyful'] }));
  });

  it('reads an old-shape or damaged record softly (009 FR-004)', async () => {
    await db.days.put({ date, symptoms: ['acne', 'x'], mood: 'great', note: 5 } as unknown as DayEntry);
    expect(await getDayEntry(date)).toEqual(entry({ symptoms: ['acne'], moods: ['joyful'] }));
    expect(await getDayEntries()).toEqual([entry({ symptoms: ['acne'], moods: ['joyful'] })]);
  });

  it('rejects only an entry without a valid date', async () => {
    await expect(saveDayEntry(entry({ date: '2026-02-30' as LocalDate }))).rejects.toThrow();
  });

  it('trims the note', async () => {
    await saveDayEntry(entry({ note: '  привет \n' }));
    expect((await getDayEntry(date))!.note).toBe('привет');
  });

  it('accepts 1000 characters and truncates a longer note to 1000 (009)', async () => {
    await saveDayEntry(entry({ note: 'я'.repeat(1000) }));
    expect((await getDayEntry(date))!.note).toHaveLength(1000);
    await saveDayEntry(entry({ note: 'ю'.repeat(1001) }));
    expect((await getDayEntry(date))!.note).toBe('ю'.repeat(1000));
  });

  it('deletes the record when it becomes empty', async () => {
    await saveDayEntry(entry({ note: 'x' }));
    await saveDayEntry(entry({ note: '   ' }));
    expect(await getDayEntry(date)).toBeUndefined();
  });

  it('rejects an invalid date', async () => {
    await expect(saveDayEntry(entry({ date: '2026-02-30' as LocalDate, note: 'x' }))).rejects.toThrow();
  });
});

describe('normalizeStoredPeriods (003 FR-016)', () => {
  it('merges adjacent stored periods once and reports whether it changed anything', async () => {
    await savePeriods([
      { id: 'a', start: '2026-10-01' as LocalDate, end: '2026-10-04' as LocalDate, endEstimated: false },
      { id: 'b', start: '2026-10-05' as LocalDate, end: '2026-10-07' as LocalDate, endEstimated: false },
      { id: 'c', start: '2026-10-29' as LocalDate, end: null, endEstimated: false },
    ]);
    expect(await normalizeStoredPeriods('2026-10-30' as LocalDate)).toBe(true);
    expect(await getPeriods()).toEqual([
      { id: 'a', start: '2026-10-01', end: '2026-10-07', endEstimated: false },
      { id: 'c', start: '2026-10-29', end: null, endEstimated: false },
    ]);
    expect(await normalizeStoredPeriods('2026-10-30' as LocalDate)).toBe(false);
  });
});

describe('dev mode flag', () => {
  it('is off by default and persists when switched', async () => {
    expect(await getDevMode()).toBe(false);
    await setDevMode(true);
    expect(await getDevMode()).toBe(true);
    await setDevMode(false);
    expect(await getDevMode()).toBe(false);
  });
});
