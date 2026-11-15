---

description: "Task list for feature 019-ui-logic"
---

# Tasks: Решения — в чистых функциях, компоненты только рисуют

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui-logic.md](./contracts/ui-logic.md),
[quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV; `docs/refactoring-roadmap.md`, «Общие ограничения», п. 5).
- Новая функция или модуль — сначала тест. Его падение (модуля нет или результат неверный) проверяется
  до кода.
- Перенос существующего кода — сначала характеризационный тест, зелёный до и после.
- Существующие файлы тестов не меняются (FR-013). Единственное исключение — строка импорта
  `looksLikeCycleText` в `src/storage/textImport.test.ts` (research R5).

Файлы — UTF-8 без BOM, правка только Edit/Write; символ U+FEFF в исходниках тестов записывать как
`String.fromCharCode(0xfeff)`, а не литералом. Каждый коммит проходит `npm test` и `npm run build` (из
PowerShell). Тест и код одной задачи идут в одном коммите: красный коммит не прошёл бы `npm test`.
Перед коммитом — `git diff` без испорченной кириллицы и BOM. `git push` и деплой не выполнять (план
рефакторинга, «Ветки и запрет на push»).

**Обвязка тестов**:
- **UI** — первой строкой `// @vitest-environment happy-dom`, затем `import 'fake-indexeddb/auto'`
  (где нужна база). `beforeEach`: `await db.delete(); await db.open();`. `afterEach`: `unmountAll();
  vi.clearAllMocks();`. Помощники `mount`, `click`, `button`, `settle`, `waitUntil` — из
  `src/ui/testing.ts`.
- **Подмена push** — как в `src/ui/saveFailures.test.ts:34-42`: `vi.mock('../push/subscribe', …)` с
  `isPushConfigured`, `isPushSupported`, `isStandalone` → `true`, `notificationPermission` →
  `'granted'`, `enableReminders: vi.fn(async () => 'granted')`, `disableReminders: vi.fn(async () =>
  {})`; `vi.mock('../push/sync', () => ({ syncReminders: vi.fn(async () => {}), startReminderSync:
  vi.fn() }))`. Пути — относительно файла теста.
- **Выбор файла в «Резервной копии»** — как в `src/ui/components/exportData.test.ts:102-108`:
  `Object.defineProperty(input, 'files', { value: [new File([content], name)], configurable: true })`,
  затем `await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); })`, затем
  `waitUntil(…)`.
- **«Сегодня»**: `vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 10, 14, 12));`,
  в `afterEach` — `vi.useRealTimers()` (как `exportData.test.ts:28-29`).
- **Часовые пояса** (домен): `process.env.TZ = tz` до построения дат, в `afterEach` — исходное значение,
  как `src/domain/dates.test.ts:16-19`.
- **Поиск по исходникам**: `readdirSync`/`readFileSync(…, 'utf8')` от `__dirname`, как
  `src/domain/derivationPlacement.test.ts`. Тесты (`*.test.ts`) и `src/ui/testing.ts` исключаются.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US3 из spec.md

---

## Phase 1: Setup

- [ ] T001 Базовая линия на ветке `019-ui-logic`: `npm test` — 1121 тест в 60 файлах, `npm run build`
  зелёный (записано при подготовке шага; повторить, если ветка менялась). `worker/` не затрагивается.

---

## Phase 2: Foundational — характеризация до правок

**Purpose**: зафиксировать прежние разметку и поведение до любых правок кода. Оба файла зелёные на
текущем коде и остаются зелёными до конца шага; после них — один коммит «019: характеризационные тесты
разметки и решений интерфейса».

- [ ] T002 [P] Новый `src/ui/toggleMarkup.test.ts` — разметка 10 переключателей (research R1).
  - **Подмены.** `const live = vi.hoisted(() => ({ settings: undefined as unknown, push: undefined as
    unknown }))`. `vi.mock('../hooks/useLiveQuery', async () => { const repo = await
    import('../storage/repository'); return { useLiveQuery: (q: unknown) => q === repo.getSettings ?
    live.settings : q === repo.getDevMode ? false : q === repo.getPushState ? live.push : undefined };
    })`. Подмена push — из «Обвязки», но `enableReminders: vi.fn()`; поведение задаётся в тесте.
    `fake-indexeddb` не нужен.
  - **Помощник.** `toggles(html) = html.match(/<label class="toggle">.*?<\/label>/g) ?? []`.
  - **(1) «всё включено».** `live.settings = { ...DEFAULT_SETTINGS, ovulationShiftEnabled: true,
    ovulationFromNextPeriod: true, showWellbeing: true, showIntensity: true, showMood: true, showSex:
    true, showNotes: true }`, `live.push = { subscribed: false }`. Тогда
    `toggles(renderToStaticMarkup(createElement(SettingsScreen)))` `toEqual` массиву из 10
    строк-литералов в порядке экрана:
    - «Учитывать личный сдвиг овуляции»;
    - «Считать от следующей менструации» (`… checked="" aria-describedby="ovulation-mode-hint"/>`);
    - «Самочувствие»;
    - «Интенсивность самочувствия» с подсказкой;
    - «Настроение» с подсказкой;
    - «Отметка секса» с подсказкой;
    - «Заметки»;
    - три напоминания с подсказками: `PERIOD_REMINDER.body`, `OVULATION_REMINDER.body` из
      `../domain/reminders` и «Придёт на 3-й день…».

    У всех `checked=""`. Образец формы — `research.md` R1 и `contracts/ui-logic.md`, таблица `Toggle`.
  - **(2) «всё выключено».** `{ ...DEFAULT_SETTINGS, remindPeriod: false, remindOvulation: false,
    remindMissedPeriod: false }` → 9 строк без `checked`: «Интенсивность самочувствия» скрыта, а
    подсказка «Настройте, на сколько дней…» не появляется.
  - **(3) DOM, недоступный вариант.** `live.settings` — как в (1). `deferred` — обещание с внешним
    `resolve`; `vi.mocked(enableReminders).mockReturnValue(deferred.promise)`. `mount(
    createElement(RemindersSection, { settings: live.settings }))`, нажать «Включить напоминания»
    (`click` + `button`). Ожидания:
    - три `input[role=switch]` — `disabled === true`;
    - `[...querySelectorAll('label.toggle')].map((l) => l.outerHTML)` —
      `toMatchInlineSnapshot()`, Vitest заполнит при первом прогоне.

    Затем `await act(async () => deferred.resolve('granted'))`, `await settle()`. Ожидания: все
    `disabled === false`, второй `toMatchInlineSnapshot()`.

  Прогнать `npx vitest run src/ui/toggleMarkup.test.ts` на текущем коде: зелёный, inline-снимки
  записаны. Строки-литералы совпали с настоящими экранами.
- [ ] T003 [P] Новый `src/ui/uiDecisions.test.ts` — поведение трёх компонентов (research R10).
  Окружение, `fake-indexeddb`, подмена push и «сегодня» — из «Обвязки».
  - **«Резервная копия»** (`mount(createElement(BackupSection))`; лист — `dialog.sheet` с
    `aria-label`; текст листа — `textContent` его `p.sheet__note`; сообщение — `p.notice`).
    1. Текстовая выгрузка `cycleFile(starts)`: строки `cycle N` /
       `Period start date: YYYY-MM-DD 20:00:00.0` / `Period end date: …` на каждые месячные, по образцу
       `FILE` в `src/storage/textImport.test.ts`. Для 1, 2 и 5 месячных (начиная с 2017-12-23)
       ожидается лист «Добавить месячные?» с «Найдено: 1 период месячных (23.12.2017 – 23.12.2017).
       Добавить в календарь?». Для 2 и 5 — «2 периода», «5 периодов» и последняя дата. Затем нажатие
       «Добавить» → `notice notice--ok` «Добавлено: 1 период месячных» (и т. д.). Повторный импорт того
       же файла → «Все месячные из файла уже были отмечены».
    2. Выгрузка с одним испорченным блоком (`Period start date: oops`) → строка «Пропущено из-за ошибок
       в файле: 1 период.». Выгрузка, пересекающая уже сохранённые месячные (`savePeriods` до
       монтирования) → «Будут заменены уже отмеченные месячные: 1 период.».
    3. Резервная копия: записать 1 месячные и N записей дней (`savePeriods`, `saveDayEntry`), взять
       `JSON.stringify(await buildBackup())`, очистить базу (`db.delete(); db.open()`), смонтировать,
       выбрать файл. Ожидается лист «Восстановить данные?» с «Будет восстановлено: 1 месячных,
       1 запись дня. Текущие данные будут заменены.»; для N = 3 и 12 — «3 записи дней», «12 записей
       дней». Тот же JSON с префиксом `'\n  \t'` — тот же лист.
    4. Текст `'{ "x": "Period start date: 2017-12-23" }'` — листа «Добавить месячные?» нет, есть
       `notice notice--error` с текстом `parseBackup(text, await getSettings())`, если тот вернул
       ошибку (вычислить в тесте). Пустой файл и `'hello'` → `notice notice--error` «Файл не
       распознан».
  - **«Самочувствие»** (`SymptomPicker`, `open: true`, запись сохранена через `saveDayEntry`, проверка —
    `getDayEntry(DAY)` после «Готово»).
    1. `showIntensity: true`, запись `{ symptoms: ['headache', 'nausea'], intensity: { headache: 'severe',
       nausea: 'mild' } }`. Снять «Головная боль», «Готово» → `symptoms: ['nausea']`, `intensity: {
       nausea: 'mild' }`.
    2. Та же запись: снять и снова отметить «Головная боль» → `['nausea', 'headache']`, `{ nausea:
       'mild', headache: 'moderate' }`.
    3. Выбрать степень «сильно» у «Тошнота» (сегмент в `fieldset` с `legend` «Тошнота»), нажать её
       ещё раз → `aria-pressed="true"` остаётся; после «Готово» — `nausea: 'severe'`.
    4. Переоткрытие сбрасывает несохранённое: снять пункт, `rerender` с `open: false`, затем с `open:
       true` → пункт снова `aria-pressed="true"`.
    5. `showIntensity: false`, запись `{ symptoms: ['headache'], intensity: { headache: 'severe' } }`:
       снять «Головная боль» → «Готово» → `symptoms: []` и `intensity` без `headache` — то, что
       сохраняет текущий код, проверить прогоном.
  - **«Напоминания»** (`mount(createElement(RemindersSection, { settings }))`, разрешение `'granted'`):
    1. Подписки нет (состояние push не записано), `settings = DEFAULT_SETTINGS` (три вида включены).
       Выключить «За 2 дня до месячных» → `waitUntil(enableReminders вызван)`;
       `disableReminders` не вызван.
    2. Подписки нет, включён только `remindPeriod`. Выключить его → `disableReminders` вызван,
       `enableReminders` нет.
    3. Подписка есть (`savePushState({ clientId: 'c', token: 't', subscribed: true, pendingSync:
       false, lastSyncedHash: null })` до монтирования, дождаться «Напоминания включены»). Выключить
       «В день овуляции» → после `settle()` ни `enable`, ни `disable` не вызваны.
    4. Подписка есть, включён только `remindOvulation`. Выключить → `disableReminders` вызван.

  Прогнать `npx vitest run src/ui/uiDecisions.test.ts` на текущем коде — зелёный. Если ожидание
  расходится с текущим поведением, исправить ожидание, а не код: это характеризация.
- [ ] T004 Прогнать `npm test` и `npm run build`; закоммитить T002–T003.

**Checkpoint**: прежние разметка и поведение зафиксированы — правки можно начинать.

---

## Phase 3: User Story 1 — склонение и форматы дат по одному определению (P1) 🎯 MVP

**Goal**: `pluralRu`, `formatDateNumeric` и `formatFullDateRu` определены один раз в домене; `src/ui` не
импортирует `date-fns`.

**Independent Test**: `npx vitest run src/domain/plural.test.ts src/domain/dateFormats.test.ts
src/domain/dates.test.ts src/domain/report.test.ts src/ui/uiDecisions.test.ts
src/ui/uiLogicPlacement.test.ts`.

- [ ] T005 [US1] Склонение в домене (FR-001; research R3; контракт `plural.ts`).
  - Тест первым: новый `src/domain/plural.test.ts`, `it.each` по таблице контракта
    (`['запись', 'записи', 'записей']`: 0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112, 122) и
    `['период', 'периода', 'периодов']` для 1, 3, 5. Прогнать — падает: модуля нет.
  - Код: новый `src/domain/plural.ts` — `export function pluralRu(n: number, [one, few, many]: [string,
    string, string]): string`, тело перенести без изменений из `src/ui/components/BackupSection.tsx:11-16`
    вместе с JSDoc. `formatShiftRu` в `src/domain/dates.ts` переписать:
    `` return `${sign}${pluralRu(abs, ['день', 'дня', 'дней'])}`; ``; `mod10`/`mod100`/`word` убрать,
    импорт `pluralRu` из `./plural`. В `BackupSection.tsx` удалить локальную `pluralRu` и
    импортировать её из `../../domain/plural`.
  - Поиск: новый `src/ui/uiLogicPlacement.test.ts`, общий помощник `sources(dir)` — рабочие
    `.ts`/`.tsx` без тестов и `testing.ts`.
    - `it`: «в `src/ui` нет правила склонения» — ни один файл не содержит `% 10` и `% 100`;
    - `it`: «`pluralRu` определена один раз» — в `src/**` ровно одно вхождение
      `function pluralRu`, в `src/domain/plural.ts`; `src/domain/dates.ts` не содержит `% 10`.
  - Проверить: `dates.test.ts` (сдвиг −5…+5, U+2212) и `uiDecisions.test.ts` зелёные. `npm test`,
    `npm run build`; коммит «019: склонение — одна функция в домене».
- [ ] T006 [US1] Числовая и полная дата в домене (FR-002, FR-003; research R4; контракт `dates.ts`).
  - Тест первым: новый `src/domain/dateFormats.test.ts`. Ожидания:
    - `formatDateNumeric`: `2026-11-08` → «08.11.2026», `2024-02-29` → «29.02.2024», `2017-12-23` →
      «23.12.2017», `2027-01-01` → «01.01.2027»;
    - `formatFullDateRu`: `2026-11-08` → «8 ноября 2026», `2027-01-01` → «1 января 2027», `2024-02-29` →
      «29 февраля 2024», `2026-12-31` → «31 декабря 2026»;
    - `describe.each(['UTC', 'Pacific/Kiritimati', 'America/Los_Angeles', 'Europe/Moscow'])` — те же
      значения, а также `2026-03-08` → «8 марта 2026» и `2026-11-01` → «1 ноября 2026» (переходы
      летнего времени в США);
    - `formatRangeRu('2026-12-28', '2027-01-02')` === `` `${formatFullDateRu('2026-12-28')} –
      ${formatFullDateRu('2027-01-02')}` ``.

    Прогнать — падает: функций нет.
  - Код в `src/domain/dates.ts`:
    - `/** «08.11.2026» */ export const formatDateNumeric = (d: LocalDate) =>
      `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`` — перенос из `src/domain/report.ts:139-140`;
    - `/** «8 ноября 2026» */ export function formatFullDateRu(d: LocalDate): string { return
      format(parseLD(d), 'd MMMM yyyy', { locale: ru }); }`;
    - в `formatRangeRu` убрать локальную `full` и вызывать `formatFullDateRu`.

    В `src/domain/report.ts` удалить определение `formatDateNumeric` и импортировать её из `./dates`.
    `formatDayMonthNumeric` остаётся.
  - Проверить: `dates.test.ts`, `report.test.ts`, `forecastCharacterization.test.ts` зелёные и не
    менялись. `npm test`, `npm run build`; коммит «019: числовая и полная дата — в модуле дат».
- [ ] T007 [US1] Интерфейс — через доменные форматы (FR-002–FR-004).
  - `BackupSection.tsx`: удалить `numericDate`, вызывать `formatDateNumeric` из `../../domain/dates`.
    Импорт `LocalDate` убрать, если он больше не нужен.
  - `src/ui/screens/StatsScreen.tsx`: удалить импорты `date-fns`, `date-fns/locale`, `parseLD`,
    `LocalDate` и функцию `fullDate`; `{fullDate(c.start)}` → `{formatFullDateRu(c.start)}` из
    `../../domain/dates`.
  - Поиск, тест первым: в `src/ui/uiLogicPlacement.test.ts` два новых `it`. Прогнать до правки
    компонентов — падают.
    - «в `src/ui` нет `date-fns` и разбора даты срезами»: ни один файл не содержит `from 'date-fns` и
      `slice(8, 10)`. `slice(5, 7)` не проверяется: им считает индекс месяца `MonthPager.tsx`, а он вне
      объёма;
    - «форматы дат определены один раз»: в `src/**` ровно одно вхождение `'d MMMM yyyy'` и ровно одно
      `` `${d.slice(8, 10)}.${d.slice(5, 7)}.`` — оба в `src/domain/dates.ts`.
  - Проверить: `uiDecisions.test.ts` (даты «23.12.2017») и `normalPath.test.ts` зелёные. `npm test`,
    `npm run build`; коммит «019: интерфейс без date-fns — даты из домена».

**Checkpoint**: US1 готова — склонение и форматы дат существуют в одном экземпляре.

---

## Phase 4: User Story 2 — решения интерфейса в чистых функциях (P1)

**Goal**: вид импортируемого файла, переходы «Самочувствия» и действие напоминаний — чистые функции с
тестами; компоненты их вызывают.

**Independent Test**: `npx vitest run src/domain/importFile.test.ts src/domain/symptomSelection.test.ts
src/ui/components/reminderToggle.test.ts src/ui/uiDecisions.test.ts src/storage/textImport.test.ts
src/ui/dayWrites.test.ts src/ui/saveFailures.test.ts src/ui/uiLogicPlacement.test.ts`.

- [ ] T008 [US2] `looksLikeCycleText` — в домен (research R5).
  - Характеризация уже есть: `src/storage/textImport.test.ts:36-37`.
  - Перенести `export const looksLikeCycleText = (text: string) => /period start date:/i.test(text);`
    вместе с JSDoc из `src/storage/textImport.ts:26-27` в `src/domain/cycleText.ts` (после типов, перед
    `CYCLE_RE`). Из `textImport.ts` удалить.
  - В `src/storage/textImport.test.ts` поменять **только импорт**: `looksLikeCycleText` — из
    `'../domain/cycleText'`, остальные имена — по-прежнему из `'./textImport'`.
  - `BackupSection.tsx` временно импортирует `looksLikeCycleText` из `../../domain/cycleText`, до T010.
  - `npm test`, `npm run build`; коммит «019: looksLikeCycleText — в домен, к разбору выгрузки».
- [ ] T009 [P] [US2] Вид импортируемого файла (FR-005; контракт `importFile.ts`; data-model
  «ImportFileKind»).
  - Тест первым: новый `src/domain/importFile.test.ts`, `it.each` по таблице контракта.
    - `'backup'`: `'{"a":1}'`, `'  \n\t{'`, `String.fromCharCode(0xfeff) + '{'`,
      `'{ "x": "Period start date: 2017-12-23" }'`;
    - `'cycle-text'`: `'cycle 1\nPeriod start date: 2017-12-23'`, `'PERIOD START DATE:'`,
      `'  period start date: x'`;
    - `'unknown'`: `''`, `'   '`, `'hello'`, `'[1,2]'`.

    Прогнать — падает: модуля нет.
  - Код: новый `src/domain/importFile.ts` с `export type ImportFileKind = 'backup' | 'cycle-text' |
    'unknown'` и функцией `importFileKind(text)`:
    `if (text.trimStart().startsWith('{')) return 'backup'; return looksLikeCycleText(text) ?
    'cycle-text' : 'unknown';`. Импорт `looksLikeCycleText` из `./cycleText`. JSDoc со ссылкой на 008 и
    009 FR-006.
  - `npm test`, `npm run build`; коммит вместе с T010.
- [ ] T010 [US2] `BackupSection` — через `importFileKind` (FR-005).
  - Поиск, тест первым: новый `it` в `uiLogicPlacement.test.ts` — `BackupSection.tsx` содержит
    `importFileKind(`, `pluralRu(`, `formatDateNumeric(` и не содержит `startsWith('{')` и
    `looksLikeCycleText`; в `src/**` одно определение `looksLikeCycleText =`, в
    `src/domain/cycleText.ts`. Прогнать — падает.
  - Код `readFile`, после `const text = await file.text();`:
    ```
    const kind = importFileKind(text);
    if (kind === 'cycle-text') { …прежняя ветка planTextImport…; return; }
    if (kind === 'unknown') { setMessage({ text: 'Файл не распознан', error: true }); return; }
    ```
    Дальше — прежняя ветка резервной копии с комментарием 009 FR-005. Импорт `looksLikeCycleText`
    убрать.
  - Проверить: `uiDecisions.test.ts` и `exportData.test.ts` зелёные. `npm test`, `npm run build`;
    коммит «019: вид импортируемого файла — чистая функция».
- [ ] T011 [P] [US2] Переходы «Самочувствия» (FR-006; контракт `symptomSelection.ts`; data-model
  «SymptomSelection»).
  - Тест первым: новый `src/domain/symptomSelection.test.ts`. Вход замораживать
    (`Object.freeze` у объекта, массива и `intensity`) и проверять, что он не изменился. Случаи:
    - `initialSymptomSelection(undefined, true|false)` → `{ symptoms: [], intensity: {} }`;
    - с `showIntensity: true` у записи `{ symptoms: ['headache', 'nausea'], intensity: { headache:
      'severe', cramps: 'mild' } }` → `intensity: { headache: 'severe', nausea: 'moderate' }`
      (степень неотмеченного `cramps` отброшена);
    - с `showIntensity: false` → `intensity` — та же запись `{ headache: 'severe', cramps: 'mild' }`;
    - `toggleSymptom` добавляет в конец с `'moderate'` при `true` и без степени при `false`;
    - снятие убирает пункт и ключ степени, остальные целы; снятие пункта без степени — то же;
    - `setSymptomIntensity` ставит степень, повторный вызов с той же степенью её не снимает,
      `symptoms` не меняется.

    Прогнать — падает: модуля нет.
  - Код: новый `src/domain/symptomSelection.ts` — `SymptomSelection`, `initialSymptomSelection`,
    `toggleSymptom`, `setSymptomIntensity` по data-model. Импорты `DEFAULT_INTENSITY`,
    `withDefaultIntensity` из `./dayEntry`, типы из `./types`. Комментарии со ссылками 009 US4 сц. 3 и
    012 FR-006 переносятся из `SymptomPicker.tsx`.
  - `npm test`, `npm run build`; коммит вместе с T012.
- [ ] T012 [US2] `SymptomPicker` — через переходы (FR-006; research R6).
  - Поиск, тест первым: новый `it` в `uiLogicPlacement.test.ts` — `SymptomPicker.tsx` содержит
    `initialSymptomSelection(`, `toggleSymptom(`, `setSymptomIntensity(` и не содержит
    `DEFAULT_INTENSITY` и `withDefaultIntensity`. Прогнать — падает.
  - Код:
    - `const [selection, setSelection] = useState<SymptomSelection>({ symptoms: [], intensity: {} })`;
    - в эффекте открытия — `setSelection(initialSymptomSelection(entry, showIntensity))`, `saveError.reset()`
      и зависимости остаются;
    - `toggle = (id) => setSelection((cur) => toggleSymptom(cur, id, showIntensity))`;
    - `setLevel = (id, level) => setSelection((cur) => setSymptomIntensity(cur, id, level))`;
    - `save` → `updateDayEntry(date, { symptoms: selection.symptoms, intensity: selection.intensity })`;
    - в разметке `symptoms` → `selection.symptoms`, `levels[s.id]` → `selection.intensity[s.id]`.

    Тип `Levels` и импорты `DEFAULT_INTENSITY`, `withDefaultIntensity` убрать. Разметку не трогать.
  - Проверить: `uiDecisions.test.ts`, `dayWrites.test.ts`, `saveFailures.test.ts`, `normalPath.test.ts`
    зелёные. `npm test`, `npm run build`; коммит «019: лист «Самочувствие» — переходы в домене».
- [ ] T013 [P] [US2] Действие напоминаний (FR-007; контракт `reminderToggle.ts`; data-model
  «ReminderToggleAction»).
  - Тест первым: новый `src/ui/components/reminderToggle.test.ts` (окружение `node`).
    - Все 8 сочетаний трёх флагов × `subscribed` ∈ {`false`, `true`} × `permission` ∈ {`'granted'`,
      `'default'`, `'denied'`, `'unsupported'`}.
    - Ожидание по явным спискам: все три `false` → `'unsubscribe'` (16 случаев); хотя бы один `true` и
      `subscribed: false` → `'subscribe'` для `granted`, `default`, `unsupported`, а для `denied` —
      `'none'`; хотя бы один `true` и `subscribed: true` → `'none'`.
    - Прогнать — падает: модуля нет.
  - Код: новый `src/ui/components/reminderToggle.ts`:
    - `import type { Settings } from '../../domain/types'`;
    - `import type { notificationPermission } from '../../push/subscribe'`;
    - `export type ReminderToggleAction = 'unsubscribe' | 'subscribe' | 'none'`;
    - `export function reminderToggleAction(next: Pick<Settings, 'remindPeriod' | 'remindOvulation' |
      'remindMissedPeriod'>, subscribed: boolean, permission: ReturnType<typeof notificationPermission>):
      ReminderToggleAction` — правило из `RemindersSection.tsx:39-40`, JSDoc со ссылкой на 007 FR-008.
  - `npm test`, `npm run build`; коммит вместе с T014.
- [ ] T014 [US2] `RemindersSection` — через `reminderToggleAction` (FR-007; research R7).
  - Поиск, тест первым: новый `it` в `uiLogicPlacement.test.ts` — `RemindersSection.tsx` содержит
    `reminderToggleAction(` и не содержит `!next.remindPeriod`. Прогнать — падает.
  - Код `toggle`:
    ```
    // Настройка не сохранилась — сообщение в карточке, подписку не трогаем (014).
    if (!(await saveError.save(() => updateSettings(patch)))) return;
    const action = reminderToggleAction({ ...settings, ...patch }, subscribed, permission);
    if (action === 'unsubscribe') await disableReminders();
    else if (action === 'subscribe') await enable();
    ```
  - Проверить: `uiDecisions.test.ts`, `saveFailures.test.ts`, `toggleMarkup.test.ts` зелёные. `npm test`,
    `npm run build`; коммит «019: действие переключателя напоминаний — чистая функция».

**Checkpoint**: US2 готова — три решения покрыты тестами функций, компоненты их вызывают.

---

## Phase 5: User Story 3 — переключатель одним компонентом (P2)

**Goal**: `Toggle` с прежней разметкой; десять мест используют его.

**Independent Test**: `npx vitest run src/ui/components/Toggle.test.ts src/ui/toggleMarkup.test.ts
src/ui/normalPath.test.ts src/ui/saveFailures.test.ts src/ui/uiLogicPlacement.test.ts`.

- [ ] T015 [US3] Компонент `Toggle` (FR-009, FR-011; research R2; контракт `Toggle.tsx`).
  - Тест первым: новый `src/ui/components/Toggle.test.ts` (happy-dom).
    - `renderToStaticMarkup(createElement(Toggle, …))` `toBe` строкам таблицы контракта для четырёх
      вариантов: без подсказки и включён; со ссылкой на пояснение и выключен; с подсказкой и выключен;
      с подсказкой, недоступен и включён (`disabled: true`, `checked: true`, подсказка
      `PERIOD_REMINDER.body`). Строки первых трёх — те же литералы, что в `toggleMarkup.test.ts`.
    - `disabled: false` и `describedBy: undefined` дают ту же строку, что без них.
    - DOM: `mount`, клик по `input` выключенного → `onChange(true)`; включённого → `onChange(false)`;
      без `hint` — нет `.toggle__hint`.
    - Прогнать — падает: модуля нет.
  - Код: новый `src/ui/components/Toggle.tsx` по research R2. Свойства `input` строго в порядке `type`,
    `role`, `checked`, `disabled`, `aria-describedby`, `onChange`; подсказка — `{hint !== undefined &&
    <span className="t-small toggle__hint">{hint}</span>}`. JSDoc: «Переключатель дизайн-системы
    (`docs/design/design.md`, «Компоненты»): строка 52 с подписью и необязательной подсказкой».
  - `npm test`, `npm run build`; коммит «019: компонент Toggle с прежней разметкой».
- [ ] T016 [US3] `SettingsScreen` — 7 × `Toggle` (FR-010).
  - Заменить каждый `<label className="toggle">…</label>` в `src/ui/screens/SettingsScreen.tsx` на
    `<Toggle label=… [hint=…] checked={settings.X} [describedBy="ovulation-mode-hint"] onChange={(v) =>
    update|updateEntries({ X: v })} />`. Карточку обработчика (`update` или `updateEntries`), условия
    показа (`settings.showWellbeing && …`) и порядок элементов сохранить.
  - Проверить: `toggleMarkup.test.ts` (SSR (1) и (2)), `normalPath.test.ts`, `saveFailures.test.ts`
    зелёные. `npm test`, `npm run build`; коммит вместе с T017.
- [ ] T017 [US3] `RemindersSection` — 3 × `Toggle` (FR-010).
  - Поиск, тест первым: новый `it` в `uiLogicPlacement.test.ts`. Прогнать до правки — падает.
    - в `src/ui` строки `role="switch"` и `className="toggle"` есть только в
      `src/ui/components/Toggle.tsx`;
    - `<Toggle` — ровно 7 раз в `SettingsScreen.tsx` и 3 раза в `RemindersSection.tsx`.
  - Код: три `label` → `<Toggle label=… hint={PERIOD_REMINDER.body | OVULATION_REMINDER.body | 'Придёт
    на 3-й день…'} checked={settings.X} disabled={busy} onChange={(v) => toggle({ X: v })} />`.
  - Проверить: `toggleMarkup.test.ts` (все части, включая inline-снимки DOM), `uiDecisions.test.ts`,
    `saveFailures.test.ts`, `normalPath.test.ts` зелёные. `npm test`, `npm run build`; коммит «019:
    переключатели «Настроек» и «Напоминаний» — компонент Toggle».
- [ ] T018 [US3] `docs/design/design.md`, таблица «Компоненты»: в строке «Переключатель» ячейку классов
  `` `toggle` `` заменить на `` `Toggle` (`toggle`) ``, как у `` `BottomSheet` (`sheet`) ``. Вид, классы и
  токены не менять (research R12). Коммит «019: design.md — компонент Toggle».

**Checkpoint**: US3 готова — разметка переключателя существует в одном файле.

---

## Phase 6: Polish & проверки

- [ ] T019 Проверки шага (quickstart.md, разделы 1–5):
  - `npm test`: тестов ≥ 1121, файлов = 60 + 9;
  - `npm run build`;
  - `git diff refactoring...HEAD --stat -- "*.test.ts" "*.snap"`: из существующих изменён только
    `src/storage/textImport.test.ts`, одна строка импорта. `ForecastInfo.test.ts`,
    `design-system.test.ts`, `theme.test.ts`, `normalPath.test.ts.snap` не изменены;
  - `git grep` из quickstart, раздел 4;
  - кириллица и BOM в `git diff refactoring...HEAD` (`LC_ALL=C.UTF-8 grep -P …`);
  - объём: `git diff refactoring...HEAD --stat` — только файлы из plan.md, «Source Code», и
    `specs/019-ui-logic/`.
- [ ] T020 Критерии готовности файла шага (`docs/refactoring/step-6-ui-logic.md`) отметить по
  результатам T019:
  - тесты новых функций написаны до кода;
  - в `src/ui` нет `date-fns` и своих функций склонения и дат;
  - разметка переключателей посимвольно прежняя;
  - три компонента вызывают чистые функции;
  - `ForecastInfo`, `design-system` и `theme` не изменены;
  - `npm test` и сборка зелёные.

  Попутные находки записать для «Журнала» (в план рефакторинга их вносит шаг 9 «Порядка работы»):
  - `DayCell.tsx` `Number(info.date.slice(8))`;
  - `MonthPager.tsx` `toIndex`;
  - `*.test.tsx` не входят в `include` (шаг 7);
  - всё, что найдётся при реализации.
- [ ] T021 Отметить задачи в `specs/019-ui-logic/tasks.md` выполненными; коммит «019: задачи
  выполнены».

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: характеризация (T002, T003) — до любых правок кода; T004 — коммит.
- **US1 (T005–T007)** после Phase 2. T005 → T006 (оба правят `dates.ts`) → T007.
- **US2 (T008–T014)** после Phase 2. `BackupSection.tsx` правят T005, T007, T008 и T010, поэтому
  T010 — после US1. T009, T011, T013 — новые файлы, их можно писать параллельно, `[P]`. T012 зависит
  от T011, T014 — от T013.
- **US3 (T015–T018)** после Phase 2. T017 правит `RemindersSection.tsx` после T014. T016 и T017 —
  после T015.
- **Polish (T019–T021)** — после всех историй.

Порядок для одного исполнителя: T001 → T002, T003 → T004 → T005 → T006 → T007 → T008 → T009 →
T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021.

## Parallel Examples

- Phase 2: `toggleMarkup.test.ts` (T002) и `uiDecisions.test.ts` (T003) — разные файлы.
- US2: доменные тесты и модули `importFile` (T009), `symptomSelection` (T011) и `reminderToggle`
  (T013) пишутся независимо. Подключение к компонентам (T010, T012, T014) — после каждого из них.

## Implementation Strategy

- **MVP** — US1: дубли склонения и дат устранены, `src/ui` без `date-fns`; самостоятельная ценность и
  проверка.
- Затем US2 (решения в чистых функциях) и US3 (`Toggle`).
- После каждой истории — `npm test`, `npm run build` и характеризационные тесты T002/T003 зелёные.
- После T021 — шаги 7–10 «Порядка работы над шагом» в `docs/refactoring-roadmap.md`: проверки, слияние
  в `refactoring`, план, отчёт. Без `git push` и деплоя.
