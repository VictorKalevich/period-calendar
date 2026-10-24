# Contract: Domain API (`src/domain`)

Чистые функции без доступа к DOM, хранилищу, сети и часам (Конституция IV). Все функции
детерминированы; «сегодня» передаётся параметром. Типы — см. [data-model.md](../data-model.md).

```ts
type LocalDate = string & { readonly __brand: 'LocalDate' }; // 'YYYY-MM-DD'
type Probability = 'low' | 'medium' | 'high';
type Confidence = 'normal' | 'low';
type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
// Подписи: 'Менструальная фаза' | 'Фолликулярная фаза' | 'Овуляция' | 'Лютеиновая фаза'
// DayInfo.fertile: 'predicted' | 'past' | null — 'past' для дней окна раньше today (любой цикл)
// DayInfo.phase: Phase | null (FR-019b)

// dates.ts
function toLocalDate(d: Date): LocalDate;
function addDaysLD(d: LocalDate, n: number): LocalDate;
function diffDays(a: LocalDate, b: LocalDate): number;      // a − b в календарных днях
function monthGrid(year: number, month: number): LocalDate[]; // 35 или 42 дня, с понедельника

// cycles.ts
function buildCycles(periods: Period[]): Cycle[];
// последние 6 завершённых не-выбросов; null — таких нет
function averageCycleLength(cycles: Cycle[]): number | null;
// последние 6 периодов с концом и endEstimated = false; null — таких нет
function averagePeriodLength(cycles: Cycle[]): number | null;
// 'low', если не-выбросов < 3 или max − min длин, учтённых в среднем, > 7
function forecastConfidence(cycles: Cycle[]): Confidence;

// forecast.ts
function buildForecast(input: {
  periods: Period[];
  settings: Settings;
  today: LocalDate;
  horizonMonths?: number; // по умолчанию 12
}): Forecast | null;     // null — нет ни одной отметки
// Forecast.cycleLength  = averageCycleLength ?? settings.defaultCycleLength
// Forecast.periodLength = averagePeriodLength ?? settings.defaultPeriodLength
// Forecast.confidence   = forecastConfidence(cycles)

type DayContext = {
  forecast: Forecast | null;          // null — прогноза нет (нет отметок)
  periods: Period[];
  settings: Settings;                 // defaultPeriodLength, когда forecast = null
  entries: ReadonlySet<LocalDate>;    // дни с симптомами/настроением/заметкой
  today: LocalDate;
};
// Незакрытый период дорисовывается по forecast.periodLength, без прогноза — по defaultPeriodLength.
function dayInfo(date: LocalDate, ctx: DayContext): DayInfo;

// Принимает тот же контекст, что dayInfo: фазе нужны фактические дни месячных.
function todaySummary(ctx: DayContext): {
  cycleDay: number | null;
  probability: Probability | null;
  daysToPeriod: number | null;    // 0 — сегодня
  daysToOvulation: number | null; // до ближайшей будущей овуляции
  nextPeriod: LocalDate | null;
  nextOvulation: LocalDate | null;
  nextFertile: { from: LocalDate; to: LocalDate } | null; // ближайшее окно, ещё не закончившееся
  delayDays: number;
  confidence: Confidence | null;
  phase: Phase | null;            // null при задержке (delayDays > 0) и без данных
};

// stats.ts — те же средние, что в прогнозе (FR-027)
function cycleStats(cycles: Cycle[]): {
  avgCycleLength: number | null;  // = averageCycleLength(cycles)
  avgPeriodLength: number | null; // = averagePeriodLength(cycles)
  history: Cycle[];               // от новых к старым, включая выбросы
};

// periods.ts — правила редактирования (возвращают новый массив или ошибку)
// periodLength — прогнозируемая длина месячных (forecast?.periodLength ?? defaultPeriodLength),
// используется для автозакрытия предыдущего открытого периода (endEstimated = true)
function markPeriodStart(periods: Period[], day: LocalDate, today: LocalDate,
                         periodLength: number): Result<Period[]>;
function markPeriodEnd(periods: Period[], day: LocalDate, today: LocalDate,
                       periodLength: number): Result<Period[]>; // результат нормализуется (003)
function unmarkPeriodDay(periods: Period[], day: LocalDate): Period[];
// movePeriodStart заменена фичей 003 на setPeriodStart и periodActionsFor —
// см. specs/003-calendar-tap-actions/contracts/period-actions.md

// reminders.ts
function planReminders(forecast: Forecast, settings: Settings, now: Date,
                       cyclesAhead?: number /* 6 */): Reminder[];
// при forecast.delayDays > 0 возвращает [] — напоминания на следующие циклы не планируются

type Reminder = {
  id: string;        // детерминированный: `${kind}:${date}`
  kind: 'period' | 'ovulation';
  sendAt: string;    // ISO-8601 UTC; 12:00 местного времени в дату напоминания
  title: string;     // 'Календарь цикла' | 'Овуляция'
  body: string;      // 'Ближайшие дни будь аккуратна, скоро начало цикла' | 'Сегодня Ты КОРОЛЕВА'
};

type Result<T> = { ok: true; value: T } | { ok: false; error: PeriodError };
type PeriodError = 'future-date' | 'inside-existing' | 'end-before-start' | 'too-long' | 'no-open-period';
```

## Обязательные тестовые случаи (TDD, до реализации)

| # | Случай | Ожидание |
|---|--------|----------|
| 1 | нет отметок | `buildForecast` → `null`; `todaySummary` → всё `null` |
| 2 | одна отметка 2026-03-01, default 28 | месячные 03-29, овуляция 03-14 (начало + 13, фича 005), окно 03-09…03-14, средняя 03-07, 03-08, 03-15 |
| 3 | циклы 27, 29, 31 | длина 29 |
| 4 | циклы 28, 28, 90 | 90 — выброс, длина 28 |
| 5 | 8 циклов | учитываются только последние 6 |
| 6 | цикл через границу года (начало 2026-12-20) | следующие 2027-01-17 |
| 7 | февраль високосного года (2028-02-15, 28 дн.) | следующие 2028-03-14 |
| 8 | задержка 3 дня | `delayDays = 3`, прогнозные месячные с «сегодня» |
| 9 | начало без конца | без прогноза — длина = default; с историей — `forecast.periodLength`; дни ≤ сегодня = `actual`, позже = `predicted` |
| 10 | новое начало при открытом периоде | предыдущий закрывается по `periodLength`, `endEstimated = true` |
| 11 | начало в будущем | ошибка `future-date` |
| 12 | начало внутри существующего периода | ошибка `inside-existing`; `movePeriodStart` переносит начало на этот день |
| 13 | `dayInfo` до первой отметки | `cycleDay = null`, `probability = null` |
| 14 | `planReminders`: смена летнего времени | `sendAt` соответствует 12:00 местного времени |
| 15 | `planReminders`: напоминание в прошлом | не включается |
| 16 | `planReminders`: выключено `remindOvulation` | только `kind: 'period'` |
| 17 | `monthGrid` для любого месяца | начинается с понедельника, содержит все дни месяца |
| 18 | `confidence`: 0, 1 или 2 завершённых цикла | `low` |
| 19 | `confidence`: циклы 26, 28, 35 (разброс 9) | `low`; циклы 27, 28, 30 (разброс 3) — `normal` |
| 20 | `averagePeriodLength`: 4 (ручной), 5×5 (`endEstimated`, закрыты следующим началом), текущие без конца | 5 (4,83; закрытые автоматически учитываются, оценочный конец текущих — нет) |
| 21 | конец позже 15-го дня от начала | ошибка `too-long` |
| 22 | `planReminders` при `delayDays > 0` | `[]` |
| 23 | смена часового пояса (`TZ` = Asia/Tokyo vs America/Los_Angeles) | `buildForecast` и `dayInfo` дают одинаковые даты |
| 24 | `cycleStats` | средние совпадают с `Forecast.cycleLength`/`periodLength` при наличии истории |
| 25 | фазы: начало 2026-03-01, месячные 5 дн., цикл 28 | 03-01…03-05 `menstrual`, 03-06…03-13 `follicular`, 03-14 `ovulation`, 03-15…03-28 `luteal`, 03-29 `menstrual` |
| 26 | фаза при пересечении (отмеченные месячные 10 дн., сдвиг −5 → овуляция на 9-й день) | 9-й день — `menstrual`, `fertile = null`, `ovulation = false` (005) |
| 29 | овуляция = `min(начало + 13 (+ сдвиг при `ovulationShiftEnabled`), следующие − 1)` для прошлых и прогнозных циклов, циклы 21 и 45, через месяц и год; выключенный сдвиг не применяется | см. specs/005-ovulation-shift-theme/contracts/ovulation.md |
| 30 | `ovulationFor({ start, periodLast, nextStart }, settings)` при `ovulationFromNextPeriod`: `min(max(nextStart − 14 + сдвиг, periodLast + 1), nextStart − 1)`; режим не меняет прогноз месячных и длины | см. specs/006-ovulation-from-next-period/contracts/ovulation-mode.md |
| 27 | `todaySummary.phase` при задержке и без отметок | `null` |
| 28 | `dayInfo.fertile` | дни окна раньше `today` (в прошлом и в текущем цикле) → `'past'`; сегодня и позже → `'predicted'`; `ovulation = true` в обоих случаях |
