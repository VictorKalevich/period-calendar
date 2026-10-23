import { diffDays } from './dates';
import { periodEnd } from './periods';
import type { DayContext, DayInfo, LocalDate, Period } from './types';

function lastStartOnOrBefore(periods: Period[], date: LocalDate): Period | undefined {
  let found: Period | undefined;
  for (const p of periods) if (p.start <= date && (!found || p.start > found.start)) found = p;
  return found;
}

/** Всё, что нужно для отрисовки одного дня (data-model.md «DayInfo»). */
export function dayInfo(date: LocalDate, ctx: DayContext): DayInfo {
  const { periods, settings, entries, today, forecast } = ctx;
  const periodLength = forecast?.periodLength ?? settings.defaultPeriodLength;

  const own = lastStartOnOrBefore(periods, date);
  let period: DayInfo['period'] = null;
  if (own && date <= periodEnd(own, periodLength)) {
    period = own.end !== null || date <= today ? 'actual' : 'predicted';
  }

  return {
    date,
    cycleDay: own ? diffDays(date, own.start) + 1 : null,
    period,
    fertile: null,
    ovulation: false,
    probability: null,
    phase: null,
    isToday: date === today,
    hasEntry: entries.has(date),
  };
}
