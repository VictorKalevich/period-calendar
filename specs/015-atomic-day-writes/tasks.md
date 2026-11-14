---

description: "Task list for feature 015-atomic-day-writes"
---

# Tasks: Запись дня — точечным изменением в транзакции

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/repository.md](./contracts/repository.md),
[quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV; `docs/refactoring-roadmap.md`, «Общие ограничения», п. 5).
- Новое поведение — сначала тест, и его падение проверяется до кода.
- Перед изменением существующего поведения — характеризационный тест, зелёный до и после.
- Существующие файлы тестов и снимки не меняются (FR-011, FR-014); новые тесты — только в новых файлах
  (research R7).

Файлы — UTF-8 без BOM, правка только Edit/Write. Каждый коммит проходит `npm test` и `npm run build`
(из PowerShell). Тест и код одной задачи идут в одном коммите: красный коммит не прошёл бы `npm test`.

**Обвязка тестов**:
- **Хранилище** (`node`): `import 'fake-indexeddb/auto'`; `beforeEach` — `await db.delete(); await db.open();`
  как в `src/storage/repository.test.ts`.
- **UI** (happy-dom): первая строка — `// @vitest-environment happy-dom`, затем `import 'fake-indexeddb/auto'`;
  `mount`, `click`, `settle`, `waitUntil`, `button`, `unmountAll` из `src/ui/testing.ts`; `afterEach` —
  `unmountAll(); vi.restoreAllMocks();`.
- Записи дня в тестах — через `{ ...emptyDayEntry(d), ...поля }` и `saveDayEntry` (как в существующих тестах).
- Подписи кнопок — из `src/domain/catalog.ts` (`SYMPTOMS`, `MOODS`). Например, «Радостная» (`joyful`),
  «Спокойная» (`calm`), «Головная боль» (`headache`), «Тошнота».

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US4 из spec.md

---

## Phase 1: Setup

- [ ] T001 Базовая линия на ветке `015-atomic-day-writes`: `npm test` — 631 тест в 40 файлах, `npm run build` зелёный (записано при подготовке шага; повторить, если ветка менялась)

---

## Phase 2: Foundational — характеризация обычного пути (US4, до любых правок кода)

**Purpose**: зафиксировать поведение листов и отметки секса на обычном пути до перевода на `updateDayEntry`
(FR-013, US4).

- [ ] T002 Характеризационные тесты в новом файле `src/ui/dayWrites.test.ts`, `describe('запись дня из листов — как раньше')`. День `DAY = '2026-11-10'`, `TODAY = '2026-11-14'`; контекст диалога — как `ctxFor([])` в `src/ui/saveFailures.test.ts` (все записи дня включены, `showIntensity: true`). В каждом сценарии запись сначала сохраняется в базе через `saveDayEntry`, и эта же запись передаётся в `entry`. Зелёные до и после правок:
  1. `DaySheets` (`which: 'day'`), запись `{ note: 'n' }`: нажать «Отметить секс» → в базе `{ sex: true, note: 'n' }`.
  2. `DaySheets`, запись `{ sex: true, moods: ['calm'] }`: нажать «Убрать отметку секса» → в базе `{ moods: ['calm'] }`, `sex: false`.
  3. `DaySheets`, записи нет, `entry: undefined`: два нажатия «Отметить секс» в одном `act` без ожидания между ними, затем `settle()` → в базе `sex: true` (research R2).
  4. `MoodPicker`, запись `{ symptoms: ['headache'], note: 'n' }`: нажать «Спокойная», «Готово» → в базе `{ symptoms: ['headache'], moods: ['calm'], note: 'n' }`.
  5. `SymptomPicker` (`showIntensity: true`), запись `{ moods: ['calm'], note: 'n' }`: нажать «Головная боль», «Готово» → в базе `{ symptoms: ['headache'], intensity: { headache: 'moderate' }, moods: ['calm'], note: 'n' }`.
  6. `NoteEditor`, запись `{ moods: ['calm'], note: 'старая' }`: ввести «новая», «Сохранить» → `{ moods: ['calm'], note: 'новая' }`. Ввод текста — как `typeInto` в `saveFailures.test.ts`.
  7. `NoteEditor`, запись `{ note: 'только' }`: корзина «Удалить заметку», «Удалить» → записи дня нет (`getDayEntry` → `undefined`).
  8. В каждом сценарии лист или диалог закрылся: вызван `onClose` или `onChange(null)`.

**Checkpoint**: тесты зелёные на текущем коде; коммит «015: характеризационные тесты записи дня из листов» (T002)

---

## Phase 3: User Story 1 — изменения одного дня не затирают друг друга (P1) 🎯 MVP

**Goal**: изменение записи дня — дата + изменённые поля, применяемые к актуальной записи в одной транзакции;
все четыре места записи передают только своё поле.

**Independent Test**: `src/storage/atomicWrites.test.ts` (`describe('updateDayEntry')`) и
`src/ui/dayWrites.test.ts` (`describe('точечное изменение')`).

- [ ] T003 [P] [US1] Failing tests в новом файле `src/storage/atomicWrites.test.ts`, `describe('updateDayEntry')` (`node`), до кода; дни `D = '2026-10-23'`, `X = '2026-10-24'`, `Y = '2026-10-25'`:
  1. `await Promise.all([updateDayEntry(D, { moods: ['calm'] }), updateDayEntry(D, { note: 'n' })])` → `getDayEntry(D)` равен `{ ...emptyDayEntry(D), moods: ['calm'], note: 'n' }` (SC-001).
  2. То же для `{ sex: true }` и `{ symptoms: ['acne'], intensity: { acne: 'severe' } }`.
  3. Сохранена полная запись D (самочувствие со степенью, настроения, секс, заметка); `updateDayEntry(D, { note: 'новая' })` → изменилась только заметка.
  4. Сохранена запись Y `{ note: 'Y', sex: true }`; у вызывающего устаревший снимок `{ ...Y, note: 'старый' }` (не передаётся). `updateDayEntry(X, { moods: ['calm'] })` → запись Y в базе прежняя; X = `{ ...emptyDayEntry(X), moods: ['calm'] }` (SC-002).
  5. Запись `{ note: 'n' }`; `updateDayEntry(D, { note: '' })` → записи нет. Запись `{ sex: true }`; `updateDayEntry(D, { sex: false })` → записи нет (SC-003).
  6. Записи нет; `updateDayEntry(D, { moods: ['joyful'] })` → `{ ...emptyDayEntry(D), moods: ['joyful'] }`.
  7. Запись старой формы: `db.days.put({ date: D, symptoms: ['acne', 'x'], mood: 'great', note: '  t ' })`; `updateDayEntry(D, { sex: true })` → `{ ...emptyDayEntry(D), symptoms: ['acne'], moods: ['joyful'], sex: true, note: 't' }` (009 FR-003).
  8. `updateDayEntry('2026-02-30', { note: 'x' })` отклоняется; `db.days.count()` → 0.
  9. Сохранена запись `{ note: 'n' }`; `vi.spyOn(db.days, 'put').mockImplementation(() => Promise.reject(new Error('QuotaExceededError')))`; `updateDayEntry(D, { moods: ['calm'] })` отклоняется; после `mockRestore()` запись D прежняя.
  10. Заметка длиннее 1000 символов обрезается до 1000 — правило `saveDayEntry` сохраняется.
- [ ] T004 [US1] `src/storage/repository.ts`, рядом с `saveDayEntry`. До прохождения T003, при зелёных `repository.test.ts` и T002:
  - `export type DayEntryPatch = Partial<Omit<DayEntry, 'date'>>;`
  - `export async function updateDayEntry(date: LocalDate, patch: DayEntryPatch): Promise<void>` — `await db.transaction('rw', db.days, async () => { const current = (await getDayEntry(date)) ?? emptyDayEntry(date); await saveDayEntry({ ...current, ...patch, date }); })`; импорт `emptyDayEntry` из `../domain/dayEntry`;
  - комментарий: по образцу `updateSettings`; изменение накладывается на актуальную запись, чтобы одновременные сохранения не затирали друг друга (research R1);
  - внутри транзакции — только операции Dexie (research R5).

**Checkpoint**: коммит «015: updateDayEntry — изменение записи дня в одной транзакции» (T003–T004)

- [ ] T005 [US1] Failing tests в `src/ui/dayWrites.test.ts`, `describe('точечное изменение')`, до правки компонентов. `DAY = '2026-11-10'`, `OTHER = '2026-11-09'`:
  1. **Запись ещё не пришла на экран** (в базе есть, `entry: undefined`):
     - в базе DAY `{ symptoms: ['headache'], note: 'n', sex: true }`; `MoodPicker` — «Радостная», «Готово» → в базе `{ symptoms: ['headache'], moods: ['joyful'], note: 'n', sex: true }`;
     - аналогично `SymptomPicker` (в базе `{ moods: ['calm'], note: 'n' }`, нажать «Тошнота») и `NoteEditor` (в базе `{ moods: ['calm'] }`, ввести «т», «Сохранить») — остальные поля сохранены;
     - `DaySheets` (в базе `{ note: 'n' }`), «Отметить секс» → `{ note: 'n', sex: true }`.
     Сейчас запись собирается из пустой и затирает поля — тесты красные.
  2. **Запись другого дня в `entry`**: в базе OTHER `{ note: 'other' }`, в листы с `date: DAY` передаётся эта запись:
     - `MoodPicker` — «Радостная», «Готово» → DAY = `{ ...emptyDayEntry(DAY), moods: ['joyful'] }`, OTHER прежний;
     - то же для `SymptomPicker` («Тошнота»);
     - `NoteEditor`: поле показывает «other»; ввести «день», «Сохранить» → DAY = `{ ...emptyDayEntry(DAY), note: 'день' }`, OTHER прежний;
     - `DaySheets`, «Отметить секс» → DAY = `{ ...emptyDayEntry(DAY), sex: true }`, OTHER прежний.
     Сейчас запись уходит в OTHER — тесты красные.
  3. **Поиск по исходникам** (SC-005, FR-008): все `.ts` и `.tsx` в `src/ui` рекурсивно (`readdirSync`/`readFileSync` из `node:fs`, как в `src/domain/isolation.test.ts`), кроме `*.test.ts` и `testing.ts`, не содержат `saveDayEntry`. Сейчас его вызывают 4 файла — тест красный.
- [ ] T006 [US1] Перевод четырёх мест на `updateDayEntry` по таблице `contracts/repository.md` — до прохождения T005 при зелёных T002 и `src/ui/saveFailures.test.ts`, `src/ui/normalPath.test.ts`:
  - `src/ui/components/DaySheets.tsx`: `const toggleSex = () => updateDayEntry(date, { sex: !entry?.sex });` и комментарий: значение — по надписи кнопки, остальные поля берутся из базы в транзакции (009 FR-014, research R2);
  - `src/ui/components/SymptomPicker.tsx`: `updateDayEntry(date, { symptoms, intensity: levels })`;
  - `src/ui/components/MoodPicker.tsx`: `updateDayEntry(date, { moods })`;
  - `src/ui/components/NoteEditor.tsx`: `updateDayEntry(date, { note })`;
  - убрать ставшие лишними импорты `saveDayEntry` и `emptyDayEntry`; комментарии «остальные поля записи сохраняются» уточнить: изменение только своего поля, накладывается на запись в базе;
  - разметку, тексты, обёртки `saveError.save(...)` и `onClose` не менять.

**Checkpoint**: коммит «015: листы дня и отметка секса — точечное изменение записи» (T005–T006)

---

## Phase 4: User Story 2 — изменение уходит в выбранный день (P1)

**Goal**: после смены выбранного дня карточка, диалог и листы не получают запись прежнего дня; `useLiveQuery`
и его тест не меняются (FR-011).

**Independent Test**: `src/ui/screens/CalendarScreen.test.ts`.

- [ ] T007 [US2] Замер мигания «до» (research R4, `quickstart.md` п. 4), до T009. Скрипт CDP в scratchpad, без зависимостей (Node 24, встроенный `WebSocket`; Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe` в headless). Страница — `npm run dev` (Vite, `base: '/period-calendar/'`), окно 390×844, `deviceScaleFactor: 1`. Без `--virtual-time-budget` (замораживает IndexedDB). Шаги:
  1. Записать в IndexedDB `cycle-calendar`, таблица `days`, записи двух соседних прошедших дней текущего месяца (заметки «A» и «B») и перезагрузить.
  2. Через `Runtime.evaluate` нажать ячейку A (`button.day-cell[aria-label^="<день> <месяц>"]`, JS `.click()`) и дождаться `.entry` с «A».
  3. Запустить запись кадров (`requestAnimationFrame`, 300 мс, текст `.entry` или «нет») и нажать ячейку B.
  4. Повторить 20 раз (A↔B). Записать число кадров с текстом прежнего дня и без `.entry` до прихода нового.
- [ ] T008 [US2] Failing test в новом файле `src/ui/screens/CalendarScreen.test.ts` (happy-dom), до T009:
  - **подмены** (`vi.hoisted` для массивов записей):
    - `vi.mock('../../hooks/useToday', () => ({ useToday: () => '2026-11-14' }))`;
    - `vi.mock('../components/MonthPager', …)` — рисует `null` и запоминает последние пропсы (`onSelect`, `getInfo`);
    - `vi.mock('../components/DayCard', …)` — запоминает `{ date: info.date, entry: children.props.entry }` и рисует `null`;
    - `vi.mock('../components/DaySheets', …)` — запоминает `{ date, entry }` и рисует `null`;
  - в базе A = `'2026-11-10'` `{ note: 'A' }`, B = `'2026-11-11'` `{ note: 'B' }`;
  - `mount(createElement(CalendarScreen))`, дождаться пропсов `MonthPager`;
  - в `act` вызвать `onSelect(getInfo(A))`, дождаться записи `DaySheets` с `date === A` и `entry?.note === 'A'`; затем так же для B;
  - проверка: в каждой записи `DayCard` и `DaySheets` либо `entry === undefined`, либо `entry.date === date`; ни одна запись с `date === B` не содержит `entry?.note === 'A'`. Сейчас первая отрисовка после выбора B получает запись A — тест красный.
- [ ] T009 [US2] `src/ui/screens/CalendarScreen.tsx`: `const stored = useLiveQuery(() => (day ? getDayEntry(day) : undefined), [day]);` и `const entry = stored?.date === day ? stored : undefined;`. Комментарий: хук держит прежнее значение до прихода нового (`useLiveQuery.test.ts`), а запись чужой даты не показывается и не передаётся в листы (research R3). `src/hooks/useLiveQuery.ts` и `src/hooks/useLiveQuery.test.ts` не менять. До прохождения T008.
- [ ] T010 [US2] Замер мигания «после» тем же скриптом, что T007. Кадров с переходным состоянием (без `.entry` до прихода нового) не больше, чем кадров с прежней записью «до». Если больше или заметно на глаз — остановиться и спросить пользователя. Цифры «до/после» записать для журнала (T015).

**Checkpoint**: коммит «015: экран «Календарь» — запись только выбранного дня» (T008–T009)

---

## Phase 5: User Story 3 — нормализация месячных при запуске неделима (P2)

**Goal**: чтение, расчёт и запись нормализации — одна транзакция; результат прежний.

**Independent Test**: `src/storage/atomicWrites.test.ts`, `describe('normalizeStoredPeriods — одна транзакция')`;
существующий тест `src/storage/repository.test.ts` (`normalizeStoredPeriods (003 FR-016)`) зелёный без изменений.

- [ ] T011 [US3] Failing test в `src/storage/atomicWrites.test.ts`, `describe('normalizeStoredPeriods — одна транзакция')`, до T012. Сохранены месячные `a` (`2026-10-01`–`2026-10-04`), `b` (`2026-10-05`–`2026-10-07`), `c` (`2026-10-29`, `end: null`), как в `repository.test.ts`. `const p = normalizeStoredPeriods('2026-10-30'); const q = savePeriods([X]);` — без ожидания между вызовами, `X = { id: 'x', start: '2026-09-01', end: '2026-09-05', endEstimated: false }`. `await Promise.all([p, q])` → `getPeriods()` равен `[X]`. Проверить, что тест падает на текущем коде; если не падает — закрепить порядок иначе (research R6) и записать это для журнала.
- [ ] T012 [US3] `src/storage/repository.ts`, `normalizeStoredPeriods`: `return db.transaction('rw', db.periods, db.kv, async () => { const periods = await getPeriods(); const settings = await getSettings(); … ; if (unchanged) return false; await savePeriods(normalized); return true; })`. Последовательные чтения вместо `Promise.all` (research R5); комментарий 003 FR-016 сохранить, добавить: «в одной транзакции — чтобы запись, начатая параллельно, не перемежалась». Сигнатура и `src/main.tsx` не меняются. До прохождения T011 при зелёном `repository.test.ts`.

**Checkpoint**: коммит «015: нормализация месячных при запуске — в одной транзакции» (T011–T012)

---

## Phase 6: Polish & проверки

- [ ] T013 Проверки `quickstart.md`:
  - `npm test` — зелёный, тестов ≥ 631 + новые;
  - `npm run build` — зелёный;
  - `git diff --stat refactoring...HEAD -- "*.test.ts" "*.snap"` — только новые файлы `src/storage/atomicWrites.test.ts`, `src/ui/dayWrites.test.ts`, `src/ui/screens/CalendarScreen.test.ts`;
  - `git grep -n "saveDayEntry" -- src/ui ":!*.test.ts"` — пусто;
  - `git diff refactoring...HEAD` — без испорченной кириллицы и BOM, без изменений вне объёма шага: не меняются `src/hooks`, `src/domain`, `src/push`, `src/storage/db.ts`, `worker/`, `savePeriods`.
- [ ] T014 Отметить задачи `[X]` в `specs/015-atomic-day-writes/tasks.md`; коммит «015: задачи выполнены»
- [ ] T015 Для журнала (`docs/refactoring-roadmap.md` обновляется после слияния, шаг 9 «Порядка работы»): число тестов до → после; отступления — R2 (отметка секса по надписи), R3 (хук не меняется, решение пользователя); замер мигания T007/T010; попутные находки

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: характеризация T002 — до любых правок кода (T004, T006, T009, T012).
- **US1**: T003 → T004 (коммит) → T005 → T006 (коммит). T006 зависит от T004 (`updateDayEntry`).
- **US2**: T007 → T008 → T009 (коммит) → T010. Не зависит от US1 по коду, но идёт после него — так проще
  читать историю коммитов.
- **US3**: T011 → T012 (коммит). Независима от US1 и US2.
- **Polish**: после всех историй.

### Parallel Opportunities

- T002 и T003 — разные файлы, без зависимостей: можно писать параллельно (T003 помечен [P]).
- US3 (T011–T012) можно выполнить в любой момент после T001 — отдельные функция и `describe`.
- Внутри историй задачи последовательны: тест → код в одних и тех же файлах.

### Parallel Example: старт

```text
T002 характеризация листов (src/ui/dayWrites.test.ts)
T003 тесты updateDayEntry (src/storage/atomicWrites.test.ts)
```

## Implementation Strategy

1. **MVP — US1** (T001–T006): одновременные изменения одного дня не теряются, места записи передают только
   своё поле. Уже это закрывает потерю данных и запись в чужой день через снимок.
2. **US2** (T007–T010): экран не передаёт запись прежнего дня — убирает и переходный показ, и чужие
   выделения/надписи в диалоге.
3. **US3** (T011–T012): неделимая нормализация при запуске.
4. **Polish** (T013–T015): проверки и материалы для журнала.
