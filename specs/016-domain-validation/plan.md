# Implementation Plan: Правила корректности настроек и месячных — в домене

**Branch**: `016-domain-validation` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/016-domain-validation/spec.md`; шаг 3 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-3-domain-validation.md`).

## Summary

1. **`isObject`** — одна проверка в новом `src/domain/guards.ts` вместо `isRecord` (`dayEntry.ts`) и
   `isObject` (`backup.ts`) (research R7).
2. **`coerceSettings(raw, fallback)` и `extraSettingFields(raw)`** — новый `src/domain/settings.ts` с
   прежними правилами по полям. Импорт вызывает `coerceSettings(data.settings, current)` вместо
   `parseSettings` (R1).
3. **`getSettings`** = `{ ...coerceSettings(raw, DEFAULT_SETTINGS), ...extraSettingFields(raw) }`: на
   корректных данных — прежние значения и порядок ключей, включая неизвестные поля; некорректное поле —
   значение по умолчанию (R2, R3). `SETTINGS_KEY` экспортируется из `repository.ts`, и `applyBackup`
   пишет через него (R6).
4. **`validatePeriods(input, today, periodLength)`** — новый `src/domain/periodValidation.ts`: строгая
   проверка записей и пересечений после объединения, с кодами ошибок `PeriodValidationError`. `backup.ts`
   превращает коды в прежние тексты (`periodErrorText`) (R4). Месячные при чтении не проверяются (R5).

Тесты — только в новых файлах (R9). Сначала характеризационные (тексты ошибок импорта и чтение корректных
настроек, зелёные до и после), затем для каждой новой функции падающий тест до кода.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.3 (не затрагивается)

**Primary Dependencies**: date-fns 4 (через `src/domain/dates.ts`), Dexie 4.4 (только `repository.ts`, без
изменений в схеме); новых зависимостей нет

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION = 6`, таблицы, форма записей и блоки
`this.version(1…6)` не трогаются

**Testing**: Vitest 5; домен — `node`; хранилище — `node` + `fake-indexeddb/auto`; поиск по исходникам —
`node:fs`, как в `src/domain/isolation.test.ts`

**Target Platform**: iOS Safari (установленная PWA), остальные браузеры — по возможности

**Project Type**: офлайн-PWA (одно приложение, `src/`)

**Performance Goals**: без заметной разницы — чтение настроек остаётся одним чтением `kv`, приведение —
13 проверок

**Constraints**: поведение на корректных данных, тексты, формат резервной копии и схема — прежние
(FR-014, FR-016); существующие проверки и файлы тестов не меняются (FR-015); правила слоёв
(`docs/refactoring-roadmap.md`)

**Scale/Scope**: 3 новых файла домена, правки в `dayEntry.ts`, `repository.ts`, `backup.ts`; 6 новых файлов
тестов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов нет; данные не покидают устройство. | ✅ |
| II. Офлайн-PWA | Всё офлайн; новых сервисов нет. | ✅ |
| III. Сохранность данных | Схема, миграции и формат копии не меняются. Неизвестные поля настроек сохраняются при чтении и изменении (R2). Месячные при чтении не фильтруются, поэтому запись месячных целиком ничего не удалит (R5). Мусор в известном поле настроек заменяется значением по умолчанию, как непонятные части записи дня (009 FR-003, R3). | ✅ |
| IV. TDD, домен — чистые функции | Новые функции домена — сначала падающие тесты; перенос — сначала характеризационные тесты (R8, R9). Новые файлы домена не импортируют хранилище и UI; «сегодня» передаётся параметром, время читает `backup.ts`. Изоляцию проверяет существующий тест. | ✅ |
| V. Простота | Зависимостей нет. Код переносится, а не пишется заново; одна проверка «это объект» вместо двух; одна функция проверки месячных вместо двух этапов в `backup.ts`. | ✅ |
| VI. Дизайн и доступность | UI не меняется. | ✅ |
| VII. Честность | Прогноз не меняется; испорченная настройка больше не доходит до прогноза. | ✅ |

Правила слоёв: `src/domain` импортирует только файлы домена (новые — `./types`, `./dates`, `./periods`,
`./guards`); `src/storage` — `domain` и Dexie. `src/ui`, `src/hooks`, `src/push`, `src/storage/db.ts`,
`src/storage/migrations/`, `worker/` не меняются.

**Повторная проверка после дизайна (Phase 1)**: нарушений не появилось — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/016-domain-validation/
├── spec.md
├── plan.md                         # этот файл
├── research.md                     # R1–R10
├── data-model.md                   # правила настроек, коды ошибок месячных и тексты
├── quickstart.md
├── contracts/domain-validation.md  # isObject, coerceSettings, extraSettingFields, validatePeriods, вызовы
├── checklists/requirements.md
└── tasks.md                        # /speckit-tasks
```

### Source Code (repository root)

```text
src/domain/guards.ts                     # новый: isObject
src/domain/guards.test.ts                # новый
src/domain/settings.ts                   # новый: coerceSettings, extraSettingFields (правила полей)
src/domain/settings.test.ts              # новый
src/domain/periodValidation.ts           # новый: validatePeriods, PeriodValidationError
src/domain/periodValidation.test.ts      # новый
src/domain/dayEntry.ts                   # isRecord → isObject из ./guards
src/storage/repository.ts                # export SETTINGS_KEY; getSettings через правила
src/storage/backup.ts                    # вызовы домена, periodErrorText, SETTINGS_KEY; правил по полям нет
src/storage/backupRules.test.ts          # новый: характеризация импорта (тексты, настройки)
src/storage/settingsRead.test.ts         # новый: чтение и изменение настроек
src/storage/validationPlacement.test.ts  # новый: поиск по исходникам (FR-010–FR-012)
```

**Structure Decision**: одно приложение `src/`; правила — рядом с доменными типами и константами в
`src/domain`, по образцу `dayEntry.ts`; тесты — рядом с кодом (`src/**/*.test.ts`).

## Порядок коммитов

Каждый коммит проходит `npm test` и `npm run build`. Тест пишется первым, его падение проверяется до кода;
тест и код идут в одном коммите (красный коммит не прошёл бы `npm test`).

1. Характеризационные тесты: `backupRules.test.ts` целиком и прежние свойства чтения настроек в
   `settingsRead.test.ts` — до правок, зелёные (US2, US1).
2. `isObject` в домене + `guards.test.ts`; `dayEntry.ts` и `backup.ts` используют его (US3).
3. `coerceSettings`, `extraSettingFields` + `settings.test.ts`; импорт через `coerceSettings` (US3, US2).
4. `getSettings` через правила + новые случаи `settingsRead.test.ts`; `SETTINGS_KEY` в `applyBackup` (US1).
5. `validatePeriods` + `periodValidation.test.ts`; импорт через него и `periodErrorText` (US3, US2).
6. Задачи выполнены.

`validationPlacement.test.ts` (поиск по исходникам, SC-005) растёт вместе с правками: в коммитах 2–5
добавляется проверка своего шага («нет `isRecord` и своего `isObject`», «нет правил настроек», «один
литерал ключа», «нет правил месячных»). Каждая пишется до правки и падает до неё.

## Complexity Tracking

Нарушений Конституции нет. Отступления от «Наброска решения» файла шага (не от Конституции):

| Отступление | Зачем | Почему не как в наброске |
|-------------|-------|--------------------------|
| `getSettings` = `coerceSettings(raw, DEFAULT_SETTINGS)` **плюс** `extraSettingFields(raw)` (R2) | Неизвестные поля и порядок ключей при чтении — прежние (пункт «Проверить на этапе плана») | `coerceSettings` с семантикой `parseSettings` отбрасывает неизвестные поля входа |
| Проверка пересечений после объединения (`mergeImported`) тоже переезжает в домен, в ту же `validatePeriods` (R4) | В `backup.ts` не остаётся правил месячных (критерий готовности) | Набросок говорит только о «строгой проверке месячных»; пересечения — такое же правило домена |
