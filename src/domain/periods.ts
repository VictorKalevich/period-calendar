import { addDaysLD, diffDays, formatDayMonthRu, formatRangeRu, maxLD, minLD } from './dates';
import { MAX_PERIOD_DAYS, type LocalDate, type Period, type Result } from './types';

// Правила редактирования месячных (data-model.md «Period», FR-009). Возвращают новый массив,
// отсортированный по началу; исходный массив не меняется. Все изменения нормализуются:
// пересекающиеся и соседние месячные объединяются (specs/003-calendar-tap-actions, ревизия 2).

const sortByStart = (ps: Period[]) => [...ps].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

/** Последний день месячных; для незакрытых — оценка по `periodLength`. */
export function periodEnd(p: Period, periodLength: number): LocalDate {
  return p.end ?? addDaysLD(p.start, periodLength - 1);
}

const lengthOf = (p: Period, periodLength: number) => diffDays(periodEnd(p, periodLength), p.start) + 1;

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

/** Конец объединённых месячных по их «источнику» — месячным с более поздним последним днём. */
function endFrom(src: Period, today: LocalDate, periodLength: number): Pick<Period, 'end' | 'endEstimated'> {
  if (src.end !== null) return { end: src.end, endEstimated: src.endEstimated };
  const estimate = periodEnd(src, periodLength);
  // Будущий конец не храним: у ещё идущих месячных конец — сегодня, оценочный.
  return { end: estimate <= today ? estimate : today, endEstimated: true };
}

/**
 * Объединяет пересекающиеся и соседние (последний день + 1 = начало) месячные (FR-015–FR-017).
 * Начало — более раннее, конец — более поздний; признак оценки — как у более позднего конца
 * (при равных — ручной, если хотя бы один ручной). Объединение длиннее 15 дней не выполняется.
 */
export function normalizePeriods(periods: Period[], today: LocalDate, periodLength: number): Period[] {
  const out: Period[] = [];
  for (const p of sortByStart(periods)) {
    const last = out.at(-1);
    if (last && p.start <= addDaysLD(periodEnd(last, periodLength), 1)) {
      const lastA = periodEnd(last, periodLength);
      const lastB = periodEnd(p, periodLength);
      const mergedLast = maxLD(lastA, lastB);
      if (diffDays(mergedLast, last.start) + 1 <= MAX_PERIOD_DAYS) {
        let tail: Pick<Period, 'end' | 'endEstimated'>;
        if (lastA === lastB) {
          const a = endFrom(last, today, periodLength);
          const b = endFrom(p, today, periodLength);
          tail = { end: a.end, endEstimated: a.endEstimated && b.endEstimated };
        } else {
          tail = endFrom(lastB > lastA ? p : last, today, periodLength);
        }
        out[out.length - 1] = { ...last, ...tail };
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * Нормализует и проверяет итог действия: ни одних месячных длиннее 15 дней, и не осталось
 * пересекающихся или соседних месячных, которые не удалось объединить из-за лимита (FR-017).
 */
function finish(periods: Period[], today: LocalDate, periodLength: number): Result<Period[]> {
  const out = normalizePeriods(periods, today, periodLength);
  for (let i = 0; i < out.length; i++) {
    const p = out[i]!;
    const prev = out[i - 1];
    if (lengthOf(p, periodLength) > MAX_PERIOD_DAYS) return { ok: false, error: 'too-long' };
    if (prev && p.start <= addDaysLD(periodEnd(prev, periodLength), 1)) return { ok: false, error: 'too-long' };
  }
  return { ok: true, value: out };
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
  return finish(closeEarlierOpenPeriods(sortByStart([...periods, added]), periodLength), today, periodLength);
}

export function markPeriodEnd(periods: Period[], day: LocalDate, today: LocalDate, periodLength: number): Result<Period[]> {
  if (day > today) return { ok: false, error: 'future-date' };
  const sorted = sortByStart(periods);
  const target = sorted.filter((p) => p.start <= day).at(-1);
  if (!target) return { ok: false, error: sorted.length > 0 ? 'end-before-start' : 'no-open-period' };
  if (diffDays(day, target.start) + 1 > MAX_PERIOD_DAYS) return { ok: false, error: 'too-long' };
  return finish(
    sorted.map((p) => (p === target ? { ...p, end: day, endEstimated: false } : p)),
    today,
    periodLength,
  );
}

/**
 * Переносит начало месячных, не меняя конец (003 FR-009, FR-010, research R3). У незакрытых
 * месячных прошедший оценочный последний день сохраняется как оценочный конец; если месячные ещё
 * идут, конец остаётся неотмеченным — будущий конец не хранится. Без нормализации — её делает
 * вызывающее действие.
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

// ── Диалог «Месячные»: состав кнопок по таблице А/Б/В, ревизия 2 (specs/003-calendar-tap-actions) ──

export type PeriodActionKind = 'delete-period' | 'end-here' | 'set-start' | 'start' | 'extend-to' | 'set-next-start';

export interface PeriodAction {
  kind: PeriodActionKind;
  label: string;
  /** Текст подтверждения перед выполнением (только «Удалить период»). */
  confirm?: string;
  apply: () => Result<Period[]>;
}

const EXTEND_TO_MAX_GAP = 7;
const SET_NEXT_START_MAX_GAP = 3;

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
  const current = sorted.find((p) => p.start <= date && date <= lastDay(p));

  // А. Первый день месячных — только удалить их целиком (с подтверждением)
  if (current && current.start === date) {
    return [
      {
        kind: 'delete-period',
        label: 'Удалить период',
        confirm: `Удалить месячные ${formatRangeRu(current.start, lastDay(current))}?`,
        apply: () => ({ ok: true, value: sorted.filter((p) => p !== current) }),
      },
    ];
  }

  // Б. Второй и следующие дни
  if (current) {
    return [
      { kind: 'end-here', label: 'Отметить конец в этот день', apply: () => markPeriodEnd(periods, date, today, periodLength) },
      {
        kind: 'set-start',
        label: 'Установить как начало',
        apply: () => finish(setPeriodStart(sorted, current.id, date, today, periodLength), today, periodLength),
      },
    ];
  }

  // В. День вне месячных
  const actions: PeriodAction[] = [
    { kind: 'start', label: 'Начало месячных', apply: () => markPeriodStart(periods, date, today, periodLength, newId) },
  ];
  const prev = sorted.filter((p) => p.start < date).at(-1);
  const next = sorted.find((p) => p.start > date);

  // «Продлить месячные до {дата}» — 1–7 дней после последнего дня предыдущих (FR-008)
  if (prev) {
    const gap = diffDays(date, lastDay(prev));
    if (gap >= 1 && gap <= EXTEND_TO_MAX_GAP && diffDays(date, prev.start) + 1 <= MAX_PERIOD_DAYS) {
      const result = finish(
        sorted.map((p) => (p === prev ? { ...p, end: date, endEstimated: false } : p)),
        today,
        periodLength,
      );
      if (result.ok) actions.push({ kind: 'extend-to', label: `Продлить месячные до ${formatDayMonthRu(date)}`, apply: () => result });
    }
  }

  // «Установить как начало месячных» — 1–3 дня до начала следующих (FR-010)
  if (next) {
    const gap = diffDays(next.start, date);
    const afterPrev = !prev || date > lastDay(prev);
    if (gap >= 1 && gap <= SET_NEXT_START_MAX_GAP && afterPrev && diffDays(lastDay(next), date) + 1 <= MAX_PERIOD_DAYS) {
      const result = finish(setPeriodStart(sorted, next.id, date, today, periodLength), today, periodLength);
      if (result.ok) actions.push({ kind: 'set-next-start', label: 'Установить как начало месячных', apply: () => result });
    }
  }
  return actions;
}
