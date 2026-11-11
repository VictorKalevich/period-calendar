---

description: "Task list for feature 013-report-button-design-system"
---

# Tasks: Кнопка «Отчёт» в шапке «Статистики» и дизайн-система

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны — пишутся первыми и должны упасть. UTF-8 без BOM; каждый коммит проходит `npm test` и `npm run build`.

## Phase 1: Setup

- [ ] T001 Снимки основных экранов текущей сборки (Chrome 390×844, обе темы) для сравнения

## Phase 2: User Story 2 — дизайн-система (P1)

- [ ] T002 [US2] Failing test `src/ui/design-system.test.ts`: в `app.css` и `theme.css` (кроме объявлений `--*`) свойства padding/margin/gap/row-gap/column-gap не содержат чисел с `px`; `border-radius` — только `var(--radius-*)`/`0`; `font-size` — только `var(--text-*)`; цвета — только `var(--*)` (кроме `rgba` в тенях и подложке листа); токены шкалы определены
- [ ] T003 [US2] Failing test `src/report/palette.test.ts`: `REPORT_PALETTE` совпадает с токенами светлой темы
- [ ] T004 [US2] Токены в `theme.css`; перевод `theme.css`/`app.css` на токены; объединение дублей (`.notice`, `.icon-btn`, `.btn--compact`, `.btn--raised`, общее «выбрано», кнопки 52/16, подписи 14, промежуток чипов 8); замена классов в компонентах; экспорт `REPORT_PALETTE` — до прохождения T002, T003
- [ ] T005 [US2] `docs/design/design.md` — раздел «Дизайн-система» (токены, компоненты, правила), обновить размеры кнопок/подписей; `CLAUDE.md` — правило

## Phase 3: User Story 1 — кнопка «Отчёт» (P1)

- [ ] T006 [US1] `DoctorReportButton` (из `DoctorReportSection`): кнопка `btn btn--compact btn--raised` «Отчёт»/«Создаю…», лист «Отчёт готов» с пояснением, лист «Отчёт не создан»; `StatsScreen` — шапка `.screen__header`, карточка убрана; `design.md` — «Экран „Статистика“»

## Phase 4: Polish

- [ ] T007 Снимки после, сравнение с T001 (SC-002); PDF создаётся; diff без испорченной кириллицы и BOM; задачи выполнены

## Implementation Strategy

Коммиты: (1) документы; (2) дизайн-система (токены, стили, тесты, design.md, CLAUDE.md); (3) кнопка «Отчёт»; (4) задачи выполнены.
