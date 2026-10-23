import { addDaysLD, diffDays, formatDayMonthRu, formatRangeRu, minLD } from './dates';
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

/**
 * Переносит начало месячных, не меняя конец (003 FR-009, FR-010, research R3). У незакрытых
 * месячных прошедший оценочный последний день сохраняется как оценочный конец; если месячные ещё
 * идут, конец остаётся неотмеченным — будущий конец не хранится.
 */
export function setPeriodStart(
  periods: Period[],
  periodId: string,
  newStart: LocalDate,
  today: LocalDate,
  periodLength: number,
): Period[] {
  return sortByStart(
    periods.map((p) => {
      if (p.id !== periodId) return p;
      if (p.end !== null) return { ...p, start: newStart };
      const oldLast = periodEnd(p, periodLength);
      return oldLast <= today ? { ...p, start: newStart, end: oldLast, endEstimated: true } : { ...p, start: newStart };
    }),
  );
}

export function unmarkPeriodDay(periods: Period[], day: LocalDate): Period[] {
  const target = periods.find((p) =>
    p.end !== null ? p.start <= day && day <= p.end : p.start <= day && diffDays(day, p.start) < MAX_PERIOD_DAYS,
  );
  if (!target) return periods;
  if (target.start === day) return periods.filter((p) => p !== target);
  return periods.map((p) => (p === target ? { ...p, end: addDaysLD(day, -1), endEstimated: false } : p));
}

// ── Диалог «Месячные»: состав кнопок по таблице А/Б/В (specs/003-calendar-tap-actions) ──

export type PeriodActionKind =
  | 'extend-by-length'
  | 'end-one-day'
  | 'unmark'
  | 'end-here'
  | 'set-start'
  | 'unmark-day'
  | 'start'
  | 'extend-to'
  | 'set-next-start';

export interface PeriodAction {
  kind: PeriodActionKind;
  label: string;
  apply: () => Result<Period[]>;
}

const EXTEND_TO_MAX_GAP = 7;
const SET_NEXT_START_MAX_GAP = 3;

const ok = (value: Period[]): Result<Period[]> => ({ ok: true, value });

/**
 * Кнопки диалога «Месячные» для дня. Будущий день — пусто. Длина `periodLength` — прогнозируемая
 * длина месячных, без прогноза — длина по умолчанию из настроек.
 */
export function periodActionsFor(
  date: LocalDate,
  today: LocalDate,
  periods: Period[],
  periodLength: number,
  newId: () => string = () => crypto.randomUUID(),
): PeriodAction[] {
  if (date > today) return [];
  const sorted = sortByStart(periods);
  const lastDay = (p: Period) => periodEnd(p, periodLength);
  const index = sorted.findIndex((p) => p.start <= date && date <= lastDay(p));

  if (index >= 0) {
    const current = sorted[index]!;
    const next = sorted[index + 1];
    const actions: PeriodAction[] = [];

    // «Продлить месячные: {начало}–{конец}» — только без ручного конца и только если не сокращает (FR-007)
    if (current.end === null || current.endEstimated) {
      const newEnd = addDaysLD(current.start, periodLength - 1);
      const extends_ = current.end === null || newEnd > current.end;
      if (extends_ && newEnd <= today && (!next || newEnd < next.start)) {
        actions.push({
          kind: 'extend-by-length',
          label: `Продлить месячные: ${formatRangeRu(current.start, newEnd)}`,
          apply: () => ok(sorted.map((p) => (p === current ? { ...p, end: newEnd, endEstimated: false } : p))),
        });
      }
    }

    if (current.start === date) {
      actions.push(
        { kind: 'end-one-day', label: 'Конец месячных (один день)', apply: () => markPeriodEnd(periods, date, today) },
        { kind: 'unmark', label: 'Убрать отметку', apply: () => ok(unmarkPeriodDay(sorted, date)) },
      );
    } else {
      actions.push(
        { kind: 'end-here', label: 'Отметить конец в этот день', apply: () => markPeriodEnd(periods, date, today) },
        {
          kind: 'set-start',
          label: 'Установить как начало',
          apply: () => ok(setPeriodStart(sorted, current.id, date, today, periodLength)),
        },
        { kind: 'unmark-day', label: 'Убрать отметку с этого дня', apply: () => ok(unmarkPeriodDay(sorted, date)) },
      );
    }
    return actions;
  }

  const actions: PeriodAction[] = [
    { kind: 'start', label: 'Начало месячных', apply: () => markPeriodStart(periods, date, today, periodLength, newId) },
  ];
  const prev = sorted.filter((p) => p.start < date).at(-1);
  const next = sorted.find((p) => p.start > date);

  // «Продлить месячные до {дата}» — 1–7 дней после последнего дня предыдущих (FR-008)
  if (prev) {
    const gap = diffDays(date, lastDay(prev));
    if (gap >= 1 && gap <= EXTEND_TO_MAX_GAP && diffDays(date, prev.start) + 1 <= MAX_PERIOD_DAYS) {
      actions.push({
        kind: 'extend-to',
        label: `Продлить месячные до ${formatDayMonthRu(date)}`,
        apply: () => ok(sorted.map((p) => (p === prev ? { ...p, end: date, endEstimated: false } : p))),
      });
    }
  }

  // «Установить как начало месячных» — 1–3 дня до начала следующих (FR-010)
  if (next) {
    const gap = diffDays(next.start, date);
    const afterPrev = !prev || date > lastDay(prev);
    if (gap >= 1 && gap <= SET_NEXT_START_MAX_GAP && afterPrev && diffDays(lastDay(next), date) + 1 <= MAX_PERIOD_DAYS) {
      actions.push({
        kind: 'set-next-start',
        label: 'Установить как начало месячных',
        apply: () => ok(setPeriodStart(sorted, next.id, date, today, periodLength)),
      });
    }
  }
  return actions;
}
