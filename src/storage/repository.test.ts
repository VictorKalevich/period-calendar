import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  getDayEntry,
  getDevMode,
  getPeriods,
  normalizeStoredPeriods,
  saveDayEntry,
  savePeriods,
  setDevMode,
} from './repository';
import type { DayEntry, LocalDate, SymptomId } from '../domain/types';

const date = '2026-10-23' as LocalDate;
const entry = (over: Partial<DayEntry>): DayEntry => ({ date, symptoms: [], mood: null, note: '', ...over });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('saveDayEntry', () => {
  it('stores symptoms, mood and note', async () => {
    await saveDayEntry(entry({ symptoms: ['cramps', 'fatigue'], mood: 'calm', note: 'устала' }));
    expect(await getDayEntry(date)).toEqual(entry({ symptoms: ['cramps', 'fatigue'], mood: 'calm', note: 'устала' }));
  });

  it('dedupes symptoms', async () => {
    await saveDayEntry(entry({ symptoms: ['cramps', 'cramps', 'acne'] }));
    expect((await getDayEntry(date))!.symptoms).toEqual(['cramps', 'acne']);
  });

  it('rejects unknown symptom and mood ids', async () => {
    await expect(saveDayEntry(entry({ symptoms: ['sneezing' as SymptomId] }))).rejects.toThrow();
    await expect(saveDayEntry(entry({ mood: 'angry' as DayEntry['mood'] }))).rejects.toThrow();
    expect(await getDayEntry(date)).toBeUndefined();
  });

  it('trims the note', async () => {
    await saveDayEntry(entry({ note: '  привет \n' }));
    expect((await getDayEntry(date))!.note).toBe('привет');
  });

  it('accepts 1000 characters and rejects 1001', async () => {
    await saveDayEntry(entry({ note: 'я'.repeat(1000) }));
    expect((await getDayEntry(date))!.note).toHaveLength(1000);
    await expect(saveDayEntry(entry({ note: 'я'.repeat(1001) }))).rejects.toThrow();
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
