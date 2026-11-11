# Implementation Plan: Подсказка «отметьте последние месячные»

**Branch**: `010-first-period-hint` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

## Summary

Карточка-подсказка вверху экрана «Календарь» (над шапкой месяца), пока нет ни одной отметки месячных и
подсказку не закрыли крестиком. Правило — чистая функция `firstPeriodHintVisible(periodsCount,
dismissed)`. Отметка «закрыто» — запись `kv` с ключом `firstPeriodHintDismissed` (как `devMode`): только на
устройстве, не в резервной копии, без новой версии схемы. Список месячных уже живой (`useForecast`),
поэтому подсказка исчезает сразу после первой отметки любым способом.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Dependencies**: без новых
**Storage**: IndexedDB `kv` — новый ключ `firstPeriodHintDismissed: boolean`; схема остаётся v6
**Testing**: Vitest — `src/domain/hints.test.ts` (правило), `src/storage/repository.test.ts` (флаг),
`src/storage/backup.test.ts` (флаг не экспортируется); ручная проверка по [quickstart.md](./quickstart.md)
**Target Platform**: iOS Safari, установленная PWA · **Project Type**: офлайн-PWA (Worker не меняется)
**Constraints**: Конституция I–VII; git — у владельца (команды PowerShell)
**Scale/Scope**: 1 чистая функция, 2 функции хранилища, 1 компонент, `CalendarScreen`, `app.css`, `design.md`

## Решения (research)

- **R1. Место**: над шапкой месяца, первым блоком экрана — «вверху», видно сразу при открытии.
  Внутри пейджера месяцев не размещается: подсказка не листается вместе с месяцем.
- **R2. Хранение «закрыто»**: `kv` в IndexedDB, как режим разработчика (002): реактивно через
  `useLiveQuery`, не входит в резервную копию (экспорт берёт только месячные, записи дней и настройки).
  `localStorage` не используется — на iOS PWA он изолирован от Safari и может очищаться отдельно.
  Альтернатива «поле в Settings» отклонена: попало бы в копию и потребовало бы схему v7.
- **R3. Вид**: карточка `roseSoft` (radius 24), заголовок 15/800 и текст 14/600 `roseText` (пара из
  таблицы контраста), справа сверху — круглая кнопка-крестик 44×44 без фона, иконка 20 px `roseText`,
  `aria-label` «Скрыть подсказку». Без эмодзи и новых цветов.
- **R4. Без переключателя**: требование «новое выключено по умолчанию» относится к функциям из отзыва;
  подсказка видна только при пустой истории и закрывается крестиком (Clarifications спецификации).

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Флаг локальный, сетевых запросов нет. | ✅ |
| II. Офлайн | Всё локально. | ✅ |
| III. Сохранность | Схема не меняется; флаг не участвует в копии и миграциях; данные не трогаются. | ✅ |
| IV. TDD | Правило показа — чистая функция, тест первым. | ✅ |
| V. Простота | Одна функция, один компонент, ключ `kv` по образцу `devMode`. | ✅ |
| VI. Дизайн | `design.md` обновляется до UI; пара `roseText`/`roseSoft` ≥ 4.5:1; крестик 44 px; обе темы. | ✅ |
| VII. Честность | Прогноз не меняется. | ✅ |

**Повторная проверка после Phase 1**: нарушений нет.

## Project Structure

```text
specs/010-first-period-hint/ — spec.md, plan.md, quickstart.md, tasks.md, checklists/requirements.md
src/domain/hints.ts (+ hints.test.ts)          — firstPeriodHintVisible
src/storage/repository.ts (+ repository.test.ts) — getFirstPeriodHintDismissed, dismissFirstPeriodHint
src/storage/backup.test.ts                     — флаг не экспортируется
src/ui/components/FirstPeriodHint.tsx (новый), src/ui/components/Icons.tsx (CloseIcon)
src/ui/screens/CalendarScreen.tsx, src/ui/app.css, docs/design/design.md
```

**Structure Decision**: существующая структура. `worker/` не меняется.

## Complexity Tracking

Нарушений нет.
