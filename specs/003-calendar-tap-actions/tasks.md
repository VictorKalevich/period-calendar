---

description: "Task list for feature 003-calendar-tap-actions"
---

# Tasks: Нажатие на дату и умные действия «Месячные»

**Input**: Design documents from `/specs/003-calendar-tap-actions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: ОБЯЗАТЕЛЬНЫ для доменной логики (Конституция IV) — пишутся первыми и должны упасть.
UI — проверка в браузере по quickstart.md.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational

- [X] T001 [P] Write failing tests in `src/domain/dates.test.ts` for `formatRangeRu(from, to)`: same month «1–5 октября»; different months «30 сентября – 4 октября»; different years «28 декабря 2026 – 2 января 2027»; single day «5 октября»
- [X] T002 Implement `formatRangeRu` in `src/domain/dates.ts` until T001 passes

## Phase 2: User Story 3 — умные действия (P1, domain first — нужно US2)

**Goal**: состав диалога строго по таблице А/Б/В, новые действия

**Independent Test**: табличные тесты `periodActionsFor` (contracts/period-actions.md, случаи 1–19)

- [X] T003 [US3] Write failing table tests in `src/domain/periodActions.test.ts` for `periodActionsFor(date, today, periods, periodLength)` — contract cases 1–16: exact ordered `kind` lists per row А/Б/В, conditional buttons present when conditions hold and absent otherwise («Продлить месячные: …» absent when end by length > today, when it reaches the next period, when the end is manual, when an estimated end is ≥ the new end; «Продлить до» absent at 8 days and when length > 15; «Установить как начало месячных» absent at 4 days, on overlap with the previous period and when length > 15; both buttons at 3+3 days); labels («Продлить месячные: 1–5 октября», «Продлить месячные до 8 октября»)
- [X] T004 [US3] Write failing tests in `src/domain/periodActions.test.ts` for `apply()` of every kind and for `setPeriodStart` — contract cases 17–19: resulting periods incl. month/year boundary (30 сентября + L 5 → 4 октября; 30 декабря → 3 января), `endEstimated` flags, previous marks before a new start removed, open-period end rule (past estimate kept as `endEstimated`, future → `end = null`), L passed as `periodLength` (default when no forecast)
- [X] T005 [US3] Implement `periodActionsFor` and `setPeriodStart` in `src/domain/periods.ts` (remove `movePeriodStart` and its tests in `src/domain/periods.test.ts`) until T003–T004 pass
- [X] T006 [US3] Rewrite `src/ui/components/PeriodSheet.tsx` to render `periodActionsFor` results (buttons in order, first one primary, «Отмена» always); delete the local `actionsFor` logic

## Phase 3: User Story 2 — нажатие открывает «Месячные» (P1)

**Goal**: день ≤ сегодня → диалог сразу; будущий → только выбор; без кнопки «Месячные»

**Independent Test**: quickstart.md сценарии 2–5

- [X] T007 [US2] Update `src/ui/screens/CalendarScreen.tsx`: selecting a day `≤ today` also opens the period sheet; `> today` only selects
- [X] T008 [P] [US2] Update `src/ui/components/DayCard.tsx`: remove the «Месячные» button, keep «Симптомы» and «Заметка» (2 columns) per updated design
- [X] T009 [US2] Update `src/ui/screens/TodayScreen.tsx`: remove «Месячные» from quick actions (2 buttons); week strip tiles for today and past days are buttons (≥ 44 px, `aria-label` with the date) opening the period sheet for their date; future tiles stay non-interactive; the summary stays about today

## Phase 4: User Story 1 — без артефактов iOS (P1)

**Independent Test**: quickstart.md сценарий 1

- [X] T010 [US1] In `src/ui/app.css` add `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent` for `.calendar-card`, `.pager`, `.month-grid`, `.day-cell`, `.week`; in `DayCell.tsx` and the week tiles prevent `contextmenu`

## Phase 5: Documentation & Release

- [X] T011 [P] Update `docs/design/design.md`: карточка дня (кнопки «Симптомы», «Заметка»; диалог «Месячные» по нажатию на дату), быстрые действия «Сегодня» (2 кнопки), полоска недели (сегодня и прошедшие дни нажимаются)
- [X] T012 [P] Update `specs/001-cycle-calendar/spec.md` FR-006 and FR-008a and `specs/001-cycle-calendar/quickstart.md` scenarios 1a, 3, 6 (SC-001: дата → «Начало месячных», 2 нажатия)
- [X] T013 Run `npm test`, `npm run build`; verify quickstart.md scenarios 2–9 in the browser (CDP), incl. computed `user-select`/`-webkit-touch-callout` on day cells
- [X] T014 Merge `003-calendar-tap-actions` into `main` and `git push origin main` (CLAUDE.md rule; worker not changed)
- [ ] T015 Manually verify on iPhone: quickstart.md scenario 1 (no selection/loupe/menu, SC-003)

## Phase 6: Ревизия 2 — слияние месячных и новый состав диалога

**Goal**: FR-006–FR-017 ревизии 2 (data-model.md, contracts/period-actions.md)

- [X] T016 [US3] Write failing tests `src/domain/normalize.test.ts` for `normalizePeriods(periods, today, L)` — contract case 11: adjacent (end + 1 = next start) merge; overlap merge; chain of three → one; later end estimated → `endEstimated = true`, later end manual → `false`, equal ends → manual wins; later open with estimate ≤ today → `end = estimate, endEstimated = true`; later open and still ongoing → `end = today, endEstimated = true`; merge across month boundary; merge > 15 days → not merged; non-touching periods unchanged; id of the earlier period kept
- [X] T017 [US3] Rewrite `src/domain/periodActions.test.ts` for the new table — contract cases 1–10, 12–13: exact `kind` lists (А `['delete-period']` with `confirm` «Удалить месячные 1–4 октября?» incl. open period by L; Б `['end-here','set-start']`; В as before) and absence of every other kind; `apply` results normalized (start adjacent to previous → one period; extend-to up to the day before next → one period; set-next-start adjacent to previous → merged; merged > 15 → conditional button hidden)
- [X] T018 [US3] Update `src/domain/periods.test.ts`: `markPeriodEnd(periods, day, today, periodLength)`; marking a start/end that touches a neighbour merges; merge > 15 → `too-long`
- [X] T019 [US3] Implement `normalizePeriods`; call it from `markPeriodStart`, `markPeriodEnd` (new `periodLength` param), `setPeriodStart` callers and every `apply`; rewrite `periodActionsFor` for the new table (remove `extend-by-length`, `end-one-day`, `unmark`, `unmark-day`; add `delete-period` with `confirm`); hide conditional actions whose result is not ok — until T016–T018 pass
- [X] T020 [US3] Write failing tests and implement: `src/storage/backup.test.ts` — import of adjacent/overlapping periods returns merged periods, un-mergeable overlap (> 15 days) is still an error; `src/storage/repository.test.ts` — `normalizeStoredPeriods(today)` merges adjacent stored periods and writes only when something changed; implement in `src/storage/backup.ts` (`parseBackup` normalizes with the file's `defaultPeriodLength`) and `src/storage/repository.ts`; call `normalizeStoredPeriods` once at startup in `src/main.tsx`
- [X] T021 [US3] Update `src/ui/components/PeriodSheet.tsx`: confirmation step for actions with `confirm` («Удалить», «Отмена»)
- [X] T022 [P] Update docs: `specs/001-cycle-calendar/data-model.md` (invariant: no adjacent/overlapping periods), `specs/001-cycle-calendar/contracts/backup-format.md` (import merges; un-mergeable overlap is an error), `specs/001-cycle-calendar/contracts/domain-api.md` (`markPeriodEnd` signature), `docs/design/design.md` (диалог «Месячные» ссылается на таблицу 003)
- [ ] T023 Run `npm test`, `npm run build`; verify quickstart.md scenarios 6–11 in the browser
- [ ] T024 Merge into `main` and `git push origin main` (CLAUDE.md rule; worker not changed)

## Dependencies & Execution Order

- T001 → T002 (formatRangeRu used in labels) → T003, T004 → T005 → T006 → US2 (T007–T009) → T010 → T011–T013 → T014 → T015
- US3 domain goes first because US2 opens the dialog built from it
- [P]: T001; T008 with T007; T011 with T012

## Implementation Strategy

Домен (T001–T005) → диалог (T006) → нажатия (T007–T009) → CSS (T010) → документы и проверка
(T011–T013) → слияние и push (T014). Каждый шаг — рабочий коммит.
