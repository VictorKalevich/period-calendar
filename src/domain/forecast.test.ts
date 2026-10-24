import { describe, expect, it } from 'vitest';
import { addDaysLD } from './dates';
import { buildForecast, todaySummary } from './forecast';
import { DEFAULT_SETTINGS, type DayContext, type LocalDate, type Period, type Settings } from './types';

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
    // 005: овуляция — 14-й день цикла (начало + 13)
    expect(current).toMatchObject({ start: '2026-03-01', nextStart: '2026-03-29', ovulation: '2026-03-14', kind: 'current' });
    expect(current.fertile).toEqual(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14']);
    expect(current.mediumDays).toEqual(['2026-03-07', '2026-03-08', '2026-03-15']);
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
    expect(f.cycles[0]).toMatchObject({ start: '2026-01-01', nextStart: '2026-02-02', ovulation: '2026-01-14', kind: 'completed' });
  });
});

describe('овуляция — 14-й день цикла и личный сдвиг (005)', () => {
  const shift = (enabled: boolean, value: number): Settings => ({ ...DEFAULT_SETTINGS, ovulationShiftEnabled: enabled, ovulationShift: value });
  const cyclesOf = (periods: Period[], today: string, settings: Settings = DEFAULT_SETTINGS) =>
    buildForecast({ periods, settings, today: ld(today) })!.cycles;

  it.each([
    ['2026-12-25', '2027-01-07'],
    ['2028-02-20', '2028-03-04'],
    ['2026-01-31', '2026-02-13'],
  ])('начало %s → овуляция %s (через месяц и год, високосный)', (start, ov) => {
    expect(cyclesOf([period('a', start, null)], start)[0]!.ovulation).toBe(ov);
  });

  it.each([21, 45])('цикл %i дней: овуляция на 14-й день каждого цикла, прошлого и прогнозного', (len) => {
    const second = addDaysLD(ld('2026-01-01'), len);
    const third = addDaysLD(second, len);
    const periods = [period('a', '2026-01-01', '2026-01-05'), period('b', second, addDaysLD(second, 4)), period('c', third, addDaysLD(third, 4))];
    const cycles = cyclesOf(periods, addDaysLD(third, 1));
    for (const c of cycles.slice(0, 6)) expect(c.ovulation).toBe(addDaysLD(c.start, 13));
    expect(cycles.map((c) => c.kind).slice(0, 4)).toEqual(['completed', 'completed', 'current', 'predicted']);
  });

  it.each([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5])('включённый сдвиг %i: овуляция = начало + 13 + сдвиг, окно и средние сдвигаются', (s) => {
    const c = cyclesOf([period('a', '2026-03-01', '2026-03-05')], '2026-03-02', shift(true, s))[0]!;
    const ov = addDaysLD(ld('2026-03-01'), 13 + s);
    expect(c.ovulation).toBe(ov);
    expect(c.fertile).toEqual([-5, -4, -3, -2, -1, 0].map((d) => addDaysLD(ov, d)));
    expect(c.mediumDays).toEqual([addDaysLD(ov, -7), addDaysLD(ov, -6), addDaysLD(ov, 1)]);
  });

  it('выключенный сдвиг не применяется, даже если значение сохранено', () => {
    expect(cyclesOf([period('a', '2026-03-01', '2026-03-05')], '2026-03-02', shift(false, 3))[0]!.ovulation).toBe('2026-03-14');
  });

  it('задержка не сдвигает овуляцию текущего цикла', () => {
    const f = buildForecast({ periods: [period('a', '2026-09-01', '2026-09-05')], settings: DEFAULT_SETTINGS, today: ld('2026-10-02') })!;
    expect(f.delayDays).toBe(3);
    expect(f.cycles[0]!.ovulation).toBe('2026-09-14');
  });
});

describe('овуляция не позже дня перед следующими месячными (005 FR-003a)', () => {
  const shift = (value: number): Settings => ({ ...DEFAULT_SETTINGS, ovulationShiftEnabled: value !== 0, ovulationShift: value });
  const pastCycle = (nextStart: string, s: number) =>
    buildForecast({
      periods: [period('a', '2026-03-01', '2026-03-05'), period('b', nextStart, null)],
      settings: shift(s),
      today: ld(nextStart),
    })!.cycles[0]!;

  it('цикл 17 дней со сдвигом +5: овуляция — день перед месячными, окно сдвигается с ней', () => {
    const c = pastCycle('2026-03-18', 5);
    expect(c).toMatchObject({ kind: 'completed', ovulation: '2026-03-17' });
    expect(c.fertile).toEqual(['2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17']);
    expect(c.mediumDays).toEqual(['2026-03-10', '2026-03-11', '2026-03-18']);
  });

  it('цикл 15 дней без сдвига: обычный 14-й день, ограничение не срабатывает', () => {
    expect(pastCycle('2026-03-16', 0).ovulation).toBe('2026-03-14');
  });

  it.each([
    [1, '2026-03-15'], // расчёт ровно в день перед месячными — не меняется
    [2, '2026-03-15'], // расчёт в день месячных — переносится на день раньше
  ])('граница, цикл 15 дней, сдвиг +%i → %s', (s, ov) => {
    expect(pastCycle('2026-03-16', s).ovulation).toBe(ov);
  });

  const shortHistory = [period('a', '2026-01-01', '2026-01-03'), period('b', '2026-01-18', '2026-01-20'), period('c', '2026-02-04', '2026-02-06')];

  it('прогнозные циклы при средней длине 17 и сдвиге +5', () => {
    const f = buildForecast({ periods: shortHistory, settings: shift(5), today: ld('2026-02-05') })!;
    expect(f.cycleLength).toBe(17);
    for (const c of f.cycles) expect(c.ovulation).toBe(addDaysLD(c.nextStart, -1));
    expect(f.cycles.find((c) => c.kind === 'current')).toMatchObject({ nextStart: '2026-02-21', ovulation: '2026-02-20' });
  });

  it('при задержке граница — прогнозное начало, а не «сегодня»', () => {
    const f = buildForecast({ periods: shortHistory, settings: shift(5), today: ld('2026-02-25') })!;
    expect(f.delayDays).toBe(4);
    expect(f.cycles.find((c) => c.kind === 'current')!.ovulation).toBe('2026-02-20');
  });
});

describe('режим «от следующей менструации» (006)', () => {
  const mode = (shift = 0, enabled = shift !== 0): Settings => ({
    ...DEFAULT_SETTINGS,
    ovulationFromNextPeriod: true,
    ovulationShiftEnabled: enabled,
    ovulationShift: shift,
  });
  const cyclesOf = (periods: Period[], today: string, settings: Settings = mode()) =>
    buildForecast({ periods, settings, today: ld(today) })!.cycles;

  it('прошлый цикл 35 дней: овуляция за 14 дней до следующих, окно и средние — от неё', () => {
    const c = cyclesOf([period('a', '2026-03-01', '2026-03-05'), period('b', '2026-04-05', '2026-04-09')], '2026-04-10')[0]!;
    expect(c).toMatchObject({ kind: 'completed', ovulation: '2026-03-22' });
    expect(c.fertile).toEqual(['2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20', '2026-03-21', '2026-03-22']);
    expect(c.mediumDays).toEqual(['2026-03-15', '2026-03-16', '2026-03-23']);
  });

  it('текущий цикл — от прогнозного начала; одна отметка без истории — длина по умолчанию 28', () => {
    const periods = [period('a', '2026-10-01', '2026-10-05')];
    expect(cyclesOf(periods, '2026-10-05')[0]).toMatchObject({ kind: 'current', nextStart: '2026-10-29', ovulation: '2026-10-15' });
  });

  it('задержка не сдвигает овуляцию текущего цикла', () => {
    const f = buildForecast({ periods: [period('a', '2026-10-01', '2026-10-05')], settings: mode(), today: ld('2026-11-01') })!;
    expect(f.delayDays).toBe(3);
    expect(f.cycles[0]!.ovulation).toBe('2026-10-15');
  });

  it('прогнозный цикл — от прогнозного начала следующего', () => {
    const settings = { ...mode(), defaultCycleLength: 30 };
    const cycles = cyclesOf([period('a', '2026-10-27', '2026-10-31')], '2026-10-28', settings);
    expect(cycles.find((c) => c.start === '2026-11-26')).toMatchObject({ kind: 'predicted', ovulation: '2026-12-12' });
  });

  it('включённый сдвиг применяется, выключенный — нет', () => {
    const periods = [period('a', '2026-03-01', '2026-03-05'), period('b', '2026-03-29', '2026-04-02')];
    expect(cyclesOf(periods, '2026-03-30', mode(2))[0]!.ovulation).toBe('2026-03-17');
    expect(cyclesOf(periods, '2026-03-30', mode(2, false))[0]!.ovulation).toBe('2026-03-15');
  });

  it.each([21, 45])('цикл %i дней: следующие − 14 в каждом цикле, прошлом и прогнозном', (len) => {
    const second = addDaysLD(ld('2026-01-01'), len);
    const third = addDaysLD(second, len);
    const periods = [period('a', '2026-01-01', '2026-01-05'), period('b', second, addDaysLD(second, 4)), period('c', third, addDaysLD(third, 4))];
    const cycles = cyclesOf(periods, addDaysLD(third, 1));
    for (const c of cycles.slice(0, 6)) expect(c.ovulation).toBe(addDaysLD(c.nextStart, -14));
    expect(cycles.map((c) => c.kind).slice(0, 4)).toEqual(['completed', 'completed', 'current', 'predicted']);
  });

  it('переход через год', () => {
    const periods = [period('a', '2026-12-08', '2026-12-12'), period('b', '2027-01-05', '2027-01-09')];
    expect(cyclesOf(periods, '2027-01-06')[0]!.ovulation).toBe('2026-12-22');
  });

  it('цикл-выброс 70 дней — от фактического начала следующих', () => {
    const periods = [period('a', '2026-03-01', '2026-03-05'), period('b', '2026-05-10', '2026-05-14')];
    expect(cyclesOf(periods, '2026-05-11')[0]!.ovulation).toBe('2026-04-26');
  });

  it.each([
    ['отмеченный конец', '2026-03-05'],
    ['неотмеченный конец (прогнозируемая длина 5)', null],
  ])('цикл 15 дней, сдвиг −5: не раньше дня после месячных — %s', (_name, end) => {
    const periods = [period('a', '2026-03-01', end), period('b', '2026-03-16', null)];
    const c = cyclesOf(periods, '2026-03-16', mode(-5))[0]!;
    expect(c.ovulation).toBe('2026-03-06');
    expect(c.fertile.at(-1)).toBe('2026-03-06');
  });
});

describe('режим расчёта овуляции не влияет на прогноз месячных (006 FR-009)', () => {
  const periods = [
    period('a', '2026-01-01', '2026-01-05'),
    period('b', '2026-01-27', '2026-01-30'),
    period('c', '2026-02-28', '2026-03-04'),
    period('d', '2026-03-27', '2026-03-31'),
  ];
  const at = (settings: Settings, today: string) => buildForecast({ periods, settings, today: ld(today) })!;
  const withoutOvulation = (f: ReturnType<typeof at>) => ({
    cycleLength: f.cycleLength,
    periodLength: f.periodLength,
    delayDays: f.delayDays,
    confidence: f.confidence,
    cycles: f.cycles.map(({ start, nextStart, periodDays, kind }) => ({ start, nextStart, periodDays, kind })),
  });

  it.each([
    [0, '2026-04-10'],
    [3, '2026-04-10'],
    [0, '2026-04-30'], // задержка
    [3, '2026-04-30'],
  ])('сдвиг %i, сегодня %s', (shift, today) => {
    const base = { ...DEFAULT_SETTINGS, ovulationShiftEnabled: shift !== 0, ovulationShift: shift };
    const off = at({ ...base, ovulationFromNextPeriod: false }, today);
    const on = at({ ...base, ovulationFromNextPeriod: true }, today);
    expect(withoutOvulation(on)).toEqual(withoutOvulation(off));
    // режим действительно применён: даты овуляции различаются
    expect(on.cycles.map((c) => c.ovulation)).not.toEqual(off.cycles.map((c) => c.ovulation));
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
      probability: 'high',
      phase: 'follicular',
      daysToPeriod: 20,
      daysToOvulation: 5,
      nextPeriod: '2026-03-29',
      nextOvulation: '2026-03-14',
      nextFertile: { from: '2026-03-09', to: '2026-03-14' },
      delayDays: 0,
      confidence: 'low',
    });
  });

  it('points to the next cycle after this ovulation has passed', () => {
    const s = todaySummary(ctx([period('a', '2026-03-01', '2026-03-05')], '2026-03-20'));
    expect(s).toMatchObject({ phase: 'luteal', daysToOvulation: 22, nextOvulation: '2026-04-11', daysToPeriod: 9 });
  });

  it('в режиме «от следующей менструации» плашка показывает новую овуляцию и окно (006)', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, ovulationFromNextPeriod: true };
    const periods = [period('a', '2026-10-01', '2026-10-05')];
    const forecast = buildForecast({ periods, settings, today: ld('2026-10-05') });
    const s = todaySummary({ forecast, periods, settings, entries: new Set(), today: ld('2026-10-05') });
    expect(s).toMatchObject({ nextOvulation: '2026-10-15', nextFertile: { from: '2026-10-10', to: '2026-10-15' } });
  });

  it('hides the phase and counts days from the last start during a delay (case 27)', () => {
    const s = todaySummary(ctx([period('a', '2026-09-01', '2026-09-05')], '2026-10-02'));
    expect(s).toMatchObject({ delayDays: 3, phase: null, cycleDay: 32, daysToPeriod: 0 });
  });
});
