import { addDaysLD, diffDays, minLD } from './dates';
import { MAX_PERIOD_DAYS, type LocalDate, type Period, type Result } from './types';

// Правила редактирования месячных (data-model.md «Period», FR-009). Возвращают новый массив,
// отсортированный по началу; исходный массив не меняется.

const sortByStart = (ps: Period[]) => [...ps].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

/** Последний день месячных; для незакрытых — оценка по `periodLength`. */
export function periodEnd(p: Period, periodLength: number): LocalDate {
  return p.end ?? addDaysLD(p.start, periodLength - 1);
}

function findContaining(periods: Period[], day: LocalDate, periodLength: number): Period | undefined {
  return periods.find((p) => p.start <= day && day <= periodEnd(p, periodLength));
}

/** Закрывает оценкой все незакрытые месячные, кроме последних. */
function closeEarlierOpenPeriods(sorted: Period[], periodLength: number): Period[] {
  return sorted.map((p, i) => {
    const next = sorted[i + 1];
    if (p.end !== null || !next) return p;
    const end = minLD(addDaysLD(p.start, periodLength - 1), addDaysLD(next.start, -1));
    return { ...p, end, endEstimated: true };
  });
}

export function markPeriodStart(
  periods: Period[],
  day: LocalDate,
  today: LocalDate,
  periodLength: number,
  newId: () => string = () => crypto.randomUUID(),
): Result<Period[]> {
  if (day > today) return { ok: false, error: 'future-date' };
  if (findContaining(periods, day, periodLength)) return { ok: false, error: 'inside-existing' };
  const added: Period = { id: newId(), start: day, end: null, endEstimated: false };
  return { ok: true, value: closeEarlierOpenPeriods(sortByStart([...periods, added]), periodLength) };
}

export function markPeriodEnd(periods: Period[], day: LocalDate, today: LocalDate): Result<Period[]> {
  if (day > today) return { ok: false, error: 'future-date' };
  const sorted = sortByStart(periods);
  const target = sorted.filter((p) => p.start <= day).at(-1);
  if (!target) return { ok: false, error: sorted.length > 0 ? 'end-before-start' : 'no-open-period' };
  if (diffDays(day, target.start) + 1 > MAX_PERIOD_DAYS) return { ok: false, error: 'too-long' };
  return {
    ok: true,
    value: sorted.map((p) => (p === target ? { ...p, end: day, endEstimated: false } : p)),
  };
}

/** Переносит начало месячных на день внутри них (U3: «Сдвинуть начало на этот день»). */
export function movePeriodStart(periods: Period[], day: LocalDate): Result<Period[]> {
  const target = periods.find((p) =>
    p.end !== null ? p.start <= day && day <= p.end : p.start <= day && diffDays(day, p.start) < MAX_PERIOD_DAYS,
  );
  if (!target) return { ok: false, error: 'no-open-period' };
  return { ok: true, value: sortByStart(periods.map((p) => (p === target ? { ...p, start: day } : p))) };
}

export function unmarkPeriodDay(periods: Period[], day: LocalDate): Period[] {
  const target = periods.find((p) =>
    p.end !== null ? p.start <= day && day <= p.end : p.start <= day && diffDays(day, p.start) < MAX_PERIOD_DAYS,
  );
  if (!target) return periods;
  if (target.start === day) return periods.filter((p) => p !== target);
  return periods.map((p) => (p === target ? { ...p, end: addDaysLD(day, -1), endEstimated: false } : p));
}
