---

description: "Task list for feature 014-render-failure"
---

# Tasks: Сбой не оставляет пустой экран

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ui.md](./contracts/ui.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV, `docs/refactoring-roadmap.md` п. 5) — новый модуль: сначала тест,
он должен упасть; перенос/изменение существующего поведения — сначала характеризационный тест, зелёный до
и после. Существующие тесты не меняются (FR-018). UTF-8 без BOM; файлы — только Edit/Write; каждый коммит
проходит `npm test` и `npm run build` (из PowerShell).

**Тестовая обвязка UI** (research R1): первая строка файла — `// @vitest-environment happy-dom`; затем
`import 'fake-indexeddb/auto'`; `globalThis.IS_REACT_ACT_ENVIRONMENT = true`; отрисовка —
`createRoot(container)` внутри `await act(async () => …)`; клики — `el.click()` внутри `act`; после
теста — `root.unmount()`, очистка таблиц `db.periods`, `db.days`, `db.kv` и `vi.restoreAllMocks()`.
Отказ записи моделируется подменой метода таблицы Dexie (`vi.spyOn(db.days, 'put').mockRejectedValue(new
Error('QuotaExceededError'))`, аналогично `db.kv.put`, `db.periods.bulkPut`); после отказа подмена
снимается и проверяется, что данные в базе прежние. `console.error` в тестах сбоев — `vi.spyOn(...)
.mockImplementation(() => {})` с проверкой вызова.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US4 из spec.md

---

## Phase 1: Setup

- [ ] T001 Dev-зависимость `happy-dom@^21.0.4` в `package.json` и `package-lock.json` (`npm install -D happy-dom@^21.0.4`, уже установлена при исследовании); `vitest.config.ts` не менять; `npm test` — по-прежнему 584 теста, `npm run build` зелёный

---

## Phase 2: Foundational (блокирует все истории)

- [ ] T002 `docs/design/design.md`, раздел «Дизайн-система» → «Компоненты»: строки «Аварийный экран» (`card settings-card`: заголовок `t-card-title` «Что-то пошло не так», текст `t-body`, `btn btn--primary` «Экспорт данных», `btn` «Перезагрузить», при неудаче экспорта — `notice notice--error` «Не удалось создать резервную копию»; на месте экрана вкладки, навигация остаётся; при сбое оболочки — на всю страницу без навигации) и «Ошибка сохранения» (`notice notice--error`, `role="alert"`, «Не удалось сохранить. Попробуйте ещё раз.»; лист не закрывается, выбранное не сбрасывается); подраздел с таблицей мест сообщения из `specs/014-render-failure/contracts/ui.md`; явно — новых классов и токенов нет
- [ ] T003 [P] Failing test `src/ui/attempt.test.ts` (окружение `node`): `attempt('save', async () => {})` → `true`, `console.error` не вызван; `attempt('save', () => Promise.reject(err))` → `false`, `console.error` вызван с `'save failed'` и `err`; синхронный `throw` внутри действия → `false`
- [ ] T004 `src/ui/attempt.ts`: `export async function attempt(what: string, action: () => Promise<unknown>): Promise<boolean>` — `try { await action(); return true } catch (e) { console.error(\`${what} failed\`, e); return false }` — до прохождения T003

**Checkpoint**: коммит «014: дизайн аварийного экрана и ошибки сохранения; общий приём attempt; happy-dom для тестов UI» (T001–T004)

---

## Phase 3: User Story 1 — аварийный экран вместо пустого (P1) 🎯 MVP

**Goal**: исключение при отрисовке экрана вкладки или оболочки показывает аварийную карточку; навигация работает.

**Independent Test**: `src/ui/App.test.ts` — упавшая вкладка показывает карточку и навигацию, другие вкладки открываются.

- [ ] T005 [P] [US1] Failing test `src/ui/components/ErrorBoundary.test.ts`: без сбоя контейнер содержит ровно разметку ребёнка (`container.innerHTML === '<p>ok</p>'` — граница не добавляет узлов); ребёнок бросает → показан `fallback`; `console.error` вызван с брошенной ошибкой (React 19 `onCaughtError` по умолчанию, research R2)
- [ ] T006 [P] [US1] Failing test `src/ui/components/EmergencyScreen.test.ts`: разметка `EmergencyScreen` — по `contracts/ui.md` (секция `card settings-card` с `aria-labelledby="emergency-title"`, `h1#emergency-title.t-card-title.settings-card__title` «Что-то пошло не так», `p.t-body.settings-card__text` с текстом из FR-005, затем `button.btn.btn--primary` «Экспорт данных», `button.btn` «Перезагрузить»; сообщения об ошибке нет); «Перезагрузить» вызывает `location.reload` (подмена `vi.spyOn(location, 'reload')` или `vi.stubGlobal('location', …)`); «Экспорт данных» вызывает `exportData` (`vi.mock('./share', …)` с частичной подменой); `EmergencyPage` — `div.app > main.app__screen > карточка`, без `nav.tabbar`
- [ ] T007 [P] [US1] Failing test `src/ui/App.test.ts`: `vi.mock` экранов — `./screens/CalendarScreen` (`<p>calendar</p>`), `./screens/SettingsScreen` (`<p>settings</p>`), `./screens/StatsScreen` (бросает и считает вызовы), `./components/UpdateBanner` (`null`); `location.hash = ''`; сценарии: обычный путь — `main.app__screen` содержит ровно `<p>calendar</p>`; нажатие «Статистика» → в `main` аварийная карточка «Что-то пошло не так», `nav.tabbar` с тремя вкладками, у «Статистика» `aria-current="page"`; нажатие «Календарь» → `<p>calendar</p>`; снова «Статистика» → экран вызван ещё раз (повторная попытка), снова карточка
- [ ] T008 [US1] `src/ui/components/ErrorBoundary.tsx`: класс `ErrorBoundary` с пропсами `{ fallback: ReactNode; children: ReactNode }`, состояние `{ failed: boolean }`, `static getDerivedStateFromError() { return { failed: true } }`, `render` — `failed ? fallback : children`; без `componentDidCatch` (логирует React) — до прохождения T005
- [ ] T009 [US1] `src/ui/components/share.ts`: `export const exportData = () => attempt('export', async () => shareOrDownload(await exportBackup()))` (импорт `exportBackup` из `../../storage/backup`, `attempt` из `../attempt`); `BackupSection` пока не трогать
- [ ] T010 [US1] `src/ui/components/EmergencyScreen.tsx`: `EmergencyScreen` (разметка по `contracts/ui.md`; «Экспорт данных» → `void exportData()`; «Перезагрузить» → `location.reload()`) и `EmergencyPage` (`<div className="app"><main className="app__screen"><EmergencyScreen /></main></div>`) — до прохождения T006
- [ ] T011 [US1] `src/ui/App.tsx`: `<main className="app__screen"><ErrorBoundary key={tab} fallback={<EmergencyScreen />}><Screen /></ErrorBoundary></main>`; `src/main.tsx`: `<StrictMode><ErrorBoundary fallback={<EmergencyPage />}><App /></ErrorBoundary></StrictMode>` — до прохождения T007

**Checkpoint**: коммит «014: граница ошибок и аварийный экран» (T005–T011)

---

## Phase 4: User Story 2 — ошибка чтения базы видна (P1)

**Goal**: ошибка реактивного запроса ведёт к аварийному экрану, обычный путь прежний.

**Independent Test**: `src/hooks/useLiveQuery.test.ts` — отклонённый запрос внутри `ErrorBoundary` с `EmergencyScreen` показывает карточку.

- [ ] T012 [US2] Характеризационный тест `src/hooks/useLiveQuery.test.ts` (happy-dom + fake-indexeddb; зелёный до изменения хука): пробный компонент `useLiveQuery(getSettings, [])` рисует `null`, пока значение `undefined`, затем значение; после `updateSettings({ defaultCycleLength: 30 })` — новое значение; при смене `deps` (запрос `getDayEntry(date)` с другой датой) прежнее значение держится до прихода нового
- [ ] T013 [US2] Failing test в `src/hooks/useLiveQuery.test.ts`: запрос `() => Promise.reject(err)` внутри `<ErrorBoundary fallback={<EmergencyScreen />}>` → показана карточка «Что-то пошло не так»; `console.error` вызван с `'liveQuery failed'` и `err`
- [ ] T014 [US2] `src/hooks/useLiveQuery.ts`: состояние `{ value?: T; error?: unknown; failed: boolean }` (или эквивалент), `next` → `{ value, failed: false }`, `error` → прежний `console.error('liveQuery failed', err)` и `{ failed: true, error }`; при отрисовке `if (failed) throw error`; сигнатура и возвращаемый тип `T | undefined` прежние; импорты — только React и Dexie — до прохождения T013 при зелёном T012

**Checkpoint**: коммит «014: useLiveQuery передаёт ошибку границе» (T012–T014)

---

## Phase 5: User Story 3 — резервная копия с аварийного экрана (P1)

**Goal**: «Экспорт данных» отдаёт тот же файл, что «Экспорт» в Настройках; неудача видна в обоих местах.

**Independent Test**: `src/ui/components/exportData.test.ts` — файлы с аварийного экрана и из «Резервной копии» совпадают; при недоступной базе — сообщение.

- [ ] T015 [US3] Failing test `src/ui/components/exportData.test.ts` (happy-dom + fake-indexeddb): в базе месячные, запись дня и настройки; `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`; `navigator.canShare` отсутствует → путь скачивания; `URL.createObjectURL` подменён и запоминает `File`; клик «Экспорт» в `BackupSection` и клик «Экспорт данных» в `EmergencyScreen` дают файлы с одинаковыми `name` (`cycle-calendar-ГГГГ-ММ-ДД.json`), `type` и текстом; при отказе чтения (`vi.spyOn(db.periods, 'orderBy')` бросает) — в `EmergencyScreen` `p.notice.notice--error[role=alert]` «Не удалось создать резервную копию» после кнопок, в `BackupSection` то же сообщение в месте сообщений карточки; повторная удачная попытка в `EmergencyScreen` убирает сообщение; сообщение «Данные восстановлены» удачный экспорт не стирает (обычный путь прежний)
- [ ] T016 [US3] `src/ui/components/EmergencyScreen.tsx`: состояние `exportFailed`; «Экспорт данных» — сброс `exportFailed`, затем `setExportFailed(!(await exportData()))`; `notice notice--error` с `role="alert"` после кнопок — до прохождения части T015
- [ ] T017 [US3] `src/ui/components/BackupSection.tsx`: «Экспорт» → `exportData()`; при `false` — `setMessage({ text: 'Не удалось создать резервную копию', error: true })`; при успехе стирается только это сообщение об ошибке экспорта (другие сообщения — как раньше) — до прохождения T015

**Checkpoint**: коммит «014: экспорт с аварийного экрана и сообщение о неудачном экспорте» (T015–T017)

---

## Phase 6: User Story 4 — отказ записи виден (P2)

**Goal**: во всех 10 местах из файла шага отказ записи показывает «Не удалось сохранить. Попробуйте ещё раз.»; листы не закрываются, выбранное не теряется.

**Independent Test**: `src/ui/saveFailures.test.ts` — отказ записи в каждом месте даёт сообщение, данные прежние; повторная удачная попытка ведёт себя как раньше.

- [ ] T018 [US4] Failing test `src/ui/components/SaveError.test.ts` (happy-dom): `<SaveError shown={false} />` ничего не рисует; `shown` → `<p class="notice notice--error" role="alert">Не удалось сохранить. Попробуйте ещё раз.</p>`; пробный компонент с `useSaveError()`: `save(() => Promise.reject(err))` → `false`, `failed === true`, `console.error('save failed', err)`; `save(async () => {})` → `true`, `failed === false`; `reset()` → `failed === false`
- [ ] T019 [US4] `src/ui/components/SaveError.tsx`: `export const SAVE_ERROR_TEXT`; `export function useSaveError(): { failed: boolean; save: (write: () => Promise<unknown>) => Promise<boolean>; reset: () => void }` (`save` — `setFailed(false)`, `ok = await attempt('save', write)`, `if (!ok) setFailed(true)`, `return ok`); `export function SaveError({ shown }: { shown: boolean })` — до прохождения T018

**Checkpoint**: коммит «014: общий приём ошибки сохранения — useSaveError и SaveError» (T018–T019)

- [ ] T020 [US4] Failing tests `src/ui/saveFailures.test.ts`, листы дня (отказ `db.days.put`/`db.periods.bulkPut`): `MoodPicker` — сообщение над «Готово», `dialog.open === true`, `onClose` не вызван, отмеченные чипы `aria-pressed="true"` остались, запись в базе прежняя; повтор после снятия подмены — `onClose` вызван, сообщения нет; повторное открытие листа — сообщения нет; `SymptomPicker` — то же (пункты и степени остались); `NoteEditor` — над «Сохранить», текст в поле остался; подтверждение удаления — над «Удалить»; «Отмена» в подтверждении убирает сообщение; `DayDialog` (через `DaySheets` с `DayContext` из `buildForecast`) — отказ «Начало месячных» → сообщение под кнопками месячных, диалог открыт, месячные в базе прежние; отказ «Отметить секс» → то же место; подтверждение «Удалить месячные?» → над «Удалить»; доменная ошибка (например, `no-open-period`) по-прежнему показывает свой текст
- [ ] T021 [US4] Листы: `src/ui/components/MoodPicker.tsx`, `SymptomPicker.tsx` — `useSaveError`, `reset()` в эффекте открытия, `if (await save(() => saveDayEntry(...))) onClose()`, `<SaveError shown={failed} />` над «Готово»; `NoteEditor.tsx` — то же для `persist`, сообщение над «Сохранить» и над «Удалить», `reset()` при открытии и при входе/выходе из подтверждения; `DayDialog.tsx` — `run`: при `res.ok` сброс доменной ошибки и `if (await save(() => savePeriods(res.value))) close()`; отметка секса — `if (await save(onToggleSex)) close()`; `<SaveError>` сразу после доменного сообщения и над «Удалить» в подтверждении; `close()` и смена `confirming` вызывают `reset()`; `DaySheets.tsx` не менять — до прохождения T020

**Checkpoint**: коммит «014: ошибка сохранения в листах дня» (T020–T021)

- [ ] T022 [US4] Failing tests в `src/ui/saveFailures.test.ts`, вне листов (отказ `db.kv.put`): `SettingsScreen` — счётчик «Длина цикла по умолчанию: больше» → сообщение последним элементом карточки «Цикл», значение прежнее; переключатель «Самочувствие» → сообщение в карточке «Записи дня», переключатель не включён; `RemindersSection` (`vi.mock('../push/subscribe')`: настроено, поддерживается, standalone, разрешение `granted`; `vi.mock('../push/sync')`) — переключатель «За 2 дня до месячных» → сообщение последним элементом карточки «Напоминания», `disableReminders`/`enableReminders` не вызваны; `VersionTapper` — 7 нажатий → сообщение под строкой версии, тост не показан, режим разработчика прежний; `FirstPeriodHint` — крестик → сообщение отдельным блоком сразу после `section.hint`, флаг в базе прежний; удачная повторная попытка в каждом месте убирает сообщение
- [ ] T023 [US4] Вне листов: `src/ui/screens/SettingsScreen.tsx` — два `useSaveError()` до раннего `return` (карточки «Цикл» и «Записи дня»), `update` каждой карточки — `void save(() => updateSettings(patch))`, `<SaveError>` последним элементом карточки; `src/ui/components/RemindersSection.tsx` — `toggle`: `if (!(await save(() => updateSettings(patch)))) return;`, остальное как было, `<SaveError>` после `{body}`; `VersionTapper.tsx` — `if (!(await save(() => setDevMode(!devMode)))) return;` перед тостом, `<SaveError>` между кнопкой версии и тостом; `FirstPeriodHint.tsx` — фрагмент `<section className="hint">…</section>{failed && <SaveError shown />}` (или `<SaveError shown={failed} />` после секции), крестик — `void save(dismissFirstPeriodHint)` — до прохождения T022

**Checkpoint**: коммит «014: ошибка сохранения в Настройках, подсказке и строке версии» (T022–T023)

---

## Phase 7: Polish & проверки

- [ ] T024 Визуальная проверка (вне репозитория): временная страница предпросмотра в корне проекта (не коммитить, удалить после) с `EmergencyScreen` на фоне `.app__screen` и листом с `SaveError`; `npm run dev`; снимки headless Edge 390×844 в светлой и тёмной теме (`--force-dark-mode` / `--blink-settings=preferredColorScheme=…`) в папку scratchpad; проверить читаемость, кнопки 52 px (≥ 44), отступы `--space-m` в карточке, вид как у карточек Настроек
- [ ] T025 Полная проверка: `npm test` (≥ 584 + новые) и `npm run build`; `git diff refactoring...HEAD --stat` — существующие `*.test.ts` не изменены (только новые файлы тестов); `ForecastInfo.test.ts`, `design-system.test.ts`, `theme.test.ts` зелёные без изменений; `SCHEMA_VERSION` и `this.version(…)` в `src/storage/db.ts`, `src/domain/`, `worker/`, `vitest.config.ts` не тронуты; diff без испорченной кириллицы и BOM; правила слоёв: `src/hooks/useLiveQuery.ts` импортирует только `react` и `dexie`
- [ ] T026 Отметить задачи выполненными в `specs/014-render-failure/tasks.md`; коммит «014: задачи выполнены»

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → истории.
- **US1 (T005–T011)** — после Foundational; MVP.
- **US2 (T012–T014)** — после US1 (тест использует `ErrorBoundary` и `EmergencyScreen`).
- **US3 (T015–T017)** — после US1 (`EmergencyScreen`, `exportData`).
- **US4 (T018–T023)** — после Foundational (`attempt`); от US1–US3 не зависит.
- **Polish (T024–T026)** — после всех историй.

Внутри истории: тест → падает → код → тест зелёный → коммит.

## Parallel Opportunities

- T003 параллельно с T002 (разные файлы).
- US1: T005, T006, T007 — разные файлы тестов, пишутся параллельно; затем T008 → T009 → T010 → T011.
- US4 можно вести параллельно с US2/US3 (другие файлы), но коммиты — последовательно.

## Implementation Strategy

MVP — US1 (аварийный экран при сбое отрисовки): уже закрывает самый опасный случай (нет пути к экспорту).
Затем US2 (ошибка чтения базы — тот же экран), US3 (экспорт проверен и сообщает о неудаче), US4 (отказ
записи). Коммиты — по «Checkpoint» выше; каждый проходит `npm test` и `npm run build`.
