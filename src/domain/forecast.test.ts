import { describe, expect, it } from 'vitest';
import { addDaysLD } from './dates';
import { buildForecast, todaySummary } from './forecast';
import { DEFAULT_SETTINGS, type DayContext, type LocalDate, type Period } from './types';

const ld = (s: string) => s as LocalDate;
const period = (id: string, start: string, end: string | null): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated: false,
});

describe('buildForecast', () => {
  it('returns null without any marks (case 1)', () => {
    expect(buildForecast({ periods: [], settings: DEFAULT_SETTINGS, today: ld('2026-03-05') })).toBeNull();
  });

  it('predicts from the default length with a single mark (case 2)', () => {
    const f = buildForecast({
      periods: [period('a', '2026-03-01', '2026-03-05')],
      settings: DEFAULT_SETTINGS,
      today: ld('2026-03-05'),
    })!;
    expect(f.cycleLength).toBe(28);
    expect(f.confidence).toBe('low');
    expect(f.delayDays).toBe(0);
    const current = f.cycles[0]!;
    expect(current).toMatchObject({ start: '2026-03-01', nextStart: '2026-03-29', ovulation: '2026-03-15', kind: 'current' });
    expect(current.fertile).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15']);
    expect(current.mediumDays).toEqual(['2026-03-08', '2026-03-09', '2026-03-16']);
    const next = f.cycles[1]!;
    expect(next).toMatchObject({ start: '2026-03-29', kind: 'predicted' });
    expect(next.periodDays).toEqual(['2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02']);
  });

  it('uses settings defaults when there is no history', () => {
    const f = buildForecast({
      periods: [period('a', '2026-03-01', null)],
      settings: { ...DEFAULT_SETTINGS, defaultCycleLength: 30, defaultPeriodLength: 4 },
      today: ld('2026-03-02'),
    })!;
    expect(f.cycleLength).toBe(30);
    expect(f.periodLength).toBe(4);
    expect(f.cycles[1]!.start).toBe('2026-03-31');
  });

  it('has normal confidence with three regular cycles', () => {
    const f = buildForecast({
      periods: [
        period('a', '2026-01-01', '2026-01-05'),
        period('b', '2026-01-29', '2026-02-02'),
        period('c', '2026-02-26', '2026-03-02'),
        period('d', '2026-03-26', '2026-03-30'),
      ],
      settings: DEFAULT_SETTINGS,
      today: ld('2026-04-01'),
    })!;
    expect(f.confidence).toBe('normal');
    expect(f.cycleLength).toBe(28);
    expect(f.periodLength).toBe(5);
  });

  it('crosses the year boundary (case 6)', () => {
    const f = buildForecast({ periods: [period('a', '2026-12-20', null)], settings: DEFAULT_SETTINGS, today: ld('2026-12-22') })!;
    expect(f.cycles[1]!.start).toBe('2027-01-17');
  });

  it('handles a leap February (case 7)', () => {
    const f = buildForecast({ periods: [period('a', '2028-02-15', null)], settings: DEFAULT_SETTINGS, today: ld('2028-02-16') })!;
    expect(f.cycles[1]!.start).toBe('2028-03-14');
  });

  it('shifts the forecast to today during a delay (case 8)', () => {
    const f = buildForecast({ periods: [period('a', '2026-09-01', '2026-09-05')], settings: DEFAULT_SETTINGS, today: ld('2026-10-02') })!;
    expect(f.delayDays).toBe(3);
    expect(f.cycles[0]!.nextStart).toBe('2026-10-02');
    expect(f.cycles[1]!).toMatchObject({ start: '2026-10-02', kind: 'predicted' });
    expect(f.cycles[2]!.start).toBe('2026-10-30');
  });

  it('is not a delay on the predicted day itself', () => {
    const f = buildForecast({ periods: [period('a', '2026-09-01', '2026-09-05')], settings: DEFAULT_SETTINGS, today: ld('2026-09-29') })!;
    expect(f.delayDays).toBe(0);
  });

  it('generates predicted cycles for a 12-month horizon', () => {
    const today = ld('2026-03-05');
    const f = buildForecast({ periods: [period('a', '2026-03-01', '2026-03-05')], settings: DEFAULT_SETTINGS, today })!;
    const predicted = f.cycles.filter((c) => c.kind === 'predicted');
    expect(predicted.at(-1)!.start <= '2027-03-05').toBe(true);
    expect(addDaysLD(predicted.at(-1)!.start, 28) > '2027-03-05').toBe(true);
    expect(predicted.length).toBe(13);
  });

  it('computes completed cycles retrospectively from the actual next start', () => {
    const f = buildForecast({
      periods: [period('a', '2026-01-01', '2026-01-05'), period('b', '2026-02-02', null)],
      settings: DEFAULT_SETTINGS,
      today: ld('2026-02-03'),
    })!;
    expect(f.cycles[0]).toMatchObject({ start: '2026-01-01', nextStart: '2026-02-02', ovulation: '2026-01-19', kind: 'completed' });
  });
});

describe('todaySummary', () => {
  const ctx = (periods: Period[], today: string): DayContext => {
    const forecast = buildForecast({ periods, settings: DEFAULT_SETTINGS, today: ld(today) });
    return { forecast, periods, settings: DEFAULT_SETTINGS, entries: new Set(), today: ld(today) };
  };

  it('is empty without marks (cases 1, 27)', () => {
    expect(todaySummary(ctx([], '2026-03-05'))).toEqual({
      cycleDay: null,
      probability: null,
      phase: null,
      daysToPeriod: null,
      daysToOvulation: null,
      nextPeriod: null,
      nextOvulation: null,
      nextFertile: null,
      delayDays: 0,
      confidence: null,
    });
  });

  it('summarises a regular day', () => {
    const s = todaySummary(ctx([period('a', '2026-03-01', '2026-03-05')], '2026-03-09'));
    expect(s).toMatchObject({
      cycleDay: 9,
      probability: 'medium',
      phase: 'follicular',
      daysToPeriod: 20,
      daysToOvulation: 6,
      nextPeriod: '2026-03-29',
      nextOvulation: '2026-03-15',
      nextFertile: { from: '2026-03-10', to: '2026-03-15' },
      delayDays: 0,
      confidence: 'low',
    });
  });

  it('points to the next cycle after this ovulation has passed', () => {
    const s = todaySummary(ctx([period('a', '2026-03-01', '2026-03-05')], '2026-03-20'));
    expect(s).toMatchObject({ phase: 'luteal', daysToOvulation: 23, nextOvulation: '2026-04-12', daysToPeriod: 9 });
  });

  it('hides the phase and counts days from the last start during a delay (case 27)', () => {
    const s = todaySummary(ctx([period('a', '2026-09-01', '2026-09-05')], '2026-10-02'));
    expect(s).toMatchObject({ delayDays: 3, phase: null, cycleDay: 32, daysToPeriod: 0 });
  });
});
