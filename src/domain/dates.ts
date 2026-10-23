import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import type { LocalDate } from './types';

// Календарные даты как строки YYYY-MM-DD (research.md R1). Арифметика — через локальную полночь,
// результат сразу возвращается в строку, поэтому часовой пояс и летнее время не влияют на даты.

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toLocalDate(d) === value;
}

export function parseLD(d: LocalDate): Date {
  const m = LOCAL_DATE_RE.exec(d);
  if (!m) throw new Error(`Invalid LocalDate: ${d}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toLocalDate(d: Date): LocalDate {
  return format(d, 'yyyy-MM-dd') as LocalDate;
}

export function addDaysLD(d: LocalDate, n: number): LocalDate {
  return toLocalDate(addDays(parseLD(d), n));
}

/** a − b в календарных днях. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return differenceInCalendarDays(parseLD(a), parseLD(b));
}

export function minLD(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b;
}

export function maxLD(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}

/** Все даты от `from` до `to` включительно. */
export function rangeLD(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDaysLD(d, 1)) out.push(d);
  return out;
}

/** Сетка месяца с понедельника: 5 или 6 полных недель. `month` — 1…12. */
export function monthGrid(year: number, month: number): LocalDate[] {
  const first = new Date(year, month - 1, 1);
  const start = startOfWeek(first, { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
  const days = Math.max(35, differenceInCalendarDays(end, start) + 1);
  return Array.from({ length: days }, (_, i) => toLocalDate(addDays(start, i)));
}

/** «23 октября, пятница» */
export function formatDayRu(d: LocalDate): string {
  return format(parseLD(d), 'd MMMM, EEEE', { locale: ru });
}

/** «23 октября» */
export function formatDayMonthRu(d: LocalDate): string {
  return format(parseLD(d), 'd MMMM', { locale: ru });
}

/** «Пятница» */
export function formatWeekdayRu(d: LocalDate): string {
  return capitalize(format(parseLD(d), 'EEEE', { locale: ru }));
}

/** «Октябрь 2026». `month` — 1…12. */
export function formatMonthRu(year: number, month: number): string {
  return capitalize(format(new Date(year, month - 1, 1), 'LLLL yyyy', { locale: ru }));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
