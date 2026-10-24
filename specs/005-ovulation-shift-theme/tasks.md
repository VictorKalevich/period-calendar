---

description: "Task list for feature 005-ovulation-shift-theme"
---

# Tasks: Овуляция на 14-й день, личный сдвиг, нежная тема, шиты

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/ovulation.md](./contracts/ovulation.md)

**Tests**: обязательны — пишутся первыми и должны упасть. Правка файлов — только Edit/Write; перед коммитом — проверка diff.

## Phase 1: Настройки v3 (US2)

- [X] T001 [US2] Failing tests: `migrations[2]` adds `ovulationShiftEnabled: false`, `ovulationShift: 0` (keeps explicit values, idempotent); `db.test.ts` — `SCHEMA_VERSION 3`, defaults; `upgrade-v3.test.ts` — stored v2 settings get both fields; `backup.test.ts` — export `schemaVersion: 3`, import of v2 and v1 copies → off/0, shift outside −5…+5 or non-integer → error
- [X] T002 [US2] Implement `Settings` fields + `DEFAULT_SETTINGS`, `OVULATION_DAY_OFFSET`, `OVULATION_SHIFT_RANGE` (types.ts), `SCHEMA_VERSION 3` + `version(3).upgrade` (db.ts), `migrations[2]`, `parseSettings` — until T001 passes

## Phase 2: Правило овуляции (US1, US2)

- [X] T003 [US1] Failing tests (contract 1–8): update `forecast.test.ts`, `dayInfo.test.ts`, `reminders.test.ts`, `dayDialog.test.ts` expectations to «начало + 13»; new cases — month/year boundaries, leap year, cycles 21 and 45 (past and predicted), shift −5…+5 enabled, shift disabled keeps value ignored, delay does not move ovulation, reminder on the shifted day, window/crown hidden on actual period days
- [X] T004 [US2] Failing tests `dates.test.ts`: `formatShiftRu` for −5…+5 (U+2212, «день/дня/дней»)
- [X] T005 [US1] Implement in `forecast.ts` (`ovulationShiftOf`, `ovulationFor`, `cycleFrom`, `dayInfo` priority) and `dates.ts` (`formatShiftRu`) until T003–T004 pass

## Phase 3: Шиты (US6)

- [X] T006 [US6] Failing test `src/ui/scrollLock.test.ts` for `createScrollLock(fakeWindow)`: first lock fixes body at −scrollY, nested lock is a no-op, last unlock restores styles and `scrollTo(0, y)`
- [X] T007 [US6] Implement `src/ui/scrollLock.ts`; use in `BottomSheet.tsx` while open; `touchmove` on the backdrop prevented (`passive: false`); `.sheet` `overscroll-behavior: contain; overflow-y: auto`

## Phase 4: UI (US2–US5)

- [X] T008 [US2] `Stepper.tsx`: `format` and `widest` props (fixed-width value cell, `tabular-nums`); `SettingsScreen.tsx`: switch «Учитывать личный сдвиг овуляции» under «Самочувствие»/«Заметки», hint and stepper −5…+5 when on
- [X] T009 [US3] `Disclaimer.tsx`: new text (14-й день, окно 5 дней до овуляции) + line about the personal shift when enabled and ≠ 0; pass settings from `CalendarScreen.tsx`
- [X] T010 [US4] `DayCard.tsx`: remove level pill and explanation line (keep date, cycle day, phase, entry summary)
- [X] T011 [US5] `theme.css` light tokens rose/roseText/roseSoft/btnBg; contrast test passes

## Phase 5: Документы и релиз

- [ ] T012 [P] Replace the ovulation rule everywhere: `docs/design/design.md` (tokens, card, settings, «Подробнее»), `specs/001-cycle-calendar/spec.md` (FR-016, US2-2, assumptions), `data-model.md`, `contracts/domain-api.md` (cases), `contracts/backup-format.md` (v3), `quickstart.md`
- [ ] T013 Run tests, build, staged-diff check; browser: quickstart 1–8 (incl. scroll lock)
- [ ] T014 Merge into `main` and push (CLAUDE.md; worker not changed)

## Dependencies

T001 → T002 → T003–T004 → T005 → T006 → T007 → T008–T011 → T012–T013 → T014
