import { describe, expect, it } from 'vitest';
import { addDaysLD } from './dates';
import { buildForecast, effectivePeriodLength } from './forecast';
import { DEFAULT_SETTINGS, type LocalDate, type Period, type Settings } from './types';

// Фича 017: производные прогноза — одна функция домена на величину (contracts/forecast-derivations.md).

const ld = (s: string) => s as LocalDate;
const p = (id: string, start: string, end: string | null = null, endEstimated = false): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated,
});

const S = DEFAULT_SETTINGS;
const S7: Settings = { ...S, defaultPeriodLength: 7 };

/** Закрытые месячные указанных длин, по одним на 28 дней с 2026-01-05. */
function closedSeries(lengths: number[], gap = 28): Period[] {
  return lengths.map((len, i) => {
    const start = addDaysLD(ld('2026-01-05'), i * gap);
    return { id: `s${i}`, start, end: addDaysLD(start, len - 1), endEstimated: false };
  });
}

/** Набор историй для проверки равенства с прогнозом (SC-005). */
const HISTORIES: Record<string, Period[]> = {
  'нет данных': [],
  'одна открытая': [p('a', '2026-08-01')],
  'одна закрытая': [p('a', '2026-08-01', '2026-08-03')],
  'оценочный конец текущих': [p('a', '2026-07-04', '2026-07-08'), p('b', '2026-08-01', '2026-08-04', true)],
  'оценочный конец, закрытый следующим': [p('a', '2026-07-04', '2026-07-07', true), p('b', '2026-08-01')],
  выбросы: [p('a', '2026-01-05', '2026-01-07'), p('b', '2026-03-16', '2026-03-20'), p('c', '2026-03-28', '2026-03-31')],
  'ручные концы': [p('a', '2026-06-06', '2026-06-08'), p('b', '2026-07-04', '2026-07-09'), p('c', '2026-08-01')],
  'больше 6 циклов': closedSeries([2, 2, 6, 6, 6, 6, 6, 6]),
  'неупорядоченный вход': [p('c', '2026-08-01'), p('a', '2026-06-06', '2026-06-09'), p('b', '2026-07-04', '2026-07-06')],
};

describe('effectivePeriodLength', () => {
  it('без истории — длина из настроек', () => {
    expect(effectivePeriodLength([], S)).toBe(5);
    expect(effectivePeriodLength([], S7)).toBe(7);
  });

  it('одна открытая — длина из настроек; одна закрытая — её длина', () => {
    expect(effectivePeriodLength([p('a', '2026-08-01')], S)).toBe(5);
    expect(effectivePeriodLength([p('a', '2026-08-01', '2026-08-03')], S)).toBe(3);
  });

  it('оценочный конец текущих не учитывается, закрытый следующим началом — учитывается (FR-014)', () => {
    expect(effectivePeriodLength([p('a', '2026-08-01', '2026-08-04', true)], S)).toBe(5);
    expect(effectivePeriodLength([p('a', '2026-08-01', '2026-08-04', true), p('b', '2026-08-29')], S)).toBe(4);
  });

  it('среднее по последним 6, с округлением', () => {
    expect(effectivePeriodLength(closedSeries([2, 2, 6, 6, 6, 6, 6, 6]), S)).toBe(6);
    expect(effectivePeriodLength(closedSeries([3, 4]), S)).toBe(4);
  });

  it('циклы-выбросы не исключают месячные из средней длины месячных', () => {
    expect(effectivePeriodLength(closedSeries([3, 5], 70), S)).toBe(4);
  });

  it('порядок входа не важен, вход не меняется', () => {
    const ps = HISTORIES['неупорядоченный вход']!;
    const before = structuredClone(ps);
    expect(effectivePeriodLength(ps, S)).toBe(effectivePeriodLength([...ps].reverse(), S));
    expect(ps).toEqual(before);
  });

  it('не зависит от «сегодня»: принимает только месячные и настройки', () => {
    expect(effectivePeriodLength.length).toBe(2);
  });

  describe('равна длине месячных в прогнозе (SC-005)', () => {
    const cases = Object.entries(HISTORIES).flatMap(([name, ps]) =>
      [S, S7].map((s) => [`${name}, по умолчанию ${s.defaultPeriodLength}`, ps, s] as const),
    );
    it.each(cases)('%s', (_name, ps, s) => {
      const f = buildForecast({ periods: ps, settings: s, today: ld('2026-11-14') });
      expect(effectivePeriodLength(ps, s)).toBe(f ? f.periodLength : s.defaultPeriodLength);
    });
  });
});
