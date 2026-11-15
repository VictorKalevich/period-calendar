# Data Model: Производные прогноза считаются в одном месте

Хранимые данные, схема IndexedDB и формат резервной копии не меняются (FR-016). Не меняются и доменные
типы `Period`, `Cycle`, `PredictedCycle`, `Forecast`, `TodaySummary`, `DayContext` (research R6). Ниже —
производные величины, у которых после шага один источник, и новый тип результата `buildPeriodCycles`.

## Производные величины

| Величина | Правило (прежнее) | Источник после шага | Потребители |
|----------|-------------------|---------------------|-------------|
| Длина месячных для расчётов | средняя длина последних 6 месячных с концом (оценочный конец текущих не учитывается), иначе `settings.defaultPeriodLength` | `effectivePeriodLength(periods, settings)` | `buildForecast` (`Forecast.periodLength`), `dayInfo` (через прогноз или напрямую), диалог дня в `DaySheets` и `CalendarScreen`, `normalizeStoredPeriods`, `planTextImport` |
| Исходная прогнозная дата начала | начало текущего цикла + длина цикла = `nextStart` текущего цикла − `delayDays` | `originalPredictedStart(forecast)` | напоминание о неотмеченном начале при задержке (`planReminders`), «ожидаемые следующие» в отчёте при задержке |
| Ближайшее прогнозное начало | начало первого прогнозного цикла с `start ≥ today` | `nextPredictedStart(forecast, today)` | `todaySummary().nextPeriod` и `daysToPeriod`, «ожидаемые следующие» в отчёте без задержки |
| Порядок месячных по началу | по возрастанию `start` (строки `YYYY-MM-DD`), стабильно | `sortByStart(periods)` | `buildPeriodCycles` (→ `buildCycles`, `buildForecast`), `normalizePeriods` |

Связи:
- `buildForecast(...).periodLength === effectivePeriodLength(periods, settings)` для любых месячных и
  настроек (SC-005).
- Без задержки (`delayDays === 0`) `originalPredictedStart(f) === nextPredictedStart(f, today)`, если первый
  прогнозный цикл попадает в горизонт прогноза.
- При задержке `nextPredictedStart(f, today) === today`, `originalPredictedStart(f) === today − delayDays`.

## `PeriodCycle` (новый тип, `src/domain/cycles.ts`)

| Поле | Тип | Значение |
|------|-----|----------|
| `period` | `Period` | месячные, с которых начинается цикл (исходный объект, не копия) |
| `cycle` | `Cycle` | цикл этих месячных — ровно тот, что раньше отдавал `buildCycles` |

`buildPeriodCycles(periods)` отдаёт пары в порядке `sortByStart(periods)`;
`buildCycles(periods) = buildPeriodCycles(periods).map((x) => x.cycle)`.

## `CycleInput` (внутренний тип, `src/domain/forecast.ts`)

Именованные значения для сборки цикла прогноза `cycleFrom` (research R7).

| Поле | Тип | Умолчание | Значение |
|------|-----|-----------|----------|
| `start` | `LocalDate` | — | начало цикла |
| `nextStart` | `LocalDate` | — | начало следующих месячных (при задержке у текущего — сегодня) |
| `kind` | `'completed' \| 'current' \| 'predicted'` | — | вид цикла |
| `periodLength` | `number` | — | длина месячных для расчётов |
| `settings` | `Settings` | — | настройки (режим и сдвиг овуляции) |
| `periodLast` | `LocalDate` | `start + periodLength − 1` | последний день месячных цикла |
| `ovulationBound` | `LocalDate` | `nextStart` | начало следующих для расчёта овуляции; у текущего — исходная прогнозная дата |
