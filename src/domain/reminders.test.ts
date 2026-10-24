import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { buildForecast } from './forecast';
import {
  planReminders,
  toServerReminders,
  MISSED_PERIOD_REMINDER,
  NOTIFICATION_TITLE,
  OVULATION_REMINDER,
  PERIOD_REMINDER,
} from './reminders';
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

  it('в режиме «от следующей менструации» напоминание об овуляции — на новую дату (006)', () => {
    const settings = { ...DEFAULT_SETTINGS, ovulationFromNextPeriod: true };
    const f = buildForecast({ periods, settings, today: ld('2026-03-02') })!;
    const r = planReminders(f, settings, new Date(2026, 2, 2, 9)).filter((x) => x.kind === 'ovulation');
    expect(r.map((x) => x.id).slice(0, 2)).toEqual(['ovulation:2026-03-15', 'ovulation:2026-04-12']);
    expect(r[0]!.sendAt).toBe(localNoon('2026-03-15'));
  });

  it('uses the exact texts and one title for all kinds (FR-022, FR-023, 007 FR-003, FR-007 — M8)', () => {
    const r = planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, new Date(2026, 2, 2));
    expect(r.find((x) => x.kind === 'period')).toMatchObject({
      title: 'Календарь цикла',
      body: 'Ближайшие дни будь аккуратна, скоро начало цикла',
    });
    expect(r.find((x) => x.kind === 'ovulation')).toMatchObject({ title: 'Календарь цикла', body: 'Сегодня Ты КОРОЛЕВА' });
    expect(r.find((x) => x.kind === 'missedPeriod')).toMatchObject({
      title: 'Календарь цикла',
      body: 'Похоже, месячные уже начались — не забудь отметить их в календаре',
    });
    expect(r.every((x) => x.title === 'Календарь цикла')).toBe(true);
    expect(PERIOD_REMINDER.body).toBe('Ближайшие дни будь аккуратна, скоро начало цикла');
    expect(OVULATION_REMINDER.body).toBe('Сегодня Ты КОРОЛЕВА');
    expect(MISSED_PERIOD_REMINDER.body).toBe('Похоже, месячные уже начались — не забудь отметить их в календаре');
  });

  it('uses the app name from the manifest as the title (007 FR-007 — M10)', () => {
    const config = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    expect(NOTIFICATION_TITLE).toBe(/\bname:\s*'([^']+)'/.exec(config)?.[1]);
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
    const noOv: Settings = { ...DEFAULT_SETTINGS, remindOvulation: false, remindMissedPeriod: false };
    expect(planReminders(forecastAt('2026-03-02'), noOv, now).every((x) => x.kind === 'period')).toBe(true);
    const noPeriod: Settings = { ...DEFAULT_SETTINGS, remindPeriod: false, remindMissedPeriod: false };
    expect(planReminders(forecastAt('2026-03-02'), noPeriod, now).every((x) => x.kind === 'ovulation')).toBe(true);
    expect(planReminders(forecastAt('2026-03-02'), { ...noOv, remindPeriod: false }, now)).toEqual([]);
  });

  it('plans nothing during a delay of 3+ days (case 22, 007 FR-005)', () => {
    const f = forecastAt('2026-04-01');
    expect(f.delayDays).toBe(3);
    expect(planReminders(f, DEFAULT_SETTINGS, new Date(2026, 3, 1))).toEqual([]);
  });

  it('plans only the missed-period reminder during a delay, nothing when it is off (007 FR-005)', () => {
    const f = forecastAt('2026-03-30');
    expect(f.delayDays).toBe(1);
    expect(planReminders(f, DEFAULT_SETTINGS, new Date(2026, 2, 30, 9)).map((x) => x.kind)).toEqual(['missedPeriod']);
    expect(planReminders(f, { ...DEFAULT_SETTINGS, remindMissedPeriod: false }, new Date(2026, 2, 30, 9))).toEqual([]);
  });
});

// Фича 007: «Похоже, месячные уже начались» — 12:00 на 3-й день после прогнозного начала (прогноз + 2).
describe('missed-period reminder (007)', () => {
  const missed = (today: string, now: Date, ps: Period[] = periods, settings: Settings = DEFAULT_SETTINGS) =>
    planReminders(buildForecast({ periods: ps, settings, today: ld(today) })!, settings, now).filter((x) => x.kind === 'missedPeriod');

  it('M1: plans one per upcoming cycle, 2 days after each predicted start', () => {
    const now = new Date(2026, 2, 2, 9);
    expect(missed('2026-03-02', now).map((x) => x.id)).toEqual([
      'missed-period:2026-03-31',
      'missed-period:2026-04-28',
      'missed-period:2026-05-26',
      'missed-period:2026-06-23',
      'missed-period:2026-07-21',
      'missed-period:2026-08-18',
    ]);
    const all = planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, now);
    expect(all.length).toBeLessThanOrEqual(24);
    expect(all.map((x) => x.sendAt)).toEqual([...all.map((x) => x.sendAt)].sort());
  });

  it('M2: none when the switch is off, other kinds unchanged', () => {
    const now = new Date(2026, 2, 2, 9);
    const off = { ...DEFAULT_SETTINGS, remindMissedPeriod: false };
    const r = planReminders(forecastAt('2026-03-02'), off, now);
    expect(r.some((x) => x.kind === 'missedPeriod')).toBe(false);
    expect(r).toEqual(planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, now).filter((x) => x.kind !== 'missedPeriod'));
  });

  it('M3: delay of 1 day — exactly the reminder for the original prediction', () => {
    const r = planReminders(forecastAt('2026-03-30'), DEFAULT_SETTINGS, new Date(2026, 2, 30, 9));
    expect(r.map((x) => x.id)).toEqual(['missed-period:2026-03-31']);
    expect(r[0]!.sendAt).toBe(localNoon('2026-03-31'));
  });

  it('M4: delay of 2 days — before noon planned for today, after noon nothing', () => {
    expect(planReminders(forecastAt('2026-03-31'), DEFAULT_SETTINGS, new Date(2026, 2, 31, 9)).map((x) => x.id)).toEqual([
      'missed-period:2026-03-31',
    ]);
    expect(planReminders(forecastAt('2026-03-31'), DEFAULT_SETTINGS, new Date(2026, 2, 31, 13))).toEqual([]);
  });

  it('M5: delay of 3 days — no repeats', () => {
    expect(missed('2026-04-01', new Date(2026, 3, 1, 9))).toEqual([]);
    expect(missed('2026-04-05', new Date(2026, 3, 5, 9))).toEqual([]);
  });

  it('M6: a start marked before the prediction removes the old reminder', () => {
    const ps: Period[] = [...periods, { id: 'b', start: ld('2026-03-27'), end: null, endEstimated: false }];
    const f = buildForecast({ periods: ps, settings: DEFAULT_SETTINGS, today: ld('2026-03-28') })!;
    const current = f.cycles.find((c) => c.kind === 'current')!;
    const r = missed('2026-03-28', new Date(2026, 2, 28, 9), ps);
    expect(r.some((x) => x.id === 'missed-period:2026-03-31')).toBe(false);
    const next = new Date(Number(current.nextStart.slice(0, 4)), Number(current.nextStart.slice(5, 7)) - 1, Number(current.nextStart.slice(8)) + 2);
    expect(r[0]!.sendAt).toBe(new Date(next.getFullYear(), next.getMonth(), next.getDate(), 12).toISOString());
  });

  it('M7: crosses the year boundary', () => {
    const ps: Period[] = [{ id: 'a', start: ld('2026-12-03'), end: ld('2026-12-07'), endEstimated: false }];
    expect(missed('2026-12-04', new Date(2026, 11, 4, 9), ps)[0]!.id).toBe('missed-period:2027-01-02');
  });

  it('M9: sends at 12:00 local time across a DST change', () => {
    process.env.TZ = 'Europe/Berlin';
    // Прогноз 29.03.2026 (переход на летнее время в эту ночь) → напоминание 31.03, CEST.
    const r = missed('2026-03-02', new Date(2026, 2, 2, 9));
    expect(r[0]!.sendAt).toBe('2026-03-31T10:00:00.000Z');
    expect(new Date(r[0]!.sendAt).getHours()).toBe(12);
  });
});

// Конституция I, 007 FR-009 / SC-004: на сервер уходят ровно id, sendAt, title, body.
describe('toServerReminders (M11)', () => {
  it('keeps exactly id, sendAt, title and body', () => {
    const planned = planReminders(forecastAt('2026-03-02'), DEFAULT_SETTINGS, new Date(2026, 2, 2, 9));
    expect(new Set(planned.map((x) => x.kind))).toEqual(new Set(['period', 'ovulation', 'missedPeriod']));
    const sent = toServerReminders(planned);
    expect(sent).toHaveLength(planned.length);
    sent.forEach((r, i) => {
      expect(Object.keys(r).sort()).toEqual(['body', 'id', 'sendAt', 'title']);
      const { id, sendAt, title, body } = planned[i]!;
      expect(r).toEqual({ id, sendAt, title, body });
    });
  });

  it('returns an empty list for no reminders', () => {
    expect(toServerReminders([])).toEqual([]);
  });
});
