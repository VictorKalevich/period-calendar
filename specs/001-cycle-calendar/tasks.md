---

description: "Task list for feature 001-cycle-calendar"
---

# Tasks: Календарь цикла

**Input**: Design documents from `/specs/001-cycle-calendar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md,
`docs/design/design.md` (согласованные макеты)

**Tests**: ОБЯЗАТЕЛЬНЫ для `src/domain`, миграций, резервной копии и Web Push-шифрования
(Конституция IV, contracts/domain-api.md). Тест пишется первым и должен упасть до реализации.
UI проверяется вручную по quickstart.md.

**Design**: каждая UI-задача (T019–T022, T027–T031, T040–T045, T049–T050, T057–T058, T071, T075)
выполняется по `docs/design/design.md` — токены, размеры, шрифты, состояния дня, состав экранов — и
сверяется с макетом по завершении задачи, а не только в T076. Для ещё не нарисованных экранов —
собирать из токенов и компонентов макета без новых цветов.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- PWA в корне репозитория: `src/`, `public/`, `index.html`, `vite.config.ts`
- Push-воркер — отдельный пакет: `worker/src/`, `worker/test/`
- Тесты лежат рядом с кодом: `*.test.ts`
- Все даты в домене — `LocalDate` (`YYYY-MM-DD`); «сегодня» передаётся параметром (research.md R1)
- Размеры зон нажатия — 44 CSS px (= 44 pt)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: каркас проекта, который собирается, тестируется и деплоится с первого коммита

- [X] T001 Verify git repo and add `.gitignore` (node_modules, dist, .wrangler, coverage) at repository root
- [X] T002 Create `package.json` with Vite + React 19 + TypeScript (strict), runtime deps `react`, `react-dom`, `dexie@4`, `date-fns@4`; dev deps `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa`, `vitest`, `fake-indexeddb`, `typescript`, `@types/react`, `@types/react-dom`; scripts `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`), `typecheck`
- [X] T003 [P] Create `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `lib: ["ES2022","DOM","WebWorker"]`, `jsx: react-jsx`) and `vitest.config.ts` (environment `node`, include `src/**/*.test.ts`)
- [X] T004 Create `vite.config.ts` with `base: '/period-calendar/'`, `@vitejs/plugin-react`, and `VitePWA({ strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', registerType: 'autoUpdate', manifest: { name: 'Календарь цикла', short_name: 'Цикл', lang: 'ru', display: 'standalone', start_url: '/period-calendar/', scope: '/period-calendar/', theme_color: '#FBF7F5', background_color: '#FBF7F5', icons } })`; precache includes `woff2`
- [X] T005 [P] Create `index.html` (lang `ru`, `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=default`, `theme-color` `#FBF7F5` light / `#1A1620` dark via `media`, `apple-touch-icon`) and placeholder `src/main.tsx` rendering «Календарь цикла»
- [X] T006 [P] Add icons to `public/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180×180) in the palette of `docs/design/design.md`
- [X] T007 Create minimal `src/sw.ts` with Workbox `precacheAndRoute(self.__WB_MANIFEST)` and `cleanupOutdatedCaches()`; register SW in `src/main.tsx` via `virtual:pwa-register`
- [X] T008 Create `.github/workflows/deploy.yml`: on push to `main` → Node 24, `npm ci`, `npm test`, `npm run build` (env `VITE_VAPID_PUBLIC_KEY`, `VITE_PUSH_API_URL` from repo variables), `actions/upload-pages-artifact` (path `dist`), `actions/deploy-pages`; deploy job runs only if tests pass
- [X] T009 Verify `npm test`, `npm run build`, `npm run preview` work and the built app loads offline after first visit (DevTools → Offline)

**Checkpoint**: пустое PWA деплоится на GitHub Pages и устанавливается на экран «Домой»

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: типы домена, работа с датами, хранилище, тема и оболочка приложения — нужны всем историям

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests first

- [X] T010 [P] Write failing tests in `src/domain/dates.test.ts`: `addDaysLD` across month/year boundary (`2026-12-31` + 1 = `2027-01-01`), leap day (`2028-02-28` + 1 = `2028-02-29`), `diffDays` across DST change (`2026-03-29` − `2026-03-28` = 1 in Europe/Moscow and Europe/Berlin via `process.env.TZ`), `toLocalDate`, and `monthGrid(year, month)` — contract case 17: starts on Monday, contains every day of the month, length 35 or 42
- [X] T011 [P] Write failing test `src/domain/isolation.test.ts` that reads every non-test file in `src/domain/` and fails if any imports from `react`, `dexie`, `../storage`, `../ui`, `../push`, or calls `new Date()` / `Date.now()` without arguments
- [X] T012 [P] Write failing tests in `src/storage/db.test.ts` (with `fake-indexeddb/auto`): opening a fresh DB creates tables `periods: 'id, start'`, `days: 'date'`, `kv: 'key'`; `SCHEMA_VERSION === 1`; `getSettings()` returns defaults `{ defaultCycleLength: 28, defaultPeriodLength: 5, remindPeriod: true, remindOvulation: true }` when none stored; periods round-trip `endEstimated`

### Implementation

- [X] T013 [P] Create `src/domain/types.ts`: `LocalDate` branded string, `Period { id: string; start: LocalDate; end: LocalDate | null; endEstimated: boolean }`, `DayEntry { date: LocalDate; symptoms: SymptomId[]; mood: MoodId | null; note: string }`, `Settings { defaultCycleLength: number /* 21…45 */; defaultPeriodLength: number /* 2…10 */; remindPeriod: boolean; remindOvulation: boolean }`, `DEFAULT_SETTINGS`, `Cycle` (incl. `periodEndEstimated`), `PredictedCycle`, `Forecast` (incl. `confidence: 'normal' | 'low'`), `Phase` (`'menstrual' | 'follicular' | 'ovulation' | 'luteal'`) with Russian labels, `DayInfo` (incl. `fertile: 'predicted' | 'past' | null`, `phase: Phase | null`), `DayContext`, `Probability`, `Confidence`, `Result<T>`, `PeriodError` exactly as in contracts/domain-api.md and data-model.md
- [X] T014 [P] Create `src/domain/catalog.ts` with `SymptomId` = `cramps | headache | backache | bloating | breast_tenderness | acne | fatigue | nausea | cravings | insomnia` and `MoodId` = `great | calm | sensitive | irritable | sad | anxious`, plus Russian labels (боль внизу живота, головная боль, боль в спине, вздутие, чувствительность груди, акне, усталость, тошнота, тяга к еде, бессонница; отличное, спокойное, чувствительное, раздражительность, грусть, тревожность)
- [X] T015 Implement `src/domain/dates.ts` (`toLocalDate`, `parseLD`, `addDaysLD`, `diffDays`, `monthGrid`, `formatDayRu` e.g. «23 октября, пятница», `formatMonthRu` e.g. «Октябрь 2026») with date-fns and `ru` locale until T010 passes
- [X] T016 Implement `src/storage/db.ts`: Dexie DB `cycle-calendar`, `SCHEMA_VERSION = 1`, `db.version(1).stores({ periods: 'id, start', days: 'date', kv: 'key' })`; call `navigator.storage?.persist?.()` once on open; migrations registry `src/storage/migrations/index.ts` exporting `migrations: Record<number, (data) => data>` (empty for v1) for reuse by backup import
- [X] T017 Implement `src/storage/repository.ts`: `getPeriods`, `savePeriods(periods)` (replace all in one transaction), `getDayEntry`, `saveDayEntry` (deletes entry if no symptoms, mood null and note empty), `getDayEntries`, `getSettings`, `saveSettings`, `getPushState`, `savePushState` until T012 passes
- [X] T018 Create `src/hooks/useLiveQuery.ts` (wrap Dexie `liveQuery` with `useSyncExternalStore`, no `dexie-react-hooks`) and `src/hooks/useToday.ts` (returns today's `LocalDate`, updates on `visibilitychange` and at local midnight)
- [X] T019 [P] Create `src/ui/theme.css` per `docs/design/design.md`: all colour tokens as CSS custom properties `--bg --surface --ink --muted --line --track --rose --roseText --roseSoft --btnBg --btnInk --violet --violetMid --violetDeep --violetSoft --violetText --gold --goldDeep --goldSoft --sage --sageSoft` with exact light values on `:root` and dark values under `@media (prefers-color-scheme: dark)`; card shadow (light only); radii (cards 24, «Сегодня» 28, pills = half height); `--tap-min: 44px`; spacing (side 20 px, vertical step 14 px); safe-area paddings via `env(safe-area-inset-*)`; download Nunito woff2 (cyrillic + latin subsets, weights 400/600/700/800) into `src/ui/fonts/` together with its SIL OFL licence file `src/ui/fonts/OFL.txt`, and declare `@font-face` for them, fallback `system-ui, sans-serif`; typography scale from the design table
- [X] T020 [P] Write `src/ui/theme.test.ts` that parses `src/ui/theme.css` for both themes and asserts WCAG contrast ≥ 4.5:1 for text pairs used in `docs/design/design.md`: `--ink/--bg`, `--ink/--surface`, `--muted/--surface`, `--muted/--bg`, `--roseText/--surface`, `--roseText/--roseSoft`, `--btnInk/--btnBg`, `--violetText/--violetSoft`, `--ink/--goldSoft`, `--ink/--sageSoft`; any failing pair is reported to the design owner instead of silently changing colours
- [X] T021 Create `src/ui/App.tsx` with bottom navigation per design (background `--surface`, top border 1 px `--line`, paddings 8/12/20, 4 equal tabs with 22 px inline-SVG icon + 12 px label: «Сегодня» (circle with dot), «Календарь» (calendar), «Статистика» (three bars), «Настройки» (two sliders); active `--roseText` 800, others `--muted` 600; each tab ≥ 44 CSS px (= 44 pt)); active tab stored in `location.hash`, **default tab «Календарь»**; placeholder screens in `src/ui/screens/{Today,Calendar,Stats,Settings}Screen.tsx`; mount in `src/main.tsx` and import `theme.css`
- [X] T022 Create `src/ui/components/BottomSheet.tsx` (native `<dialog>` as bottom sheet with `--surface`, radius 24 top corners, swipe-down/backdrop to close, focus trap via `showModal`) for pickers and action menus

**Checkpoint**: тесты T010–T012, T020 зелёные; приложение открывается на «Календаре», 4 вкладки по макету в светлой и тёмной теме

---

## Phase 3: User Story 1 — Отметить месячные и увидеть их в календаре (Priority: P1) 🎯 MVP

**Goal**: календарь месяца с перелистыванием свайпом и кнопками, отметка начала/конца месячных, сплошная розовая заливка, данные сохраняются офлайн

**Independent Test**: отметить начало и конец месячных в текущем и прошлом месяце, закрыть и снова открыть приложение (в авиарежиме) — отметки на месте, дни залиты сплошным розовым (quickstart.md сценарии 1a, 2–4)

**Design input**: `docs/design/design.md` — «Экран „Календарь“» п. 1, 3, 5, 6 и «Состояния дня в календаре»

### Tests for User Story 1 ⚠️ (write first, must FAIL)

- [X] T023 [P] [US1] Write failing tests in `src/domain/periods.test.ts` — contract cases 10–12, 21: `markPeriodStart(periods, day, today, periodLength)` in future → `future-date`; inside existing period → `inside-existing`; new start while previous `end = null` closes previous at `min(start_prev + periodLength − 1, start_new − 1)` with `endEstimated = true`; `markPeriodEnd` before start → `end-before-start`; end later than day 15 from start → `too-long`; no open/containing period → `no-open-period`; `markPeriodEnd` sets `endEstimated = false`; `movePeriodStart` on a day inside a period moves `start` to that day and keeps `end`; `unmarkPeriodDay` on start removes period, on inner day sets `end = day − 1` and `endEstimated = false`; periods never overlap
- [X] T024 [P] [US1] Write failing tests in `src/domain/dayInfo.test.ts` — contract cases 9 (no-forecast part), 13, 23: with `forecast = null` and no periods → `cycleDay = null`, `probability = null`, `period = null`; open period started 4 days ago with `forecast = null`, `defaultPeriodLength = 5` → days ≤ today are `'actual'`, remaining day is `'predicted'`; closed period days are `'actual'`; `isToday`, `hasEntry` set correctly; results identical when run with `process.env.TZ` = `Asia/Tokyo` and `America/Los_Angeles`

### Implementation for User Story 1

- [X] T025 [US1] Implement `src/domain/periods.ts` (`markPeriodStart`, `markPeriodEnd`, `movePeriodStart`, `unmarkPeriodDay`; ids via injected `newId` parameter, default `crypto.randomUUID`) until T023 passes
- [X] T026 [US1] Implement `dayInfo(date, ctx)` in `src/domain/forecast.ts` handling `forecast = null` (actual/predicted period days from periods + `settings.defaultPeriodLength`, cycle day from last period start ≤ date) until T024 passes
- [X] T027 [P] [US1] Create `src/ui/components/DayCell.tsx` per design «Состояния дня»: 40×40 circle inside 44 px row; normal (`--ink`, 600); period actual (fill `--btnBg`, text `--btnInk`, 800); period predicted (2 px dashed `--rose`, text `--roseText`, 700); today (2 px solid `--ink`, 800, combinable); selected (`0 0 0 3px var(--surface), 0 0 0 5px var(--violet)`); entry dot 4–5 px `--muted` under the number; whole cell is a button ≥ 44 CSS px (= 44 pt) with `aria-label` like «12 октября, месячные»
- [X] T028 [P] [US1] Create `src/ui/components/MonthGrid.tsx` per design: `--surface` card radius 24, weekday row «Пн … Вс» (12 px, `--muted`), 7-column grid with row gap 4 from `monthGrid()`, days outside month dimmed, renders `DayCell` with `dayInfo` for each date
- [X] T029 [US1] Create `src/ui/components/MonthPager.tsx` per research.md R2 and design: horizontal container with `scroll-snap-type: x mandatory`, `scroll-snap-stop: always`, one 100%-wide page per month from `min(firstPeriodMonth, currentMonth) − 12` to `currentMonth + 12`; when the user reaches the left edge, prepend 12 more months while preserving scroll position (no jump); only visible ±1 pages render `MonthGrid`, others are empty placeholders; active month via `IntersectionObserver` (threshold 0.6); initial scroll to current month without animation; header: round 44×44 `--surface` buttons «‹» / «›» (`aria-label` «Предыдущий месяц» / «Следующий месяц», `scrollTo({ behavior: 'smooth' })`) and centred title «Октябрь 2026» (24 px, 800, letter-spacing −0.01em)
- [X] T030 [US1] Create `src/ui/components/DayCard.tsx` as the inline «Карточка выбранного дня» from design (calendar screen item 5, not a sheet): title «24 октября · 10-й день» (or «—» before first mark), explanation line 14 px `--muted`, three 44 px pill buttons «Месячные» (text `--roseText`), «Симптомы», «Заметка» (bg `--bg`, border `--line`; latter two disabled placeholders until US3); «Месячные» opens a `BottomSheet` with actions «Начало месячных» / «Конец месячных» / «Убрать отметку» depending on state; on `inside-existing` the sheet offers «Сдвинуть начало на этот день» (`movePeriodStart`) and «Отметить конец» (`markPeriodEnd`); other errors in Russian (e.g. «Нельзя отметить месячные в будущем», «Месячные не могут длиться больше 15 дней»)
- [X] T031 [US1] Implement `src/ui/screens/CalendarScreen.tsx` per design order (header → pager card → day card → disclaimer slot → nav): loads periods, settings, day entries via `useLiveQuery`, builds `DayContext`, renders `MonthPager`; tapping a day selects it (selected ring) and shows `DayCard` below; period actions call domain functions with `periodLength = forecast?.periodLength ?? settings.defaultPeriodLength`, then `savePeriods`; today is selected by default
- [ ] T032 [US1] Manually verify quickstart.md scenarios 1a, 2–4 on iPhone (installed PWA, airplane mode), compare screens with `docs/design/design.md`, and fix issues

**Checkpoint**: MVP — дневник месячных работает офлайн и переживает перезапуск

---

## Phase 4: User Story 2 — Прогноз, фертильное окно, овуляция, вероятность зачатия (Priority: P1)

**Goal**: прогноз месячных/окна/овуляции на 12 месяцев с уровнем уверенности, плашка над календарём, легенда, экран «Сегодня», постоянная пометка о неточности прогноза

**Independent Test**: отметить два цикла с известными датами и сверить прогноз, окно (прогнозное и прошлое), корону, вероятность, фазу и строку низкой уверенности в плашке и на экране «Сегодня» с правилами FR-013–FR-019b (quickstart.md сценарии 3, 5, 5a, 5b, 5c, 14)

**Design input**: `docs/design/design.md` — «Экран „Календарь“» п. 2, 4, 5, 6; «Экран „Сегодня“ (макет C)»; корона

### Tests for User Story 2 ⚠️ (write first, must FAIL)

- [X] T033 [P] [US2] Write failing tests in `src/domain/cycles.test.ts` — contract cases 3–5, 18–20: `buildCycles` derives `length`, `periodLength`, `periodEndEstimated`, `isOutlier` (`length < 15 || length > 60`); `averageCycleLength` of 27, 29, 31 = 29; 28, 28, 90 → 28 (90 excluded); only last 6 of 8 cycles used; `null` with no completed cycles; `averagePeriodLength` uses last 6 periods with `end` and `endEstimated = false` (4, 6 manual + 5 estimated → 5), `null` when none; rounding to nearest whole day; `forecastConfidence` → `low` for 0, 1, 2 completed non-outlier cycles and for 26, 28, 35 (spread 9 > 7), `normal` for 27, 28, 30
- [X] T034 [P] [US2] Write failing tests in `src/domain/forecast.test.ts` — contract cases 1, 2, 6, 7, 8: no periods → `null`; single start `2026-03-01`, default 28 → next period `2026-03-29`, ovulation `2026-03-15`, fertile `2026-03-10…2026-03-15`, medium `2026-03-08`, `2026-03-09`, `2026-03-16`, `confidence = 'low'`; three regular cycles → `confidence = 'normal'`; `cycleLength`/`periodLength` fall back to settings defaults when averages are `null`; start `2026-12-20` → next `2027-01-17`; `2028-02-15` + 28 → `2028-03-14`; delay 3 days → `delayDays = 3` and predicted period starts today; cycles generated for 12 months horizon; completed cycles get retrospective ovulation = actual next start − 14
- [X] T035 [US2] Extend `src/domain/dayInfo.test.ts` (with forecast) and add `todaySummary` tests to `src/domain/forecast.test.ts` (after T034, same file) — contract cases 9, 25–28: probability `high` for fertile window incl. ovulation, `medium` for ovulation −7, −6 and +1, `low` otherwise; actual period overrides predicted; open current period drawn to `start + forecast.periodLength − 1` when forecast exists; `fertile = 'past'` for window days before `today` (completed cycles and the current cycle alike) and `'predicted'` for today and later, `ovulation = true` in both cases; `phase` (FR-019b): start `2026-03-01`, period 5, cycle 28 → `03-01…03-05` menstrual, `03-06…03-14` follicular, `03-15` ovulation, `03-16…03-28` luteal, `03-29` menstrual; menstrual wins over ovulation in a 15-day cycle; `todaySummary` returns `cycleDay`, `probability`, `daysToPeriod` (0 = today), `daysToOvulation` to nearest future ovulation, `delayDays`, `confidence`, `phase` (`null` during a delay and with no marks)

### Implementation for User Story 2

- [X] T036 [US2] Implement `src/domain/cycles.ts` (`buildCycles`, `averageCycleLength`, `averagePeriodLength`, `forecastConfidence`) until T033 passes
- [X] T037 [US2] Implement `buildForecast` in `src/domain/forecast.ts` (incl. `confidence`) until T034 passes
- [X] T038 [US2] Extend `dayInfo` (open period by `forecast.periodLength`, `fertile` predicted/past, `phase`) and implement `todaySummary` (incl. `phase`) in `src/domain/forecast.ts` until T035 passes
- [X] T039 [US2] Create `src/hooks/useForecast.ts` combining `useLiveQuery` (periods, settings, entries) + `useToday` → memoized `{ forecast, ctx }` shared by Calendar and Today screens; switch `CalendarScreen` to it
- [X] T040 [P] [US2] Extend `src/ui/components/DayCell.tsx` per design and FR-003: fertile predicted (fill `--violetSoft`, 2 px dashed `--violetMid`, text `--violetText`, 700); fertile past — any window day before today, incl. the current cycle (fill `--violetSoft` **without** dashed border, text `--violetText`, 600, per design «Фертильное окно (прошлый цикл)»); ovulation (same for past and predicted) (fill `--goldSoft`, 2 px solid `--gold`, text `--ink`, 800, crown 18×18 at top −9 / right −6 using the exact SVG path from design with `--gold` fill and `--goldDeep` stroke); combined states readable in both themes; `aria-label` includes «фертильное окно» / «овуляция» / «прогноз месячных»
- [X] T041 [P] [US2] Create `src/ui/components/StatusBanner.tsx` per design item 2: centred pill exactly «Сегодня N-й день · вероятность низкая|средняя|высокая» — without the word «зачатия» (FR-004) (`--violetSoft` / `--violetText`); when `delayDays > 0` — «Задержка N дн.» (`--roseSoft` / `--roseText`); with no data — invitation «Отметьте начало последних месячных»; when `confidence === 'low'` — line below the pill, 12 px `--muted`: «Прогноз по средним значениям, станет точнее после нескольких циклов» (FR-019a)
- [X] T042 [P] [US2] Create `src/ui/components/Legend.tsx` per design item 4 and FR-005 (13 px `--muted`), 6 items with swatches drawn like the real day states: Месячные (fill `--btnBg`), Месячные — прогноз (dashed `--rose`), Фертильное окно (fill `--violetSoft` + dashed `--violetMid`), Овуляция (crown), Сегодня (ring `--ink`), Есть записи (dot `--muted`)
- [X] T043 [P] [US2] Create `src/ui/components/Disclaimer.tsx` per design item 6: always-visible line 12 px `--muted` «Прогноз ориентировочный и не заменяет контрацепцию» with «Подробнее» opening a `BottomSheet` explaining the calculation rules and the confidence rule
- [X] T044 [US2] Update `src/ui/screens/CalendarScreen.tsx` to the full design order: header → `StatusBanner` (with low-confidence line) → pager card → `Legend` → `DayCard` (adds level pill «Высокая»/«Средняя» `--violetSoft`/`--violetText`, «Низкая» `--sageSoft`/`--ink`) → `Disclaimer` → nav
- [X] T045 [US2] Implement `src/ui/screens/TodayScreen.tsx` per «Макет C» (FR-008a; **not** the default tab): header weekday (14, `--muted`) / date (24, 800); big `--surface` card radius 28 with phase label (14, `--muted`; «Менструальная фаза» / «Фолликулярная фаза» / «Овуляция» / «Лютеиновая фаза» from `todaySummary.phase`, hidden when `null` — delay or no data), «N-й день цикла» (34, 800), pill «из N» (`--roseSoft`/`--roseText`), inner `--violetSoft` block radius 20 with «Вероятность зачатия» and level (30, 800, `--violetText`), low-confidence line and `Disclaimer` under it; week strip Пн–Вс (7 tiles 76 px high, radius 20, 8 px dot by level: period `--rose`, low `--sage`, medium `--violetMid`, high `--violetDeep`; today inverted `--ink`/`--bg`); card «Ближайшие даты» (fertile window, ovulation with crown «через N дн.», period «≈ дата», or «Задержка N дн.»); 52 px pill buttons «Месячные» (`--btnBg`/`--btnInk`), «Симптомы», «Заметка» acting on today
- [ ] T046 [US2] Manually verify quickstart.md scenarios 3, 5, 5a, 5b, 5c, 14 against `docs/design/design.md` and that forecast updates immediately after any mark change (FR-020)

**Checkpoint**: US1 + US2 — полноценный календарь с прогнозом

---

## Phase 5: User Story 3 — Карточка дня: симптомы, настроение, заметка (Priority: P2)

**Goal**: множественный выбор симптомов, одно настроение, заметка до 1000 символов для любого дня

**Independent Test**: выбрать для дня два симптома, настроение и заметку, закрыть и открыть карточку — данные сохранены, у дня в календаре индикатор (quickstart.md сценарий 6)

**Design input**: макетов листа симптомов и редактора заметки ещё нет — собирать из токенов и пилюль `docs/design/design.md` без новых цветов

### Tests for User Story 3 ⚠️

- [X] T047 [P] [US3] Write failing tests in `src/storage/repository.test.ts` (fake-indexeddb): `saveDayEntry` dedupes `symptoms` ("уникальные значения из справочника"), rejects unknown ids, trims `note`, rejects `note` longer than 1000 characters ("0…1000 символов"), deletes the record when symptoms empty, mood null and note empty

### Implementation for User Story 3

- [X] T048 [US3] Add validation to `saveDayEntry` in `src/storage/repository.ts` until T047 passes
- [X] T049 [P] [US3] Create `src/ui/components/SymptomPicker.tsx` in `BottomSheet`: symptom pills (multi-select) and mood pills (single-select, tap again to clear) from `catalog.ts`, each pill ≥ 44 CSS px (= 44 pt), selected state `--violetSoft`/`--violetText`, «Готово» as main 54 px `--btnBg` button
- [X] T050 [P] [US3] Create `src/ui/components/NoteEditor.tsx` in `BottomSheet`: `<textarea maxLength={1000}>` (15 px, line-height 1.45) with counter «N / 1000», «Сохранить», «Удалить заметку»
- [X] T051 [US3] Enable «Симптомы» and «Заметка» in `src/ui/components/DayCard.tsx` and in `TodayScreen`; show selected symptoms, mood and note preview in the card; allow for any date (past, today, future)
- [X] T052 [US3] Ensure `DayCell` entry dot reflects `hasEntry` from `useForecast` entries set; manually verify quickstart.md scenario 6

**Checkpoint**: US1–US3 работают независимо

---

## Phase 6: User Story 6 — Настройки и резервная копия (Priority: P2)

**Goal**: длины по умолчанию, экспорт всех данных в JSON и импорт с подтверждением

**Independent Test**: внести данные, экспорт, удалить приложение, установить, импорт — всё восстановлено; импорт чужого файла даёт ошибку без изменений (quickstart.md сценарии 10, 11)

**Design input**: макета «Настройки» ещё нет — собирать из карточек `--surface` и пилюль `docs/design/design.md`

### Tests for User Story 6 ⚠️

- [X] T053 [P] [US6] Write failing tests in `src/storage/backup.test.ts` per contracts/backup-format.md: export produces `{ format: 'cycle-calendar-backup', schemaVersion: 1, exportedAt, data: { periods, days, settings } }` with `endEstimated` on every period and without push state; import rejects wrong `format` («Это не резервная копия Календаря цикла»), newer `schemaVersion` («…создана более новой версией приложения. Обновите приложение»), invalid records (bad dates, overlapping periods, period longer than 15 days, missing or non-boolean `endEstimated` (required in v1), `defaultCycleLength` outside 21…45, `defaultPeriodLength` outside 2…10, unknown symptom ids, note > 1000) leaving DB unchanged; valid import replaces all data in one transaction; importing the same file twice yields identical state; older `schemaVersion` passes through `migrations`
- [X] T054 [P] [US6] Write failing test in `src/storage/migrations/migrations.test.ts`: `migrateData(data, fromVersion)` applies migrations in order, is idempotent, preserves unknown fields (framework test for future v2)

### Implementation for User Story 6

- [X] T055 [US6] Implement `migrateData` in `src/storage/migrations/index.ts` until T054 passes
- [X] T056 [US6] Implement `src/storage/backup.ts` (`exportBackup(): Promise<Blob>`, `parseBackup(text): Result<BackupSummary>`, `applyBackup(parsed)`) until T053 passes
- [X] T057 [US6] Implement `src/ui/screens/SettingsScreen.tsx` section «Цикл»: steppers «Длина цикла по умолчанию» (21…45) and «Длина месячных по умолчанию» (2…10) with 44×44 round buttons, saved immediately via `saveSettings`
- [X] T058 [US6] Add section «Резервная копия» to `src/ui/screens/SettingsScreen.tsx`: «Экспорт» → `navigator.share({ files: [new File([blob], 'cycle-calendar-YYYY-MM-DD.json', { type: 'application/json' })] })` with `<a download>` fallback; «Импорт» → hidden `<input type="file" accept="application/json,.json">` → confirm sheet «Будет восстановлено: N месячных, M записей дней. Текущие данные будут заменены» → `applyBackup`; errors shown in Russian
- [ ] T059 [US6] Manually verify quickstart.md scenarios 10–11 on iPhone

**Checkpoint**: данные защищены резервной копией

---

## Phase 7: User Story 4 — Push-напоминания (Priority: P2)

**Goal**: уведомления за 2 дня до месячных и в день овуляции в 12:00 местного времени при закрытом приложении; отдельные выключатели

**Independent Test**: установить PWA, включить напоминания, отметить цикл так, чтобы овуляция была завтра — в 12:00 приходит «Овуляция» / «Сегодня Ты КОРОЛЕВА» (quickstart.md сценарии 7–9)

### Setup and tests for User Story 4 ⚠️

- [ ] T060 [P] [US4] Write failing tests in `src/domain/reminders.test.ts` — contract cases 14–16, 22: `planReminders` yields `period` reminders 2 days before each predicted start and `ovulation` reminders on each predicted ovulation for `cyclesAhead = 6`; `sendAt` is 12:00 local time (check with `process.env.TZ = 'Europe/Berlin'` across DST change); reminders with `sendAt <= now` excluded; disabled `remindOvulation`/`remindPeriod` excluded; `forecast.delayDays > 0` → `[]`; ids `period:YYYY-MM-DD` / `ovulation:YYYY-MM-DD`; titles/bodies exactly «Календарь цикла» / «Ближайшие дни будь аккуратна, скоро начало цикла» and «Овуляция» / «Сегодня Ты КОРОЛЕВА»; at most 24 reminders
- [ ] T061 [P] [US4] Create worker package so its tests can run: `worker/package.json` (dev deps `wrangler`, `vitest`, `typescript`, `@cloudflare/workers-types`; script `test`), `worker/tsconfig.json`, `worker/vitest.config.ts`, `worker/wrangler.toml` (name `cycle-push`, `main = src/index.ts`, `[triggers] crons = ["0 * * * *"]`, KV binding `SUBS`, vars `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `ALLOWED_ORIGIN`)
- [ ] T062 [US4] Write failing tests in `worker/test/webpush.test.ts` (after T061): RFC 8291 Appendix A vector (aes128gcm encryption with given keys/salt produces expected body) and VAPID JWT (ES256) verifiable with the public key, `aud` = push endpoint origin, `exp` ≤ 24 h
- [ ] T063 [US4] Write failing tests in `worker/test/api.test.ts` (after T061) per contracts/push-worker-api.md: `PUT /v1/clients/{uuid}` stores record `{ tokenHash, subscription, reminders }` and returns 204; second PUT with wrong token → 401; invalid body → 400 (`reminders.length` 0…24, `title` ≤ 100, `body` ≤ 200, `sendAt` ISO within 400 days, `endpoint` `https://` ≤ 1024); body > 16 KB → 413; `DELETE` → 204/401/404; CORS only for `ALLOWED_ORIGIN`; `scheduled` sends due reminders, deletes sent and >24 h stale ones, deletes record on 404/410 (fetch mocked, in-memory KV)

### Implementation for User Story 4

- [ ] T064 [US4] Implement `src/domain/reminders.ts` until T060 passes
- [ ] T065 [US4] Implement `worker/src/webpush.ts` (RFC 8291 aes128gcm + RFC 8292 VAPID on WebCrypto, no runtime deps) until T062 passes
- [ ] T066 [US4] Implement `worker/src/validate.ts` and `worker/src/index.ts` (`fetch`: OPTIONS/PUT/DELETE with CORS and bearer token SHA-256 check, record `sub:{clientId}` → `{ tokenHash, subscription, reminders }` — only random `clientId` and token hash as identifiers, no personal data; `scheduled`: send due reminders with `TTL: 86400`, `Urgency: normal`, payload `{ title, body, id }`; no request bodies or endpoints in logs) until T063 passes
- [ ] T067 [P] [US4] Create `worker/scripts/generate-vapid.mjs` printing a P-256 key pair (public key base64url raw, private key JWK) for `wrangler secret put VAPID_PRIVATE_KEY`
- [ ] T068 [US4] Add `push` and `notificationclick` handlers to `src/sw.ts`: `showNotification(title, { body, tag: id, icon, badge })`; click focuses an existing client or opens `/period-calendar/#today`
- [ ] T069 [US4] Implement `src/push/subscribe.ts`: `isStandalone()`, `enableReminders()` (from user tap: `Notification.requestPermission()`, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })`, create `clientId` UUID and 32-byte base64url `token` in `PushState`), `disableReminders()` (`DELETE`, unsubscribe)
- [ ] T070 [US4] Implement `src/push/sync.ts`: on data/settings change (debounce 2 s) and on app start compute `planReminders(forecast, settings, new Date())` (empty list during a delay), skip if hash equals `lastSyncedHash`, `PUT` full list; on failure/offline set `pendingSync = true` and retry on `online` event and next start; call from `src/main.tsx`
- [ ] T071 [US4] Add section «Напоминания» to `src/ui/screens/SettingsScreen.tsx`: if not standalone — instruction «Поделиться → На экран „Домой“»; if permission denied — «Уведомления запрещены. Разрешите их в Настройки iPhone → Уведомления → Цикл»; main 54 px button «Включить напоминания»; toggles «За 2 дня до месячных» and «В день овуляции» (`remindPeriod`, `remindOvulation`, each ≥ 44 CSS px); when both off → `disableReminders()`
- [ ] T072 [US4] Deploy worker per quickstart.md «Настройка push», set GitHub variables `VITE_VAPID_PUBLIC_KEY`, `VITE_PUSH_API_URL`, and manually verify quickstart.md scenarios 7–9

**Checkpoint**: напоминания приходят при закрытом приложении

---

## Phase 8: User Story 5 — Статистика (Priority: P3)

**Goal**: средняя длина цикла и месячных (те же, что в прогнозе), история циклов от новых к старым

**Independent Test**: внести три цикла и сверить средние (совпадают с прогнозом) и список истории; без завершённых циклов — пояснение

**Design input**: макета «Статистика» ещё нет — собирать из карточек и типографики `docs/design/design.md`

### Tests for User Story 5 ⚠️

- [ ] T073 [P] [US5] Write failing tests in `src/domain/stats.test.ts` — contract case 24: `cycleStats` returns `avgCycleLength = averageCycleLength(cycles)` and `avgPeriodLength = averagePeriodLength(cycles)` (last 6, no outliers, no estimated ends), equal to `Forecast.cycleLength`/`periodLength` when history exists; `null` when none; history newest first and includes outliers flagged `isOutlier`

### Implementation for User Story 5

- [ ] T074 [US5] Implement `src/domain/stats.ts` until T073 passes
- [ ] T075 [US5] Implement `src/ui/screens/StatsScreen.tsx`: tiles «Средняя длина цикла: N дн.», «Средняя длина месячных: N дн.» each with caption «по последним 6 циклам»; list rows «12 сентября 2026 · цикл 29 дн. · месячные 5 дн.» (outliers marked «не учитывается в прогнозе», estimated ends marked «≈»); empty state «Статистика появится после первого полного цикла»

**Checkpoint**: все истории реализованы

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: проверки, затрагивающие все истории

- [ ] T076 [P] Final pass of all screens against `docs/design/design.md` (FR-003 colours/markers, layout, typography) in light and dark themes — per-task checks were done along the way; fix remaining drift
- [ ] T077 [P] Audit tap targets ≥ 44 CSS px (= 44 pt) and `aria-label`s across `src/ui/components/` and `src/ui/screens/` with VoiceOver on iPhone
- [ ] T078 [P] Add `src/storage/update.test.ts`: data written with schema v1 survives re-opening the DB with the same version and a new app build (FR-031); document the «new schema version» checklist in `src/storage/migrations/README.md`
- [ ] T079 Measure startup to calendar (≤ 1 s offline, SC-003) and swipe smoothness (SC-002) on iPhone; fix regressions (e.g., limit rendered pages, memoize `dayInfo`)
- [ ] T080 Run full quickstart.md validation (scenarios 1–14 incl. 1a, 5a, 5b, 5c), including scenario 12 (publish new version → data intact)
- [ ] T081 [P] Write `README.md`: what the app is, privacy statement (data stays on device; the worker stores only the push subscription, reminder dates/texts, random `clientId` and token hash), install on iPhone, backup, development commands

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish (Phase 9)**
- Foundational BLOCKS all stories (types, dates, DB, theme, App shell, BottomSheet)

### User Story Dependencies

- **US1 (P1)**: after Phase 2; no story dependencies — MVP
- **US2 (P1)**: after Phase 2; extends `forecast.ts`, `dayInfo.test.ts`, `DayCell`, `CalendarScreen` from US1 → do after US1
- **US3 (P2)**: after US1 (uses `DayCard`); `TodayScreen` part after US2
- **US6 (P2)**: after Phase 2; independent (Settings screen); best after US1 so there is data to back up
- **US4 (P2)**: after US2 (`planReminders` needs `Forecast`) and US6 (adds a section to `SettingsScreen`); worker track T061–T063, T065–T067 has no client dependencies and can start any time after Phase 1 (T062, T063 need T061)
- **US5 (P3)**: after US2 (`buildCycles`, averages)

Порядок фаз по приоритету: US1 → US2 → US3 → US6 → US4 → US5 (US6 выполняется раньше US4,
т. к. US4 расширяет экран настроек и зависит от прогноза).

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Конституция IV)
- Domain → storage → hooks → components → screens → manual verification against the mockups
- Commit after each task; every commit passes `npm test` and `npm run build` (Конституция V)

### Parallel Opportunities

- Phase 1: T003, T005, T006 together
- Phase 2: tests T010, T011, T012 together; T013, T014, T019 together; T020 after T019
- US1: T023 ∥ T024; T027 ∥ T028 after T026
- US2: T033 ∥ T034; T035 after T034 (same file); T040 ∥ T041 ∥ T042 ∥ T043 after T038
- US3: T049 ∥ T050
- US6: T053 ∥ T054
- US4: T060 ∥ T061; then T062 ∥ T063; whole worker track (T061–T063, T065–T067) in parallel with client track (T060, T064, T068–T071)

---

## Parallel Example: User Story 2

```bash
# Tests first:
Task: "Write failing tests for cycles and confidence in src/domain/cycles.test.ts"
Task: "Write failing tests for buildForecast in src/domain/forecast.test.ts"

# After domain is green, UI pieces together:
Task: "Fertile/ovulation styles in src/ui/components/DayCell.tsx"
Task: "StatusBanner with low-confidence line in src/ui/components/StatusBanner.tsx"
Task: "Legend in src/ui/components/Legend.tsx"
Task: "Disclaimer in src/ui/components/Disclaimer.tsx"
```

## Parallel Example: User Story 4

```bash
# Worker setup and client tests in parallel:
Task: "Worker package in worker/package.json, worker/wrangler.toml"
Task: "planReminders tests in src/domain/reminders.test.ts"

# Then worker tests together:
Task: "RFC 8291/VAPID tests in worker/test/webpush.test.ts"
Task: "API + cron tests in worker/test/api.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → деплой пустого PWA
2. Phase 2 Foundational
3. Phase 3 US1 → **STOP and VALIDATE** на iPhone (сценарии 1a, 2–4) → деплой

### Incremental Delivery

1. US1 → дневник месячных (MVP)
2. US2 → прогноз с уверенностью, «Сегодня», пометка о неточности
3. US3 → симптомы, настроение, заметки
4. US6 → настройки и резервная копия (до появления ценных данных)
5. US4 → push-напоминания
6. US5 → статистика
7. Polish → финальная сверка с макетами, доступность, производительность

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- `docs/design/design.md` — обязательный вход для UI-задач; расхождения макета и спецификации согласуются с владельцем, а не решаются молча
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
