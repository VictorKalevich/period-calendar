import { afterEach, describe, expect, it } from 'vitest';
import { buildForecast } from './forecast';
import { planReminders, OVULATION_REMINDER, PERIOD_REMINDER } from './reminders';
import { DEFAULT_SETTINGS, type LocalDate, type Period, type Settings } from './types';

const ld = (s: string) => s as LocalDate;
const originalTZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTZ;
});

const periods: Period[] = [{ id: 'a', start: ld('2026-03-01'), end: ld('2026-03-05'), endEstimated: false }];
const forecastAt = (today: string, ps: Period[] = periods) => buildForecast({ periods: ps, settings: DEFAULT_SETTINGS, today: ld(today) })!;
const localNoon = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8)), 12).toISOString();

describe('planReminders', () => {
  it('plans period reminders 2 days before each start and ovulation reminders, 6 cycles ahead', () => {
    const now = new Date(2026, 2, 2, 9);
    const r = planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, now);
    expect(r.filter((x) => x.kind === 'period').map((x) => x.id)).toEqual([
      'period:2026-03-27',
      'period:2026-04-24',
      'period:2026-05-22',
      'period:2026-06-19',
      'period:2026-07-17',
      'period:2026-08-14',
    ]);
    // 005: овуляция — 14-й день цикла (начало + 13)
    expect(r.filter((x) => x.kind === 'ovulation').map((x) => x.id)).toEqual([
      'ovulation:2026-03-14',
      'ovulation:2026-04-11',
      'ovulation:2026-05-09',
      'ovulation:2026-06-06',
      'ovulation:2026-07-04',
      'ovulation:2026-08-01',
    ]);
    expect(r.length).toBeLessThanOrEqual(24);
    expect(r.map((x) => x.sendAt)).toEqual([...r.map((x) => x.sendAt)].sort());
  });

  it('uses the exact texts (FR-022, FR-023)', () => {
    const r = planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, new Date(2026, 2, 2));
    expect(r.find((x) => x.kind === 'period')).toMatchObject({
      title: 'Календарь цикла',
      body: 'Ближайшие дни будь аккуратна, скоро начало цикла',
    });
    expect(r.find((x) => x.kind === 'ovulation')).toMatchObject({ title: 'Овуляция', body: 'Сегодня Ты КОРОЛЕВА' });
    expect(PERIOD_REMINDER.title).toBe('Календарь цикла');
    expect(OVULATION_REMINDER.body).toBe('Сегодня Ты КОРОЛЕВА');
  });

  it('sends at 12:00 local time across a DST change (case 14)', () => {
    process.env.TZ = 'Europe/Berlin';
    const r = planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, new Date(2026, 2, 2));
    const ov = r.find((x) => x.id === 'ovulation:2026-03-14')!;
    const ov2 = r.find((x) => x.id === 'ovulation:2026-04-11')!;
    expect(ov.sendAt).toBe('2026-03-14T11:00:00.000Z'); // CET, UTC+1
    expect(ov2.sendAt).toBe('2026-04-11T10:00:00.000Z'); // CEST, UTC+2
    expect(new Date(ov2.sendAt).getHours()).toBe(12);
  });

  it('skips reminders that are already due (case 15)', () => {
    const now = new Date(2026, 2, 14, 12, 30);
    const r = planReminders(forecastAt('2026-03-14'), DEFAULT_SETTINGS, now);
    expect(r.some((x) => x.id === 'ovulation:2026-03-14')).toBe(false);
    expect(r.every((x) => x.sendAt > now.toISOString())).toBe(true);
    const before = planReminders(forecastAt('2026-03-14'), DEFAULT_SETTINGS, new Date(2026, 2, 14, 11, 59));
    expect(before[0]!.id).toBe('ovulation:2026-03-14');
    expect(before[0]!.sendAt).toBe(localNoon('2026-03-14'));
  });

  it('puts the ovulation reminder on the shifted day (005)', () => {
    const settings = { ...DEFAULT_SETTINGS, ovulationShiftEnabled: true, ovulationShift: -2 };
    const f = buildForecast({ periods, settings, today: ld('2026-03-02') })!;
    const r = planReminders(f, settings, new Date(2026, 2, 2));
    expect(r.find((x) => x.kind === 'ovulation')!.id).toBe('ovulation:2026-03-12');
    expect(r.find((x) => x.kind === 'period')!.id).toBe('period:2026-03-27'); // начало месячных не сдвигается
  });

  it('puts the ovulation reminder on the corrected day before the next period (005 FR-003a)', () => {
    const settings = { ...DEFAULT_SETTINGS, ovulationShiftEnabled: true, ovulationShift: 5 };
    const ps: Period[] = [
      { id: 'a', start: ld('2026-02-12'), end: ld('2026-02-14'), endEstimated: false },
      { id: 'b', start: ld('2026-03-01'), end: ld('2026-03-03'), endEstimated: false },
    ];
    const f = buildForecast({ periods: ps, settings, today: ld('2026-03-02') })!;
    const r = planReminders(f, settings, new Date(2026, 2, 2));
    expect(r.filter((x) => x.kind === 'ovulation').map((x) => x.id).slice(0, 2)).toEqual([
      'ovulation:2026-03-17',
      'ovulation:2026-04-03',
    ]);
  });

  it('respects the switches (case 16)', () => {
    const now = new Date(2026, 2, 2);
    const noOv: Settings = { ...DEFAULT_SETTINGS, remindOvulation: false };
    expect(planReminders(forecastAt('2026-03-02'), noOv, now).every((x) => x.kind === 'period')).toBe(true);
    const noPeriod: Settings = { ...DEFAULT_SETTINGS, remindPeriod: false };
    expect(planReminders(forecastAt('2026-03-02'), noPeriod, now).every((x) => x.kind === 'ovulation')).toBe(true);
    expect(planReminders(forecastAt('2026-03-02'), { ...noOv, remindPeriod: false }, now)).toEqual([]);
  });

  it('plans nothing during a delay (case 22)', () => {
    const f = forecastAt('2026-04-01');
    expect(f.delayDays).toBe(3);
    expect(planReminders(f, DEFAULT_SETTINGS, new Date(2026, 3, 1))).toEqual([]);
  });
});
