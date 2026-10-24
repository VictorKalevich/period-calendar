import { addMonths } from 'date-fns';
import { addDaysLD, diffDays, maxLD, minLD, parseLD, rangeLD, toLocalDate } from './dates';
import { averageCycleLength, averagePeriodLength, buildCycles, forecastConfidence } from './cycles';
import { periodEnd } from './periods';
import {
  LUTEAL_PHASE_DAYS,
  OVULATION_DAY_OFFSET,
  type DayContext,
  type DayInfo,
  type Forecast,
  type LocalDate,
  type Period,
  type Phase,
  type PredictedCycle,
  type Probability,
  type Settings,
  type TodaySummary,
} from './types';

const FERTILE_DAYS_BEFORE_OVULATION = 5;

/** Личный сдвиг овуляции — только если включён (005 FR-007). */
export function ovulationShiftOf(settings: Settings): number {
  return settings.ovulationShiftEnabled ? settings.ovulationShift : 0;
}

/**
 * Овуляция цикла (+ личный сдвиг), не позже дня перед следующими месячными (005 FR-003a):
 * - по умолчанию — 14-й день цикла: начало + 13 (005 FR-003; заменяет 001 FR-016);
 * - «от следующей менструации» — следующие − 14, но не раньше дня после месячных цикла (006 FR-004, FR-005).
 * `periodLast` — последний день месячных цикла, `nextStart` — начало следующих.
 */
export function ovulationFor(
  cycle: { start: LocalDate; periodLast: LocalDate; nextStart: LocalDate },
  settings: Settings,
): LocalDate {
  const shift = ovulationShiftOf(settings);
  const raw = settings.ovulationFromNextPeriod
    ? maxLD(addDaysLD(cycle.nextStart, shift - LUTEAL_PHASE_DAYS), addDaysLD(cycle.periodLast, 1))
    : addDaysLD(cycle.start, OVULATION_DAY_OFFSET + shift);
  return minLD(raw, addDaysLD(cycle.nextStart, -1));
}

/** `ovulationBound` — начало следующих месячных для расчёта овуляции; у текущего цикла — прогнозное, без задержки. */
function cycleFrom(
  start: LocalDate,
  nextStart: LocalDate,
  kind: PredictedCycle['kind'],
  periodLength: number,
  settings: Settings,
  periodLast: LocalDate = addDaysLD(start, periodLength - 1),
  ovulationBound: LocalDate = nextStart,
): PredictedCycle {
  const ovulation = ovulationFor({ start, periodLast, nextStart: ovulationBound }, settings);
  return {
    start,
    nextStart,
    periodDays: kind === 'predicted' ? rangeLD(start, addDaysLD(start, periodLength - 1)) : [],
    ovulation,
    fertile: rangeLD(addDaysLD(ovulation, -FERTILE_DAYS_BEFORE_OVULATION), ovulation),
    mediumDays: [addDaysLD(ovulation, -7), addDaysLD(ovulation, -6), addDaysLD(ovulation, 1)],
    kind,
  };
}

/** Прогноз по отметкам (FR-013–FR-019a). `null` — нет ни одной отметки. */
export function buildForecast(input: {
  periods: Period[];
  settings: Settings;
  today: LocalDate;
  horizonMonths?: number;
}): Forecast | null {
  const { periods, settings, today, horizonMonths = 12 } = input;
  if (periods.length === 0) return null;

  const cycles = buildCycles(periods);
  const cycleLength = averageCycleLength(cycles) ?? settings.defaultCycleLength;
  const periodLength = averagePeriodLength(cycles) ?? settings.defaultPeriodLength;
  const starts = cycles.map((c) => c.start);
  const last = starts.at(-1)!;

  const predictedStart = addDaysLD(last, cycleLength);
  const delayDays = Math.max(0, diffDays(today, predictedStart));
  const nextStart = delayDays > 0 ? today : predictedStart;

  // Месячные в порядке начала — как циклы в buildCycles.
  const sorted = [...periods].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const lastDayOf = (i: number) => periodEnd(sorted[i]!, periodLength);

  const out: PredictedCycle[] = [];
  for (let i = 0; i < starts.length - 1; i++) {
    out.push(cycleFrom(starts[i]!, starts[i + 1]!, 'completed', periodLength, settings, lastDayOf(i)));
  }
  out.push(cycleFrom(last, nextStart, 'current', periodLength, settings, lastDayOf(starts.length - 1), predictedStart));

  const horizon = toLocalDate(addMonths(parseLD(today), horizonMonths));
  for (let s = nextStart; s <= horizon; s = addDaysLD(s, cycleLength)) {
    out.push(cycleFrom(s, addDaysLD(s, cycleLength), 'predicted', periodLength, settings));
  }

  return { cycleLength, periodLength, confidence: forecastConfidence(cycles), delayDays, cycles: out };
}

interface DayMarks {
  fertile: boolean;
  ovulation: boolean;
  medium: boolean;
  predictedPeriod: boolean;
}

// dayInfo вызывается для каждой ячейки календаря — индексы строятся один раз на прогноз.
const marksCache = new WeakMap<Forecast, Map<LocalDate, DayMarks>>();

function marksFor(forecast: Forecast): Map<LocalDate, DayMarks> {
  let map = marksCache.get(forecast);
  if (map) return map;
  map = new Map();
  const get = (d: LocalDate) => {
    let m = map!.get(d);
    if (!m) map!.set(d, (m = { fertile: false, ovulation: false, medium: false, predictedPeriod: false }));
    return m;
  };
  for (const c of forecast.cycles) {
    for (const d of c.fertile) get(d).fertile = true;
    for (const d of c.mediumDays) get(d).medium = true;
    for (const d of c.periodDays) get(d).predictedPeriod = true;
    get(c.ovulation).ovulation = true;
  }
  marksCache.set(forecast, map);
  return map;
}

function lastStartOnOrBefore(periods: Period[], date: LocalDate): Period | undefined {
  let found: Period | undefined;
  for (const p of periods) if (p.start <= date && (!found || p.start > found.start)) found = p;
  return found;
}

/** Цикл, в который попадает дата: по фактическим началам до сегодня, по прогнозу — после. */
function cycleOf(forecast: Forecast, date: LocalDate, today: LocalDate): PredictedCycle | undefined {
  let found: PredictedCycle | undefined;
  for (const c of forecast.cycles) {
    if (c.start > date) break;
    if (c.kind === 'predicted' && c.start > today) {
      found = c;
      continue;
    }
    if (c.kind !== 'predicted') found = c;
  }
  return found;
}

/** Всё, что нужно для отрисовки одного дня (data-model.md «DayInfo»). */
export function dayInfo(date: LocalDate, ctx: DayContext): DayInfo {
  const { periods, settings, entries, today, forecast } = ctx;
  const periodLength = forecast?.periodLength ?? settings.defaultPeriodLength;

  const own = lastStartOnOrBefore(periods, date);
  let period: DayInfo['period'] = null;
  if (own && date <= periodEnd(own, periodLength)) {
    // После сегодняшнего дня отмеченным считается только конец, поставленный вручную; оценочный
    // конец в будущем (003 FR-018) и незакрытые месячные — прогноз.
    period = date <= today || (own.end !== null && !own.endEstimated) ? 'actual' : 'predicted';
  }

  const base: DayInfo = {
    date,
    cycleDay: own ? diffDays(date, own.start) + 1 : null,
    period,
    fertile: null,
    ovulation: false,
    probability: null,
    phase: null,
    isToday: date === today,
    hasEntry: entries.has(date),
  };
  if (!forecast || !own) return base;

  const marks = marksFor(forecast).get(date);
  if (!period && marks?.predictedPeriod) period = 'predicted';

  const cycle = cycleOf(forecast, date, today);
  const cycleDay = cycle && date > today && cycle.kind === 'predicted' ? diffDays(date, cycle.start) + 1 : base.cycleDay;

  const probability: Probability = marks?.fertile ? 'high' : marks?.medium ? 'medium' : 'low';

  let phase: Phase | null = null;
  if (period) phase = 'menstrual';
  else if (marks?.ovulation) phase = 'ovulation';
  else if (cycle) phase = date < cycle.ovulation ? 'follicular' : 'luteal';

  // Отмеченные месячные приоритетнее окна и короны (005 FR-005): при коротком цикле и сдвиге
  // окно может зайти на месячные — тогда на этих днях видны только месячные.
  const window = period !== 'actual';
  return {
    ...base,
    cycleDay,
    period,
    fertile: window && marks?.fertile ? (date < today ? 'past' : 'predicted') : null,
    ovulation: window && (marks?.ovulation ?? false),
    probability,
    phase,
  };
}

/** Сводка для плашки и экрана «Сегодня». */
export function todaySummary(ctx: DayContext): TodaySummary {
  const { forecast, today } = ctx;
  if (!forecast) {
    return {
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
    };
  }
  const info = dayInfo(today, ctx);
  const nextPeriod = forecast.cycles.find((c) => c.kind === 'predicted' && c.start >= today)?.start ?? null;
  const nextOvulation = forecast.cycles.find((c) => c.ovulation >= today)?.ovulation ?? null;
  const window = forecast.cycles.find((c) => c.ovulation >= today);
  return {
    cycleDay: info.cycleDay,
    probability: info.probability,
    phase: forecast.delayDays > 0 ? null : info.phase,
    daysToPeriod: nextPeriod ? diffDays(nextPeriod, today) : null,
    daysToOvulation: nextOvulation ? diffDays(nextOvulation, today) : null,
    nextPeriod,
    nextOvulation,
    nextFertile: window ? { from: window.fertile[0]!, to: window.ovulation } : null,
    delayDays: forecast.delayDays,
    confidence: forecast.confidence,
  };
}
