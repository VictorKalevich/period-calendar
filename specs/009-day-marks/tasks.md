---

description: "Task list for feature 009-day-marks"
---

# Tasks: Отметка секса, несколько настроений и интенсивность самочувствия

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/day-entry.md](./contracts/day-entry.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. Правка файлов — только Edit/Write, UTF-8 без BOM; перед коммитом — проверка diff на испорченную кириллицу и BOM. Каждый коммит проходит `npm test` и `npm run build`. `worker/` не меняется.

## Phase 1: Setup

Новых зависимостей нет — фаза пропущена.

## Phase 2: Foundational — запись дня v6 и коды (блокирует все истории)

- [ ] T001 Failing tests `src/domain/catalog.test.ts`: `MOODS` — 20 пунктов, коды уникальны, коды и подписи в порядке data-model.md; старые коды `calm`, `sensitive`, `sad`, `anxious`, `irritable` есть в справочнике; `LEGACY_MOOD_CODES` = `{ great: 'joyful' }`; `INTENSITIES` — `mild/moderate/severe` с подписями «слабо», «средне», «сильно»; `isMoodId('great') === false`
- [ ] T002 Implement `src/domain/types.ts` (`MoodId` — 20 кодов, `Intensity`, `DayEntry` v6 без `mood`) и `src/domain/catalog.ts` (`MOODS`, `LEGACY_MOOD_CODES`, `INTENSITIES`, `isIntensity`, `intensityLabel`) — до прохождения T001
- [ ] T003 Failing tests `src/domain/dayEntry.test.ts` по таблице [contracts/day-entry.md](./contracts/day-entry.md): каждый ряд таблицы; старая запись `{ mood: 'great' }` → `moods: ['joyful']`, `{ mood: 'calm' }` → `['calm']`, `{ mood: 'nope' }` → `[]`, `{ mood: 5 }` → `[]`; `moods` с неизвестными, повторами и не по порядку; `intensity` для неотмеченного кода и неверное значение отбрасываются; `sex: 'yes'` → `false`; заметка-число → `''`, 1001 символ → обрезка до 1000; лишние поля отбрасываются; функция не бросает для `undefined`, `null`, массива, строки, `{ date: 1 }`; `isEmptyDayEntry` — запись только с `sex` не пуста, только со степенью без пунктов — пуста
- [ ] T004 Implement `coerceDayEntry`, `emptyDayEntry(date)`, новый `isEmptyDayEntry` в `src/domain/dayEntry.ts` (удалить `normalizeDayEntry`); `saveDayEntry` в `src/storage/repository.ts` — через `coerceDayEntry`; минимально поправить использование `mood` (`dayDialog.ts` — `hasWellbeing` = симптомы или настроения, `visibleEntryParts` → `moods`; `SymptomPicker`, `NoteEditor`, `EntrySummary` — `moods`, сохранение `{ ...entry, … }`; `backup.ts` — разбор дней через `coerceDayEntry`), фикстуры тестов — до прохождения T003 и всех прежних тестов

**Checkpoint**: приложение работает как раньше; настроение пока одно (UI), хранится как массив.

## Phase 3: User Story 1 — обновление и импорт без потерь (P1) 🎯 MVP

**Goal**: базы v1–v5 открываются сборкой v6 без потерь; испорченные записи не ломают ни перенос, ни чтение, ни импорт.

**Independent Test**: `npm test` (migrations, upgrade, update, backup).

- [ ] T005 [US1] Failing tests: `migrations.test.ts` — `migrations[5]`: `showMood = showWellbeing` (true/false), `showIntensity`/`showSex` = `false`, явные значения сохраняются, идемпотентна; `data.days` переводятся (`mood` → `moods`), не-массив `days` не трогается; `migrateData(v1, 1, 6)` даёт все поля 004–009; `db.test.ts` — `SCHEMA_VERSION === 6`, значения по умолчанию трёх новых полей `false`; `upgrade-v2.test.ts` — базы v1…v5 **с месячными и записями дней** (в т.ч. `mood: 'great'`, неизвестный код, `symptoms: 'x'`, `note: 7`) → v6: месячные равны исходным, записи переведены по контракту, ни одна не удалена, настройки получили новые поля; `update.test.ts` — v6 пишет и читает запись с `moods`, `intensity`, `sex`
- [ ] T006 [US1] Implement: `Settings.showMood/showIntensity/showSex` + `DEFAULT_SETTINGS` (`false`) в `types.ts`; `migrations[5]` в `src/storage/migrations/index.ts`; `SCHEMA_VERSION = 6` + `this.version(6)…upgrade` в `src/storage/db.ts` (настройки — `migrations[5]`; `days` — `toCollection().modify` с `coerceDayEntry`, `null` — не трогать, `try/catch` на запись и на проход); чтение `getDayEntry`/`getDayEntries` через `coerceDayEntry`; `useForecast` — `getDayEntries`; фикстуры `Settings` в тестах — до прохождения T005
- [ ] T007 [US1] Failing tests `src/storage/backup.test.ts`: экспорт `schemaVersion: 6`, запись дня v6, три новых поля настроек; импорт копии v5 с `mood` → `moods`; копия с испорченными записями дней (неизвестные коды, `symptoms: 'x'`, `note: 7`, запись без даты, повтор даты) — импорт проходит, месячные все, записи по контракту, повтор — первая; испорченные месячные — отказ «Файл резервной копии повреждён: …», база не изменилась; испорченная настройка (`defaultCycleLength: 50`, `showWellbeing: 'yes'`, `ovulationShift: 9`) — значение из `current`, прочие из файла; нет объекта настроек — `current`; `parseBackup` не бросает при `data.days = null`, `data.settings = 5`, `data: []`; прежние кейсы «отказ при испорченной записи дня/настройке» заменить новыми ожиданиями
- [ ] T008 [US1] Implement `parseBackup(text, current)` в `src/storage/backup.ts`: общий `try/catch`, мягкие дни (`coerceDayEntry`, пропуск `null`, первый при повторе), настройки поштучно с запасом `current`, месячные строго; `BackupSection.tsx` — передаёт `await getSettings()`, `onFile` в `try/catch` («Не удалось прочитать файл»); обновить `specs/001-cycle-calendar/contracts/backup-format.md` (v6, правила 4–4б) — до прохождения T007

**Checkpoint**: обновление безопасно; UI прежний.

## Phase 4: User Story 2 — несколько настроений (P1)

**Goal**: переключатель «Настроение», лист с 20 настроениями, несколько сразу.

**Independent Test**: quickstart шаг 3.

- [ ] T009 [US2] Обновить `docs/design/design.md` (до UI-кода, для всех историй 009): карточка «Записи дня» — пять переключателей и правило показа «Интенсивности»; состав диалога дня (FR-019); лист «Настроение»; строки степени в листе «Самочувствие»; сердечко в таблице состояний дня и в легенде (`btnBg`, обводка 2 px `surface`, 14×14, top −6 left −5); пометка «Секс» в карточке дня
- [ ] T010 [US2] Failing tests `src/domain/dayDialog.test.ts`: `extras` — `['wellbeing','mood','notes']` по включённым; будущий день с одним `showMood` открывает диалог; `visibleEntryDates` учитывает `showMood ∧ hasMood`, `hasWellbeing` — только симптомы; `visibleEntryParts` — `moods` пусты при `!showMood`
- [ ] T011 [US2] Implement в `src/domain/dayDialog.ts` (`DayExtra` + `'mood'`, `hasMood`, правила видимости) — до прохождения T010
- [ ] T012 [US2] UI: новый `src/ui/components/MoodPicker.tsx` (лист «Настроение · {дата}», чипы с `aria-pressed`, «Готово», сохранение `{ ...entry, moods }`); `DaySheets` — лист `'mood'`; `DayDialog` — подпись «Настроение»; `SymptomPicker` — только самочувствие; `EntrySummary` — настроения; `SettingsScreen` — переключатель «Настроение», текст карточки; `CalendarScreen`/`Legend` — «Есть записи» при `showWellbeing || showMood || showNotes`; сверить с design.md

## Phase 5: User Story 3 — отметка секса (P2)

**Goal**: переключатель, кнопка в диалоге, сердечко в календаре, легенде и карточке.

**Independent Test**: quickstart шаг 2.

- [ ] T013 [US3] Failing tests: `dayDialog.test.ts` — `sex`: `null` при `!showSex` и для будущего дня, `'mark'` без отметки, `'unmark'` с отметкой; будущий день только с `showSex` — диалог не открывается; `visibleSexDates` пуст при `!showSex`; `dayInfo.test.ts` — `DayInfo.sex` из `ctx.sexDates`; `theme.test.ts` — `btnBg` к `surface` и `bg` ≥ 3:1 (значок) в обеих темах
- [ ] T014 [US3] Implement: `DayInfo.sex`, `DayContext.sexDates` (`types.ts`), `dayInfo` (`forecast.ts`), `dayDialogFor(…, entry)` и `visibleSexDates` (`dayDialog.ts`), фикстуры `DayContext` в тестах — до прохождения T013
- [ ] T015 [US3] UI: `Heart` в `Icons.tsx`; `DayCell` — значок и «секс» в `aria-label`; `Legend` — пункт «Секс» при `showSex`; `DayDialog` — кнопка «Отметить секс»/«Убрать отметку секса» с сердечком после кнопок месячных, сохранение `{ ...entry ?? emptyDayEntry(date), sex: !sex }`, закрытие; `EntrySummary` — пилюля «Секс»; `SettingsScreen` — переключатель «Отметка секса»; `useForecast` — `sexDates`; `CalendarScreen` — передать запись в `dayDialogFor`; стили в `app.css`; сверить с design.md

## Phase 6: User Story 4 — интенсивность самочувствия (P3)

**Goal**: степени у отмеченного самочувствия за переключателем.

**Independent Test**: quickstart шаг 4.

- [ ] T016 [US4] Failing tests `dayDialog.test.ts`: `visibleEntryParts` — `intensity` пуст при `!showIntensity` и при `!showWellbeing`; `formatSymptomTag` — «Головная боль · сильно» при включённой интенсивности, «Головная боль» при выключенной или без степени
- [ ] T017 [US4] Implement `visibleEntryParts`/`formatSymptomTag` (`dayDialog.ts`); UI: `SymptomPicker` — строки степени (подпись + три сегмента `aria-pressed`, повторное нажатие снимает; снятие пункта удаляет степень; при выключенной интенсивности степени сохраняются как есть); `EntrySummary`; `SettingsScreen` — «Интенсивность самочувствия» с подписью, только при `showWellbeing`; стили — до прохождения T016

## Phase 7: Polish

- [ ] T018 Документы: `specs/001-cycle-calendar/data-model.md` (DayEntry v6, Settings, версия схемы 6), `specs/004-day-dialog-wellbeing/spec.md` (примечание: с 009 настроение — отдельный переключатель); отметить задачи выполненными
- [ ] T019 Ручная проверка по quickstart.md в браузере 390×844, обе темы; зоны нажатия ≥ 44 px
- [ ] T020 Проверка diff всех коммитов на испорченную кириллицу и BOM; `npm test`, `npm run build` на каждом коммите

## Dependencies

Phase 2 → Phase 3 → (Phase 4, Phase 5, Phase 6 — независимы, но правят одни UI-файлы, поэтому по порядку) → Phase 7. T009 (design.md) — до T012, T015, T017.

## Parallel Example

Внутри фаз тесты разных файлов можно писать параллельно (T005: `migrations.test.ts`, `db.test.ts`, `upgrade-v2.test.ts`). UI-задачи — последовательно (общие файлы).

## Implementation Strategy

MVP — Phase 2 + Phase 3: форма данных и безопасное обновление. Затем видимые функции по приоритету:
настроения → секс → интенсивность. Коммиты: (1) документы фичи; (2) запись дня v6; (3) перенос и
импорт; (4) design.md; (5) настроения; (6) секс; (7) интенсивность; (8) документы 001/004.
