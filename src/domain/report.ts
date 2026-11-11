import { addMonths } from 'date-fns';
import { moodLabel, MOODS, symptomLabel, SYMPTOMS } from './catalog';
import { averageCycleLength, averagePeriodLength, buildCycles } from './cycles';
import { addDaysLD, diffDays, parseLD, toLocalDate } from './dates';
import { buildForecast, todaySummary } from './forecast';
import type { DayEntry, Intensity, LocalDate, MoodId, Period, Settings, SymptomId } from './types';

// Отчёт для врача (фича 011) — specs/011-doctor-report/contracts/report.md. Чистые функции:
// «сегодня» — параметр. Заметки и отметки секса не читаются (FR-008).

export interface DoctorReportInput {
  periods: Period[];
  entries: DayEntry[];
  settings: Settings;
  today: LocalDate;
  /** Глубина отчёта в календарных месяцах. */
  months?: number;
}

export interface ReportCycle {
  start: LocalDate;
  /** `null` — текущий цикл. */
  length: number | null;
  periodLength: number | null;
  periodEndEstimated: boolean;
  outlier: boolean;
}

export interface DoctorReport {
  from: LocalDate;
  to: LocalDate;
  /** Циклы с началом в периоде, по возрастанию. */
  cycles: ReportCycle[];
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
  cycleRange: { min: number; max: number } | null;
  lastPeriodStart: LocalDate | null;
  /** Ожидаемое начало следующих месячных (при задержке — исходный прогноз). */
  nextPeriod: LocalDate | null;
  delayDays: number;
  lowConfidence: boolean;
  /** Завершённые циклы периода — столбцы графика. */
  chart: Array<{ start: LocalDate; length: number; outlier: boolean }>;
  symptoms: Array<{ id: SymptomId; days: number; intensity: Record<Intensity, number> | null }> | null;
  moods: Array<{ id: MoodId; days: number }> | null;
}

/** Сколько дней встречается каждый код; по убыванию дней, при равенстве — порядок справочника. */
function countByCode<T extends string>(catalog: ReadonlyArray<{ id: T }>, lists: T[][]): Array<{ id: T; days: number }> {
  const counts = new Map<T, number>();
  for (const list of lists) for (const id of list) counts.set(id, (counts.get(id) ?? 0) + 1);
  return catalog
    .map((item, order) => ({ id: item.id, days: counts.get(item.id) ?? 0, order }))
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days || a.order - b.order)
    .map(({ id, days }) => ({ id, days }));
}

export function buildDoctorReport(input: DoctorReportInput): DoctorReport {
  const { periods, entries, settings, today, months = 12 } = input;
  const from = toLocalDate(addMonths(parseLD(today), -months));

  const allCycles = buildCycles(periods);
  const cycles: ReportCycle[] = allCycles
    .filter((c) => c.start >= from && c.start <= today)
    .map((c) => ({
      start: c.start,
      length: c.length,
      periodLength: c.periodLength,
      periodEndEstimated: c.periodEndEstimated,
      outlier: c.isOutlier,
    }));

  const completed = cycles.filter((c): c is ReportCycle & { length: number } => c.length !== null);
  const usable = completed.filter((c) => !c.outlier).map((c) => c.length);

  const forecast = buildForecast({ periods, settings, today });
  const delayDays = forecast?.delayDays ?? 0;
  let nextPeriod: LocalDate | null = null;
  if (forecast) {
    nextPeriod =
      delayDays > 0
        ? addDaysLD(today, -delayDays)
        : todaySummary({ forecast, periods, settings, entries: new Set(), today }).nextPeriod;
  }

  const inPeriod = entries.filter((e) => e.date >= from && e.date <= today);

  let symptoms: DoctorReport['symptoms'] = null;
  if (settings.showWellbeing) {
    symptoms = countByCode(SYMPTOMS, inPeriod.map((e) => e.symptoms)).map(({ id, days }) => {
      if (!settings.showIntensity) return { id, days, intensity: null };
      const intensity: Record<Intensity, number> = { mild: 0, moderate: 0, severe: 0 };
      for (const e of inPeriod) {
        const level = e.symptoms.includes(id) ? e.intensity[id] : undefined;
        if (level) intensity[level] += 1;
      }
      return { id, days, intensity };
    });
  }

  return {
    from,
    to: today,
    cycles,
    avgCycleLength: averageCycleLength(allCycles),
    avgPeriodLength: averagePeriodLength(allCycles),
    cycleRange: usable.length ? { min: Math.min(...usable), max: Math.max(...usable) } : null,
    lastPeriodStart: allCycles.at(-1)?.start ?? null,
    nextPeriod,
    delayDays,
    lowConfidence: forecast?.confidence === 'low',
    chart: completed.map((c) => ({ start: c.start, length: c.length, outlier: c.outlier })),
    symptoms,
    moods: settings.showMood ? countByCode(MOODS, inPeriod.map((e) => e.moods)) : null,
  };
}

// ---------- Строки для рисования ----------

export interface ReportTable {
  head: string[];
  rows: string[][];
}

export interface ReportView {
  title: string;
  subtitle: string;
  tiles: Array<{ label: string; value: string; note: string }>;
  confidenceNote: string | null;
  /** `null` — завершённых циклов нет: вместо графика текст `NO_CYCLES_TEXT`. */
  chart: { bars: Array<{ label: string; value: number; outlier: boolean }>; average: number | null } | null;
  cycleTable: ReportTable;
  symptomTable: ReportTable | null;
  moodTable: ReportTable | null;
}

export const REPORT_TITLE = 'Отчёт о менструальном цикле';
export const NO_CYCLES_TEXT = 'Пока нет завершённых циклов';
const LOW_CONFIDENCE_NOTE = 'Прогноз по средним значениям: мало данных или нерегулярный цикл';

/** «08.11.2026» */
export const formatDateNumeric = (d: LocalDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const formatDayMonthNumeric = (d: LocalDate) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const days = (n: number | null) => (n === null ? '—' : `${n} дн.`);
const count = (n: number) => (n === 0 ? '—' : String(n));

function averageNote(r: DoctorReport): string {
  const base = 'по последним 6 циклам';
  if (!r.cycleRange) return base;
  const { min, max } = r.cycleRange;
  return min === max ? `${base} · все по ${min} дн.` : `${base} · от ${min} до ${max} дн.`;
}

function nextTile(r: DoctorReport): { value: string; note: string } {
  if (!r.nextPeriod) return { value: '—', note: '' };
  if (r.delayDays > 0) return { value: `Задержка ${r.delayDays} дн.`, note: `ожидались ${formatDateNumeric(r.nextPeriod)}` };
  if (r.lowConfidence) return { value: `≈ ${formatDateNumeric(r.nextPeriod)}`, note: 'ориентировочно' };
  return { value: formatDateNumeric(r.nextPeriod), note: 'по средней длине цикла' };
}

export function reportView(r: DoctorReport, createdAt: LocalDate): ReportView {
  const last = r.lastPeriodStart;
  const tiles = [
    { label: 'Средняя длина цикла', value: days(r.avgCycleLength), note: averageNote(r) },
    { label: 'Средняя длина месячных', value: days(r.avgPeriodLength), note: 'по последним 6 циклам' },
    {
      label: 'Последние месячные',
      value: last ? formatDateNumeric(last) : '—',
      note: last ? `сегодня ${diffDays(r.to, last) + 1}-й день цикла` : '',
    },
    { label: 'Ожидаемые следующие', ...nextTile(r) },
  ];

  const cycleRows = [...r.cycles].reverse().map((c) => [
    formatDateNumeric(c.start),
    c.length === null ? 'идёт сейчас' : `${c.length} дн.`,
    c.periodLength === null ? '—' : `${c.periodEndEstimated ? '≈ ' : ''}${c.periodLength} дн.`,
    c.outlier ? 'не учитывается в средних' : '',
  ]);

  let symptomTable: ReportTable | null = null;
  if (r.symptoms && r.symptoms.length > 0) {
    const withLevels = r.symptoms.some((s) => s.intensity !== null);
    symptomTable = {
      head: withLevels ? ['Самочувствие', 'Дней', 'Слабо', 'Средне', 'Сильно'] : ['Самочувствие', 'Дней'],
      rows: r.symptoms.map((s) =>
        s.intensity
          ? [symptomLabel(s.id), String(s.days), count(s.intensity.mild), count(s.intensity.moderate), count(s.intensity.severe)]
          : [symptomLabel(s.id), String(s.days)],
      ),
    };
  }

  return {
    title: REPORT_TITLE,
    subtitle: `Период: ${formatDateNumeric(r.from)} – ${formatDateNumeric(r.to)} · сформирован ${formatDateNumeric(createdAt)}`,
    tiles,
    confidenceNote: r.lowConfidence ? LOW_CONFIDENCE_NOTE : null,
    chart: r.chart.length
      ? {
          bars: r.chart.map((c) => ({ label: formatDayMonthNumeric(c.start), value: c.length, outlier: c.outlier })),
          average: r.avgCycleLength,
        }
      : null,
    cycleTable: { head: ['Начало месячных', 'Длина цикла', 'Длина месячных', 'Примечание'], rows: cycleRows },
    symptomTable,
    moodTable:
      r.moods && r.moods.length > 0
        ? { head: ['Настроение', 'Дней'], rows: r.moods.map((m) => [moodLabel(m.id), String(m.days)]) }
        : null,
  };
}
