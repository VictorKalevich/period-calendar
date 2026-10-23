# Contract: Domain API (`src/domain`)

Чистые функции без доступа к DOM, хранилищу, сети и часам (Конституция IV). Все функции
детерминированы; «сегодня» передаётся параметром. Типы — см. [data-model.md](../data-model.md).

```ts
type LocalDate = string & { readonly __brand: 'LocalDate' }; // 'YYYY-MM-DD'
type Probability = 'low' | 'medium' | 'high';

// dates.ts
function toLocalDate(d: Date): LocalDate;
function addDaysLD(d: LocalDate, n: number): LocalDate;
function diffDays(a: LocalDate, b: LocalDate): number;      // a − b в календарных днях
function monthGrid(year: number, month: number): LocalDate[]; // 35 или 42 дня, с понедельника

// cycles.ts
function buildCycles(periods: Period[], settings: Settings): Cycle[];
function averageCycleLength(cycles: Cycle[], fallback: number): number;  // последние 6, без выбросов
function averagePeriodLength(cycles: Cycle[], fallback: number): number; // последние 6 с концом

// forecast.ts
function buildForecast(input: {
  periods: Period[];
  settings: Settings;
  today: LocalDate;
  horizonMonths?: number; // по умолчанию 12
}): Forecast | null;     // null — нет ни одной отметки

function dayInfo(date: LocalDate, forecast: Forecast | null, periods: Period[],
                 entries: ReadonlySet<LocalDate>, today: LocalDate): DayInfo;

function todaySummary(forecast: Forecast | null, today: LocalDate): {
  cycleDay: number | null;
  probability: Probability | null;
  daysToPeriod: number | null;    // 0 — сегодня
  daysToOvulation: number | null; // до ближайшей будущей овуляции
  delayDays: number;
};

// periods.ts — правила редактирования (возвращают новый массив или ошибку)
function markPeriodStart(periods: Period[], day: LocalDate, today: LocalDate,
                         settings: Settings): Result<Period[]>;
function markPeriodEnd(periods: Period[], day: LocalDate, today: LocalDate): Result<Period[]>;
function unmarkPeriodDay(periods: Period[], day: LocalDate): Period[];

// reminders.ts
function planReminders(forecast: Forecast, settings: Settings, now: Date,
                       cyclesAhead?: number /* 6 */): Reminder[];

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
| 2 | одна отметка 2026-03-01, default 28 | месячные 03-29, овуляция 03-15, окно 03-10…03-15, средняя 03-08, 03-09, 03-16 |
| 3 | циклы 27, 29, 31 | длина 29 |
| 4 | циклы 28, 28, 90 | 90 — выброс, длина 28 |
| 5 | 8 циклов | учитываются только последние 6 |
| 6 | цикл через границу года (начало 2026-12-20) | следующие 2027-01-17 |
| 7 | февраль високосного года (2028-02-15, 28 дн.) | следующие 2028-03-14 |
| 8 | задержка 3 дня | `delayDays = 3`, прогнозные месячные с «сегодня» |
| 9 | начало без конца | длина месячных = default; отмеченные дни ≤ сегодня = `actual` |
| 10 | новое начало при открытом периоде | предыдущий закрывается автоматически |
| 11 | начало в будущем | ошибка `future-date` |
| 12 | начало внутри существующего периода | ошибка `inside-existing` |
| 13 | `dayInfo` до первой отметки | `cycleDay = null`, `probability = null` |
| 14 | `planReminders`: смена летнего времени | `sendAt` соответствует 12:00 местного времени |
| 15 | `planReminders`: напоминание в прошлом | не включается |
| 16 | `planReminders`: выключено `remindOvulation` | только `kind: 'period'` |
| 17 | `monthGrid` для любого месяца | начинается с понедельника, содержит все дни месяца |
