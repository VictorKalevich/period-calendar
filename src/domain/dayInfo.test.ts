import { afterEach, describe, expect, it } from 'vitest';
import { dayInfo } from './forecast';
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
