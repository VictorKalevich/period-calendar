import { describe, expect, it } from 'vitest';
import { normalizePeriods } from './periods';
import type { LocalDate, Period } from './types';

// Слияние пересекающихся и соседних месячных (003 ревизия 2, FR-015–FR-017).

const ld = (s: string) => s as LocalDate;
const p = (id: string, start: string, end: string | null = null, endEstimated = false): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated,
});
const TODAY = ld('2026-10-30');
const L = 5;
const norm = (periods: Period[], today = TODAY, len = L) => normalizePeriods(periods, today, len);

describe('normalizePeriods', () => {
  it('keeps separate periods unchanged and sorted', () => {
    expect(norm([p('b', '2026-10-10', '2026-10-14'), p('a', '2026-10-01', '2026-10-04')])).toEqual([
      p('a', '2026-10-01', '2026-10-04'),
      p('b', '2026-10-10', '2026-10-14'),
    ]);
  });

  it('merges adjacent periods (end + 1 = next start)', () => {
    expect(norm([p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-05', '2026-10-08')])).toEqual([
      p('a', '2026-10-01', '2026-10-08'),
    ]);
  });

  it('does not merge with a one-day gap', () => {
    expect(norm([p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-06', '2026-10-08')])).toHaveLength(2);
  });

  it('merges overlapping periods and keeps the later end', () => {
    expect(norm([p('a', '2026-10-01', '2026-10-06'), p('b', '2026-10-04', '2026-10-05')])).toEqual([
      p('a', '2026-10-01', '2026-10-06'),
    ]);
  });

  it('merges a chain of three into one', () => {
    expect(
      norm([p('a', '2026-10-01', '2026-10-03'), p('b', '2026-10-04', '2026-10-05'), p('c', '2026-10-06', '2026-10-09')]),
    ).toEqual([p('a', '2026-10-01', '2026-10-09')]);
  });

  it('takes endEstimated from the later end; equal ends — manual wins', () => {
    expect(norm([p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-05', '2026-10-07', true)])).toEqual([
      p('a', '2026-10-01', '2026-10-07', true),
    ]);
    expect(norm([p('a', '2026-10-01', '2026-10-07', true), p('b', '2026-10-05', '2026-10-06')])).toEqual([
      p('a', '2026-10-01', '2026-10-07', true),
    ]);
    expect(norm([p('a', '2026-10-01', '2026-10-06', true), p('b', '2026-10-05', '2026-10-06')])).toEqual([
      p('a', '2026-10-01', '2026-10-06', false),
    ]);
  });

  it('merges with a later open period whose estimate has passed', () => {
    // b: 5–9 по оценке (L = 5), сегодня 30-е
    expect(norm([p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-05')])).toEqual([p('a', '2026-10-01', '2026-10-09', true)]);
  });

  it('merges with a later open period that is still going: end = max(its estimate, today), estimated, may be in the future', () => {
    // b: 28 октября – 1 ноября по оценке, сегодня 30-е → конец 1 ноября (прогноз)
    expect(norm([p('a', '2026-10-24', '2026-10-27'), p('b', '2026-10-28')])).toEqual([p('a', '2026-10-24', '2026-11-01', true)]);
    // идущие начались сегодня: оценка 30.10–3.11
    expect(norm([p('a', '2026-10-26', '2026-10-29'), p('b', '2026-10-30')])).toEqual([p('a', '2026-10-26', '2026-11-03', true)]);
  });

  it('respects the 15-day limit with a future estimated end', () => {
    // 17–27 + идущие с 28-го (оценка до 1.11) = 16 дней → не объединяются
    const periods = [p('a', '2026-10-17', '2026-10-27'), p('b', '2026-10-28')];
    expect(norm(periods)).toEqual(periods);
  });

  it('merges across a month boundary', () => {
    expect(norm([p('a', '2026-09-28', '2026-09-30'), p('b', '2026-10-01', '2026-10-03')])).toEqual([
      p('a', '2026-09-28', '2026-10-03'),
    ]);
  });

  it('does not merge when the result would be longer than 15 days', () => {
    const periods = [p('a', '2026-10-01', '2026-10-08'), p('b', '2026-10-09', '2026-10-16')]; // 16 дней
    expect(norm(periods)).toEqual(periods);
    expect(norm([p('a', '2026-10-01', '2026-10-08'), p('b', '2026-10-09', '2026-10-15')])).toEqual([
      p('a', '2026-10-01', '2026-10-15'),
    ]); // ровно 15
  });

  it('keeps the earlier id', () => {
    expect(norm([p('x', '2026-10-05', '2026-10-06'), p('y', '2026-10-01', '2026-10-04')])[0]!.id).toBe('y');
  });
});
