# Contract: производные прогноза в домене

Все функции — чистые, в `src/domain`, без чтения текущего времени; «сегодня» — параметром. Импорты домена —
только файлы домена и `date-fns` (через `dates.ts`).

## `src/domain/periods.ts`

```ts
/** Новый массив месячных по возрастанию начала; исходный не меняется; равные начала — в исходном порядке. */
export function sortByStart(periods: Period[]): Period[];
```

Прежняя внутренняя функция, теперь экспортируется. Единственное место сравнения месячных «по началу».

## `src/domain/cycles.ts`

```ts
export interface PeriodCycle {
  period: Period;
  cycle: Cycle;
}

/** Месячные по началу и цикл каждого из них — одна сортировка для циклов и прогноза. */
export function buildPeriodCycles(periods: Period[]): PeriodCycle[];

/** Прежний результат: `buildPeriodCycles(periods).map((x) => x.cycle)`. */
export function buildCycles(periods: Period[]): Cycle[];
```

## `src/domain/forecast.ts`

```ts
/** Длина месячных для расчётов: средняя по истории (FR-014 фичи 001), иначе из настроек. */
export function effectivePeriodLength(periods: Period[], settings: Settings): number;

/** Начало следующих месячных по прогнозу до учёта задержки; `null`, если в прогнозе нет текущего цикла. */
export function originalPredictedStart(forecast: Forecast): LocalDate | null;

/** Начало ближайших прогнозных месячных не раньше `today`; `null`, если таких в горизонте нет. */
export function nextPredictedStart(forecast: Forecast, today: LocalDate): LocalDate | null;
```

Без изменений сигнатур: `buildForecast`, `dayInfo`, `todaySummary`, `ovulationFor`, `ovulationShiftOf`.

Гарантии:

| # | Гарантия |
|---|----------|
| G1 | `buildForecast({ periods, settings, today })?.periodLength ?? settings.defaultPeriodLength === effectivePeriodLength(periods, settings)` для любых входов |
| G2 | Результат `buildForecast`, `todaySummary`, `dayInfo`, `planReminders`, `buildDoctorReport` — прежний на любых входах (характеризация R9 и существующие тесты) |
| G3 | `originalPredictedStart(f)` — единственный обратный счёт от `delayDays` в `src/` |
| G4 | `effectivePeriodLength` — единственное место правила `… ?? …defaultPeriodLength` в `src/` |

## Вызывающие места

| Место | Было | Стало |
|-------|------|-------|
| `forecast.ts` `buildForecast` | `averagePeriodLength(cycles) ?? settings.defaultPeriodLength`; вторая сортировка `sorted` и `sorted[i]` | `effectivePeriodLength(periods, settings)`; месячные и циклы из `buildPeriodCycles`; `cycleFrom({ … })` |
| `forecast.ts` `dayInfo` | `forecast?.periodLength ?? settings.defaultPeriodLength` | `forecast ? forecast.periodLength : effectivePeriodLength(periods, settings)` |
| `forecast.ts` `todaySummary` | `forecast.cycles.find(…predicted… >= today)?.start ?? null` | `nextPredictedStart(forecast, today)` |
| `cycles.ts` `buildCycles` | своя сортировка | `buildPeriodCycles` (через `sortByStart`) |
| `reminders.ts` `planReminders` | `addDaysLD(current.nextStart, -forecast.delayDays)` | `originalPredictedStart(forecast)` |
| `report.ts` `buildDoctorReport` | `addDaysLD(today, -delayDays)` / `todaySummary({ …, entries: new Set() }).nextPeriod` | `originalPredictedStart(forecast)` / `nextPredictedStart(forecast, today)` |
| `storage/repository.ts` `normalizeStoredPeriods` | `buildForecast(…)?.periodLength ?? settings.defaultPeriodLength` | `effectivePeriodLength(periods, settings)` |
| `storage/textImport.ts` `planTextImport` | то же | `effectivePeriodLength(existing, settings)` |
| `ui/components/DaySheets.tsx` | `ctx.forecast?.periodLength ?? ctx.settings.defaultPeriodLength` | `effectivePeriodLength(ctx.periods, ctx.settings)` |
| `ui/screens/CalendarScreen.tsx` `onSelect` | то же | `effectivePeriodLength(ctx.periods, ctx.settings)` |
