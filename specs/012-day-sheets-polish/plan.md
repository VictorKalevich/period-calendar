# Implementation Plan: Доработки диалога дня и листов записей

**Branch**: `012-day-sheets-polish` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

## Summary

Домен: `dayDialogFor` для будущего дня оставляет из записей только «Заметки» и возвращает `filled` —
включённые типы, по которым у дня есть записи; `withDefaultIntensity` дополняет степени отмеченных пунктов
значением `DEFAULT_INTENSITY = 'moderate'`. UI: кнопки диалога с записями — класс `btn--filled`
(`violetSoft`/`violetText`) и скрытая пометка «есть записи»; `SymptomPicker` — степени-«радио» со
«средне» по умолчанию; `NoteEditor` — корзина в шапке листа и подтверждение внутри листа (как удаление
периода в 003); `BottomSheet` после `showModal()` переводит фокус на сам лист (`tabIndex={-1}`), поэтому
браузер не обводит первый элемент. Схема хранения не меняется.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Dependencies**: без новых
**Storage**: без изменений
**Testing**: Vitest — `dayDialog.test.ts` (будущий день, `filled`), `dayEntry.test.ts`
(`withDefaultIntensity`); ручная проверка в Chrome 390×844, обе темы ([quickstart.md](./quickstart.md))
**Target Platform**: iOS Safari, установленная PWA · **Project Type**: офлайн-PWA (Worker не меняется)
**Constraints**: Конституция I–VII; git — у владельца (команды PowerShell)

## Решения (research)

- **R1. Обводка первого элемента**: её даёт глобальное `:focus-visible` — `showModal()` фокусирует первый
  фокусируемый элемент листа. Решение — фокус на сам `<dialog>` (`tabIndex=-1`, `focus({ preventScroll })`)
  сразу после `showModal()`, у листа своя обводка отключена. Глобальное правило для внешней клавиатуры
  остаётся (доступность). Альтернатива «убрать `:focus-visible` везде» отклонена: с клавиатуры не было бы
  видно, где фокус.
- **R2. Выделение «есть записи»**: как нажатый чип — `violetSoft` фон и рамка, `violetText` текст (пара из
  таблицы контраста). Отдельный цвет не вводится (design.md: без новых цветов).
- **R3. Степень по умолчанию**: только в листе (предложение) и при сохранении; карточка и отчёт
  показывают сохранённое — без подмены данных (Конституция VII по духу).
- **R4. Корзина**: значок в шапке листа (44×44, `roseText`), подтверждение — в том же листе, без второго
  `<dialog>` (iOS плохо переносит вложенные модальные окна).

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов нет. | ✅ |
| II. Офлайн | Всё локально. | ✅ |
| III. Сохранность | Схема не меняется; будущие записи не удаляются; удаление заметки — только после подтверждения, прочие поля записи сохраняются. | ✅ |
| IV. TDD | Правила — чистые функции, тесты первыми. | ✅ |
| V. Простота | Без зависимостей и новых модулей. | ✅ |
| VI. Дизайн | `design.md` до UI; пары контраста из таблицы; зоны ≥ 44 px; обе темы. | ✅ |
| VII. Честность | Степень по умолчанию не подставляется в карточку и отчёт. | ✅ |

## Project Structure

```text
src/domain/dayDialog.ts (+ test) — будущий день, filled
src/domain/dayEntry.ts (+ test)  — DEFAULT_INTENSITY, withDefaultIntensity
src/ui/components/{BottomSheet, DayDialog, SymptomPicker, NoteEditor, Icons}.tsx, src/ui/app.css
docs/design/design.md, specs/004-day-dialog-wellbeing/spec.md, specs/009-day-marks/spec.md (примечания)
```

## Complexity Tracking

Нарушений нет.
