import { describe, expect, it } from 'vitest';
import { buildCycles } from './cycles';
import { buildForecast } from './forecast';
import { cycleStats } from './stats';
import { DEFAULT_SETTINGS, type LocalDate, type Period } from './types';

const ld = (s: string) => s as LocalDate;
const p = (id: string, start: string, end: string | null, endEstimated = false): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated,
});

describe('cycleStats', () => {
  it('is empty without completed cycles', () => {
    expect(cycleStats(buildCycles([]))).toEqual({ avgCycleLength: null, avgPeriodLength: null, history: [] });
    const one = cycleStats(buildCycles([p('a', '2026-10-01', null)]));
    expect(one.avgCycleLength).toBeNull();
    expect(one.avgPeriodLength).toBeNull();
    expect(one.history).toHaveLength(1);
  });

  it('uses the same averages as the forecast (case 24)', () => {
    const periods = [
      p('a', '2026-01-01', '2026-01-05'),
      p('b', '2026-01-29', '2026-02-01'),
      p('c', '2026-02-28', '2026-03-05', true),
      p('d', '2026-03-28', null),
    ];
    const stats = cycleStats(buildCycles(periods));
    const f = buildForecast({ periods, settings: DEFAULT_SETTINGS, today: ld('2026-03-30') })!;
    expect(stats.avgCycleLength).toBe(f.cycleLength); // (28 + 30 + 28) / 3 ≈ 28.67 → 29
    expect(stats.avgCycleLength).toBe(29);
    expect(stats.avgPeriodLength).toBe(f.periodLength); // 5 и 4; оценочный не учитывается → 4.5 → 5
    expect(stats.avgPeriodLength).toBe(5);
  });

  it('lists history newest first, including outliers', () => {
    const stats = cycleStats(buildCycles([p('a', '2026-01-01', '2026-01-05'), p('b', '2026-04-01', '2026-04-04'), p('c', '2026-04-29', null)]));
    expect(stats.history.map((c) => c.start)).toEqual(['2026-04-29', '2026-04-01', '2026-01-01']);
    expect(stats.history.map((c) => c.isOutlier)).toEqual([false, false, true]);
    expect(stats.avgCycleLength).toBe(28);
  });
});
