# Implementation Plan: Запись дня — точечным изменением в транзакции

**Branch**: `015-atomic-day-writes` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-atomic-day-writes/spec.md`; шаг 2 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-2-atomic-day-writes.md`).

## Summary

1. **`updateDayEntry(date, patch)`** в `src/storage/repository.ts`: одна транзакция `rw` по `db.days` —
   мягко прочитать запись, наложить изменение и дату, сохранить через `saveDayEntry` (приведение, удаление
   пустой). Образец — `updateSettings` (research R1).
2. **Четыре места записи** передают только своё поле: `{ sex }`, `{ symptoms, intensity }`, `{ moods }`,
   `{ note }`. Отметка секса ставит значение по надписи кнопки — отступление от наброска, research R2.
3. **Запись выбранного дня**: `useLiveQuery` и его тест не меняются (решение пользователя). `CalendarScreen`
   использует значение запроса, только если `stored.date === day` (research R3). Мигание проверяется
   замером в Chrome до и после (R4).
4. **`normalizeStoredPeriods`**: чтение месячных и настроек, расчёт и запись — в одной транзакции
   `rw` по `db.periods` и `db.kv` (research R5, R6).

Тесты — только в новых файлах (research R7), каждый пишется до кода и падает.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.3

**Primary Dependencies**: Dexie 4.4 (транзакции), date-fns 4; новых зависимостей нет

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION = 6`, таблицы, форма записей и блоки
`this.version(1…6)` не трогаются

**Testing**: Vitest 5; хранилище — `node` + `fake-indexeddb/auto`; интерфейс — `// @vitest-environment
happy-dom` + `src/ui/testing.ts` (из 014); `vi.mock` для подмены `DayCard`, `DaySheets`, `MonthPager` и
`useToday` в тесте смены дня

**Target Platform**: iOS Safari (установленная PWA), остальные браузеры — по возможности

**Project Type**: офлайн-PWA (одно приложение, `src/`)

**Performance Goals**: без заметной разницы — одна транзакция вместо одной операции записи; два чтения
по ключу внутри транзакции

**Constraints**: поведение, разметка и тексты прежние (FR-013); существующие проверки и файлы тестов не
меняются (FR-014, FR-011); правила слоёв (`docs/refactoring-roadmap.md`)

**Scale/Scope**: 1 новая функция и 1 тип в `repository.ts`, правка `normalizeStoredPeriods`; правки в 5
файлах UI (`DaySheets`, `SymptomPicker`, `MoodPicker`, `NoteEditor`, `CalendarScreen`); 3 новых файла тестов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов нет; данные не покидают устройство. | ✅ |
| II. Офлайн-PWA | Всё офлайн; новых сервисов нет. | ✅ |
| III. Сохранность данных | Главная цель: одновременное изменение не теряется, запись не уходит в чужой день, нормализация неделима. Схема, миграции и формат копии не меняются; мягкое чтение (009 FR-003) сохраняется; отказ записи отменяет транзакцию целиком. | ✅ |
| IV. TDD | Домен не меняется. Новая функция `updateDayEntry`, транзакция нормализации и новое поведение мест записи — сначала падающие тесты (R6, R7). Обычный путь подтверждают существующие тесты, без изменений. | ✅ |
| V. Простота | Зависимостей нет. Одна функция по образцу `updateSettings`; правила приведения — в существующем `saveDayEntry`; проверка даты в одну строку вместо нового контракта хука. | ✅ |
| VI. Дизайн и доступность | Разметка, классы и тексты не меняются: листы и диалог подтверждает снимок обычного пути из 014 (без изменений). `CalendarScreen` меняет только то, какая запись передаётся в переходный момент после смены дня; на обычном пути передаётся та же запись (T008). Видимых изменений нет, поэтому проверка тем и контраста не требуется. | ✅ |
| VII. Честность | Прогноз не меняется. | ✅ |

Правила слоёв: `src/storage/repository.ts` импортирует только `domain` и `db`; `src/ui` — `storage`,
`domain`, `hooks`. `src/domain`, `src/hooks`, `src/push`, `src/storage/db.ts`, `worker/` не меняются.

**Повторная проверка после дизайна (Phase 1)**: нарушений не появилось — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/015-atomic-day-writes/
├── spec.md
├── plan.md                  # этот файл
├── research.md              # R1–R9
├── data-model.md            # изменение записи дня и переходы (хранимые данные не меняются)
├── quickstart.md
├── contracts/repository.md  # updateDayEntry, normalizeStoredPeriods, использование в UI
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/storage/repository.ts              # + DayEntryPatch, updateDayEntry; normalizeStoredPeriods в транзакции
src/storage/atomicWrites.test.ts       # новый (node): updateDayEntry и неделимость нормализации
src/ui/dayWrites.test.ts               # новый (happy-dom): листы и отметка, поиск по исходникам
src/ui/screens/CalendarScreen.test.ts  # новый (happy-dom): смена дня
src/ui/components/DaySheets.tsx        # отметка секса — updateDayEntry(date, { sex })
src/ui/components/SymptomPicker.tsx    # updateDayEntry(date, { symptoms, intensity })
src/ui/components/MoodPicker.tsx       # updateDayEntry(date, { moods })
src/ui/components/NoteEditor.tsx       # updateDayEntry(date, { note })
src/ui/screens/CalendarScreen.tsx      # запись выбранного дня — только своей даты
```

**Structure Decision**: одно приложение `src/`; функция записи — рядом с `updateSettings` в
`repository.ts`; тесты — рядом с кодом, как во всём проекте (`src/**/*.test.ts`).

## Порядок коммитов

Каждый коммит проходит `npm test` и `npm run build`. Тест пишется первым, его падение проверяется до кода;
тест и код идут в одном коммите (красный коммит не прошёл бы `npm test`).

По приоритетам историй (подробно — `tasks.md`, «Checkpoint»):

1. Характеризационные тесты листов и отметки — до правок, зелёные (US4).
2. `updateDayEntry` + тесты хранилища (US1).
3. Четыре места записи → `updateDayEntry` + UI-тесты точечного изменения + поиск по исходникам (US1).
4. Замер мигания «до» → `CalendarScreen`: только запись своей даты + тест смены дня → замер «после» (US2).
5. `normalizeStoredPeriods` в одной транзакции + тест неделимости (US3).
6. Задачи выполнены.

## Complexity Tracking

Нарушений Конституции нет. Отступления от «Наброска решения» файла шага (не от Конституции):

| Отступление | Зачем | Почему не как в наброске |
|-------------|-------|--------------------------|
| `useLiveQuery` не меняется; проверка даты — в `CalendarScreen` (R3) | Не менять существующую проверку `useLiveQuery.test.ts` (решение пользователя 2026-11-14) | Сброс значения в хуке нарушил бы «Общие ограничения», п. 2 |
| Отметка секса — значение по надписи кнопки, а не переключение внутри транзакции (R2) | Результат совпадает с нажатой кнопкой; двойное нажатие — как сейчас | Переключение внутри транзакции меняет видимое поведение при двойном нажатии |
