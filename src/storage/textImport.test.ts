import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { getDayEntries, getPeriods, getSettings, saveDayEntry, savePeriods, saveSettings } from './repository';
import { applyTextImport, looksLikeCycleText, planTextImport } from './textImport';
import { DEFAULT_SETTINGS, type LocalDate } from '../domain/types';

const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-11-09');

const FILE = [
  'cycle 0',
  'Period start date: 2025-01-05 00:00:00.0',
  'Period end date: 2025-01-09 00:00:00.0',
  'Pregnant: False',
  '---------------',
  'cycle 1',
  'Period start date: 2025-01-05 00:00:00.0',
  'Period end date: 2025-01-13 00:00:00.0',
  '---------------',
  'cycle 2',
  'Period start date: 2025-02-01 20:00:00.0',
  'Period end date: 2025-02-05 20:00:00.0',
  '---------------',
  'manual events ',
  '0 - 2018-01-06 20:00:00 - 2018-01-06 20:00:00 - Symptom - Fatigue - ',
].join('\n');

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('text import', () => {
  it('detects the text format', () => {
    expect(looksLikeCycleText(FILE)).toBe(true);
    expect(looksLikeCycleText('{"format":"cycle-calendar-backup"}')).toBe(false);
  });

  it('adds periods, file wins on overlap, other data untouched', async () => {
    await savePeriods([
      { id: 'old', start: ld('2025-01-03'), end: ld('2025-01-07'), endEstimated: false },
      { id: 'keep', start: ld('2025-03-01'), end: ld('2025-03-05'), endEstimated: false },
    ]);
    await saveDayEntry({ date: ld('2025-01-06'), symptoms: ['cramps'], mood: null, note: 'note' });
    await saveSettings({ ...DEFAULT_SETTINGS, defaultCycleLength: 30 });

    const plan = await planTextImport(FILE, TODAY);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value).toMatchObject({ found: 3, first: '2025-01-05', last: '2025-02-05', skipped: 0, added: 2, replaced: 1 });
    // До подтверждения ничего не меняется.
    expect(await getPeriods()).toHaveLength(2);

    await applyTextImport(plan.value);
    expect((await getPeriods()).map((p) => [p.start, p.end])).toEqual([
      ['2025-01-05', '2025-01-13'],
      ['2025-02-01', '2025-02-05'],
      ['2025-03-01', '2025-03-05'],
    ]);
    expect(await getDayEntries()).toHaveLength(1);
    expect((await getSettings()).defaultCycleLength).toBe(30);
  });

  it('second import of the same file changes nothing', async () => {
    const first = await planTextImport(FILE, TODAY);
    if (!first.ok) throw new Error(first.error);
    await applyTextImport(first.value);
    const before = await getPeriods();
    const second = await planTextImport(FILE, TODAY);
    if (!second.ok) throw new Error(second.error);
    expect(second.value).toMatchObject({ added: 0, replaced: 0, unchanged: 2 });
    await applyTextImport(second.value);
    expect(await getPeriods()).toEqual(before);
  });

  it('reports unknown files', async () => {
    expect(await planTextImport('hello', TODAY)).toEqual({ ok: false, error: 'Файл не распознан' });
  });
});
