import { addMonths } from 'date-fns';
import { addDaysLD, diffDays, maxLD, minLD, parseLD, rangeLD, toLocalDate } from './dates';
import {
  averageCycleLength,
  averagePeriodLength,
  buildCycles,
  buildPeriodCycles,
  forecastConfidence,
  type PeriodCycle,
} from './cycles';
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
 * Длина месячных для расчётов: средняя по истории (FR-014), иначе из настроек. От «сегодня» не зависит.
 * Единственное место этого правила (фича 017): им считают прогноз, календарь, диалог дня, нормализация
 * и текстовый импорт.
 */
export function effectivePeriodLength(periods: Period[], settings: Settings): number {
  return averagePeriodLength(buildCycles(periods)) ?? settings.defaultPeriodLength;
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

/** Значения для сборки цикла прогноза — именованные, а не позиционные (фича 017). */
interface CycleInput {
  start: LocalDate;
  /** Начало следующих месячных (у текущего цикла при задержке — сегодня). */
  nextStart: LocalDate;
  kind: PredictedCycle['kind'];
  periodLength: number;
  settings: Settings;
  /** Последний день месячных цикла; по умолчанию — оценка по `periodLength`. */
  periodLast?: LocalDate;
  /** Начало следующих месячных для расчёта овуляции; у текущего цикла — прогнозное, без задержки. */
  ovulationBound?: LocalDate;
}

function cycleFrom({
  start,
  nextStart,
  kind,
  periodLength,
  settings,
  periodLast = addDaysLD(start, periodLength - 1),
  ovulationBound = nextStart,
}: CycleInput): PredictedCycle {
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

  // Месячные и их циклы — из одной сортировки: последний день месячных цикла берётся из той же пары.
  const history = buildPeriodCycles(periods);
  const cycles = history.map((x) => x.cycle);
  const cycleLength = averageCycleLength(cycles) ?? settings.defaultCycleLength;
  const periodLength = effectivePeriodLength(periods, settings);
  const lastDayOf = (x: PeriodCycle) => periodEnd(x.period, periodLength);
  const current = history.at(-1)!;
  const last = current.cycle.start;

  const predictedStart = addDaysLD(last, cycleLength);
  const delayDays = Math.max(0, diffDays(today, predictedStart));
  const nextStart = delayDays > 0 ? today : predictedStart;

  const out: PredictedCycle[] = [];
  for (let i = 0; i < history.length - 1; i++) {
    const x = history[i]!;
    out.push(
      cycleFrom({
        start: x.cycle.start,
        nextStart: history[i + 1]!.cycle.start,
        kind: 'completed',
        periodLength,
        settings,
        periodLast: lastDayOf(x),
      }),
    );
  }
  out.push(
    cycleFrom({
      start: last,
      nextStart,
      kind: 'current',
      periodLength,
      settings,
      periodLast: lastDayOf(current),
      ovulationBound: predictedStart,
    }),
  );

  const horizon = toLocalDate(addMonths(parseLD(today), horizonMonths));
  for (let s = nextStart; s <= horizon; s = addDaysLD(s, cycleLength)) {
    out.push(cycleFrom({ start: s, nextStart: addDaysLD(s, cycleLength), kind: 'predicted', periodLength, settings }));
  }

  return { cycleLength, periodLength, confidence: forecastConfidence(cycles), delayDays, cycles: out };
}

/**
 * Начало следующих месячных по прогнозу до учёта задержки; `null`, если в прогнозе нет текущего цикла.
 * При задержке `nextStart` текущего цикла — сегодня, поэтому исходный прогноз — `nextStart − delayDays`;
 * без задержки — сам `nextStart`. Единственный обратный счёт от задержки (фича 017).
 */
export function originalPredictedStart(forecast: Forecast): LocalDate | null {
  const current = forecast.cycles.find((c) => c.kind === 'current');
  return current ? addDaysLD(current.nextStart, -forecast.delayDays) : null;
}

/** Начало ближайших прогнозных месячных не раньше `today`; `null`, если таких в горизонте прогноза нет. */
export function nextPredictedStart(forecast: Forecast, today: LocalDate): LocalDate | null {
  return forecast.cycles.find((c) => c.kind === 'predicted' && c.start >= today)?.start ?? null;
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
  // Длина из прогноза посчитана effectivePeriodLength; без прогноза — та же функция (фича 017, research R2).
  const periodLength = forecast ? forecast.periodLength : effectivePeriodLength(periods, settings);

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
    sex: ctx.sexDates?.has(date) ?? false,
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
  const nextPeriod = nextPredictedStart(forecast, today);
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
