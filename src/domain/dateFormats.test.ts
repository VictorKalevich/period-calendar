import { afterEach, describe, expect, it } from 'vitest';
import { formatDateNumeric, formatFullDateRu, formatRangeRu } from './dates';
import type { LocalDate } from './types';

// Фича 019 (FR-002, FR-003; research R4): числовая и полная дата — по одной функции в модуле дат.
// Календарные дни без времени суток: результат не зависит от часового пояса и летнего времени (Конституция IV).

const ld = (s: string) => s as LocalDate;
const originalTZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTZ;
});

const NUMERIC: Array<[string, string]> = [
  ['2026-11-08', '08.11.2026'],
  ['2024-02-29', '29.02.2024'],
  ['2017-12-23', '23.12.2017'],
  ['2027-01-01', '01.01.2027'],
  ['2026-12-31', '31.12.2026'],
];

const FULL: Array<[string, string]> = [
  ['2026-11-08', '8 ноября 2026'],
  ['2027-01-01', '1 января 2027'],
  ['2024-02-29', '29 февраля 2024'],
  ['2026-12-31', '31 декабря 2026'],
  // Переходы на летнее и зимнее время в США и в Европе.
  ['2026-03-08', '8 марта 2026'],
  ['2026-11-01', '1 ноября 2026'],
  ['2026-03-29', '29 марта 2026'],
  ['2026-10-25', '25 октября 2026'],
];

describe.each(['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Europe/Moscow'])('часовой пояс %s', (tz) => {
  it.each(NUMERIC)('formatDateNumeric(%s) → «%s»', (d, expected) => {
    process.env.TZ = tz;
    expect(formatDateNumeric(ld(d))).toBe(expected);
  });

  it.each(FULL)('formatFullDateRu(%s) → «%s»', (d, expected) => {
    process.env.TZ = tz;
    expect(formatFullDateRu(ld(d))).toBe(expected);
  });
});

describe('formatRangeRu через границу года — через полную дату', () => {
  it('«28 декабря 2026 – 2 января 2027»', () => {
    expect(formatRangeRu(ld('2026-12-28'), ld('2027-01-02'))).toBe(
      `${formatFullDateRu(ld('2026-12-28'))} – ${formatFullDateRu(ld('2027-01-02'))}`,
    );
  });
});
