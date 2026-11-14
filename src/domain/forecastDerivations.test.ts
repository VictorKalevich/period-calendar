import { afterEach, describe, expect, it } from 'vitest';
import { buildCycles, buildPeriodCycles } from './cycles';
import { addDaysLD } from './dates';
import { buildForecast, effectivePeriodLength, nextPredictedStart, originalPredictedStart } from './forecast';
import { sortByStart } from './periods';
import { DEFAULT_SETTINGS, type Forecast, type LocalDate, type Period, type Settings } from './types';

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

describe('originalPredictedStart и nextPredictedStart', () => {
  // Прогноз следующих — 2026-03-30 (цикл 28 дней).
  const REG = [p('a', '2026-01-05', '2026-01-09'), p('b', '2026-02-02', '2026-02-06'), p('c', '2026-03-02', '2026-03-06')];
  const f = (today: string, periods: Period[] = REG): Forecast => buildForecast({ periods, settings: S, today: ld(today) })!;
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it.each([
    ['задержки нет', '2026-03-20', 0, '2026-03-30', '2026-03-30'],
    ['прогноз — сегодня', '2026-03-30', 0, '2026-03-30', '2026-03-30'],
    ['задержка 1 день', '2026-03-31', 1, '2026-03-30', '2026-03-31'],
    ['задержка 15 дней', '2026-04-14', 15, '2026-03-30', '2026-04-14'],
  ])('%s: исходная и ближайшая прогнозные даты', (_name, today, delay, original, next) => {
    const forecast = f(today);
    expect(forecast.delayDays).toBe(delay);
    expect(originalPredictedStart(forecast)).toBe(original);
    expect(nextPredictedStart(forecast, ld(today))).toBe(next);
  });

  it.each(['2026-03-20', '2026-03-30', '2026-03-31', '2026-04-14'])(
    'сегодня %s: исходная дата = начало текущего цикла + длина цикла',
    (today) => {
      const forecast = f(today);
      const current = forecast.cycles.find((c) => c.kind === 'current')!;
      expect(originalPredictedStart(forecast)).toBe(addDaysLD(current.start, forecast.cycleLength));
    },
  );

  it('переход года и високосный год', () => {
    const year = f('2026-01-03', [p('a', '2025-11-06', '2025-11-10'), p('b', '2025-12-04', '2025-12-08')]);
    expect(originalPredictedStart(year)).toBe('2026-01-01');
    expect(nextPredictedStart(year, ld('2026-01-03'))).toBe('2026-01-03');
    const leap = f('2028-03-02', [p('a', '2028-01-04', '2028-01-08'), p('b', '2028-02-01', '2028-02-05')]);
    expect(originalPredictedStart(leap)).toBe('2028-02-29');
    expect(nextPredictedStart(leap, ld('2028-03-02'))).toBe('2028-03-02');
  });

  it('без текущего цикла в прогнозе исходной даты нет', () => {
    const forecast = f('2026-03-31');
    expect(originalPredictedStart({ ...forecast, cycles: forecast.cycles.filter((c) => c.kind !== 'current') })).toBeNull();
  });

  it('без прогнозных циклов в горизонте ближайшей даты нет', () => {
    const forecast = buildForecast({ periods: REG, settings: S, today: ld('2026-03-20'), horizonMonths: 0 })!;
    expect(forecast.cycles.some((c) => c.kind === 'predicted')).toBe(false);
    expect(nextPredictedStart(forecast, ld('2026-03-20'))).toBeNull();
  });

  it('прогноз не меняется', () => {
    const forecast = f('2026-03-31');
    const before = structuredClone(forecast);
    originalPredictedStart(forecast);
    nextPredictedStart(forecast, ld('2026-03-31'));
    expect(forecast).toEqual(before);
  });

  it('одинаковые результаты в разных часовых поясах и при переходе на летнее время (Конституция IV)', () => {
    const run = () =>
      ['2026-03-20', '2026-03-31', '2026-04-14'].map((today) => {
        const forecast = f(today);
        return [originalPredictedStart(forecast), nextPredictedStart(forecast, ld(today)), effectivePeriodLength(REG, S)];
      });
    process.env.TZ = 'Asia/Tokyo';
    const tokyo = run();
    process.env.TZ = 'America/Los_Angeles';
    const la = run();
    // Europe/Berlin переходит на летнее время 2026-03-29 — за день до прогноза 2026-03-30.
    process.env.TZ = 'Europe/Berlin';
    const berlin = run();
    expect(la).toEqual(tokyo);
    expect(berlin).toEqual(tokyo);
    expect(tokyo[1]).toEqual(['2026-03-30', '2026-03-31', 5]);
  });
});

describe('sortByStart и buildPeriodCycles', () => {
  const sameStart = [p('a', '2026-09-01', '2026-09-03'), p('b', '2026-09-01', '2026-09-06'), p('c', '2026-09-29', '2026-10-02')];

  it('sortByStart: новый массив по возрастанию начала, в том числе через год; вход не меняется', () => {
    const input = [p('c', '2026-01-01'), p('a', '2025-12-31', '2026-01-03'), p('b', '2025-02-10', '2025-02-14')];
    const before = structuredClone(input);
    const sorted = sortByStart(input);
    expect(sorted).not.toBe(input);
    expect(sorted.map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(input).toEqual(before);
  });

  it('sortByStart: равные начала — в порядке входа', () => {
    expect(sortByStart([sameStart[2]!, sameStart[1]!, sameStart[0]!]).map((x) => x.id)).toEqual(['b', 'a', 'c']);
    expect(sortByStart(sameStart).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('buildPeriodCycles: пары в порядке sortByStart, месячные — те же объекты', () => {
    const input = HISTORIES['неупорядоченный вход']!;
    const pairs = buildPeriodCycles(input);
    expect(pairs.map((x) => x.period.id)).toEqual(sortByStart(input).map((x) => x.id));
    for (const pair of pairs) expect(input).toContain(pair.period);
    expect(pairs.find((x) => x.period.id === 'a')!.period).toBe(input[1]);
    expect(buildPeriodCycles([])).toEqual([]);
  });

  const histories = [...Object.entries(HISTORIES), ['одинаковые начала', sameStart] as const];
  it.each(histories)('buildPeriodCycles: циклы пар — те же, что у buildCycles (%s)', (_name, ps) => {
    expect(buildPeriodCycles(ps).map((x) => x.cycle)).toEqual(buildCycles(ps));
  });
});
