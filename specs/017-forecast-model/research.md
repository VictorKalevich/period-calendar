# Research: Производные прогноза считаются в одном месте

Фича 017, шаг 4 плана рефакторинга. Пункты «Проверить на этапе плана» файла шага разобраны в R6 (функции
вместо новых полей), R5 (форма `buildCycles`) и R1 (равенство `effectivePeriodLength` и
`buildForecast(...).periodLength` на наборе историй).

## R1. Длина месячных: `effectivePeriodLength(periods, settings)` в `src/domain/forecast.ts`

**Decision**: экспортируемая функция
`effectivePeriodLength(periods: Period[], settings: Settings): number` =
`averagePeriodLength(buildCycles(periods)) ?? settings.defaultPeriodLength`. Лежит в `forecast.ts`, рядом с
`ovulationShiftOf` — второй производной от настроек. `buildForecast` считает `periodLength` ею же:
`const periodLength = effectivePeriodLength(periods, settings)`.

**Rationale**:
- Это ровно прежнее выражение `forecast.ts:78` — формула не меняется. От «сегодня» она не зависит, поэтому
  хранилищу не нужен прогноз на 12 месяцев (FR-004).
- Пустая история: `buildForecast` возвращает `null`, и прежние потребители брали `defaultPeriodLength`;
  `averagePeriodLength([])` — `null`, функция даёт тот же `defaultPeriodLength`. Непустая история: прежнее
  `buildForecast(...).periodLength` — то же выражение над теми же месячными. Значит, в хранилище результат
  совпадает на любых данных.
- Равенство с `buildForecast(...).periodLength` проверяется тестом на наборе историй (SC-005): нет данных;
  одна открытая; одна закрытая; оценочный конец текущих (не учитывается); оценочный конец, закрытый
  следующим началом (учитывается); выбросы; ручные концы; больше 6 циклов (окно); неупорядоченный вход.
- `buildForecast` строит циклы дважды (свои и внутри функции). Прогноз считается один раз на изменение
  данных, циклов — десятки; цена незаметна, а правило остаётся одним выражением.

**Alternatives considered**:
- *Функция над циклами (`effectivePeriodLength(cycles, settings)`)*: прогноз не строил бы циклы второй раз,
  но хранилищу и интерфейсу пришлось бы сначала вызывать `buildCycles` — лишний шаг в каждом потребителе.
  Отклонено: набросок шага и критерии говорят о функции по месячным.
- *Положить в `cycles.ts` рядом с `averagePeriodLength`*: `cycles.ts` не знает о настройках. Отклонено.

## R2. Потребители длины месячных

**Decision**:
- `src/storage/repository.ts` (`normalizeStoredPeriods`) и `src/storage/textImport.ts` (`planTextImport`) —
  `effectivePeriodLength(periods, settings)`; импорт `buildForecast` из них уходит.
- `src/ui/components/DaySheets.tsx` и `src/ui/screens/CalendarScreen.tsx` (`onSelect`) —
  `effectivePeriodLength(ctx.periods, ctx.settings)`.
- `dayInfo` — `forecast ? forecast.periodLength : effectivePeriodLength(periods, settings)`: значение
  прогноза, посчитанное той же функцией, а без прогноза — сама функция.

**Rationale**:
- Контекст дня собирает только `useForecast` (`src/hooks/useForecast.ts:23-31`): `forecast` строится из тех
  же `periods` и `settings`, что кладутся в контекст. Поэтому в приложении `ctx.forecast.periodLength`
  равно `effectivePeriodLength(ctx.periods, ctx.settings)` (R1), а `forecast === null` бывает только при
  пустой истории, где функция даёт `defaultPeriodLength`. Для диалога дня и выбора дня результат прежний.
- `dayInfo` вызывается для каждой ячейки (до 126 на отрисовку: `MonthPager` рисует три месяца). Готовое
  значение прогноза не добавляет работы на ячейку; пересчёт циклов на каждую ячейку был бы лишним, а кэш
  `dayInfo` по условиям шага не трогается.
- Контекст «без прогноза, но с месячными» строят тесты `dayInfo.test.ts` («dayInfo without forecast»,
  «оценочный конец в будущем»). Раньше длина в нём была `defaultPeriodLength`, теперь — по истории. На всех
  существующих таких тестах значения те же: у месячных либо отмечен конец (длина не участвует), либо
  средняя по истории равна умолчанию 5 (одна открытая запись; закрытая 5-дневная + открытая). Проверяется
  прогоном существующих тестов без изменений. В приложении такого контекста нет.
- Правило «длина из настроек, если средней нет» после правки записано один раз — в
  `effectivePeriodLength` (SC-002, проверка поиском по исходникам).

**Alternatives considered**:
- *В `dayInfo` всегда `effectivePeriodLength(periods, settings)`*: проще, но пересчёт циклов на каждую
  ячейку. Отклонено.
- *В `dayInfo` без прогноза — `settings.defaultPeriodLength`, как сейчас*: это та же копия правила «длина
  из настроек», которую шаг убирает (критерий готовности). Отклонено.
- *Отдельная функция над контекстом дня (`periodLengthOf(ctx)`) для `dayInfo` и интерфейса*: ещё одна
  функция ради выбора «из прогноза или пересчитать»; интерфейсу дешевле пересчитать (один вызов на
  отрисовку или нажатие). Отклонено (Конституция V).

## R3. Исходная прогнозная дата: `originalPredictedStart(forecast)`

**Decision**: экспортируемая функция в `forecast.ts`
`originalPredictedStart(forecast: Forecast): LocalDate | null` — начало следующих месячных по прогнозу до
учёта задержки: `nextStart` текущего цикла (`kind === 'current'`) минус `forecast.delayDays`; `null`, если
текущего цикла в прогнозе нет. Это единственный обратный счёт от `delayDays` в домене.
- `planReminders`: при задержке, если текущий цикл попал в выборку и напоминание включено, — напоминание о
  неотмеченном начале на `originalPredictedStart(forecast)` (+2 дня внутри `missedPeriodReminder`, как
  сейчас). Комментарий о `nextStart − delayDays` переносится к функции.
- `buildDoctorReport`: при задержке `nextPeriod = originalPredictedStart(forecast)`.

**Rationale**:
- В `buildForecast` (`forecast.ts:82-84`): `predictedStart = last + cycleLength`,
  `delayDays = max(0, today − predictedStart)`, `nextStart` текущего цикла = `today` при задержке, иначе
  `predictedStart`. Отсюда `nextStart − delayDays = predictedStart` в обоих случаях.
- Прежние выражения дают ту же дату: в напоминаниях — `current.nextStart − delayDays` (тот же текущий
  цикл); в отчёте при задержке — `today − delayDays`, а `nextStart = today`. Совпадение подтверждают
  неизменные `reminders.test.ts` («M3: delay of 1 day — exactly the reminder for the original prediction»)
  и `report.test.ts` («задержка: delayDays и ожидавшаяся дата») и характеризационный тест (R9).
- Функция над существующим типом `Forecast`, без нового поля (пункт «Функции вместо новых полей», R6).
- `null` вместо исключения: `Forecast` из `buildForecast` всегда содержит текущий цикл, но тип этого не
  гарантирует. В `planReminders` прежняя проверка «текущий цикл есть в выборке» остаётся: при
  `cyclesAhead = 0` напоминание по-прежнему не планируется.

**Alternatives considered**:
- *Прямой счёт `current.start + cycleLength`*: обратного счёта не осталось бы вовсе, но формула прогнозного
  начала (`forecast.ts:82`) появилась бы второй раз. Отклонено: копия формулы прогноза хуже копии правила
  задержки, а обратный счёт живёт рядом с определением задержки в том же файле.
- *Поле `predictedStart` в `Forecast`*: сломало бы проверки на точное равенство прогноза в существующих
  тестах (`toEqual` в `dayInfo.test.ts` и др.). Отклонено (R6).

## R4. Ближайшие прогнозные месячные: `nextPredictedStart(forecast, today)`

**Decision**: экспортируемая функция в `forecast.ts`
`nextPredictedStart(forecast: Forecast, today: LocalDate): LocalDate | null` — начало первого
прогнозного цикла (`kind === 'predicted'`) с `start >= today`, иначе `null`. Это прежнее выражение
`todaySummary` (`forecast.ts:225`). `todaySummary` берёт `nextPeriod` из неё. `buildDoctorReport` без
задержки — тоже: `nextPeriod = nextPredictedStart(forecast, today)`; вызов `todaySummary` с выдуманным
контекстом (`entries: new Set()`) из отчёта уходит.

**Rationale**:
- Отчёт использовал из сводки только `nextPeriod`, а он зависит лишь от прогноза и «сегодня» — контекст дня
  для этого не нужен.
- Отчёт сохраняет прежнее ветвление «задержка → исходная дата, иначе ближайшее прогнозное начало». Это
  часть состава отчёта (поле «ожидаемые следующие»), а не производная прогноза.
- Без задержки обе функции дают одну дату (прогнозное начало ≥ сегодня — первый прогнозный цикл), но
  только пока первый прогнозный цикл попадает в горизонт. При месячных в будущем (их запрещает проверка
  ввода, но не `buildForecast`) прогнозных циклов может не быть, и прежний отчёт давал `null`. Поэтому
  ветвление не упрощается до одной функции (FR-008).

**Alternatives considered**:
- *Имя `nextPredictedPeriod`* (набросок шага): функция отдаёт дату начала, а не цикл; имя
  `nextPredictedStart` парно `originalPredictedStart`. Отклонено как менее точное.
- *Всегда `originalPredictedStart` в отчёте*: меняет поведение в крайнем случае выше. Отклонено.

## R5. Одна сортировка: `sortByStart` и `buildPeriodCycles`

**Decision**:
- `src/domain/periods.ts` экспортирует прежнюю `sortByStart(periods)` (новый массив, сравнение строк
  `YYYY-MM-DD`, стабильная сортировка). Сравнение «по началу» в исходниках остаётся одно.
- `src/domain/cycles.ts`: новая экспортируемая `buildPeriodCycles(periods): PeriodCycle[]`, где
  `PeriodCycle = { period: Period; cycle: Cycle }`, — месячные по началу (через `sortByStart`) и цикл
  каждого из них. `buildCycles(periods)` = `buildPeriodCycles(periods).map((x) => x.cycle)`; форма и
  значения `Cycle` прежние.
- `buildForecast` берёт циклы и месячные из одного результата `buildPeriodCycles`: последний день месячных
  цикла — `periodEnd(x.period, periodLength)`, как сейчас. Своя сортировка и обращение `sorted[i]` по индексу
  цикла уходят.

**Rationale**:
- Пара «месячные — цикл» строится в одном проходе по одному отсортированному массиву: совпадение двух
  сортировок больше не нужно.
- `Cycle` не меняется, поэтому `stats.ts`, `report.ts`, `StatsScreen.tsx` и их тесты (`cycles.test.ts`,
  `stats.test.ts`, `report.test.ts` с проверками на точное равенство циклов) не затронуты (пункт
  «Проверить на этапе плана» про п. 5).
- Последний день месячных по-прежнему считает `periodEnd` — правило «конец отмечен или оценка по длине»
  остаётся одним.
- Импорт `cycles.ts → periods.ts` не создаёт цикла: `periods.ts` импортирует только `dates` и `types`.

**Alternatives considered**:
- *Восстанавливать конец месячных из `Cycle.periodLength`* (`start + (periodLength ?? L) − 1`): форма
  `Cycle` та же, но правило «конец или оценка» записано второй раз, а конец получается обратным счётом из
  длины, посчитанной из конца. Отклонено.
- *Поле `end` в `Cycle`*: ломает проверки на точное равенство циклов в `cycles.test.ts` и `report.test.ts`.
  Отклонено.
- *Экспортировать отдельный компаратор `byStart`*: потребитель один (`sortByStart`). Отклонено (YAGNI).

## R6. Функции вместо новых полей

**Decision**: ни `Forecast`, ни `Cycle`, ни `PredictedCycle`, ни `TodaySummary` не меняются. Новые величины
— функции над существующими типами (R1, R3, R4); пара «месячные — цикл» — новый тип результата новой
функции (R5).

**Rationale**: существующие тесты сравнивают прогнозы и циклы целиком (`toEqual`), например сравнение
прогнозов в двух часовых поясах (`dayInfo.test.ts`), циклы в `cycles.test.ts`. Новое поле изменило бы их
ожидания или потребовало бы правки проверок (Общие ограничения, п. 2).

## R7. `cycleFrom` с именованными полями

**Decision**: `cycleFrom(input: CycleInput)`, где
`CycleInput = { start; nextStart; kind; periodLength; settings; periodLast?; ovulationBound? }` с прежними
умолчаниями (`periodLast = start + periodLength − 1`, `ovulationBound = nextStart`). Функция остаётся
внутренней. Вызовы в `buildForecast` передают объект: завершённые циклы — с `periodLast`, текущий — с
`periodLast` и `ovulationBound: predictedStart`, прогнозные — без них.

**Rationale**: `periodLast` и `ovulationBound` — две даты подряд, обе необязательные; в позиционном вызове
их легко переставить, и TypeScript этого не заметит. С именами — заметно при чтении. Тело функции не
меняется.

## R8. Тексты с числами из констант

**Decision**: новый тест `src/domain/explanationTexts.test.ts` читает исходники (`node:fs`, как
`isolation.test.ts`) и проверяет:
1. каждая фраза «по последним N циклам» в исходниках приложения (не тестах) содержит
   `N === AVERAGE_WINDOW`; фраза есть в `src/ui/screens/StatsScreen.tsx` (2 раза),
   `src/domain/report.ts` (2) и `src/ui/components/ForecastInfo.tsx` (1) — чтобы проверка не прошла
   впустую;
2. каждая фраза «короче N и длиннее M дней» содержит `N === OUTLIER_CYCLE.min`, `M === OUTLIER_CYCLE.max`;
   она есть в `ForecastInfo.tsx`.

Тексты в исходниках не меняются (FR-012, «Не входит: тексты»).

**Rationale**:
- Тест падает, если изменить константу и забыть текст, и если добавить новый текст с другим числом
  (SC-006). Проверяется один раз временной правкой константы при реализации.
- Поиск по исходникам охватывает все три места одним способом. `StatsScreen` без данных в базе не рисует
  плитки, а отрисовка с базой ради строки — лишняя сложность.
- Строки остаются литералами: снимок разметки обычного пути (`normalPath.test.ts`) и существующие проверки
  текстов (`ForecastInfo.test.ts`, `report.test.ts`) не затрагиваются.

**Alternatives considered**:
- *Собирать строки из констант* (`` `по последним ${AVERAGE_WINDOW} циклам` ``): итоговая строка та же, но
  меняется код текстов в трёх файлах (шаг их не трогает), а падежи при другом числе («по последним 1
  циклам») всё равно потребуют ручной правки. Отклонено.
- *Проверять отрисованный текст* (`renderToStaticMarkup` для `ForecastInfo`, `reportView` для отчёта):
  работает для двух мест из трёх. Отклонено ради единообразия; существующие проверки этих текстов
  остаются.

## R9. Характеризационные тесты

**Decision**: до правок, зелёные до и после:
1. `src/domain/forecastCharacterization.test.ts` — «золотой» снимок (`toMatchInlineSnapshot`) компактного
   описания результатов на наборе историй: `buildForecast` (длины, уверенность, задержка; для каждого цикла
   — вид, начало, следующее начало, овуляция, окно, дни средней вероятности, прогнозные дни месячных),
   `todaySummary(...).nextPeriod`, `buildDoctorReport(...).nextPeriod` и `delayDays`, даты напоминаний
   `planReminders`. Истории: неупорядоченный вход; одинаковые начала; открытые месячные в середине истории
   при коротком цикле в режиме «от следующей менструации» (последний день месячных влияет на овуляцию);
   оценочный конец; задержка 0 / 1 / больше; без истории. Оба режима овуляции, со сдвигом и без; горизонт
   2 месяца, чтобы снимок был коротким.
2. `src/storage/periodLength.test.ts` (изолированная база, `fake-indexeddb`) — `normalizeStoredPeriods` и
   `planTextImport` на истории, где средняя длина месячных (3) отличается от умолчания (5) и от неё зависит
   результат: открытые месячные и следующие за ними через 4 дня не объединяются при длине 3 (при 5
   объединились бы). Существующие тесты нормализации и импорта этого не различают (у них длина не влияет
   на итог).

Для строк интерфейса (`DaySheets.tsx`, `CalendarScreen.tsx`) отдельной характеризации нет: значение
заменяется равным (R2), равенство подтверждает тест R1 на наборе историй; поведение экрана охраняют
существующие `CalendarScreen.test.ts`, `dayWrites.test.ts`, `normalPath.test.ts`.

**Rationale**: снимок пишет Vitest при первом прогоне на текущем коде — это и есть записанное поведение;
inline-снимок в файле теста не создаёт `.snap` (у них на Windows бывает лишняя смена окончаний строк, см.
журнал шага 1). Компактные строки читаются в ревью.

## R10. Где новые тесты и что не меняется

**Decision**: тесты — только в новых файлах:
`src/domain/forecastDerivations.test.ts` (новые функции: `effectivePeriodLength`, `originalPredictedStart`,
`nextPredictedStart`, `sortByStart`, `buildPeriodCycles`), `src/domain/forecastCharacterization.test.ts`,
`src/domain/derivationPlacement.test.ts` (поиск по исходникам: SC-002–SC-004, FR-009–FR-011),
`src/domain/explanationTexts.test.ts` (R8), `src/storage/periodLength.test.ts` (R9).
Существующие тесты, в том числе перечисленные в критериях готовности (`forecast.test.ts`,
`dayInfo.test.ts`, `cycles.test.ts`, `periods.test.ts`, `periodActions.test.ts`, `reminders.test.ts`,
`report.test.ts`, `stats.test.ts`, `normalize.test.ts`, `cycleText.test.ts`), не меняются.

**Rationale**: Общие ограничения, п. 2 и 5. Поиск по исходникам — как `validationPlacement.test.ts` (шаг 3)
и поиск `saveDayEntry` (шаг 2). Тесты домена с `node:fs` допустимы: `isolation.test.ts` проверяет только
исходники домена, не тесты.

## R11. Попутные находки (не исправляются — в «Журнал»)

- `src/storage/backup.ts:124`: импорт резервной копии проверяет пересечения месячных с
  `settings.defaultPeriodLength`, а не с длиной по истории. Это не копия правила `effectivePeriodLength`
  (умолчание без попытки взять среднюю), а отдельное решение импорта (016); менять — значит менять
  поведение импорта.
- Другие числа в пояснительных текстах тоже не связаны с константами: «14-й день», «через 13 дней»,
  «за 14 дней» (`OVULATION_DAY_OFFSET`, `LUTEAL_PHASE_DAYS`), «5 дней до овуляции», «2 дня перед окном»
  (`FERTILE_DAYS_BEFORE_OVULATION` и смещения средних дней в `forecast.ts`, не экспортируются), «меньше
  трёх», «на 7 дней» (`CONFIDENCE_MIN_CYCLES`, `CONFIDENCE_MAX_SPREAD` в `cycles.ts`, не экспортируются).
  П. 8 файла шага называет только окно усреднения и границы выбросов.
- В `normalizePeriods` параметр `today` по-прежнему ни на что не влияет (находка шага 3); шаг 4 его не
  трогает.
