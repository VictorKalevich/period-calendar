# Implementation Plan: Нажатие на дату и умные действия «Месячные»

**Branch**: `003-calendar-tap-actions` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-calendar-tap-actions/spec.md`

## Summary

Нажатие на сегодняшний или прошедший день сразу открывает диалог «Месячные», будущий — только
выбирается; системные артефакты iOS при нажатии отключены CSS-свойствами. Состав диалога (таблица
А/Б/В) вычисляет чистая функция `periodActionsFor` в `src/domain/periods.ts` с новыми действиями
«Продлить месячные: …», «Продлить месячные до …», «Установить как начало», «Установить как начало
месячных»; UI только рисует кнопки. Кнопка «Месячные» убрана из карточки дня и быстрых действий
«Сегодня», плитки прошедших дней полоски недели открывают диалог. Решения — [research.md](./research.md).

**Ревизия 2**: кнопка «Продлить месячные: …» удалена; диалог — «Удалить период» (с подтверждением)
для первого дня, «Отметить конец в этот день» и «Установить как начало» для остальных дней; новая
чистая функция `normalizePeriods` объединяет пересекающиеся и соседние месячные после любого
изменения, при импорте и при запуске (research.md R5, data-model.md «Инвариант»).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), как в 001

**Primary Dependencies**: без новых (React 19, Dexie 4, date-fns 4)

**Storage**: IndexedDB — схема не меняется

**Testing**: Vitest — табличные тесты `periodActionsFor` и `setPeriodStart`; проверка в браузере (CDP)

**Target Platform**: iOS 16.4+ Safari, PWA

**Project Type**: web application (PWA), воркер не затрагивается

**Performance Goals**: без изменений (диалог открывается мгновенно)

**Constraints**: Конституция I–VII; зоны нажатия ≥ 44 CSS px; макеты `docs/design/design.md`

**Scale/Scope**: 1 доменная функция + 1 вспомогательная, 4 UI-компонента, документы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сеть не затрагивается. | ✅ |
| II. Офлайн-PWA | Всё локально. | ✅ |
| III. Сохранность данных | Схема не меняется; инвариант «конец не в будущем» сохраняется (R3, R5); нормализация при запуске только объединяет месячные, ничего не удаляет; импорт нормализует, неустранимые пересечения — ошибка без изменения данных. | ✅ |
| IV. Корректность (TDD) | Правила кнопок и действия — чистые функции в домене, 19 тест-кейсов до кода. | ✅ |
| V. Простота | Без зависимостей; UI упрощается (нет условий в компоненте). | ✅ |
| VI. Дизайн | Обновляются `design.md` (карточка дня, быстрые действия, полоска недели); кнопки ≥ 44 px. | ✅ |
| VII. Честность | Не затрагивается. | ✅ |

**Post-design re-check**: data-model и контракт не добавили хранимых данных и зависимостей. Нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/003-calendar-tap-actions/
├── plan.md, research.md, data-model.md, quickstart.md
├── contracts/period-actions.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/domain/periods.ts            # + periodActionsFor, setPeriodStart (movePeriodStart удаляется)
src/domain/periodActions.test.ts # табличные тесты
src/domain/dates.ts              # + formatRangeRu (+ тест в dates.test.ts)
src/ui/components/PeriodSheet.tsx  # рисует periodActionsFor
src/ui/components/DayCard.tsx      # без «Месячные»
src/ui/components/DayCell.tsx, MonthGrid.tsx, app.css  # подавление выделения/лупы
src/ui/screens/CalendarScreen.tsx  # нажатие ≤ сегодня → диалог
src/ui/screens/TodayScreen.tsx     # без «Месячные», плитки-кнопки
docs/design/design.md, specs/001-cycle-calendar/{spec.md,quickstart.md}
```

**Structure Decision**: существующая структура PWA; новый код — в `src/domain/periods.ts`.

## Complexity Tracking

Нарушений конституции нет.
