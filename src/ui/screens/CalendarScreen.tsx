import { useCallback, useState } from 'react';
import { dayInfo } from '../../domain/forecast';
import type { DayInfo, LocalDate } from '../../domain/types';
import { useForecast } from '../../hooks/useForecast';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getDayEntry } from '../../storage/repository';
import { DayCard } from '../components/DayCard';
import { DaySheets, type DaySheet } from '../components/DaySheets';
import { Disclaimer } from '../components/Disclaimer';
import { EntrySummary } from '../components/EntrySummary';
import { Legend } from '../components/Legend';
import { MonthPager } from '../components/MonthPager';
import { StatusBanner } from '../components/StatusBanner';

/** Главный экран (design.md «Экран „Календарь“»). */
export function CalendarScreen() {
  const state = useForecast();
  const [selected, setSelected] = useState<LocalDate | null>(null);
  const [sheet, setSheet] = useState<DaySheet>(null);

  const ctx = state?.ctx;
  const day = selected ?? ctx?.today ?? null;
  const entry = useLiveQuery(() => (day ? getDayEntry(day) : undefined), [day]);
  const getInfo = useCallback((date: LocalDate) => dayInfo(date, ctx!), [ctx]);
  const onSelect = useCallback((info: DayInfo) => setSelected(info.date), []);

  if (!state || !ctx || !day) return null;

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
      <DayCard
        info={getInfo(day)}
        onPeriod={() => setSheet('period')}
        onSymptoms={() => setSheet('symptoms')}
        onNote={() => setSheet('note')}
      >
        <EntrySummary entry={entry} />
      </DayCard>
      <Disclaimer />
      <DaySheets which={sheet} onClose={() => setSheet(null)} date={day} ctx={ctx} entry={entry} />
    </>
  );
}
