---

description: "Task list for feature 016-domain-validation"
---

# Tasks: Правила корректности настроек и месячных — в домене

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/domain-validation.md](./contracts/domain-validation.md),
[quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV; `docs/refactoring-roadmap.md`, «Общие ограничения», п. 5).
- Новая функция — сначала тест, и его падение проверяется до кода.
- Перенос существующего кода — сначала характеризационный тест, зелёный до и после.
- Существующие файлы тестов не меняются (FR-015); новые тесты — только в новых файлах (research R9).

Файлы — UTF-8 без BOM, правка только Edit/Write. Каждый коммит проходит `npm test` и `npm run build`
(из PowerShell). Тест и код одной задачи идут в одном коммите: красный коммит не прошёл бы `npm test`.

**Обвязка тестов**:
- **Домен** (`node`): только `vitest` и файлы домена; даты — `'2026-08-01' as LocalDate`.
- **Хранилище** (`node`): `import 'fake-indexeddb/auto'`; `beforeEach` — `await db.delete(); await db.open();`,
  как в `src/storage/backup.test.ts`. Сырые настройки в базу — `db.kv.put({ key: 'settings', value })`
  (литерал допустим в тестах, как в `upgrade-v2.test.ts`).
- **Поиск по исходникам**: `readFileSync(join(__dirname, …), 'utf8')`, как в `src/domain/isolation.test.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US3 из spec.md

---

## Phase 1: Setup

- [ ] T001 Базовая линия на ветке `016-domain-validation`: `npm test` — 695 тестов в 43 файлах, `npm run build` зелёный (записано при подготовке шага; повторить, если ветка менялась)

---

## Phase 2: Foundational — характеризация (до любых правок кода)

**Purpose**: зафиксировать точные тексты ошибок импорта, правила настроек при импорте и чтение корректных
настроек до переноса правил (FR-003, FR-004, FR-008, research R8).

- [ ] T002 [P] Характеризационные тесты импорта в новом файле `src/storage/backupRules.test.ts` (`node` + `fake-indexeddb/auto`). Основа — корректный файл `schemaVersion: 6`: `data.periods = [{ id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false }]`, `data.days = []`, `data.settings = { ...DEFAULT_SETTINGS }`; функция `err(file)` → `parseBackup(JSON.stringify(file))`, ошибка или `null`. Префикс `P = 'Файл резервной копии повреждён: '`. Зелёные до и после правок, проверка — `toBe` (символ в символ):
  1. `periods: 'x'` и поля `periods` нет → `P + 'нет списка месячных'`.
  2. Запись `null`, `[1]`, `'s'` → `P + 'запись месячных не объект'`.
  3. `id: 5` → `P + 'некорректный или повторный id: 5'`; `id: ''` → `P + 'некорректный или повторный id: '`; поля `id` нет → `P + 'некорректный или повторный id: undefined'`; две записи с `id: 'x'` (вторая `2026-09-01`, `end: null`) → `P + 'некорректный или повторный id: x'`.
  4. `start: '2026-02-30'` → `P + 'некорректная дата начала: 2026-02-30'`; поля `start` нет → `P + 'некорректная дата начала: undefined'`.
  5. `end: '2026-13-01'` → `P + 'некорректная дата конца: 2026-13-01'`; поля `end` нет → `P + 'некорректная дата конца: undefined'`.
  6. Поля `endEstimated` нет и `endEstimated: 'no'` → `P + 'нет признака endEstimated'`.
  7. `end: '2026-07-30'` → `P + 'конец раньше начала: 2026-08-01'`.
  8. `end: '2026-08-16'` → `P + 'месячные длиннее 15 дней: 2026-08-01'`; `end: '2026-08-15'` (ровно 15 дней) → импорт принят.
  9. `x` = 2026-08-01…2026-08-10 и `y` = 2026-08-08…2026-08-17 → `P + 'месячные пересекаются: 2026-08-01 и 2026-08-08'`.
  10. Соприкосновение без объединения: `x` = 2026-08-01…2026-08-10 и `y` = 2026-08-11…2026-08-20 → импорт принят, месячных 2.
  11. Порядок: первая ошибка — по порядку записей в файле (`[{ …, start: '2026-02-30' }, { id: 5, … }]` → текст про дату начала); внутри записи `{ id: 5, start: 'плохо' }` → текст про `id`; `{ start: '2026-08-01', end: '2026-07-30', endEstimated: 'no' }` → `нет признака endEstimated`; пересечение пары и затем запись с плохой датой начала → текст про дату начала.
  12. Лишнее поле у записи месячных (`color: 'red'`) отбрасывается: `periods` равны `[{ id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false }]`.
  13. Настройки: неизвестное поле файла `futureField: 1` в результат не попадает; неизвестное поле настроек устройства (`parseBackup(text, { ...DEFAULT_SETTINGS, deviceExtra: 'x' } as Settings)`) сохраняется; `Object.keys(result.settings)` равен `Object.keys(device)`.
  14. Границы диапазонов при импорте принимаются: `defaultCycleLength` 21 и 45, `defaultPeriodLength` 2 и 10, `ovulationShift` −5 и 5 (по одному `it.each`); за границей (20, 46, 1, 11, −6, 6) — значение устройства.
- [ ] T003 [P] Характеризационные тесты чтения настроек в новом файле `src/storage/settingsRead.test.ts`, `describe('чтение настроек — как раньше')` (`node` + `fake-indexeddb/auto`). Зелёные до и после правок:
  1. В базе `raw = { ...DEFAULT_SETTINGS, defaultCycleLength: 30, futureA: 1, futureB: { x: 1 } }` → `getSettings()` равен `{ ...DEFAULT_SETTINGS, ...raw }`, и `Object.keys` результата равен `Object.keys({ ...DEFAULT_SETTINGS, ...raw })`.
  2. В базе неполная запись с ключами в обратном порядке и неизвестным полем (`{ futureA: 1, showSex: true, defaultCycleLength: 30 }`) → то же равенство значений и порядка ключей с `{ ...DEFAULT_SETTINGS, ...raw }`.
  3. Записи нет и `value: null` → `getSettings()` равен `DEFAULT_SETTINGS`, результат `not.toBe(DEFAULT_SETTINGS)` и `Object.isFrozen(result) === false`.
  4. В базе `{ ...DEFAULT_SETTINGS, futureA: 1 }`; `updateSettings({ showNotes: true })` → сырая запись `(await db.kv.get('settings'))?.value` содержит `futureA: 1` и `showNotes: true`.
  5. В базе `{ ...DEFAULT_SETTINGS, futureA: 1 }` → `(await buildBackup(new Date('2026-11-14T10:00:00.000Z'))).data.settings` равен `{ ...DEFAULT_SETTINGS, futureA: 1 }` с тем же порядком ключей (экспорт прежний).

**Checkpoint**: оба файла зелёные на текущем коде; коммит «016: характеризационные тесты импорта и чтения настроек» (T002, T003)

---

## Phase 3: User Story 3 — правила проверяются отдельно (P2, основа для US1 и US2)

**Goal**: правила корректности — чистые функции домена с собственными тестами. Идёт первой из историй:
US1 и US2 вызывают её функции. Вызывающие места меняются только для `isObject` (тело то же).

**Independent Test**: `npx vitest run src/domain/guards.test.ts src/domain/settings.test.ts src/domain/periodValidation.test.ts src/domain/isolation.test.ts`.

### isObject

- [ ] T004 [US3] Failing tests до кода:
  - новый `src/domain/guards.test.ts`: `isObject` — `true` для `{}`, `{ a: 1 }`, `Object.create(null)`; `false` для `null`, `undefined`, `[]`, `[1]`, `'x'`, `1`, `true`, `() => {}`;
  - новый `src/storage/validationPlacement.test.ts`, `describe('правила корректности — в домене')`, первая проверка: в `src/domain/dayEntry.ts` нет `isRecord`, в `src/storage/backup.ts` нет `const isObject` (FR-011).
- [ ] T005 [US3] Создать `src/domain/guards.ts`: `export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);` (контракт). В `src/domain/dayEntry.ts` удалить `isRecord`, использовать `isObject` из `./guards`; в `src/storage/backup.ts` удалить свой `isObject`, импортировать из `../domain/guards`. Коммит «016: одна проверка «это объект» в домене» (T004, T005)

### Настройки

- [ ] T006 [US3] Failing tests в новом файле `src/domain/settings.test.ts`, до кода:
  1. `FALLBACK` отличается от `DEFAULT_SETTINGS` в каждом поле: `defaultCycleLength: 33`, `defaultPeriodLength: 7`, `ovulationShift: 4`, все логические — противоположные значениям по умолчанию.
  2. Таблица `FIELDS: Record<keyof Settings, { valid: unknown[]; invalid: unknown[] }>`: `defaultCycleLength` — valid `[21, 28, 45]`, invalid `[20, 46, 30.5, '30', NaN, Infinity, null, undefined, true]`; `defaultPeriodLength` — valid `[2, 5, 10]`, invalid `[1, 11, 4.5, '4', NaN, null]`; `ovulationShift` — valid `[-5, 0, 5]`, invalid `[-6, 6, 1.5, '2', NaN, null]`; каждое из 10 логических — valid `[true, false]`, invalid `['true', 'false', 1, 0, null, undefined]`. Правило из `data-model.md`: «целое — `Number.isInteger`… Границы включительно».
  3. Тест полноты: `Object.keys(FIELDS).sort()` равен `Object.keys(DEFAULT_SETTINGS).sort()` (13 полей, SC-001).
  4. `it.each` по всем полям и значениям: `coerceSettings({ ...FALLBACK, [key]: value }, FALLBACK)` — для корректного значение поля равно `value`, для некорректного — `FALLBACK[key]`; остальные поля равны `FALLBACK`.
  5. Поля нет во входе → значение `FALLBACK`.
  6. Вход не объект (`undefined`, `null`, `'x'`, `5`, `true`, `[]`, `[1, 2]`) → результат равен `FALLBACK`, `not.toBe(FALLBACK)`; при `fallback = DEFAULT_SETTINGS` результат не заморожен.
  7. Неизвестное поле входа (`futureA`) в результат не попадает; неизвестное поле `fallback` (`deviceExtra`) сохраняется; `Object.keys(result)` равен `Object.keys(fallback)`.
  8. Входы не меняются: `Object.freeze` у `raw` и `fallback` — без исключения, оба прежние.
  9. `extraSettingFields`: `{ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc', b: 2, a: 1 }` → `{ b: 2, a: 1 }`, ключи `['b', 'a']`; не объект (`undefined`, `null`, `'x'`, `[1]`) и `{}` → `{}`; `JSON.parse('{"__proto__": {"polluted": 1}, "x": 1}')` → у результата прототип — `Object.prototype`, `({} as Record<string, unknown>).polluted` — `undefined`.
- [ ] T007 [US3] Создать `src/domain/settings.ts` по контракту: закрытые `isIntIn`, `isBool`, таблица `SETTING_RULES: { readonly [K in keyof Settings]: (v: unknown) => boolean }` (правила из `backup.ts`, диапазоны — `CYCLE_LENGTH_RANGE`, `PERIOD_LENGTH_RANGE`, `OVULATION_SHIFT_RANGE` из `./types`); `coerceSettings(raw, fallback)` — `out = { ...fallback }`, при `!isObject(raw)` вернуть `out`, иначе для каждого ключа `SETTING_RULES` с корректным `raw[key]` — `out[key] = raw[key]`; `extraSettingFields(raw)` — `Object.fromEntries(Object.entries(raw).filter(([k]) => !Object.hasOwn(SETTING_RULES, k)))` для объекта, иначе `{}`. Вызывающих мест пока нет. Коммит «016: правила настроек в домене» (T006, T007)

### Месячные

- [ ] T008 [US3] Failing tests в новом файле `src/domain/periodValidation.test.ts`, до кода; `TODAY = '2026-11-14'`, `LEN = 5`; `v(input)` → `validatePeriods(input, TODAY, LEN)`. Каждый код — `toEqual` с параметрами (SC-002, таблица «Ошибка проверки» в `data-model.md`):
  1. `not-a-list`: `'x'`, `undefined`, `null`, `{}`, `5`.
  2. `not-an-object`: `[null]`, `[[1]]`, `['s']`, `[5]`.
  3. `invalid-id`: `id` `5`, `''`, `null`, поля нет → `{ code: 'invalid-id', id: <значение> }`.
  4. `duplicate-id`: две записи с `id: 'a'` → `{ code: 'duplicate-id', id: 'a' }`.
  5. `invalid-start`: `'2026-02-30'`, `'2026-8-1'`, `20260801`, поля нет → `{ code: 'invalid-start', start: <значение> }`.
  6. `invalid-end`: `'2026-13-01'`, `''`, поля нет → `{ code: 'invalid-end', end: <значение> }`; `end: null` — корректно.
  7. `invalid-end-estimated`: поля нет, `'no'`, `0`, `null`.
  8. `end-before-start`: 2026-08-01…2026-07-31 → `{ code: 'end-before-start', start: '2026-08-01' }`.
  9. `too-long`: 2026-08-01…2026-08-16 → `{ code: 'too-long', start: '2026-08-01', maxDays: 15 }`; 2026-08-01…2026-08-15 — корректно.
  10. `overlap`: 2026-08-01…2026-08-10 и 2026-08-08…2026-08-17 → `{ code: 'overlap', first: '2026-08-01', second: '2026-08-08' }`.
  11. Порядок: первая ошибка по порядку записей; `id` проверяется раньше `start`; `endEstimated` — раньше «конец раньше начала»; проверки записей — раньше пересечений (пересекающаяся пара, затем запись с плохой датой начала → `invalid-start`).
  12. Успех: неупорядоченный список → отсортирован по началу; лишние поля отброшены (только `id`, `start`, `end`, `endEstimated`); соседние 2026-08-01…2026-08-05 и 2026-08-06…2026-08-08 объединены в одни 2026-08-01…2026-08-08; соприкасающиеся без объединения 2026-08-01…2026-08-10 и 2026-08-11…2026-08-20 — две записи; `[]` → `{ ok: true, value: [] }`.
  13. `periodLength` влияет на оценку незакрытых: `[{ a: 2026-08-01, end: null }, { b: 2026-08-06…2026-08-07 }]` при `LEN = 5` → одни месячные 2026-08-01…2026-08-07, `endEstimated: false`; при длине 3 → две записи, у `a` `end: null`.
  14. Вход не меняется (`structuredClone` до и после равны); на смешанном входе (`[корректная запись, 'x']`) — не бросает, `not-an-object`.
- [ ] T009 [US3] Создать `src/domain/periodValidation.ts` по контракту: тип `PeriodValidationError`; `validatePeriods(input, today, periodLength)` — этап 1 переносит проверки `parsePeriods` из `backup.ts` в прежнем порядке, возвращая коды вместо текстов (`isObject` из `./guards`, `isLocalDate`, `diffDays` из `./dates`, `MAX_PERIOD_DAYS`, `Result` из `./types`); этап 2 — `normalizePeriods(periods, today, periodLength)` и проверка соседних `periodEnd(prev, periodLength) >= next.start` → `{ code: 'overlap', first: prev.start, second: next.start }` (`./periods`). Без чтения текущего времени. Вызывающих мест пока нет. Коммит «016: строгая проверка месячных в домене» (T008, T009)

**Checkpoint**: тесты домена и `src/domain/isolation.test.ts` зелёные; `backup.ts` пока использует свои правила.

---

## Phase 4: User Story 1 — испорченная настройка в базе не ломает экран (P1) 🎯 MVP

**Goal**: `getSettings` приводит сохранённое значение правилами домена, сохраняя неизвестные поля и порядок
ключей; один ключ настроек.

**Independent Test**: `npx vitest run src/storage/settingsRead.test.ts src/storage/validationPlacement.test.ts`.

- [ ] T010 [US1] Failing tests до кода:
  - в `src/storage/settingsRead.test.ts` (новый файл из T003, допустимо дополнять), `describe('чтение настроек по правилам')`. Сохранённые «прочие» поля — корректные и отличные от умолчаний (`defaultCycleLength: 30`, `showNotes: true`):
    1. `it.each` некорректных полей: `defaultCycleLength` `'abc'`, `50`, `30.5`, `null`, `undefined`; `defaultPeriodLength` `'5'`; `ovulationShift` `9`; `remindPeriod` `'yes'`; `showSex` `1` → поле равно `DEFAULT_SETTINGS[key]`, остальные — сохранённые (SC-004).
    2. В базе не объект (`'abc'`, `[1, 2]`, `5`, `true`) → `getSettings()` равен `DEFAULT_SETTINGS`.
    3. В базе `{ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc', futureA: 1 }`; `updateSettings({ showNotes: true })` → сырая запись равна `{ ...DEFAULT_SETTINGS, showNotes: true, futureA: 1 }` (research R3, сценарий US1.6).
    4. В базе `{ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc' }` и месячные 2026-10-01…2026-10-05 → `buildForecast({ periods: await getPeriods(), settings: await getSettings(), today: '2026-11-14' })` не бросает, `cycleLength` = 28 (испорченное поле не доходит до прогноза).
    5. `SETTINGS_KEY` экспортирован из `./repository` и равен `'settings'`.
  - в `src/storage/validationPlacement.test.ts`: литерал `'settings'` встречается в `src/storage/repository.ts` и `src/storage/backup.ts` вместе ровно один раз — в строке `export const SETTINGS_KEY = 'settings'` (FR-010).
- [ ] T011 [US1] В `src/storage/repository.ts`: `export const SETTINGS_KEY = 'settings'`; `getSettings` — `const raw = (await db.kv.get(SETTINGS_KEY))?.value; return { ...coerceSettings(raw, DEFAULT_SETTINGS), ...extraSettingFields(raw) };` с комментарием из контракта. В `src/storage/backup.ts` `applyBackup` пишет `{ key: SETTINGS_KEY, value: b.settings }` (импорт из `./repository`). `saveSettings`, `updateSettings` не меняются. Коммит «016: настройки читаются из базы по правилам домена» (T010, T011)

**Checkpoint**: характеризация T003 и новые тесты зелёные; `db.test.ts`, `update.test.ts`, `upgrade-v2.test.ts`, `useLiveQuery.test.ts` — без изменений и зелёные.

---

## Phase 5: User Story 2 — импорт резервной копии ведёт себя как раньше (P1)

**Goal**: `backup.ts` вызывает правила домена и превращает коды в прежние тексты; правил по полям в нём нет.

**Independent Test**: `npx vitest run src/storage/backupRules.test.ts src/storage/backup.test.ts src/storage/validationPlacement.test.ts`.

- [ ] T012 [US2] Failing test до кода в `src/storage/validationPlacement.test.ts`: исходник `src/storage/backup.ts` не содержит `SETTING_RULES`, `isIntIn`, `isBool`, `CYCLE_LENGTH_RANGE`, `PERIOD_LENGTH_RANGE`, `OVULATION_SHIFT_RANGE`, `MAX_PERIOD_DAYS`, `isLocalDate`, `diffDays`, `normalizePeriods`, `periodEnd`, `function parsePeriods`, `function parseSettings`, `function mergeImported`; содержит вызовы `coerceSettings(` и `validatePeriods(` (FR-012, SC-005).
- [ ] T013 [US2] В `src/storage/backup.ts`: удалить `isIntIn`, `isBool`, `SETTING_RULES`, `parseSettings`, `parsePeriods`, `mergeImported` и ставшие лишними импорты; добавить закрытую `periodErrorText(e: PeriodValidationError): string` (`switch` по `e.code`, тексты — таблица `data-model.md`, «Ошибка проверки»: `invalid-id` и `duplicate-id` → `` `некорректный или повторный id: ${String(e.id)}` ``, `too-long` → `` `месячные длиннее ${e.maxDays} дней: ${e.start}` `` и т. д.). `parseBackupUnsafe`: `const settings = coerceSettings(data.settings, current)`; `const periods = validatePeriods(data.periods, toLocalDate(new Date()), settings.defaultPeriodLength)`; при `!periods.ok` — `{ ok: false, error: corrupted(periodErrorText(periods.error)) }`; затем `parseDays` — порядок прежний. Обновить комментарии (правила — в домене). Коммит «016: импорт резервной копии через правила домена» (T012, T013)

**Checkpoint**: `backupRules.test.ts` (характеризация T002) и `backup.test.ts` — зелёные без изменений.

---

## Phase 6: Polish & проверки

- [ ] T014 Проверки `quickstart.md`:
  - `npm test` — зелёный, тестов ≥ 695 + новые;
  - `npm run build` — зелёный;
  - `git diff --stat refactoring...HEAD -- "*.test.ts" "*.snap"` — только новые файлы: `src/domain/guards.test.ts`, `src/domain/settings.test.ts`, `src/domain/periodValidation.test.ts`, `src/storage/backupRules.test.ts`, `src/storage/settingsRead.test.ts`, `src/storage/validationPlacement.test.ts`;
  - команды раздела 3 `quickstart.md` (`git grep` по `backup.ts`, `'settings'`, `isRecord`);
  - `git diff refactoring...HEAD` — без испорченной кириллицы и BOM, без изменений вне объёма шага: не меняются `src/storage/db.ts`, `src/storage/migrations/`, `src/push/`, `src/ui/`, `src/hooks/`, `worker/`, `getPeriods`, `savePeriods`.
- [ ] T015 Отметить задачи `[X]` в `specs/016-domain-validation/tasks.md`; коммит «016: задачи выполнены»
- [ ] T016 Для журнала (`docs/refactoring-roadmap.md` обновляется после слияния, шаг 9 «Порядка работы»): число тестов до → после; отступления — R2 (`extraSettingFields` в дополнение к `coerceSettings`), R4 (пересечения тоже в домене, одна функция); попутные находки (R7: своя проверка объекта в `migrations/index.ts` пропускает списки; литерал `'settings'` в `push/sync.ts` — шаг 5)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: характеризация T002, T003 — до любых правок кода (T005, T007, T009, T011, T013).
- **US3** (Phase 3): T004 → T005 (коммит) → T006 → T007 (коммит) → T008 → T009 (коммит). Три части
  независимы друг от друга, но `settings.ts` и `periodValidation.ts` импортируют `./guards`, поэтому
  `isObject` — первым.
- **US1** (Phase 4): зависит от T005, T007 (`coerceSettings`, `extraSettingFields`). T010 → T011 (коммит).
- **US2** (Phase 5): зависит от T005, T007, T009. T012 → T013 (коммит). Не зависит от US1 по коду
  (`SETTINGS_KEY` в `applyBackup` — в T011); идёт после неё по приоритету.
- **Polish**: после всех историй.

### Parallel Opportunities

- T002 и T003 — разные файлы, без зависимостей: можно писать параллельно.
- В Phase 3 тесты T006 и T008 — разные файлы; их можно писать параллельно после T005.
- Внутри историй задачи последовательны: тест → код в одних и тех же файлах.

### Parallel Example: старт

```text
T002 характеризация импорта (src/storage/backupRules.test.ts)
T003 характеризация чтения настроек (src/storage/settingsRead.test.ts)
```

## Implementation Strategy

1. **Основа — US3** (T001–T009): правила в домене с собственными тестами; поведение приложения ещё не
   меняется.
2. **MVP — US1** (T010–T011): настройки читаются по правилам — испорченное поле больше не доходит до
   прогноза.
3. **US2** (T012–T013): импорт через домен; в `backup.ts` остаются разбор файла, миграции и тексты.
4. **Polish** (T014–T016): проверки и материалы для журнала.
