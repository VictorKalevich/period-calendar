import { useCallback, useState } from 'react';
import { dayInfo } from '../../domain/forecast';
import type { DayInfo, LocalDate } from '../../domain/types';
import { useForecast } from '../../hooks/useForecast';
import { DayCard } from '../components/DayCard';
import { Disclaimer } from '../components/Disclaimer';
import { Legend } from '../components/Legend';
import { MonthPager } from '../components/MonthPager';
import { PeriodSheet } from '../components/PeriodSheet';
import { StatusBanner } from '../components/StatusBanner';

/** Главный экран (design.md «Экран „Календарь“»). */
export function CalendarScreen() {
  const state = useForecast();
  const [selected, setSelected] = useState<LocalDate | null>(null);
  const [sheet, setSheet] = useState(false);

  const ctx = state?.ctx;
  const getInfo = useCallback((date: LocalDate) => dayInfo(date, ctx!), [ctx]);
  const onSelect = useCallback((info: DayInfo) => setSelected(info.date), []);

  if (!state || !ctx) return null;

  const day = selected ?? ctx.today;
  const periodLength = ctx.forecast?.periodLength ?? ctx.settings.defaultPeriodLength;

  return (
    <>
      <MonthPager
        today={ctx.today}
        earliest={ctx.periods[0]?.start ?? null}
        getInfo={getInfo}
        selected={day}
        onSelect={onSelect}
        banner={<StatusBanner summary={state.summary} />}
      />
      <Legend />
      <DayCard info={getInfo(day)} onPeriod={() => setSheet(true)} />
      <Disclaimer />
      <PeriodSheet
        open={sheet}
        onClose={() => setSheet(false)}
        date={day}
        today={ctx.today}
        periods={ctx.periods}
        periodLength={periodLength}
      />
    </>
  );
}
