# Tasks: Скрытый режим разработчика

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [contracts/](./contracts/)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть.

## Phase 1: Foundational

- [X] T001 Bump `package.json` version to 0.2.0; add `define: { __APP_VERSION__: JSON.stringify(version) }` in `vite.config.ts` and `vitest.config.ts`, declare `__APP_VERSION__` in `src/vite-env.d.ts`

## Phase 2: User Story 1 — режим разработчика (P1)

- [X] T002 [P] [US1] Write failing tests `src/ui/tapCounter.test.ts`: toggles exactly on the 7th tap with gaps ≤ 1000 ms; a gap > 1000 ms restarts counting; counter resets after a toggle
- [X] T003 [P] [US1] Write failing tests in `src/storage/repository.test.ts`: `getDevMode()` is `false` by default, `setDevMode(true)` persists; and in `src/storage/backup.test.ts`: export does not contain `devMode`
- [X] T004 [US1] Implement `src/ui/tapCounter.ts` and `getDevMode`/`setDevMode` (kv key `devMode`) in `src/storage/repository.ts` until T002–T003 pass
- [X] T005 [US1] Create `src/ui/components/VersionTapper.tsx` («Версия X.Y.Z», button ≥ 44 px, toast «Режим разработчика включён/выключен» with `role="status"`) and add it to the bottom of `src/ui/screens/SettingsScreen.tsx`

## Phase 3: User Story 2 — тестовый push (P1)

- [X] T006 [US2] Write failing tests in `worker/test/api.test.ts` per contracts/push-worker-test-api.md: 204 sends exactly «Календарь цикла» / «Уведомления работают» to the stored endpoint; 401 wrong/missing token (record unchanged, no push); 404 unknown client; 429 with `Retry-After` within 60 s (attempt counted even when push failed); allowed again after 60 s; 410 on push 404/410 deletes record; 502 on other push errors; preflight allows POST
- [X] T007 [US2] Implement the test endpoint in `worker/src/index.ts` (`StoredRecord.lastTestAt`) until T006 passes; keep `PUT` preserving `lastTestAt`
- [X] T008 [US2] Implement `src/push/testNotification.ts` (sync subscription, then `POST`, map statuses to the FR-008 messages)
- [X] T009 [US2] Create `src/ui/components/DevSection.tsx` «Для разработчика» with «Проверить уведомление» (disabled with hint «Сначала включите напоминания» when not subscribed) and show it in `SettingsScreen` only in dev mode
- [X] T010 [US2] Update `specs/001-cycle-calendar/contracts/push-worker-api.md` with a link to the new endpoint

## Phase 4: Release

- [X] T011 Run app and worker tests, typecheck, build; verify the version tapper and dev section in a browser
- [X] T012 Deploy the worker (`wrangler deploy`) and smoke-test `POST …/test` (401/404/429 paths)
- [X] T013 Merge `002-dev-mode` into `main` and push to GitHub
- [X] T014 Manually verify on iPhone: test notification arrives within 10 s (SC-002)
