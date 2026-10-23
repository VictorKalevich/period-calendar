import { afterEach, describe, expect, it } from 'vitest';
import { addDaysLD, rangeLD } from './dates';
import { buildForecast, dayInfo } from './forecast';
import { DEFAULT_SETTINGS, type DayContext, type LocalDate, type Period } from './types';

const ld = (s: string) => s as LocalDate;
const originalTZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTZ;
});

function ctx(periods: Period[], today: string, entries: string[] = []): DayContext {
  return {
    forecast: null,
    periods,
    settings: DEFAULT_SETTINGS,
    entries: new Set(entries.map(ld)),
    today: ld(today),
  };
}

describe('dayInfo without forecast', () => {
  it('knows nothing before the first mark (case 13)', () => {
    const info = dayInfo(ld('2026-10-23'), ctx([], '2026-10-23'));
    expect(info).toMatchObject({ cycleDay: null, probability: null, period: null, phase: null, fertile: null });
    expect(info.isToday).toBe(true);
  });

  it('draws an open period: days up to today are actual, later days predicted (case 9)', () => {
    // Начало 3 дня назад, длина по умолчанию 5: 20–23 отмечены, 24-е — прогноз, 25-е — уже нет.
    const periods: Period[] = [{ id: 'a', start: ld('2026-10-20'), end: null, endEstimated: false }];
    const c = ctx(periods, '2026-10-23');
    const kinds = ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(
      (d) => dayInfo(ld(d), c).period,
    );
    expect(kinds).toEqual([null, 'actual', 'actual', 'actual', 'predicted', null]);
    expect(dayInfo(ld('2026-10-23'), c).cycleDay).toBe(4);
    expect(dayInfo(ld('2026-10-19'), c).cycleDay).toBeNull();
  });

  it('draws a closed period as actual', () => {
    const periods: Period[] = [{ id: 'a', start: ld('2026-09-28'), end: ld('2026-09-30'), endEstimated: false }];
    const c = ctx(periods, '2026-10-23');
    expect(dayInfo(ld('2026-09-30'), c).period).toBe('actual');
    expect(dayInfo(ld('2026-10-01'), c).period).toBeNull();
    expect(dayInfo(ld('2026-10-01'), c).cycleDay).toBe(4);
  });

  it('flags today and days with entries', () => {
    const c = ctx([], '2026-10-23', ['2026-10-20']);
    expect(dayInfo(ld('2026-10-20'), c).hasEntry).toBe(true);
    expect(dayInfo(ld('2026-10-20'), c).isToday).toBe(false);
    expect(dayInfo(ld('2026-10-21'), c).hasEntry).toBe(false);
  });

  it('gives identical results in different time zones (case 23)', () => {
    process.env.TZ = 'Asia/Tokyo';
    const fTokyo = buildForecast({ periods: [{ id: 'a', start: ld('2026-09-25'), end: null, endEstimated: false }], settings: DEFAULT_SETTINGS, today: ld('2026-10-23') });
    process.env.TZ = 'America/Los_Angeles';
    const fLA = buildForecast({ periods: [{ id: 'a', start: ld('2026-09-25'), end: null, endEstimated: false }], settings: DEFAULT_SETTINGS, today: ld('2026-10-23') });
    expect(fLA).toEqual(fTokyo);
    const periods: Period[] = [
      { id: 'a', start: ld('2026-09-25'), end: ld('2026-09-29'), endEstimated: false },
      { id: 'b', start: ld('2026-10-21'), end: null, endEstimated: false },
    ];
    const days = ['2026-09-24', '2026-09-25', '2026-09-29', '2026-10-20', '2026-10-21', '2026-10-23', '2026-10-26'];
    const run = () => days.map((d) => dayInfo(ld(d), ctx(periods, '2026-10-23')));
    process.env.TZ = 'Asia/Tokyo';
    const tokyo = run();
    process.env.TZ = 'America/Los_Angeles';
    const la = run();
    expect(la).toEqual(tokyo);
  });
});

describe('dayInfo with forecast', () => {
  function withForecast(periods: Period[], today: string): DayContext {
    const forecast = buildForecast({ periods, settings: DEFAULT_SETTINGS, today: ld(today) });
    return { forecast, periods, settings: DEFAULT_SETTINGS, entries: new Set(), today: ld(today) };
  }
  const single = [{ id: 'a', start: ld('2026-03-01'), end: ld('2026-03-05'), endEstimated: false }];

  it('assigns conception probability by window (FR-018)', () => {
    const c = withForecast(single, '2026-03-02');
    const p = (d: string) => dayInfo(ld(d), c).probability;
    expect(p('2026-03-07')).toBe('low');
    expect(p('2026-03-08')).toBe('medium');
    expect(p('2026-03-09')).toBe('medium');
    for (const d of rangeLD(ld('2026-03-10'), ld('2026-03-15'))) expect(p(d)).toBe('high');
    expect(p('2026-03-16')).toBe('medium');
    expect(p('2026-03-17')).toBe('low');
    expect(p('2026-02-28')).toBeNull();
  });

  it('marks ovulation and predicted periods', () => {
    const c = withForecast(single, '2026-03-02');
    expect(dayInfo(ld('2026-03-15'), c).ovulation).toBe(true);
    expect(dayInfo(ld('2026-03-14'), c).ovulation).toBe(false);
    expect(dayInfo(ld('2026-03-29'), c).period).toBe('predicted');
    expect(dayInfo(ld('2026-04-02'), c).period).toBe('predicted');
    expect(dayInfo(ld('2026-04-03'), c).period).toBeNull();
    expect(dayInfo(ld('2026-03-30'), c).cycleDay).toBe(2);
  });

  it('lets an actual period override a predicted one', () => {
    const periods = [...single, { id: 'b', start: ld('2026-03-27'), end: ld('2026-03-30'), endEstimated: false }];
    const c = withForecast(periods, '2026-03-30');
    expect(dayInfo(ld('2026-03-29'), c).period).toBe('actual');
  });

  it('draws an open period by the forecast period length (I3)', () => {
    const periods: Period[] = [
      { id: 'a', start: ld('2026-01-01'), end: ld('2026-01-03'), endEstimated: false },
      { id: 'b', start: ld('2026-01-29'), end: ld('2026-01-31'), endEstimated: false },
      { id: 'c', start: ld('2026-02-26'), end: null, endEstimated: false },
    ];
    const c = withForecast(periods, '2026-02-26');
    expect(c.forecast!.periodLength).toBe(3);
    expect(dayInfo(ld('2026-02-28'), c).period).toBe('predicted');
    expect(dayInfo(ld('2026-03-01'), c).period).toBeNull();
  });

  it('marks window days before today as past, in the current cycle too (case 28)', () => {
    const c = withForecast(single, '2026-03-12');
    expect(dayInfo(ld('2026-03-11'), c).fertile).toBe('past');
    expect(dayInfo(ld('2026-03-12'), c).fertile).toBe('predicted');
    expect(dayInfo(ld('2026-03-15'), c)).toMatchObject({ fertile: 'predicted', ovulation: true });

    const later = withForecast(
      [...single, { id: 'b', start: ld('2026-03-29'), end: ld('2026-04-02'), endEstimated: false }],
      '2026-04-05',
    );
    expect(dayInfo(ld('2026-03-15'), later)).toMatchObject({ fertile: 'past', ovulation: true });
  });

  it('determines the cycle phase (FR-019b, case 25)', () => {
    const c = withForecast(single, '2026-03-02');
    const phase = (d: string) => dayInfo(ld(d), c).phase;
    for (const d of rangeLD(ld('2026-03-01'), ld('2026-03-05'))) expect(phase(d)).toBe('menstrual');
    for (const d of rangeLD(ld('2026-03-06'), ld('2026-03-14'))) expect(phase(d)).toBe('follicular');
    expect(phase('2026-03-15')).toBe('ovulation');
    for (const d of rangeLD(ld('2026-03-16'), ld('2026-03-28'))) expect(phase(d)).toBe('luteal');
    expect(phase('2026-03-29')).toBe('menstrual');
    expect(phase('2026-02-27')).toBeNull();
  });

  it('prefers menstrual over ovulation in a very short cycle (case 26)', () => {
    const periods: Period[] = [];
    let start = ld('2026-01-01');
    for (let i = 0; i < 4; i++) {
      periods.push({ id: `p${i}`, start, end: addDaysLD(start, 4), endEstimated: false });
      start = addDaysLD(start, 15);
    }
    const c = withForecast(periods, '2026-02-15');
    expect(c.forecast!.cycleLength).toBe(15);
    const ov = c.forecast!.cycles.find((x) => x.start === '2026-02-15')!.ovulation;
    expect(ov).toBe('2026-02-16');
    expect(dayInfo(ov, c)).toMatchObject({ phase: 'menstrual', ovulation: true });
  });
});
