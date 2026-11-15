# Implementation Plan: Решения — в чистых функциях, компоненты только рисуют

**Branch**: `019-ui-logic` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/019-ui-logic/spec.md`; шаг 6 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-6-ui-logic.md`).

## Summary

1. **Характеризация до правок.**
   - `src/ui/toggleMarkup.test.ts` — прежняя разметка всех 10 переключателей. Строки снимаются через
     `renderToStaticMarkup` с настоящих экранов при подмене `useLiveQuery`. Недоступный вариант
     снимается в DOM, пока идёт включение напоминаний (R1).
   - `src/ui/uiDecisions.test.ts` — тексты листов импорта, переходы «Самочувствия», действия
     напоминаний на экране (R10).
2. **Одно определение вспомогательных функций** (R3, R4).
   - `pluralRu` → новый `src/domain/plural.ts`; через неё считает и `formatShiftRu`.
   - `formatDateNumeric` переносится из `report.ts` в `dates.ts`.
   - Новая `formatFullDateRu` в `dates.ts`: через неё считают `formatRangeRu` и `StatsScreen`.
   - `StatsScreen` больше не импортирует `date-fns`.
3. **Чистые функции решений** (R5–R7).
   - `importFileKind` (`src/domain/importFile.ts`); `looksLikeCycleText` переезжает в
     `domain/cycleText.ts`.
   - `initialSymptomSelection`, `toggleSymptom`, `setSymptomIntensity` (`src/domain/symptomSelection.ts`).
   - `reminderToggleAction` (`src/ui/components/reminderToggle.ts`).
   - Компоненты вызывают эти функции.
4. **`Toggle`** (`src/ui/components/Toggle.tsx`) с прежней разметкой; десять мест используют его;
   строка «Переключатель» в `design.md` получает имя компонента (R2, R12).
5. **Тест-поиск** `src/ui/uiLogicPlacement.test.ts` — по частям, в коммитах соответствующих правок (R11).

Тесты — только в новых файлах. Единственная правка существующего теста — путь импорта
`looksLikeCycleText` в `src/storage/textImport.test.ts` (R5; разрешено «Общими ограничениями», п. 2).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19

**Primary Dependencies**: date-fns 4 (локаль `ru`) — только в `src/domain`; новых зависимостей нет — ни
runtime, ни dev

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION`, таблицы и блоки `this.version(1…6)` не
трогаются

**Testing**: Vitest 5. Домен — окружение `node`; часовые пояса — `process.env.TZ`, как в `dates.test.ts`.
UI — `// @vitest-environment happy-dom` и `fake-indexeddb/auto`, обвязка `src/ui/testing.ts`.
Серверная отрисовка — `react-dom/server` `renderToStaticMarkup` при `vi.mock('../hooks/useLiveQuery')`.
Поиск по исходникам — `node:fs`

**Target Platform**: iOS Safari (установленная PWA)

**Project Type**: офлайн-PWA (`src/`); `worker/` не затрагивается

**Performance Goals**: без изменений

**Constraints**: разметка, классы, тексты, порядок элементов и поведение прежние (FR-012). Существующие
проверки не меняются (FR-013): `ForecastInfo.test.ts`, `design-system.test.ts`, `theme.test.ts`, снимок
`normalPath.test.ts`. Правила слоёв соблюдаются. Без деплоя и `git push` (план рефакторинга)

**Scale/Scope**: правки — `BackupSection.tsx`, `SymptomPicker.tsx`, `RemindersSection.tsx`,
`SettingsScreen.tsx`, `StatsScreen.tsx`, `domain/dates.ts`, `domain/report.ts`, `domain/cycleText.ts`,
`storage/textImport.ts`, `storage/textImport.test.ts` (только путь импорта), `docs/design/design.md`
(одна строка). Новые файлы:
- модули: `domain/plural.ts`, `domain/importFile.ts`, `domain/symptomSelection.ts`,
  `ui/components/reminderToggle.ts`, `ui/components/Toggle.tsx`;
- тесты (9 файлов): `domain/plural.test.ts`, `domain/dateFormats.test.ts`, `domain/importFile.test.ts`,
  `domain/symptomSelection.test.ts`, `ui/components/reminderToggle.test.ts`,
  `ui/components/Toggle.test.ts`, `ui/toggleMarkup.test.ts`, `ui/uiDecisions.test.ts`,
  `ui/uiLogicPlacement.test.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов не добавляется; запросы к воркеру не меняются. | ✅ |
| II. Офлайн-PWA, бесплатная инфраструктура | Без изменений; новых ресурсов и сервисов нет. | ✅ |
| III. Сохранность данных | Схема, формат резервной копии, импорт и запись дня — прежние. Лист «Самочувствие» сохраняет тот же набор полей (`symptoms`, `intensity`) через `updateDayEntry`. | ✅ |
| IV. TDD, домен — чистые функции | Новые функции (`pluralRu` в домене, `formatDateNumeric` в `dates.ts`, `formatFullDateRu`, `importFileKind`, переходы «Самочувствия», `reminderToggleAction`, `Toggle`) — сначала падающий тест. Перенос — сначала характеризационные тесты: разметка, поведение компонентов, существующие тесты дат и отчёта. Даты — строки `YYYY-MM-DD`, тесты форматов — с переходами через месяц и год, високосным днём, часовыми поясами и летним временем (R4). Домен не читает часы и не импортирует `storage`/`ui`/`push`. | ✅ |
| V. Простота | Зависимостей нет. Пять маленьких модулей и один компонент; без редьюсеров, классов и новых слоёв. Конфигурация тестов не меняется (R9). | ✅ |
| VI. Дизайн и доступность | Разметка посимвольно прежняя (R1): `role="switch"`, `aria-describedby`, классы, подсказки. Переключатель описан в дизайн-системе; в `design.md` добавляется только имя компонента кода (R12). Темы, контраст и размеры не меняются (`theme.test.ts`, `design-system.test.ts`). | ✅ |
| VII. Честность | Прогноз и тексты не меняются. | ✅ |

**Правила слоёв** («Целевые правила слоёв» плана рефакторинга):
- новые доменные модули импортируют только домен (`plural.ts` — ничего, `importFile.ts` → `cycleText`,
  `symptomSelection.ts` → `dayEntry`, `types`), `dates.ts` — `date-fns`;
- `src/storage/textImport.ts` перестаёт определять `looksLikeCycleText`;
- `src/ui/components/reminderToggle.ts` импортирует только типы (`domain/types`, `push/subscribe`);
- в `src/ui` не остаётся `date-fns`.

**Повторная проверка после дизайна (Phase 1)**: нарушений не появилось — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/019-ui-logic/
├── spec.md
├── plan.md                  # этот файл
├── research.md              # R1–R13
├── data-model.md            # SymptomSelection, ImportFileKind, ReminderToggleAction, свойства Toggle
├── quickstart.md
├── contracts/ui-logic.md    # сигнатуры и правила новых функций и компонента
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/plural.ts                    # новый: pluralRu
src/domain/dates.ts                     # + formatDateNumeric (из report.ts), formatFullDateRu; formatShiftRu и formatRangeRu через них
src/domain/report.ts                    # formatDateNumeric — импорт из ./dates
src/domain/cycleText.ts                 # + looksLikeCycleText (из storage/textImport.ts)
src/domain/importFile.ts                # новый: ImportFileKind, importFileKind
src/domain/symptomSelection.ts          # новый: SymptomSelection и переходы
src/storage/textImport.ts               # без looksLikeCycleText
src/ui/components/reminderToggle.ts     # новый: reminderToggleAction
src/ui/components/Toggle.tsx            # новый: компонент переключателя
src/ui/components/BackupSection.tsx     # importFileKind, pluralRu, formatDateNumeric из домена
src/ui/components/SymptomPicker.tsx     # одно состояние SymptomSelection
src/ui/components/RemindersSection.tsx  # reminderToggleAction; 3 × Toggle
src/ui/screens/SettingsScreen.tsx       # 7 × Toggle
src/ui/screens/StatsScreen.tsx          # formatFullDateRu; без date-fns
docs/design/design.md                   # строка «Переключатель»: `Toggle` (`toggle`)

src/storage/textImport.test.ts          # только путь импорта looksLikeCycleText
src/domain/plural.test.ts               # новый
src/domain/dateFormats.test.ts          # новый
src/domain/importFile.test.ts           # новый
src/domain/symptomSelection.test.ts     # новый
src/ui/components/reminderToggle.test.ts# новый
src/ui/components/Toggle.test.ts        # новый
src/ui/toggleMarkup.test.ts             # новый: характеризация разметки (до замены)
src/ui/uiDecisions.test.ts              # новый: характеризация поведения (до переноса)
src/ui/uiLogicPlacement.test.ts         # новый: поиск по исходникам
```

**Structure Decision**: одно приложение `src/` с прежними слоями. Правила о данных лежат в
`src/domain`, правило с разрешением браузера — в `src/ui/components` отдельным `.ts`, компонент — в
`src/ui/components` рядом со `Stepper`.

## Complexity Tracking

Нарушений Конституции нет. Отступления от наброска файла шага (обоснование — в `research.md`):

| Отступление | Почему | Почему не проще |
|-------------|--------|-----------------|
| Подмена `useLiveQuery` в характеризационном тесте разметки (R1) | Позволяет снять разметку переключателей `renderToStaticMarkup` с настоящих экранов, а не с копии | Файл шага предполагал проверять только компонент; тогда эталон — копия JSX в тесте, которая может разойтись с экранами |
| `looksLikeCycleText` переезжает в домен, в `textImport.test.ts` меняется путь импорта (R5) | Домен не может импортировать хранилище, а правило вида файла от неё зависит | Повторный экспорт из `textImport.ts` оставил бы в хранилище API только ради теста; свой шаблон в домене — дубль |
| Строка «Переключатель» в `design.md` получает имя компонента (R12) | Правило `CLAUDE.md` «собирать из компонентов дизайн-системы» — по таблице видно, чем собирать | Не менять — `Toggle` нигде не описан; вид, классы и токены не меняются |
