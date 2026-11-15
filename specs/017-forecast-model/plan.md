# Implementation Plan: Производные прогноза считаются в одном месте

**Branch**: `017-forecast-model` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/017-forecast-model/spec.md`; шаг 4 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-4-forecast-model.md`).

## Summary

1. **`effectivePeriodLength(periods, settings)`** в `src/domain/forecast.ts` — единственное место правила
   «средняя длина месячных, иначе из настроек». Им считают `buildForecast`, `normalizeStoredPeriods`,
   `planTextImport`, диалог дня (`DaySheets`, `CalendarScreen`); `dayInfo` берёт значение прогноза, а без
   прогноза — функцию. Хранилище больше не строит прогноз ради длины (research R1, R2).
2. **`originalPredictedStart(forecast)`** — единственный обратный счёт от задержки; им пользуются
   напоминание о неотмеченном начале и отчёт при задержке (R3).
3. **`nextPredictedStart(forecast, today)`** — ближайшее прогнозное начало для `todaySummary` и отчёта;
   отчёт не вызывает `todaySummary` (R4).
4. **Одна сортировка**: `sortByStart` экспортируется из `periods.ts`; новая `buildPeriodCycles` в
   `cycles.ts` отдаёт пары «месячные — цикл», `buildCycles` — их циклы (форма `Cycle` прежняя);
   `buildForecast` берёт месячные цикла из этих пар без второй сортировки и индекса (R5, R6).
5. **`cycleFrom({ … })`** — именованные поля вместо семи позиционных (R7).
6. **Тест текстов**: числа в «по последним 6 циклам» и «короче 15 и длиннее 60 дней» сверяются с
   `AVERAGE_WINDOW` и `OUTLIER_CYCLE` поиском по исходникам; тексты не меняются (R8).

Тесты — только в новых файлах (R10). Сначала характеризационные (прогноз, сводка, отчёт, напоминания,
нормализация и текстовый импорт — зелёные до и после), затем для каждой новой функции падающий тест до
кода.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.3 (две строки в UI)

**Primary Dependencies**: date-fns 4 (через `src/domain/dates.ts`); новых зависимостей нет

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION = 6`, таблицы, форма записей и блоки
`this.version(1…6)` не трогаются

**Testing**: Vitest 5; домен — `node`; хранилище — `node` + `fake-indexeddb/auto`; поиск по исходникам —
`node:fs`, как `src/domain/isolation.test.ts`; характеризация — `toMatchInlineSnapshot`

**Target Platform**: iOS Safari (установленная PWA), остальные браузеры — по возможности

**Project Type**: офлайн-PWA (одно приложение, `src/`)

**Performance Goals**: без заметной разницы — `dayInfo` на ячейку не делает новой работы; хранилище вместо
прогноза на 12 месяцев строит только циклы; `buildForecast` строит циклы дважды (десятки элементов)

**Constraints**: формулы прогноза, правила напоминаний, состав отчёта, тексты и разметка — прежние
(FR-014); существующие проверки и файлы тестов не меняются (FR-015); правила слоёв
(`docs/refactoring-roadmap.md`)

**Scale/Scope**: правки в 5 файлах домена (`periods.ts`, `cycles.ts`, `forecast.ts`, `reminders.ts`,
`report.ts`), 2 хранилища, 2 интерфейса; 5 новых файлов тестов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов нет; состав и поля напоминаний для сервера не меняются. | ✅ |
| II. Офлайн-PWA | Всё офлайн; новых сервисов нет. | ✅ |
| III. Сохранность данных | Схема, миграции, формат копии не меняются. Нормализация при запуске и текстовый импорт объединяют месячные по той же длине, что и раньше (R1, характеризация R9). | ✅ |
| IV. TDD, домен — чистые функции | Новые функции — сначала падающие тесты; перенос — сначала характеризационные тесты (R9). Все новые функции в `src/domain`, «сегодня» — параметром, времени не читают; изоляцию проверяет существующий тест. Формулы прогноза не меняются. | ✅ |
| V. Простота | Зависимостей нет. Функции над существующими типами вместо новых полей (R6); один новый тип-пара (R5); в UI — замена выражения вызовом. | ✅ |
| VI. Дизайн и доступность | Разметка и тексты не меняются (снимок `normalPath.test.ts`). | ✅ |
| VII. Честность | Уверенность прогноза и оговорки не меняются. | ✅ |

Правила слоёв: `src/domain` импортирует только файлы домена (`cycles.ts → periods.ts` — новый импорт внутри
домена, без цикла); `src/storage` — `domain`; `src/ui` — `domain`. `src/hooks`, `src/push`,
`src/storage/db.ts`, `src/storage/migrations/`, `worker/` не меняются.

**Повторная проверка после дизайна (Phase 1)**: нарушений не появилось — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/017-forecast-model/
├── spec.md
├── plan.md                           # этот файл
├── research.md                       # R1–R11
├── data-model.md                     # производные величины и их источники, PeriodCycle, CycleInput
├── quickstart.md
├── contracts/forecast-derivations.md # функции, гарантии, вызывающие места «было → стало»
├── checklists/requirements.md
└── tasks.md                          # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/periods.ts                        # export sortByStart
src/domain/cycles.ts                         # buildPeriodCycles, PeriodCycle; buildCycles через них
src/domain/forecast.ts                       # effectivePeriodLength, originalPredictedStart, nextPredictedStart;
                                             # buildForecast без второй сортировки, cycleFrom({ … }); dayInfo, todaySummary
src/domain/reminders.ts                      # originalPredictedStart
src/domain/report.ts                         # originalPredictedStart, nextPredictedStart; без todaySummary
src/storage/repository.ts                    # effectivePeriodLength вместо buildForecast
src/storage/textImport.ts                    # effectivePeriodLength вместо buildForecast
src/ui/components/DaySheets.tsx              # effectivePeriodLength
src/ui/screens/CalendarScreen.tsx            # effectivePeriodLength
src/domain/forecastDerivations.test.ts       # новый: новые функции, равенство длины на наборе историй
src/domain/forecastCharacterization.test.ts  # новый: снимок прогноза, сводки, отчёта, напоминаний
src/domain/derivationPlacement.test.ts       # новый: поиск по исходникам
src/domain/explanationTexts.test.ts          # новый: числа в текстах = константы
src/storage/periodLength.test.ts             # новый: нормализация и текстовый импорт по длине из истории
```

**Structure Decision**: одно приложение `src/`; производные прогноза — в `forecast.ts` рядом с
`buildForecast`, пара «месячные — цикл» — в `cycles.ts` рядом с `buildCycles`; тесты — рядом с кодом
(`src/**/*.test.ts`).

## Порядок коммитов

Каждый коммит проходит `npm test` и `npm run build`. Тест пишется первым, его падение проверяется до кода;
тест и код идут в одном коммите (красный коммит не прошёл бы `npm test`). Подробно — `tasks.md`.

1. Характеризационные тесты: `forecastCharacterization.test.ts` (снимок пишется на текущем коде) и
   `storage/periodLength.test.ts` — зелёные до правок.
2. `effectivePeriodLength`; `buildForecast` считает длину ею (US1).
3. Потребители длины: `dayInfo`, `normalizeStoredPeriods`, `planTextImport`, `DaySheets`, `CalendarScreen`
   (US1).
4. `nextPredictedStart`, `originalPredictedStart`; `todaySummary`, `planReminders`, `buildDoctorReport`
   (US2).
5. `sortByStart` экспортируется, `buildPeriodCycles`; `buildForecast` — месячные из пар, без второй
   сортировки; `cycleFrom({ … })` (US3).
6. Тест текстов (US3).
7. Задачи выполнены.

`derivationPlacement.test.ts` (поиск по исходникам) растёт вместе с правками: в коммитах 3, 4 и 5
добавляется проверка своего шага («`?? …defaultPeriodLength` — один раз; хранилище не строит прогноз»,
«обратный счёт от `delayDays` — один; отчёт без `todaySummary`», «в `forecast.ts` и `cycles.ts` нет
сортировки, в `forecast.ts` нет `sorted[`; сравнение по началу одно; вызовы `cycleFrom` с объектом»). Каждая
пишется до правки и падает до неё.

## Complexity Tracking

Нарушений Конституции нет. Отступления от «Наброска решения» файла шага (не от Конституции):

| Отступление | Зачем | Почему не как в наброске |
|-------------|-------|--------------------------|
| `nextPredictedStart` вместо `nextPredictedPeriod` (R4) | Имя говорит, что отдаётся дата начала, и парно `originalPredictedStart` | Набросок — отправная точка; функция та же |
| `buildCycles` не меняет форму; пары «месячные — цикл» отдаёт новая `buildPeriodCycles` (R5) | Проверки на точное равенство циклов в `cycles.test.ts`, `report.test.ts`, `stats.test.ts` не затронуты | П. 5 наброска («`buildCycles` отдаёт всё, что нужно») потребовал бы нового поля в `Cycle` |
| `dayInfo` берёт длину из прогноза, а без прогноза — из `effectivePeriodLength` (R2) | Нет пересчёта циклов на каждую ячейку | П. 1 наброска не уточняет, как `dayInfo` получает длину; в контексте без прогноза с месячными (только тесты) длина теперь по истории, на существующих тестах значения те же |
| Тест текстов — поиском по исходникам, строки остаются литералами (R8) | Тексты не меняются (границы шага), снимок разметки не затронут | Набросок допускает оба варианта |
