// Типы доменного модуля — contracts/domain-api.md, data-model.md.

/** Календарная дата `YYYY-MM-DD` без времени суток и часового пояса. */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

export type SymptomId =
  | 'cramps'
  | 'headache'
  | 'backache'
  | 'bloating'
  | 'breast_tenderness'
  | 'acne'
  | 'fatigue'
  | 'nausea'
  | 'cravings'
  | 'insomnia';

export type MoodId = 'great' | 'calm' | 'sensitive' | 'irritable' | 'sad' | 'anxious';

export interface Period {
  id: string;
  start: LocalDate;
  /** `null` — конец не отмечен. */
  end: LocalDate | null;
  /** Конец проставлен автоматически; такие месячные не входят в среднюю длину (FR-014). */
  endEstimated: boolean;
}

export interface DayEntry {
  date: LocalDate;
  symptoms: SymptomId[];
  mood: MoodId | null;
  /** 0…1000 символов. */
  note: string;
}

export interface Settings {
  /** 21…45 */
  defaultCycleLength: number;
  /** 2…10 */
  defaultPeriodLength: number;
  remindPeriod: boolean;
  remindOvulation: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  defaultCycleLength: 28,
  defaultPeriodLength: 5,
  remindPeriod: true,
  remindOvulation: true,
});

export const CYCLE_LENGTH_RANGE = { min: 21, max: 45 } as const;
export const PERIOD_LENGTH_RANGE = { min: 2, max: 10 } as const;
export const MAX_PERIOD_DAYS = 15;
export const MAX_NOTE_LENGTH = 1000;
export const OUTLIER_CYCLE = { min: 15, max: 60 } as const;
export const AVERAGE_WINDOW = 6;
export const LUTEAL_PHASE_DAYS = 14;

export type Probability = 'low' | 'medium' | 'high';
export type Confidence = 'normal' | 'low';
export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  menstrual: 'Менструальная фаза',
  follicular: 'Фолликулярная фаза',
  ovulation: 'Овуляция',
  luteal: 'Лютеиновая фаза',
};

export const PROBABILITY_LABELS: Readonly<Record<Probability, string>> = {
  low: 'низкая',
  medium: 'средняя',
  high: 'высокая',
};

export interface Cycle {
  start: LocalDate;
  /** Дней до начала следующих месячных; `null` для текущего цикла. */
  length: number | null;
  /** Длина месячных, если конец отмечен. */
  periodLength: number | null;
  periodEndEstimated: boolean;
  /** `length < 15 || length > 60` — не участвует в среднем. */
  isOutlier: boolean;
}

export interface PredictedCycle {
  start: LocalDate;
  /** Начало следующих месячных (фактическое для завершённых циклов). */
  nextStart: LocalDate;
  /** Прогнозные дни месячных этого цикла (пусто для циклов с фактическими месячными). */
  periodDays: LocalDate[];
  ovulation: LocalDate;
  /** `ovulation − 5 … ovulation` */
  fertile: LocalDate[];
  /** `ovulation − 7`, `ovulation − 6`, `ovulation + 1` */
  mediumDays: LocalDate[];
  /** Цикл завершён (следующие месячные отмечены). */
  completed: boolean;
}

export interface Forecast {
  cycleLength: number;
  periodLength: number;
  confidence: Confidence;
  delayDays: number;
  /** Завершённые, текущий и прогнозируемые циклы в хронологическом порядке. */
  cycles: PredictedCycle[];
}

export interface DayInfo {
  date: LocalDate;
  cycleDay: number | null;
  period: 'actual' | 'predicted' | null;
  /** `past` — день окна раньше сегодняшнего (любой цикл); `predicted` — сегодня и позже. */
  fertile: 'predicted' | 'past' | null;
  ovulation: boolean;
  probability: Probability | null;
  phase: Phase | null;
  isToday: boolean;
  hasEntry: boolean;
}

export interface DayContext {
  forecast: Forecast | null;
  periods: Period[];
  settings: Settings;
  entries: ReadonlySet<LocalDate>;
  today: LocalDate;
}

export type PeriodError =
  | 'future-date'
  | 'inside-existing'
  | 'end-before-start'
  | 'too-long'
  | 'no-open-period';

export type Result<T, E = PeriodError> = { ok: true; value: T } | { ok: false; error: E };
