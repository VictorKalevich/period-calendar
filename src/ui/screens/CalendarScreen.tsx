import { useCallback, useMemo, useState } from 'react';
import { dayInfo } from '../../domain/forecast';
import { DEFAULT_SETTINGS, type DayContext, type DayInfo, type LocalDate } from '../../domain/types';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useToday } from '../../hooks/useToday';
import { db } from '../../storage/db';
import { getPeriods, getSettings } from '../../storage/repository';
import { DayCard } from '../components/DayCard';
import { MonthPager } from '../components/MonthPager';
import { PeriodSheet } from '../components/PeriodSheet';

export function CalendarScreen() {
  const today = useToday();
  const periods = useLiveQuery(getPeriods, []);
  const settings = useLiveQuery(getSettings, []);
  const entryDates = useLiveQuery(() => db.days.toCollection().primaryKeys(), []);
  const [selected, setSelected] = useState<LocalDate>(today);
  const [sheet, setSheet] = useState(false);

  const ctx = useMemo<DayContext | null>(() => {
    if (!periods || !settings || !entryDates) return null;
    return { forecast: null, periods, settings, entries: new Set(entryDates), today };
  }, [periods, settings, entryDates, today]);

  const getInfo = useCallback((date: LocalDate) => dayInfo(date, ctx!), [ctx]);
  const onSelect = useCallback((info: DayInfo) => setSelected(info.date), []);

  if (!ctx) return null;

  const periodLength = ctx.forecast?.periodLength ?? (settings ?? DEFAULT_SETTINGS).defaultPeriodLength;

  return (
    <>
      <MonthPager
        today={today}
        earliest={ctx.periods[0]?.start ?? null}
        getInfo={getInfo}
        selected={selected}
        onSelect={onSelect}
      />
      <DayCard info={getInfo(selected)} onPeriod={() => setSheet(true)} />
      <PeriodSheet
        open={sheet}
        onClose={() => setSheet(false)}
        date={selected}
        today={today}
        periods={ctx.periods}
        periodLength={periodLength}
      />
    </>
  );
}
