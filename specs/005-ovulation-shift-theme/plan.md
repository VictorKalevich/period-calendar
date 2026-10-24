# Implementation Plan: Овуляция на 14-й день, личный сдвиг, нежная тема, шиты

**Branch**: `005-ovulation-shift-theme` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

## Summary

Овуляция считается как начало цикла + 13 дней (+ личный сдвиг −5…+5 при включённом переключателе);
окно, вероятность, фазы и напоминание следуют за ней; отмеченные месячные перекрывают окно.
Настройки получают переключатель и счётчик сдвига (схема v3 с миграцией). «Подробнее» описывает
новый расчёт. Карточка дня — без вероятности. Светлая тема — нежнее розовый. Все шиты блокируют
прокрутку страницы. Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 · **Dependencies**: без новых · **Storage**: IndexedDB схема v3
**Testing**: Vitest (прогноз, напоминания, склонение, миграции, копия, scrollLock, контраст); браузер (CDP)
**Constraints**: Конституция I–VII; правка файлов только Edit/Write, UTF-8 без BOM, проверка diff

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Новые настройки только на устройстве и в локальной копии. | ✅ |
| II. Офлайн | Без сети. | ✅ |
| III. Сохранность | Схема v3 + `upgrade` + `migrations[2]` с тестами; старые копии импортируются. | ✅ |
| IV. TDD | Новое правило овуляции, сдвиг, склонение, блокировка — тесты вперёд; обновлены контракты. | ✅ |
| V. Простота | Без библиотек (блокировка прокрутки — ~30 строк). | ✅ |
| VI. Дизайн | Новые токены светлой темы, контраст ≥ 4.5:1 тестом; кнопки 44 px; `design.md`. | ✅ |
| VII. Честность | «Подробнее» описывает новый расчёт и учтённый сдвиг; пометка о неточности остаётся. | ✅ |

## Project Structure

```text
src/domain/types.ts, forecast.ts, dates.ts (+ tests: forecast, dayInfo, reminders, dates, dayDialog)
src/storage/db.ts, migrations/index.ts, backup.ts (+ tests)
src/ui/scrollLock.ts (+ test), components/BottomSheet.tsx, Stepper.tsx, Disclaimer.tsx, DayCard.tsx
src/ui/screens/SettingsScreen.tsx, CalendarScreen.tsx, theme.css, app.css
docs/design/design.md, specs/001-cycle-calendar/{spec,data-model,contracts/domain-api,contracts/backup-format,quickstart}.md
```

## Complexity Tracking

Нарушений нет.
