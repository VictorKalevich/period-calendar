import { describe, expect, it } from 'vitest';
import { addDaysLD } from './dates';
import { buildForecast, todaySummary } from './forecast';
import { planReminders } from './reminders';
import { buildDoctorReport } from './report';
import { DEFAULT_SETTINGS, type LocalDate, type Period, type Settings } from './types';

// Фича 017 (research R9): «золотой» снимок прогноза, сводки «Сегодня», отчёта и напоминаний, записанный
// до рефакторинга производных прогноза. Зелёный до и после: поведение не меняется.

const ld = (s: string) => s as LocalDate;
const p = (id: string, start: string, end: string | null = null, endEstimated = false): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated,
});

const S = DEFAULT_SETTINGS;
const NEXT: Settings = { ...S, ovulationFromNextPeriod: true };
const SHIFT: Settings = { ...S, ovulationShiftEnabled: true, ovulationShift: 2 };
const NEXT_SHIFT: Settings = { ...NEXT, ovulationShiftEnabled: true, ovulationShift: -3 };

const range = (days: readonly LocalDate[]) => (days.length ? `${days[0]}…${days.at(-1)}` : '—');

function describeCase(periods: Period[], today: string, settings: Settings): string[] {
  const t = ld(today);
  const lines: string[] = [];

  const short = buildForecast({ periods, settings, today: t, horizonMonths: 2 });
  if (!short) lines.push('прогноза нет');
  else {
    lines.push(`cycle ${short.cycleLength} · period ${short.periodLength} · ${short.confidence} · delay ${short.delayDays}`);
    for (const c of short.cycles) {
      lines.push(
        `${c.kind} ${c.start}→${c.nextStart} ov ${c.ovulation} fertile ${range(c.fertile)} ` +
          `medium ${c.mediumDays.join(',')} period ${range(c.periodDays)}`,
      );
    }
  }

  const full = buildForecast({ periods, settings, today: t });
  if (full) {
    const s = todaySummary({ forecast: full, periods, settings, entries: new Set(), today: t });
    lines.push(`today next ${s.nextPeriod} · days ${s.daysToPeriod}`);
  }

  const r = buildDoctorReport({ periods, entries: [], settings, today: t });
  lines.push(`report next ${r.nextPeriod} · delay ${r.delayDays}`);

  if (full) {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const rs = planReminders(full, settings, new Date(y, m - 1, d, 9));
    lines.push(`reminders(${rs.length}) ${rs.slice(0, 3).map((x) => x.id).join(' ')}`);
    lines.push(`missed ${rs.filter((x) => x.kind === 'missedPeriod').map((x) => x.id).join(' ')}`);
  }
  return lines;
}

const REG = [p('a', '2026-01-05', '2026-01-09'), p('b', '2026-02-02', '2026-02-06'), p('c', '2026-03-02', '2026-03-06')];

/** 9 месячных по 5 и 4 дня с промежутками 28, 29, 27, 70 (выброс), 12 (выброс), 28, 30, 28 дней. */
function longHistory(): Period[] {
  const gaps = [28, 29, 27, 70, 12, 28, 30, 28];
  let start = ld('2025-11-03');
  const out: Period[] = [];
  for (let i = 0; i <= gaps.length; i++) {
    out.push({ id: `h${i}`, start, end: addDaysLD(start, i % 2 === 0 ? 4 : 3), endEstimated: false });
    if (i < gaps.length) start = addDaysLD(start, gaps[i]!);
  }
  return out;
}

describe('характеризация прогноза до фичи 017', () => {
  it('нет истории', () => {
    expect(describeCase([], '2026-11-14', S)).toMatchInlineSnapshot(`
      [
        "прогноза нет",
        "report next null · delay 0",
      ]
    `);
  });

  it('одна открытая', () => {
    expect(describeCase([p('a', '2026-11-10')], '2026-11-14', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · low · delay 0",
        "current 2026-11-10→2026-12-08 ov 2026-11-23 fertile 2026-11-18…2026-11-23 medium 2026-11-16,2026-11-17,2026-11-24 period —",
        "predicted 2026-12-08→2027-01-05 ov 2026-12-21 fertile 2026-12-16…2026-12-21 medium 2026-12-14,2026-12-15,2026-12-22 period 2026-12-08…2026-12-12",
        "predicted 2027-01-05→2027-02-02 ov 2027-01-18 fertile 2027-01-13…2027-01-18 medium 2027-01-11,2027-01-12,2027-01-19 period 2027-01-05…2027-01-09",
        "today next 2026-12-08 · days 24",
        "report next 2026-12-08 · delay 0",
        "reminders(18) ovulation:2026-11-23 period:2026-12-06 missed-period:2026-12-10",
        "missed missed-period:2026-12-10 missed-period:2027-01-07 missed-period:2027-02-04 missed-period:2027-03-04 missed-period:2027-04-01 missed-period:2027-04-29",
      ]
    `);
  });

  const unordered = [
    p('c', '2026-07-03', '2026-07-07'),
    p('a', '2026-05-08', '2026-05-11'),
    p('d', '2026-08-01'),
    p('b', '2026-06-05', '2026-06-09', true),
  ];

  it('неупорядоченный вход, ручные и оценочные концы', () => {
    expect(describeCase(unordered, '2026-08-10', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · normal · delay 0",
        "completed 2026-05-08→2026-06-05 ov 2026-05-21 fertile 2026-05-16…2026-05-21 medium 2026-05-14,2026-05-15,2026-05-22 period —",
        "completed 2026-06-05→2026-07-03 ov 2026-06-18 fertile 2026-06-13…2026-06-18 medium 2026-06-11,2026-06-12,2026-06-19 period —",
        "completed 2026-07-03→2026-08-01 ov 2026-07-16 fertile 2026-07-11…2026-07-16 medium 2026-07-09,2026-07-10,2026-07-17 period —",
        "current 2026-08-01→2026-08-29 ov 2026-08-14 fertile 2026-08-09…2026-08-14 medium 2026-08-07,2026-08-08,2026-08-15 period —",
        "predicted 2026-08-29→2026-09-26 ov 2026-09-11 fertile 2026-09-06…2026-09-11 medium 2026-09-04,2026-09-05,2026-09-12 period 2026-08-29…2026-09-02",
        "predicted 2026-09-26→2026-10-24 ov 2026-10-09 fertile 2026-10-04…2026-10-09 medium 2026-10-02,2026-10-03,2026-10-10 period 2026-09-26…2026-09-30",
        "today next 2026-08-29 · days 19",
        "report next 2026-08-29 · delay 0",
        "reminders(18) ovulation:2026-08-14 period:2026-08-27 missed-period:2026-08-31",
        "missed missed-period:2026-08-31 missed-period:2026-09-28 missed-period:2026-10-26 missed-period:2026-11-23 missed-period:2026-12-21 missed-period:2027-01-18",
      ]
    `);
  });

  it('неупорядоченный вход, ручные и оценочные концы — от следующей менструации', () => {
    expect(describeCase(unordered, '2026-08-10', NEXT)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · normal · delay 0",
        "completed 2026-05-08→2026-06-05 ov 2026-05-22 fertile 2026-05-17…2026-05-22 medium 2026-05-15,2026-05-16,2026-05-23 period —",
        "completed 2026-06-05→2026-07-03 ov 2026-06-19 fertile 2026-06-14…2026-06-19 medium 2026-06-12,2026-06-13,2026-06-20 period —",
        "completed 2026-07-03→2026-08-01 ov 2026-07-18 fertile 2026-07-13…2026-07-18 medium 2026-07-11,2026-07-12,2026-07-19 period —",
        "current 2026-08-01→2026-08-29 ov 2026-08-15 fertile 2026-08-10…2026-08-15 medium 2026-08-08,2026-08-09,2026-08-16 period —",
        "predicted 2026-08-29→2026-09-26 ov 2026-09-12 fertile 2026-09-07…2026-09-12 medium 2026-09-05,2026-09-06,2026-09-13 period 2026-08-29…2026-09-02",
        "predicted 2026-09-26→2026-10-24 ov 2026-10-10 fertile 2026-10-05…2026-10-10 medium 2026-10-03,2026-10-04,2026-10-11 period 2026-09-26…2026-09-30",
        "today next 2026-08-29 · days 19",
        "report next 2026-08-29 · delay 0",
        "reminders(18) ovulation:2026-08-15 period:2026-08-27 missed-period:2026-08-31",
        "missed missed-period:2026-08-31 missed-period:2026-09-28 missed-period:2026-10-26 missed-period:2026-11-23 missed-period:2026-12-21 missed-period:2027-01-18",
      ]
    `);
  });

  it('одинаковые начала', () => {
    const periods = [p('a', '2026-09-01', '2026-09-03'), p('b', '2026-09-01', '2026-09-06'), p('c', '2026-09-29', '2026-10-02')];
    expect(describeCase(periods, '2026-10-10', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 4 · low · delay 0",
        "completed 2026-09-01→2026-09-01 ov 2026-08-31 fertile 2026-08-26…2026-08-31 medium 2026-08-24,2026-08-25,2026-09-01 period —",
        "completed 2026-09-01→2026-09-29 ov 2026-09-14 fertile 2026-09-09…2026-09-14 medium 2026-09-07,2026-09-08,2026-09-15 period —",
        "current 2026-09-29→2026-10-27 ov 2026-10-12 fertile 2026-10-07…2026-10-12 medium 2026-10-05,2026-10-06,2026-10-13 period —",
        "predicted 2026-10-27→2026-11-24 ov 2026-11-09 fertile 2026-11-04…2026-11-09 medium 2026-11-02,2026-11-03,2026-11-10 period 2026-10-27…2026-10-30",
        "predicted 2026-11-24→2026-12-22 ov 2026-12-07 fertile 2026-12-02…2026-12-07 medium 2026-11-30,2026-12-01,2026-12-08 period 2026-11-24…2026-11-27",
        "today next 2026-10-27 · days 17",
        "report next 2026-10-27 · delay 0",
        "reminders(18) ovulation:2026-10-12 period:2026-10-25 missed-period:2026-10-29",
        "missed missed-period:2026-10-29 missed-period:2026-11-26 missed-period:2026-12-24 missed-period:2027-01-21 missed-period:2027-02-18 missed-period:2027-03-18",
      ]
    `);
  });

  const shortCycle = [p('a', '2026-03-01'), p('b', '2026-03-17', '2026-03-19'), p('c', '2026-04-02')];

  it('открытые в середине, короткий цикл — от следующей менструации со сдвигом', () => {
    expect(describeCase(shortCycle, '2026-04-05', NEXT_SHIFT)).toMatchInlineSnapshot(`
      [
        "cycle 16 · period 3 · low · delay 0",
        "completed 2026-03-01→2026-03-17 ov 2026-03-04 fertile 2026-02-27…2026-03-04 medium 2026-02-25,2026-02-26,2026-03-05 period —",
        "completed 2026-03-17→2026-04-02 ov 2026-03-20 fertile 2026-03-15…2026-03-20 medium 2026-03-13,2026-03-14,2026-03-21 period —",
        "current 2026-04-02→2026-04-18 ov 2026-04-05 fertile 2026-03-31…2026-04-05 medium 2026-03-29,2026-03-30,2026-04-06 period —",
        "predicted 2026-04-18→2026-05-04 ov 2026-04-21 fertile 2026-04-16…2026-04-21 medium 2026-04-14,2026-04-15,2026-04-22 period 2026-04-18…2026-04-20",
        "predicted 2026-05-04→2026-05-20 ov 2026-05-07 fertile 2026-05-02…2026-05-07 medium 2026-04-30,2026-05-01,2026-05-08 period 2026-05-04…2026-05-06",
        "predicted 2026-05-20→2026-06-05 ov 2026-05-23 fertile 2026-05-18…2026-05-23 medium 2026-05-16,2026-05-17,2026-05-24 period 2026-05-20…2026-05-22",
        "predicted 2026-06-05→2026-06-21 ov 2026-06-08 fertile 2026-06-03…2026-06-08 medium 2026-06-01,2026-06-02,2026-06-09 period 2026-06-05…2026-06-07",
        "today next 2026-04-18 · days 13",
        "report next 2026-04-18 · delay 0",
        "reminders(18) ovulation:2026-04-05 period:2026-04-16 missed-period:2026-04-20",
        "missed missed-period:2026-04-20 missed-period:2026-05-06 missed-period:2026-05-22 missed-period:2026-06-07 missed-period:2026-06-23 missed-period:2026-07-09",
      ]
    `);
  });

  it('открытые в середине, короткий цикл — 14-й день со сдвигом', () => {
    expect(describeCase(shortCycle, '2026-04-05', SHIFT)).toMatchInlineSnapshot(`
      [
        "cycle 16 · period 3 · low · delay 0",
        "completed 2026-03-01→2026-03-17 ov 2026-03-16 fertile 2026-03-11…2026-03-16 medium 2026-03-09,2026-03-10,2026-03-17 period —",
        "completed 2026-03-17→2026-04-02 ov 2026-04-01 fertile 2026-03-27…2026-04-01 medium 2026-03-25,2026-03-26,2026-04-02 period —",
        "current 2026-04-02→2026-04-18 ov 2026-04-17 fertile 2026-04-12…2026-04-17 medium 2026-04-10,2026-04-11,2026-04-18 period —",
        "predicted 2026-04-18→2026-05-04 ov 2026-05-03 fertile 2026-04-28…2026-05-03 medium 2026-04-26,2026-04-27,2026-05-04 period 2026-04-18…2026-04-20",
        "predicted 2026-05-04→2026-05-20 ov 2026-05-19 fertile 2026-05-14…2026-05-19 medium 2026-05-12,2026-05-13,2026-05-20 period 2026-05-04…2026-05-06",
        "predicted 2026-05-20→2026-06-05 ov 2026-06-04 fertile 2026-05-30…2026-06-04 medium 2026-05-28,2026-05-29,2026-06-05 period 2026-05-20…2026-05-22",
        "predicted 2026-06-05→2026-06-21 ov 2026-06-20 fertile 2026-06-15…2026-06-20 medium 2026-06-13,2026-06-14,2026-06-21 period 2026-06-05…2026-06-07",
        "today next 2026-04-18 · days 13",
        "report next 2026-04-18 · delay 0",
        "reminders(18) period:2026-04-16 ovulation:2026-04-17 missed-period:2026-04-20",
        "missed missed-period:2026-04-20 missed-period:2026-05-06 missed-period:2026-05-22 missed-period:2026-06-07 missed-period:2026-06-23 missed-period:2026-07-09",
      ]
    `);
  });

  it('прогноз сегодня (задержка 0)', () => {
    expect(describeCase(REG, '2026-03-30', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · low · delay 0",
        "completed 2026-01-05→2026-02-02 ov 2026-01-18 fertile 2026-01-13…2026-01-18 medium 2026-01-11,2026-01-12,2026-01-19 period —",
        "completed 2026-02-02→2026-03-02 ov 2026-02-15 fertile 2026-02-10…2026-02-15 medium 2026-02-08,2026-02-09,2026-02-16 period —",
        "current 2026-03-02→2026-03-30 ov 2026-03-15 fertile 2026-03-10…2026-03-15 medium 2026-03-08,2026-03-09,2026-03-16 period —",
        "predicted 2026-03-30→2026-04-27 ov 2026-04-12 fertile 2026-04-07…2026-04-12 medium 2026-04-05,2026-04-06,2026-04-13 period 2026-03-30…2026-04-03",
        "predicted 2026-04-27→2026-05-25 ov 2026-05-10 fertile 2026-05-05…2026-05-10 medium 2026-05-03,2026-05-04,2026-05-11 period 2026-04-27…2026-05-01",
        "predicted 2026-05-25→2026-06-22 ov 2026-06-07 fertile 2026-06-02…2026-06-07 medium 2026-05-31,2026-06-01,2026-06-08 period 2026-05-25…2026-05-29",
        "today next 2026-03-30 · days 0",
        "report next 2026-03-30 · delay 0",
        "reminders(16) missed-period:2026-04-01 ovulation:2026-04-12 period:2026-04-25",
        "missed missed-period:2026-04-01 missed-period:2026-04-29 missed-period:2026-05-27 missed-period:2026-06-24 missed-period:2026-07-22 missed-period:2026-08-19",
      ]
    `);
  });

  it('задержка 1 день', () => {
    expect(describeCase(REG, '2026-03-31', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · low · delay 1",
        "completed 2026-01-05→2026-02-02 ov 2026-01-18 fertile 2026-01-13…2026-01-18 medium 2026-01-11,2026-01-12,2026-01-19 period —",
        "completed 2026-02-02→2026-03-02 ov 2026-02-15 fertile 2026-02-10…2026-02-15 medium 2026-02-08,2026-02-09,2026-02-16 period —",
        "current 2026-03-02→2026-03-31 ov 2026-03-15 fertile 2026-03-10…2026-03-15 medium 2026-03-08,2026-03-09,2026-03-16 period —",
        "predicted 2026-03-31→2026-04-28 ov 2026-04-13 fertile 2026-04-08…2026-04-13 medium 2026-04-06,2026-04-07,2026-04-14 period 2026-03-31…2026-04-04",
        "predicted 2026-04-28→2026-05-26 ov 2026-05-11 fertile 2026-05-06…2026-05-11 medium 2026-05-04,2026-05-05,2026-05-12 period 2026-04-28…2026-05-02",
        "predicted 2026-05-26→2026-06-23 ov 2026-06-08 fertile 2026-06-03…2026-06-08 medium 2026-06-01,2026-06-02,2026-06-09 period 2026-05-26…2026-05-30",
        "today next 2026-03-31 · days 0",
        "report next 2026-03-30 · delay 1",
        "reminders(1) missed-period:2026-04-01",
        "missed missed-period:2026-04-01",
      ]
    `);
  });

  it('задержка 15 дней', () => {
    expect(describeCase(REG, '2026-04-14', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · low · delay 15",
        "completed 2026-01-05→2026-02-02 ov 2026-01-18 fertile 2026-01-13…2026-01-18 medium 2026-01-11,2026-01-12,2026-01-19 period —",
        "completed 2026-02-02→2026-03-02 ov 2026-02-15 fertile 2026-02-10…2026-02-15 medium 2026-02-08,2026-02-09,2026-02-16 period —",
        "current 2026-03-02→2026-04-14 ov 2026-03-15 fertile 2026-03-10…2026-03-15 medium 2026-03-08,2026-03-09,2026-03-16 period —",
        "predicted 2026-04-14→2026-05-12 ov 2026-04-27 fertile 2026-04-22…2026-04-27 medium 2026-04-20,2026-04-21,2026-04-28 period 2026-04-14…2026-04-18",
        "predicted 2026-05-12→2026-06-09 ov 2026-05-25 fertile 2026-05-20…2026-05-25 medium 2026-05-18,2026-05-19,2026-05-26 period 2026-05-12…2026-05-16",
        "predicted 2026-06-09→2026-07-07 ov 2026-06-22 fertile 2026-06-17…2026-06-22 medium 2026-06-15,2026-06-16,2026-06-23 period 2026-06-09…2026-06-13",
        "today next 2026-04-14 · days 0",
        "report next 2026-03-30 · delay 15",
        "reminders(0) ",
        "missed ",
      ]
    `);
  });

  it('больше 6 циклов, выбросы', () => {
    const periods = longHistory();
    expect(describeCase(periods, addDaysLD(periods.at(-1)!.start, 10), S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · normal · delay 0",
        "completed 2025-11-03→2025-12-01 ov 2025-11-16 fertile 2025-11-11…2025-11-16 medium 2025-11-09,2025-11-10,2025-11-17 period —",
        "completed 2025-12-01→2025-12-30 ov 2025-12-14 fertile 2025-12-09…2025-12-14 medium 2025-12-07,2025-12-08,2025-12-15 period —",
        "completed 2025-12-30→2026-01-26 ov 2026-01-12 fertile 2026-01-07…2026-01-12 medium 2026-01-05,2026-01-06,2026-01-13 period —",
        "completed 2026-01-26→2026-04-06 ov 2026-02-08 fertile 2026-02-03…2026-02-08 medium 2026-02-01,2026-02-02,2026-02-09 period —",
        "completed 2026-04-06→2026-04-18 ov 2026-04-17 fertile 2026-04-12…2026-04-17 medium 2026-04-10,2026-04-11,2026-04-18 period —",
        "completed 2026-04-18→2026-05-16 ov 2026-05-01 fertile 2026-04-26…2026-05-01 medium 2026-04-24,2026-04-25,2026-05-02 period —",
        "completed 2026-05-16→2026-06-15 ov 2026-05-29 fertile 2026-05-24…2026-05-29 medium 2026-05-22,2026-05-23,2026-05-30 period —",
        "completed 2026-06-15→2026-07-13 ov 2026-06-28 fertile 2026-06-23…2026-06-28 medium 2026-06-21,2026-06-22,2026-06-29 period —",
        "current 2026-07-13→2026-08-10 ov 2026-07-26 fertile 2026-07-21…2026-07-26 medium 2026-07-19,2026-07-20,2026-07-27 period —",
        "predicted 2026-08-10→2026-09-07 ov 2026-08-23 fertile 2026-08-18…2026-08-23 medium 2026-08-16,2026-08-17,2026-08-24 period 2026-08-10…2026-08-14",
        "predicted 2026-09-07→2026-10-05 ov 2026-09-20 fertile 2026-09-15…2026-09-20 medium 2026-09-13,2026-09-14,2026-09-21 period 2026-09-07…2026-09-11",
        "today next 2026-08-10 · days 18",
        "report next 2026-08-10 · delay 0",
        "reminders(18) ovulation:2026-07-26 period:2026-08-08 missed-period:2026-08-12",
        "missed missed-period:2026-08-12 missed-period:2026-09-09 missed-period:2026-10-07 missed-period:2026-11-04 missed-period:2026-12-02 missed-period:2026-12-30",
      ]
    `);
  });

  it('переход года с задержкой', () => {
    const periods = [p('a', '2025-11-06', '2025-11-10'), p('b', '2025-12-04', '2025-12-08')];
    expect(describeCase(periods, '2026-01-03', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · low · delay 2",
        "completed 2025-11-06→2025-12-04 ov 2025-11-19 fertile 2025-11-14…2025-11-19 medium 2025-11-12,2025-11-13,2025-11-20 period —",
        "current 2025-12-04→2026-01-03 ov 2025-12-17 fertile 2025-12-12…2025-12-17 medium 2025-12-10,2025-12-11,2025-12-18 period —",
        "predicted 2026-01-03→2026-01-31 ov 2026-01-16 fertile 2026-01-11…2026-01-16 medium 2026-01-09,2026-01-10,2026-01-17 period 2026-01-03…2026-01-07",
        "predicted 2026-01-31→2026-02-28 ov 2026-02-13 fertile 2026-02-08…2026-02-13 medium 2026-02-06,2026-02-07,2026-02-14 period 2026-01-31…2026-02-04",
        "predicted 2026-02-28→2026-03-28 ov 2026-03-13 fertile 2026-03-08…2026-03-13 medium 2026-03-06,2026-03-07,2026-03-14 period 2026-02-28…2026-03-04",
        "today next 2026-01-03 · days 0",
        "report next 2026-01-01 · delay 2",
        "reminders(1) missed-period:2026-01-03",
        "missed missed-period:2026-01-03",
      ]
    `);
  });

  it('високосный год с задержкой', () => {
    const periods = [p('a', '2028-01-04', '2028-01-08'), p('b', '2028-02-01', '2028-02-05')];
    expect(describeCase(periods, '2028-03-02', S)).toMatchInlineSnapshot(`
      [
        "cycle 28 · period 5 · low · delay 2",
        "completed 2028-01-04→2028-02-01 ov 2028-01-17 fertile 2028-01-12…2028-01-17 medium 2028-01-10,2028-01-11,2028-01-18 period —",
        "current 2028-02-01→2028-03-02 ov 2028-02-14 fertile 2028-02-09…2028-02-14 medium 2028-02-07,2028-02-08,2028-02-15 period —",
        "predicted 2028-03-02→2028-03-30 ov 2028-03-15 fertile 2028-03-10…2028-03-15 medium 2028-03-08,2028-03-09,2028-03-16 period 2028-03-02…2028-03-06",
        "predicted 2028-03-30→2028-04-27 ov 2028-04-12 fertile 2028-04-07…2028-04-12 medium 2028-04-05,2028-04-06,2028-04-13 period 2028-03-30…2028-04-03",
        "predicted 2028-04-27→2028-05-25 ov 2028-05-10 fertile 2028-05-05…2028-05-10 medium 2028-05-03,2028-05-04,2028-05-11 period 2028-04-27…2028-05-01",
        "today next 2028-03-02 · days 0",
        "report next 2028-02-29 · delay 2",
        "reminders(1) missed-period:2028-03-02",
        "missed missed-period:2028-03-02",
      ]
    `);
  });
});
