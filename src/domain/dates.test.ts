import { afterEach, describe, expect, it } from 'vitest';
import {
  addDaysLD,
  diffDays,
  formatDayRu,
  formatMonthRu,
  formatRangeRu,
  monthGrid,
  parseLD,
  toLocalDate,
} from './dates';
import type { LocalDate } from './types';

const ld = (s: string) => s as LocalDate;
const originalTZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTZ;
});

describe('addDaysLD', () => {
  it('crosses month and year boundaries', () => {
    expect(addDaysLD(ld('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDaysLD(ld('2026-03-31'), 1)).toBe('2026-04-01');
    expect(addDaysLD(ld('2027-01-01'), -1)).toBe('2026-12-31');
  });

  it('handles leap days', () => {
    expect(addDaysLD(ld('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDaysLD(ld('2028-02-29'), 1)).toBe('2028-03-01');
    expect(addDaysLD(ld('2027-02-28'), 1)).toBe('2027-03-01');
  });

  it('is stable across DST transitions', () => {
    for (const tz of ['Europe/Moscow', 'Europe/Berlin', 'America/New_York']) {
      process.env.TZ = tz;
      expect(addDaysLD(ld('2026-03-28'), 1)).toBe('2026-03-29');
      expect(addDaysLD(ld('2026-03-29'), 1)).toBe('2026-03-30');
      expect(addDaysLD(ld('2026-10-25'), 1)).toBe('2026-10-26');
    }
  });
});

describe('diffDays', () => {
  it('counts calendar days across DST changes', () => {
    for (const tz of ['Europe/Moscow', 'Europe/Berlin', 'America/New_York']) {
      process.env.TZ = tz;
      expect(diffDays(ld('2026-03-29'), ld('2026-03-28'))).toBe(1);
      expect(diffDays(ld('2026-03-30'), ld('2026-03-28'))).toBe(2);
      expect(diffDays(ld('2026-10-26'), ld('2026-10-24'))).toBe(2);
    }
  });

  it('is negative when a is before b and crosses years', () => {
    expect(diffDays(ld('2026-12-20'), ld('2027-01-17'))).toBe(-28);
    expect(diffDays(ld('2027-01-17'), ld('2026-12-20'))).toBe(28);
  });
});

describe('toLocalDate / parseLD', () => {
  it('formats a local Date as YYYY-MM-DD', () => {
    expect(toLocalDate(new Date(2026, 9, 23, 23, 59))).toBe('2026-10-23');
    expect(toLocalDate(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('round-trips', () => {
    expect(toLocalDate(parseLD(ld('2028-02-29')))).toBe('2028-02-29');
  });
});

describe('monthGrid', () => {
  const months: Array<[number, number]> = [];
  for (let y = 2026; y <= 2028; y++) for (let m = 1; m <= 12; m++) months.push([y, m]);

  it.each(months)('%i-%i starts on Monday and contains every day of the month', (year, month) => {
    const grid = monthGrid(year, month);
    expect([35, 42]).toContain(grid.length);
    expect(parseLD(grid[0]!).getDay()).toBe(1);
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const inMonth = grid.filter((d) => d.startsWith(prefix));
    expect(inMonth).toHaveLength(daysInMonth);
    for (let i = 1; i < grid.length; i++) expect(diffDays(grid[i]!, grid[i - 1]!)).toBe(1);
  });

  it('pads a 4-week February to 5 rows', () => {
    expect(monthGrid(2027, 2)).toHaveLength(35);
  });
});

describe('Russian formatting', () => {
  it('formats a day with month in genitive and weekday', () => {
    expect(formatDayRu(ld('2026-10-23'))).toBe('23 октября, пятница');
  });

  it('formats a month title capitalised', () => {
    expect(formatMonthRu(2026, 10)).toBe('Октябрь 2026');
  });

  it('formats date ranges', () => {
    expect(formatRangeRu(ld('2026-10-01'), ld('2026-10-05'))).toBe('1–5 октября');
    expect(formatRangeRu(ld('2026-09-30'), ld('2026-10-04'))).toBe('30 сентября – 4 октября');
    expect(formatRangeRu(ld('2026-12-28'), ld('2027-01-02'))).toBe('28 декабря 2026 – 2 января 2027');
    expect(formatRangeRu(ld('2026-10-05'), ld('2026-10-05'))).toBe('5 октября');
  });
});
