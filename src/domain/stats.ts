import { averageCycleLength, averagePeriodLength } from './cycles';
import type { Cycle } from './types';

/** Статистика — те же средние, что использует прогноз (FR-027): последние 6 циклов. */
export function cycleStats(cycles: Cycle[]): {
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  history: Cycle[];
} {
  return {
    avgCycleLength: averageCycleLength(cycles),
    avgPeriodLength: averagePeriodLength(cycles),
    history: [...cycles].reverse(),
  };
}
