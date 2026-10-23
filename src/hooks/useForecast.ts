import { useMemo } from 'react';
import { visibleEntryDates } from '../domain/dayDialog';
import { buildForecast, todaySummary } from '../domain/forecast';
import type { DayContext, TodaySummary } from '../domain/types';
import { db } from '../storage/db';
import { getPeriods, getSettings } from '../storage/repository';
import { useLiveQuery } from './useLiveQuery';
import { useToday } from './useToday';

export interface ForecastState {
  ctx: DayContext;
  summary: TodaySummary;
}

/** Отметки, настройки и прогноз; пересчитывается при любом изменении данных (FR-020). */
export function useForecast(): ForecastState | null {
  const today = useToday();
  const periods = useLiveQuery(getPeriods, []);
  const settings = useLiveQuery(getSettings, []);
  const entries = useLiveQuery(() => db.days.toArray(), []);

  return useMemo(() => {
    if (!periods || !settings || !entries) return null;
    const forecast = buildForecast({ periods, settings, today });
    // Индикатор записи — только по включённым типам (004 FR-010).
    const ctx: DayContext = { forecast, periods, settings, entries: visibleEntryDates(entries, settings), today };
    return { ctx, summary: todaySummary(ctx) };
  }, [periods, settings, entries, today]);
}
