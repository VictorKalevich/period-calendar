---

description: "Task list for feature 010-first-period-hint"
---

# Tasks: Подсказка «отметьте последние месячные»

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. UTF-8 без BOM; каждый коммит проходит `npm test` и `npm run build`. `worker/` не меняется.

## Phase 1–2: Setup / Foundational

Новых зависимостей и изменений схемы нет — фазы пропущены.

## Phase 3: User Story 1 — подсказка для новой пользовательницы (P1) 🎯 MVP

**Goal**: подсказка вверху «Календаря», пока нет отметок; исчезает после первой отметки.

**Independent Test**: quickstart шаги 1–3.

- [ ] T001 [US1] Failing test `src/domain/hints.test.ts`: `firstPeriodHintVisible(0, false) === true`; `(1, false)`, `(5, false)`, `(0, true)`, `(3, true)` — `false`
- [ ] T002 [US1] Implement `firstPeriodHintVisible(periodsCount, dismissed)` в `src/domain/hints.ts` — до прохождения T001
- [ ] T003 [US1] Обновить `docs/design/design.md`: экран «Календарь», п. 0 — карточка-подсказка (место, цвета, тексты FR-006, крестик 44×44)
- [ ] T004 [US1] UI: `CloseIcon` в `Icons.tsx`; новый `src/ui/components/FirstPeriodHint.tsx` (заголовок, два абзаца, крестик с `aria-label` «Скрыть подсказку»); `CalendarScreen` — показывать перед `MonthPager` по `firstPeriodHintVisible(ctx.periods.length, dismissed)`; стили в `app.css`; сверить с design.md

## Phase 4: User Story 2 — закрыть крестиком (P2)

**Goal**: крестик скрывает подсказку навсегда на устройстве; флаг не в резервной копии.

**Independent Test**: quickstart шаги 4–5.

- [ ] T005 [US2] Failing tests: `repository.test.ts` — `getFirstPeriodHintDismissed()` по умолчанию `false`, после `dismissFirstPeriodHint()` — `true`; `backup.test.ts` — после `dismissFirstPeriodHint()` файл копии не содержит `firstPeriodHintDismissed`
- [ ] T006 [US2] Implement в `src/storage/repository.ts` (ключ `kv` `firstPeriodHintDismissed`, по образцу `devMode`); `FirstPeriodHint` — крестик вызывает `dismissFirstPeriodHint`; `CalendarScreen` читает флаг через `useLiveQuery` — до прохождения T005

## Phase 5: Polish

- [ ] T007 Ручная проверка по quickstart.md, 390×844, обе темы; диff без испорченной кириллицы и BOM; отметить задачи выполненными

## Dependencies

T001 → T002 → T004; T003 → T004; T005 → T006 (T006 дополняет компонент из T004).

## Implementation Strategy

Коммиты: (1) документы фичи; (2) правило, флаг, design.md и подсказка с крестиком; (3) задачи выполнены.
