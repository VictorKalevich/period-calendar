import { useMemo } from 'react';
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
  const entryDates = useLiveQuery(() => db.days.toCollection().primaryKeys(), []);

  return useMemo(() => {
    if (!periods || !settings || !entryDates) return null;
    const forecast = buildForecast({ periods, settings, today });
    const ctx: DayContext = { forecast, periods, settings, entries: new Set(entryDates), today };
    return { ctx, summary: todaySummary(ctx) };
  }, [periods, settings, entryDates, today]);
}
