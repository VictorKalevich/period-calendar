---

description: "Task list for feature 017-forecast-model"
---

# Tasks: Производные прогноза считаются в одном месте

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/forecast-derivations.md](./contracts/forecast-derivations.md),
[quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV; `docs/refactoring-roadmap.md`, «Общие ограничения», п. 5).
- Новая функция — сначала тест, и его падение проверяется до кода.
- Перенос существующего кода — сначала характеризационный тест, зелёный до и после.
- Существующие файлы тестов не меняются (FR-015); новые тесты — только в новых файлах (research R10).

Файлы — UTF-8 без BOM, правка только Edit/Write. Каждый коммит проходит `npm test` и `npm run build`
(из PowerShell). Тест и код одной задачи идут в одном коммите: красный коммит не прошёл бы `npm test`.

**Обвязка тестов**:
- **Домен** (`node`): только `vitest` и файлы домена; даты — `'2026-08-01' as LocalDate` (помощник
  `ld`); месячные — помощник `p(id, start, end = null, endEstimated = false)`.
- **Хранилище** (`node`): `import 'fake-indexeddb/auto'`; `beforeEach` — `await db.delete(); await db.open();`,
  как в `src/storage/textImport.test.ts`.
- **Поиск по исходникам**: `readdirSync(srcDir, { recursive: true })` и `readFileSync(…, 'utf8')`, как в
  `src/ui/dayWrites.test.ts` и `src/domain/isolation.test.ts`; исходники приложения — `.ts`/`.tsx` под `src/`
  без `.test.` в имени.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US3 из spec.md

---

## Phase 1: Setup

- [X] T001 Базовая линия на ветке `017-forecast-model`: `npm test` — 957 тестов в 49 файлах, `npm run build` зелёный (записано при подготовке шага; повторить, если ветка менялась)

---

## Phase 2: Foundational — характеризация (до любых правок кода)

**Purpose**: записать текущее поведение прогноза, сводки, отчёта, напоминаний, нормализации и текстового
импорта до правок (research R9). Оба файла зелёные на текущем коде и после каждого следующего коммита.

- [X] T002 [P] Новый `src/domain/forecastCharacterization.test.ts` — «золотой» снимок `toMatchInlineSnapshot()` (Vitest запишет его при первом прогоне на текущем коде). Функция `describeCase({ periods, today, settings })` возвращает массив строк:
  1. прогноз на 2 месяца `buildForecast({ periods, settings, today, horizonMonths: 2 })`: `null` → `'прогноза нет'`; иначе строка `cycle ${cycleLength} · period ${periodLength} · ${confidence} · delay ${delayDays}` и по строке на цикл: `${kind} ${start}→${nextStart} ov ${ovulation} fertile ${fertile[0]}…${fertile.at(-1)} medium ${mediumDays.join(',')} period ${periodDays.length ? `${periodDays[0]}…${periodDays.at(-1)}` : '—'}`;
  2. полный прогноз `full = buildForecast({ periods, settings, today })`; при `full` — `today next ${todaySummary({ forecast: full, periods, settings, entries: new Set(), today }).nextPeriod} · days ${…daysToPeriod}`;
  3. `report next ${r.nextPeriod} · delay ${r.delayDays}` для `r = buildDoctorReport({ periods, entries: [], settings, today })`;
  4. при `full` — `reminders(${rs.length}) ${rs.slice(0, 3).map((x) => x.id).join(' ')}` для `rs = planReminders(full, settings, new Date(y, m - 1, d, 9))` (местные 09:00 сегодняшнего дня) и `missed ${rs.filter((x) => x.kind === 'missedPeriod').map((x) => x.id).join(' ')}`.
  Случаи (`it` на случай, снимок — массив строк; `S = DEFAULT_SETTINGS`, `NEXT = { ...S, ovulationFromNextPeriod: true }`, `SHIFT = { ...S, ovulationShiftEnabled: true, ovulationShift: 2 }`, `NEXT_SHIFT = { ...NEXT, ovulationShiftEnabled: true, ovulationShift: -3 }`):
  1. «нет истории»: `[]`, сегодня 2026-11-14, `S`.
  2. «одна открытая»: `[p('a', '2026-11-10')]`, сегодня 2026-11-14, `S`.
  3. «неупорядоченный вход, ручные и оценочные концы»: в порядке `p('c', '2026-07-03', '2026-07-07')`, `p('a', '2026-05-08', '2026-05-11')`, `p('d', '2026-08-01')`, `p('b', '2026-06-05', '2026-06-09', true)`; сегодня 2026-08-10; `S` и `NEXT` (два `it`).
  4. «одинаковые начала»: `p('a', '2026-09-01', '2026-09-03')`, `p('b', '2026-09-01', '2026-09-06')`, `p('c', '2026-09-29', '2026-10-02')`; сегодня 2026-10-10; `S`.
  5. «открытые в середине, короткий цикл»: `p('a', '2026-03-01')`, `p('b', '2026-03-17', '2026-03-19')`, `p('c', '2026-04-02')`; сегодня 2026-04-05; `NEXT_SHIFT` и `SHIFT` (последний день месячных `a` влияет на овуляцию в режиме «от следующей»).
  6. «прогноз сегодня (задержка 0)», «задержка 1 день», «задержка 15 дней»: `p('a', '2026-01-05', '2026-01-09')`, `p('b', '2026-02-02', '2026-02-06')`, `p('c', '2026-03-02', '2026-03-06')` (прогноз 2026-03-30); сегодня 2026-03-30, 2026-03-31, 2026-04-14; `S`.
  7. «больше 6 циклов, выбросы»: 9 месячных по 4–5 дней с промежутками 28, 29, 27, 70 (выброс), 12 (выброс), 28, 30, 28 дней от 2025-11-03; сегодня — 10 дней после последнего начала; `S`.
  8. «переход года и високосный год с задержкой»: `p('a', '2025-11-06', '2025-11-10')`, `p('b', '2025-12-04', '2025-12-08')`, сегодня 2026-01-03; и `p('a', '2028-01-04', '2028-01-08')`, `p('b', '2028-02-01', '2028-02-05')`, сегодня 2028-03-02; `S`.
  Проверить, что все строки снимка записаны и тест зелёный на текущем коде.
- [X] T003 [P] Новый `src/storage/periodLength.test.ts` (`node` + `fake-indexeddb/auto`), `describe('длина месячных по истории — как раньше')`. Зелёные до и после правок:
  1. `normalizeStoredPeriods`: в базе `p('a', '2026-08-01', '2026-08-03')`, `p('b', '2026-08-29', '2026-08-31')`, `p('c', '2026-09-26')`, `p('d', '2026-09-30', '2026-10-02')` (средняя длина 3, по умолчанию 5) → `normalizeStoredPeriods('2026-10-30')` — `false`, `getPeriods()` — те же 4 записи (при длине 5 `c` и `d` объединились бы).
  2. `normalizeStoredPeriods`, контроль: `a` = 2026-08-01…2026-08-05, `b` = 2026-08-29…2026-09-02, `c`, `d` — как в п. 1 (средняя 4) → `true`; `getPeriods()` — `a`, `b` и `{ id: 'c', start: '2026-09-26', end: '2026-10-02', endEstimated: false }`.
  3. `planTextImport`: в базе `a`, `b`, `c` из п. 1; файл с одним периодом 2026-09-30…2026-10-02 (формат — как `FILE` в `src/storage/textImport.test.ts`), сегодня 2026-11-09 → `ok`, `{ added: 1, replaced: 0, unchanged: 0, skipped: 0 }`, в `periods` есть `c` с `end: null` и новые месячные 2026-09-30…2026-10-02 (при длине 5 `c` был бы заменён).
  4. `planTextImport`, контроль: `a`, `b` из п. 2, `c` — как в п. 1 (средняя 5) → `{ added: 1, replaced: 1 }`, `c` в `periods` нет.
  Если фактические значения на текущем коде отличаются от ожидаемых — разобраться до правок (тест фиксирует текущее поведение, а не догадку).

**Checkpoint**: оба файла зелёные на текущем коде; коммит «017: характеризационные тесты прогноза и длины месячных» (T002, T003)

---

## Phase 3: User Story 1 — длина месячных из одного правила (P1) 🎯 MVP

**Goal**: `effectivePeriodLength(periods, settings)` — единственное место правила; хранилище не строит
прогноз ради длины.

**Independent Test**: `npx vitest run src/domain/forecastDerivations.test.ts src/domain/derivationPlacement.test.ts src/storage/periodLength.test.ts`.

- [X] T004 [US1] Failing tests до кода в новом `src/domain/forecastDerivations.test.ts`, `describe('effectivePeriodLength')` (контракт, data-model «Производные величины»):
  1. `[]` → `S.defaultPeriodLength` (5); при `{ ...S, defaultPeriodLength: 7 }` → 7.
  2. Одна открытая → 5; одна закрытая 2026-08-01…2026-08-03 → 3.
  3. Оценочный конец текущих (последние, `endEstimated: true`) не учитывается: `[p('a', '2026-08-01', '2026-08-04', true)]` → 5; оценочный конец, закрытый следующим началом, учитывается: `[p('a', '2026-08-01', '2026-08-04', true), p('b', '2026-08-29')]` → 4.
  4. Окно 6: восемь закрытых месячных длиной 2, 2, 6, 6, 6, 6, 6, 6 (по одной на 28 дней) → 6; округление: длины 3 и 4 → 4.
  5. Выбросы по длине цикла не исключают месячные из средней: месячные 3 и 5 дней с промежутком 70 дней → 4.
  6. Порядок входа не важен: перевёрнутый список даёт то же; вход не меняется.
  7. От «сегодня» не зависит: функция не принимает его (сигнатура `(periods, settings)`).
  8. Равенство с прогнозом (SC-005): для каждой истории из набора (пустая; одна открытая; одна закрытая; оценочный конец текущих; оценочный, закрытый следующим; выбросы; ручные концы; больше 6 циклов; неупорядоченный вход) и настроек `S`, `{ ...S, defaultPeriodLength: 7 }` при сегодня 2026-11-14: `const f = buildForecast(…)`; `effectivePeriodLength(ps, s)` равно `f ? f.periodLength : s.defaultPeriodLength`.
- [X] T005 [US1] В `src/domain/forecast.ts`: `export function effectivePeriodLength(periods: Period[], settings: Settings): number { return averagePeriodLength(buildCycles(periods)) ?? settings.defaultPeriodLength; }` с комментарием «Длина месячных для расчётов: средняя по истории (FR-014), иначе из настроек; от «сегодня» не зависит»; в `buildForecast` — `const periodLength = effectivePeriodLength(periods, settings)`. Коммит «017: длина месячных для расчётов — одна функция домена» (T004, T005)
- [X] T006 [US1] Failing tests до правки в новом `src/domain/derivationPlacement.test.ts`, `describe('производные прогноза — в одном месте')`:
  1. в исходниках приложения совпадения `/\?\?\s*[\w.?]*defaultPeriodLength/g` — ровно одно, в `src/domain/forecast.ts`, строка содержит `averagePeriodLength(buildCycles(periods))` (SC-002);
  2. `src/storage/repository.ts` и `src/storage/textImport.ts` не содержат `buildForecast` (SC-003).
- [X] T007 [US1] Потребители (contracts, «Вызывающие места»; research R2):
  - `src/domain/forecast.ts` `dayInfo`: `const periodLength = forecast ? forecast.periodLength : effectivePeriodLength(periods, settings);`
  - `src/storage/repository.ts` `normalizeStoredPeriods`: `const periodLength = effectivePeriodLength(periods, settings);`; импорт `buildForecast` → `effectivePeriodLength`;
  - `src/storage/textImport.ts` `planTextImport`: `const periodLength = effectivePeriodLength(existing, settings);`; импорт так же;
  - `src/ui/components/DaySheets.tsx`: `const periodLength = effectivePeriodLength(ctx.periods, ctx.settings);` (импорт из `../../domain/forecast`);
  - `src/ui/screens/CalendarScreen.tsx` `onSelect`: то же; импорт `effectivePeriodLength` рядом с `dayInfo`.
  Существующие `dayInfo.test.ts`, `CalendarScreen.test.ts`, `dayWrites.test.ts`, `repository.test.ts`, `textImport.test.ts`, `atomicWrites.test.ts` и характеризация T003 — зелёные без изменений. Коммит «017: длину месячных берут из одной функции» (T006, T007)

**Checkpoint**: правило записано один раз; хранилище не строит прогноз; поведение прежнее.

---

## Phase 4: User Story 2 — даты следующих месячных из одного места (P1)

**Goal**: `originalPredictedStart` — единственный обратный счёт от задержки; `nextPredictedStart` — для
сводки и отчёта; отчёт не вызывает `todaySummary`.

**Independent Test**: `npx vitest run src/domain/forecastDerivations.test.ts src/domain/derivationPlacement.test.ts src/domain/forecastCharacterization.test.ts src/domain/reminders.test.ts src/domain/report.test.ts`.

- [X] T008 [US2] Failing tests до кода:
  - в `src/domain/forecastDerivations.test.ts`, `describe('originalPredictedStart и nextPredictedStart')`; история `REG = [p('a', '2026-01-05', '2026-01-09'), p('b', '2026-02-02', '2026-02-06'), p('c', '2026-03-02', '2026-03-06')]` (прогноз 2026-03-30), `f(today)` = `buildForecast({ periods: REG, settings: S, today })!`:
    1. сегодня 2026-03-20 (задержки нет) → `originalPredictedStart` = 2026-03-30, `nextPredictedStart` = 2026-03-30;
    2. сегодня 2026-03-30 (прогноз — сегодня, `delayDays` 0) → обе 2026-03-30;
    3. сегодня 2026-03-31 (задержка 1) → `originalPredictedStart` = 2026-03-30, `nextPredictedStart` = 2026-03-31;
    4. сегодня 2026-04-14 (задержка 15) → 2026-03-30 и 2026-04-14;
    5. для 1–4: `originalPredictedStart(f)` равно началу текущего цикла + `f.cycleLength` (`addDaysLD`);
    6. переход года: `[p('a', '2025-11-06', '2025-11-10'), p('b', '2025-12-04', '2025-12-08')]`, сегодня 2026-01-03 → `originalPredictedStart` = 2026-01-01, `nextPredictedStart` = 2026-01-03; високосный: `[p('a', '2028-01-04', '2028-01-08'), p('b', '2028-02-01', '2028-02-05')]`, сегодня 2028-03-02 → 2028-02-29 и 2028-03-02;
    7. прогноз без текущего цикла (`{ ...f, cycles: f.cycles.filter((c) => c.kind !== 'current') }`) → `originalPredictedStart` — `null`;
    8. `buildForecast({ periods: REG, settings: S, today: '2026-03-20', horizonMonths: 0 })` — прогнозных циклов нет → `nextPredictedStart` — `null`;
    9. функции не меняют прогноз (`structuredClone` до и после равны);
    10. часовой пояс и летнее время (Конституция IV): `originalPredictedStart`, `nextPredictedStart` и `effectivePeriodLength` для `REG` при сегодня 2026-03-20, 2026-03-31 и 2026-04-14 дают одинаковые результаты при `process.env.TZ` = `'Asia/Tokyo'`, `'America/Los_Angeles'` и `'Europe/Berlin'` (переход на летнее время 2026-03-29, прогноз — 2026-03-30); `TZ` восстанавливается в `afterEach`, как в `dayInfo.test.ts`.
  - в `src/domain/derivationPlacement.test.ts`: (3) обратный счёт `/-\s*[\w.]*delayDays\b/g` в исходниках приложения — ровно одно совпадение, в `src/domain/forecast.ts` (SC-004); (4) `src/domain/report.ts` не содержит `todaySummary`.
- [X] T009 [US2] Реализация (research R3, R4; контракт):
  - `src/domain/forecast.ts`: `export function nextPredictedStart(forecast: Forecast, today: LocalDate): LocalDate | null` — `forecast.cycles.find((c) => c.kind === 'predicted' && c.start >= today)?.start ?? null`; `export function originalPredictedStart(forecast: Forecast): LocalDate | null` — текущий цикл `forecast.cycles.find((c) => c.kind === 'current')`, `addDaysLD(current.nextStart, -forecast.delayDays)` или `null`; комментарий: «При задержке `nextStart` текущего цикла — сегодня, поэтому исходный прогноз — `nextStart − delayDays`»; `todaySummary`: `const nextPeriod = nextPredictedStart(forecast, today);`.
  - `src/domain/reminders.ts` `planReminders`: `const original = originalPredictedStart(forecast);` и `if (delayed && current && original && settings.remindMissedPeriod) out.push(missedPeriodReminder(original));` — проверка `current` (текущий цикл в выборке `cyclesAhead`) остаётся; комментарий о `nextStart − delayDays` заменить ссылкой на `originalPredictedStart`; импорт из `./forecast`.
  - `src/domain/report.ts` `buildDoctorReport`: `nextPeriod = delayDays > 0 ? originalPredictedStart(forecast) : nextPredictedStart(forecast, today)` (ветвление прежнее, R4); импорт `todaySummary` и ставший лишним `addDaysLD` убрать.
  Характеризация T002, `reminders.test.ts`, `report.test.ts`, `forecast.test.ts` — зелёные без изменений. Коммит «017: исходная и ближайшая прогнозные даты — функции домена» (T008, T009)

**Checkpoint**: обратный счёт — один; отчёт без выдуманного контекста; даты прежние.

---

## Phase 5: User Story 3 — устройство прогноза без скрытых совпадений (P2)

**Goal**: одна сортировка по началу; прогноз берёт месячные цикла из пар «месячные — цикл»; `cycleFrom` с
именованными полями; числа в текстах связаны с константами.

**Independent Test**: `npx vitest run src/domain/forecastDerivations.test.ts src/domain/derivationPlacement.test.ts src/domain/forecastCharacterization.test.ts src/domain/explanationTexts.test.ts src/domain/cycles.test.ts`.

- [X] T010 [US3] Failing tests до кода:
  - в `src/domain/forecastDerivations.test.ts`, `describe('sortByStart и buildPeriodCycles')`:
    1. `sortByStart` — новый массив (`not.toBe`), вход не меняется, по возрастанию начала, в том числе через год (`2025-12-31` раньше `2026-01-01`); равные начала — в порядке входа (по `id`);
    2. `buildPeriodCycles(ps)` — пары в порядке `sortByStart(ps)`; `period` — тот же объект, что во входе (`toBe`); `buildPeriodCycles(ps).map((x) => x.cycle)` равно `buildCycles(ps)` на историях из T004 п. 8 и на случае «одинаковые начала»; `[]` → `[]`.
  - в `src/domain/derivationPlacement.test.ts`: (5) сравнение по началу `/\.start\s*<\s*\w+\.start\s*\?\s*-1/g` в исходниках приложения — ровно одно совпадение, в `src/domain/periods.ts` (FR-009); (6) `src/domain/forecast.ts` и `src/domain/cycles.ts` не содержат `.sort(`, `forecast.ts` не содержит `sorted[` (FR-010); (7) в `src/domain/forecast.ts` каждый вызов и определение `cycleFrom(` продолжаются `{` — нет совпадений `/cycleFrom\(\s*(?!\{)/` (FR-011).
- [X] T011 [US3] Реализация (research R5, R7; data-model `PeriodCycle`, `CycleInput`):
  - `src/domain/periods.ts`: `export function sortByStart(periods: Period[]): Period[]` — тело прежнее, с комментарием «единственное сравнение месячных по началу»;
  - `src/domain/cycles.ts`: `export interface PeriodCycle { period: Period; cycle: Cycle }`; `export function buildPeriodCycles(periods: Period[]): PeriodCycle[]` — `sortByStart(periods).map((p, i, sorted) => ({ period: p, cycle: { …прежние поля в прежнем порядке… } }))`; `buildCycles(periods)` = `buildPeriodCycles(periods).map((x) => x.cycle)`; импорт `sortByStart` из `./periods`;
  - `src/domain/forecast.ts`: `interface CycleInput { start; nextStart; kind; periodLength; settings; periodLast?; ovulationBound? }`; `function cycleFrom({ start, nextStart, kind, periodLength, settings, periodLast = addDaysLD(start, periodLength - 1), ovulationBound = nextStart }: CycleInput)` — тело прежнее; `buildForecast`: `const history = buildPeriodCycles(periods); const cycles = history.map((x) => x.cycle);`, последний — `history.at(-1)!.cycle.start`, завершённые — `cycleFrom({ start: history[i].cycle.start, nextStart: history[i + 1].cycle.start, kind: 'completed', periodLength, settings, periodLast: periodEnd(history[i].period, periodLength) })`, текущий — с `periodLast` последних месячных и `ovulationBound: predictedStart`, прогнозные — `cycleFrom({ start: s, nextStart: addDaysLD(s, cycleLength), kind: 'predicted', periodLength, settings })`; переменные `sorted`, `lastDayOf`, `starts` и комментарий «Месячные в порядке начала — как циклы в buildCycles» уходят.
  Характеризация T002, `forecast.test.ts`, `cycles.test.ts`, `stats.test.ts`, `report.test.ts`, `periods.test.ts`, `normalize.test.ts` — зелёные без изменений. Коммит «017: одна сортировка месячных, сборка цикла с именованными полями» (T010, T011)
- [X] T012 [US3] Новый `src/domain/explanationTexts.test.ts` (research R8), `describe('числа в пояснительных текстах = константы')`, по исходникам приложения:
  1. все совпадения `/по последним (\d+) циклам/g` — число равно `AVERAGE_WINDOW`; число совпадений по файлам: `src/ui/screens/StatsScreen.tsx` — 2, `src/domain/report.ts` — 2, `src/ui/components/ForecastInfo.tsx` — 1 (не меньше 5 всего);
  2. все совпадения `/короче (\d+) и длиннее (\d+) дней/g` — числа равны `OUTLIER_CYCLE.min` и `OUTLIER_CYCLE.max`; есть в `ForecastInfo.tsx`.
  Тексты не меняются. Проверить, что тест ловит рассинхронизацию: временно `AVERAGE_WINDOW = 5`, затем `OUTLIER_CYCLE.min = 14` в `src/domain/types.ts` — тест падает; вернуть значения (в коммит не попадает). Коммит «017: тест связывает числа в текстах с константами» (T012)

**Checkpoint**: все проверки `derivationPlacement.test.ts` зелёные; снимок T002 прежний.

---

## Phase 6: Polish & проверки

- [X] T013 Проверки `quickstart.md`:
  - `npm test` — зелёный, тестов ≥ 957 + новые; `npm run build` — зелёный;
  - `git diff --stat refactoring...HEAD -- "*.test.ts" "*.snap"` — только новые файлы: `src/domain/forecastCharacterization.test.ts`, `src/domain/forecastDerivations.test.ts`, `src/domain/derivationPlacement.test.ts`, `src/domain/explanationTexts.test.ts`, `src/storage/periodLength.test.ts`;
  - команды раздела 5 `quickstart.md`;
  - `git diff refactoring...HEAD` — без испорченной кириллицы и BOM, без изменений вне объёма шага: не меняются `src/storage/db.ts`, `src/storage/migrations/`, `src/storage/backup.ts`, `src/push/`, `src/hooks/`, `worker/`, тексты и разметка.
- [X] T014 Отметить задачи `[X]` в `specs/017-forecast-model/tasks.md`; коммит «017: задачи выполнены»
- [X] T015 Для журнала (`docs/refactoring-roadmap.md` обновляется после слияния, шаг 9 «Порядка работы»): число тестов до → после; отступления — таблица Complexity Tracking в `plan.md`; попутные находки — research R11

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: характеризация T002, T003 — до любых правок кода (T005, T007, T009, T011).
- **US1** (Phase 3): T004 → T005 (коммит) → T006 → T007 (коммит). `effectivePeriodLength` нужна T007.
- **US2** (Phase 4): от US1 по коду не зависит (другие функции и строки), но `derivationPlacement.test.ts`
  создаётся в T006 — поэтому после US1. T008 → T009 (коммит).
- **US3** (Phase 5): T010 → T011 (коммит) → T012 (коммит). `buildForecast` правится и в T005, и в T011 —
  поэтому после US1. T012 от T011 не зависит.
- **Polish**: после всех историй.

### Parallel Opportunities

- T002 и T003 — разные файлы, без зависимостей: можно писать параллельно.
- T012 (тест текстов) — отдельный файл, без зависимостей от кода шага: можно писать параллельно с любой
  историей.
- Внутри историй задачи последовательны: тест → код в одних и тех же файлах.

### Parallel Example: старт

```text
T002 снимок прогноза, сводки, отчёта, напоминаний (src/domain/forecastCharacterization.test.ts)
T003 нормализация и текстовый импорт по длине из истории (src/storage/periodLength.test.ts)
```

## Implementation Strategy

1. **Основа** (T001–T003): записать текущее поведение.
2. **MVP — US1** (T004–T007): правило длины месячных — одно; хранилище не строит прогноз.
3. **US2** (T008–T009): даты следующих месячных — из домена; обратный счёт — один.
4. **US3** (T010–T012): одна сортировка, именованные поля, тест текстов.
5. **Polish** (T013–T015): проверки и материалы для журнала.
