import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { getPeriods, normalizeStoredPeriods, savePeriods } from './repository';
import { planTextImport } from './textImport';
import type { LocalDate, Period } from '../domain/types';

// Фича 017 (research R9): нормализация при запуске и текстовый импорт объединяют месячные по длине из
// истории (средняя), а не по длине из настроек. Характеризация — зелёная до и после рефакторинга.

const ld = (s: string) => s as LocalDate;
const p = (id: string, start: string, end: string | null = null, endEstimated = false): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated,
});

// Средняя длина месячных — 3 дня (по умолчанию 5): открытые `c` оцениваются до 28.09.
const SHORT = [p('a', '2026-08-01', '2026-08-03'), p('b', '2026-08-29', '2026-08-31'), p('c', '2026-09-26')];
// Средняя по `a`, `b` — 5 дней: открытые `c` оцениваются до 30.09.
const LONG = [p('a', '2026-08-01', '2026-08-05'), p('b', '2026-08-29', '2026-09-02'), p('c', '2026-09-26')];

const FILE = [
  'cycle 0',
  'Period start date: 2026-09-30 00:00:00.0',
  'Period end date: 2026-10-02 00:00:00.0',
  '---------------',
].join('\n');

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('длина месячных по истории — как раньше', () => {
  it('нормализация: при средней 3 открытые и месячные через 4 дня не объединяются', async () => {
    const stored = [...SHORT, p('d', '2026-09-30', '2026-10-02')];
    await savePeriods(stored);
    expect(await normalizeStoredPeriods(ld('2026-10-30'))).toBe(false);
    expect(await getPeriods()).toEqual(stored);
  });

  it('нормализация, контроль: при средней 4 те же месячные объединяются', async () => {
    await savePeriods([...LONG, p('d', '2026-09-30', '2026-10-02')]);
    expect(await normalizeStoredPeriods(ld('2026-10-30'))).toBe(true);
    expect(await getPeriods()).toEqual([LONG[0], LONG[1], p('c', '2026-09-26', '2026-10-02')]);
  });

  it('текстовый импорт: при средней 3 месячные из файла добавляются рядом с открытыми', async () => {
    await savePeriods(SHORT);
    const plan = await planTextImport(FILE, ld('2026-11-09'));
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.value).toMatchObject({ added: 1, replaced: 0, unchanged: 0, skipped: 0 });
    expect(plan.value.periods.map((x) => [x.start, x.end])).toEqual([
      ['2026-08-01', '2026-08-03'],
      ['2026-08-29', '2026-08-31'],
      ['2026-09-26', null],
      ['2026-09-30', '2026-10-02'],
    ]);
  });

  it('текстовый импорт, контроль: при средней 5 открытые заменяются месячными из файла', async () => {
    await savePeriods(LONG);
    const plan = await planTextImport(FILE, ld('2026-11-09'));
    if (!plan.ok) throw new Error(plan.error);
    expect(plan.value).toMatchObject({ added: 1, replaced: 1 });
    expect(plan.value.periods.map((x) => [x.start, x.end])).toEqual([
      ['2026-08-01', '2026-08-05'],
      ['2026-08-29', '2026-09-02'],
      ['2026-09-30', '2026-10-02'],
    ]);
  });
});
