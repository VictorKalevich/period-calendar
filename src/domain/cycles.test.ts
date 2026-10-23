import { describe, expect, it } from 'vitest';
import { addDaysLD } from './dates';
import { averageCycleLength, averagePeriodLength, buildCycles, forecastConfidence } from './cycles';
import type { LocalDate, Period } from './types';

const ld = (s: string) => s as LocalDate;

/** Месячные с заданными длинами циклов, начиная с `first`; каждые длятся `periodDays` (null — без конца). */
function history(first: string, cycleLengths: number[], periodDays: number | null = 5): Period[] {
  const out: Period[] = [];
  let start = ld(first);
  for (let i = 0; i <= cycleLengths.length; i++) {
    out.push({
      id: `p${i}`,
      start,
      end: periodDays === null ? null : addDaysLD(start, periodDays - 1),
      endEstimated: false,
    });
    if (i < cycleLengths.length) start = addDaysLD(start, cycleLengths[i]!);
  }
  return out;
}

describe('buildCycles', () => {
  it('derives lengths, period lengths and outliers', () => {
    const cycles = buildCycles(history('2026-01-01', [28, 90, 10]));
    expect(cycles.map((c) => c.length)).toEqual([28, 90, 10, null]);
    expect(cycles.map((c) => c.isOutlier)).toEqual([false, true, true, false]);
    expect(cycles.map((c) => c.periodLength)).toEqual([5, 5, 5, 5]);
  });

  it('sorts periods by start and carries the estimated flag', () => {
    const periods: Period[] = [
      { id: 'b', start: ld('2026-02-01'), end: null, endEstimated: false },
      { id: 'a', start: ld('2026-01-03'), end: ld('2026-01-07'), endEstimated: true },
    ];
    const cycles = buildCycles(periods);
    expect(cycles.map((c) => c.start)).toEqual(['2026-01-03', '2026-02-01']);
    expect(cycles[0]).toMatchObject({ length: 29, periodLength: 5, periodEndEstimated: true });
    expect(cycles[1]).toMatchObject({ length: null, periodLength: null });
  });

  it('crosses the year boundary', () => {
    expect(buildCycles(history('2026-12-20', [28]))[0]!.length).toBe(28);
  });
});

describe('averageCycleLength', () => {
  it('averages 27, 29, 31 to 29 (case 3)', () => {
    expect(averageCycleLength(buildCycles(history('2026-01-01', [27, 29, 31])))).toBe(29);
  });

  it('excludes outliers (case 4)', () => {
    expect(averageCycleLength(buildCycles(history('2026-01-01', [28, 28, 90])))).toBe(28);
  });

  it('uses only the last 6 completed cycles (case 5)', () => {
    expect(averageCycleLength(buildCycles(history('2025-01-01', [40, 40, 28, 28, 28, 28, 28, 28])))).toBe(28);
  });

  it('rounds to the nearest whole day', () => {
    expect(averageCycleLength(buildCycles(history('2026-01-01', [28, 29])))).toBe(29); // 28.5
    expect(averageCycleLength(buildCycles(history('2026-01-01', [28, 28, 29])))).toBe(28); // 28.33
  });

  it('is null without completed cycles', () => {
    expect(averageCycleLength(buildCycles(history('2026-01-01', [])))).toBeNull();
    expect(averageCycleLength(buildCycles(history('2026-01-01', [90])))).toBeNull();
  });
});

describe('averagePeriodLength', () => {
  it('ignores estimated ends (case 20)', () => {
    const periods: Period[] = [
      { id: 'a', start: ld('2026-01-01'), end: ld('2026-01-04'), endEstimated: false },
      { id: 'b', start: ld('2026-01-29'), end: ld('2026-02-02'), endEstimated: true },
      { id: 'c', start: ld('2026-02-26'), end: ld('2026-03-03'), endEstimated: false },
    ];
    expect(averagePeriodLength(buildCycles(periods))).toBe(5); // (4 + 6) / 2
  });

  it('uses the last 6 periods with a manual end', () => {
    const periods = [
      ...history('2025-01-01', [28], 9),
      ...history('2025-03-01', [28, 28, 28, 28, 28], 4).map((p, i) => ({ ...p, id: `q${i}` })),
    ];
    expect(averagePeriodLength(buildCycles(periods))).toBe(4);
  });

  it('is null when no period has a manual end', () => {
    expect(averagePeriodLength(buildCycles(history('2026-01-01', [28], null)))).toBeNull();
  });
});

describe('forecastConfidence', () => {
  it('is low with fewer than 3 completed non-outlier cycles (case 18)', () => {
    expect(forecastConfidence(buildCycles(history('2026-01-01', [])))).toBe('low');
    expect(forecastConfidence(buildCycles(history('2026-01-01', [28])))).toBe('low');
    expect(forecastConfidence(buildCycles(history('2026-01-01', [28, 28])))).toBe('low');
    expect(forecastConfidence(buildCycles(history('2026-01-01', [28, 28, 90])))).toBe('low');
  });

  it('is low when the spread is more than 7 days (case 19)', () => {
    expect(forecastConfidence(buildCycles(history('2026-01-01', [26, 28, 35])))).toBe('low');
    expect(forecastConfidence(buildCycles(history('2026-01-01', [27, 28, 30])))).toBe('normal');
    expect(forecastConfidence(buildCycles(history('2026-01-01', [24, 28, 31])))).toBe('normal'); // ровно 7
  });
});
