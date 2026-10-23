---

description: "Task list for feature 004-day-dialog-wellbeing"
---

# Tasks: Диалог дня, фаза в карточке, «Самочувствие» и «Заметки» по выбору

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/day-dialog.md](./contracts/day-dialog.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. Правка файлов — только Edit/Write.

## Phase 1: Foundational — настройки и миграция v2 (US2)

- [X] T001 [US2] Write failing tests: `src/storage/migrations/migrations.test.ts` — `migrations[1]` adds `showWellbeing: false`, `showNotes: false` to `settings` when missing, keeps explicit values, is idempotent, leaves other fields; `src/storage/db.test.ts` — `SCHEMA_VERSION === 2`, `db.verno === 2`, defaults include both `false`; new `src/storage/upgrade-v2.test.ts` — a raw IndexedDB v1 database (native version 10) with a stored settings record without the fields, opened by the app, gets both fields `false` in the stored record
- [X] T002 [US2] Write failing tests in `src/storage/backup.test.ts`: export has `schemaVersion: 2` and both fields; import of a `schemaVersion: 1` file → both `false`; non-boolean `showWellbeing`/`showNotes` → error; round trip keeps `true` values
- [X] T003 [US2] Implement: `Settings` + `DEFAULT_SETTINGS` in `src/domain/types.ts`; `SCHEMA_VERSION = 2` and `this.version(2).stores(same).upgrade(...)` in `src/storage/db.ts`; `migrations[1]` in `src/storage/migrations/index.ts`; `parseSettings` in `src/storage/backup.ts` — until T001–T002 pass

## Phase 2: Domain rules (US1, US2, US3)

- [X] T004 [US3] Write failing tests `src/domain/dayDialog.test.ts` — contract cases 1–4: `dayDialogFor` for {past outside, past inside first day, past inside other day, today outside, future} × {off/off, wellbeing, notes, both} (period actions = `periodActionsFor` kinds, `extras`, `opens`, `title` «24 октября»); `visibleEntryDates` and `visibleEntryParts` for all 4 toggle combinations on days with only a note / only wellbeing / both / empty; `cardPhase` (normal, delay, no forecast)
- [X] T005 [US3] Implement `src/domain/dayDialog.ts` until T004 passes

## Phase 3: UI (US1, US2, US3)

- [ ] T006 [US3] Replace `src/ui/components/PeriodSheet.tsx` with `src/ui/components/DayDialog.tsx`: title = date, period actions (with 003 delete confirmation), then «Самочувствие» / «Заметки» per `extras`, then «Отмена»; extras open the existing `SymptomPicker` / `NoteEditor`; update `src/ui/components/DaySheets.tsx`
- [ ] T007 [US3] Update `src/ui/screens/CalendarScreen.tsx`: tap opens the dialog when `dayDialogFor(...).opens`; otherwise only selects
- [ ] T008 [US1] Update `src/ui/components/DayCard.tsx`: remove «Симптомы»/«Заметка» buttons; phase line under the title via `cardPhase`; `src/ui/components/EntrySummary.tsx` shows only `visibleEntryParts`
- [ ] T009 [US2] `src/hooks/useForecast.ts`: load day entries and build `ctx.entries` via `visibleEntryDates`; `src/ui/components/Legend.tsx`: «Есть записи» only if at least one toggle is on
- [ ] T010 [US2] `src/ui/screens/SettingsScreen.tsx`: block «Записи дня» with switches «Самочувствие» and «Заметки» (`showWellbeing`, `showNotes`, ≥ 44 px)
- [ ] T011 [US2] Rename «Симптомы» → «Самочувствие» in the UI (`SymptomPicker` legend and any remaining labels); verify `grep "Симптомы" src/ui` is empty

## Phase 4: Docs & release

- [ ] T012 [P] Update `docs/design/design.md` (card with phase, dialog, «Записи дня», legend), `specs/001-cycle-calendar` (spec FR-006/FR-007/FR-010–FR-012/US3, data-model Settings, backup-format `schemaVersion` 2, quickstart), `specs/003-calendar-tap-actions` (spec FR-002/FR-004, dialog title, quickstart)
- [ ] T013 Run `npm test`, `npm run build`, staged-diff check (no BOM/mojibake); verify quickstart 1–8 in the browser
- [ ] T014 Merge into `main` and `git push origin main` (CLAUDE.md; worker not changed)

## Dependencies

T001–T002 → T003 → T004 → T005 → T006–T011 → T012–T013 → T014
