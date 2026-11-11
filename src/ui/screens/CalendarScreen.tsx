import { useCallback, useState } from 'react';
import { cardPhase, dayDialogFor } from '../../domain/dayDialog';
import { dayInfo } from '../../domain/forecast';
import { firstPeriodHintVisible } from '../../domain/hints';
import type { DayInfo, LocalDate } from '../../domain/types';
import { useForecast } from '../../hooks/useForecast';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getDayEntry, getFirstPeriodHintDismissed } from '../../storage/repository';
import { DayCard } from '../components/DayCard';
import { DaySheets, type DaySheet } from '../components/DaySheets';
import { EntrySummary } from '../components/EntrySummary';
import { FirstPeriodHint } from '../components/FirstPeriodHint';
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
  const hintDismissed = useLiveQuery(getFirstPeriodHintDismissed, []);
  const getInfo = useCallback((date: LocalDate) => dayInfo(date, ctx!), [ctx]);
  // Нажатие выбирает день и открывает диалог, если в нём есть кнопки (003 FR-002, 004 FR-006/FR-007).
  const onSelect = useCallback(
    (info: DayInfo) => {
      setSelected(info.date);
      if (!ctx) return;
      const periodLength = ctx.forecast?.periodLength ?? ctx.settings.defaultPeriodLength;
      if (dayDialogFor(info.date, ctx.today, ctx.periods, periodLength, ctx.settings).opens) setSheet('day');
    },
    [ctx],
  );

  if (!state || !ctx || !day) return null;
  const info = getInfo(day);
  const { showWellbeing, showMood, showNotes, showSex } = ctx.settings;

  return (
    <>
      {/* Пока флаг не прочитан — не показываем, чтобы подсказка не мелькала у закрывших её (010). */}
      {hintDismissed !== undefined && firstPeriodHintVisible(ctx.periods.length, hintDismissed) && <FirstPeriodHint />}
      <MonthPager
        today={ctx.today}
        earliest={ctx.periods[0]?.start ?? null}
        getInfo={getInfo}
        selected={day}
        onSelect={onSelect}
        banner={<StatusBanner summary={state.summary} />}
      />
      <Legend showEntries={showWellbeing || showMood || showNotes} showSex={showSex} />
      <DayCard info={info} phase={cardPhase(info, ctx.forecast)}>
        <EntrySummary entry={entry} settings={ctx.settings} />
      </DayCard>
      <DaySheets which={sheet} onChange={setSheet} date={day} ctx={ctx} entry={entry} />
    </>
  );
}
