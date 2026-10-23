import { diffDays } from './dates';
import { AVERAGE_WINDOW, OUTLIER_CYCLE, type Confidence, type Cycle, type Period } from './types';

const CONFIDENCE_MIN_CYCLES = 3;
const CONFIDENCE_MAX_SPREAD = 7;

export function buildCycles(periods: Period[]): Cycle[] {
  const sorted = [...periods].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return sorted.map((p, i) => {
    const next = sorted[i + 1];
    const length = next ? diffDays(next.start, p.start) : null;
    return {
      start: p.start,
      length,
      periodLength: p.end ? diffDays(p.end, p.start) + 1 : null,
      periodEndEstimated: p.endEstimated,
      isOutlier: length !== null && (length < OUTLIER_CYCLE.min || length > OUTLIER_CYCLE.max),
    };
  });
}

/** Длины последних 6 завершённых циклов без выбросов (FR-013). */
function usedCycleLengths(cycles: Cycle[]): number[] {
  return cycles
    .filter((c) => c.length !== null && !c.isOutlier)
    .map((c) => c.length!)
    .slice(-AVERAGE_WINDOW);
}

const roundedMean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function averageCycleLength(cycles: Cycle[]): number | null {
  return roundedMean(usedCycleLengths(cycles));
}

/** Последние 6 месячных с концом, отмеченным вручную (FR-014). */
export function averagePeriodLength(cycles: Cycle[]): number | null {
  return roundedMean(
    cycles
      .filter((c) => c.periodLength !== null && !c.periodEndEstimated)
      .map((c) => c.periodLength!)
      .slice(-AVERAGE_WINDOW),
  );
}

/** FR-019a: низкая, если учтённых циклов меньше 3 или разброс их длин больше 7 дней. */
export function forecastConfidence(cycles: Cycle[]): Confidence {
  const used = usedCycleLengths(cycles);
  if (used.length < CONFIDENCE_MIN_CYCLES) return 'low';
  return Math.max(...used) - Math.min(...used) > CONFIDENCE_MAX_SPREAD ? 'low' : 'normal';
}
