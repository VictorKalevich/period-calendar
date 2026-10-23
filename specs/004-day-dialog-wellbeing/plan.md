# Implementation Plan: Диалог дня, фаза в карточке, «Самочувствие» и «Заметки» по выбору

**Branch**: `004-day-dialog-wellbeing` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-day-dialog-wellbeing/spec.md`

## Summary

Карточка дня показывает фазу вместо кнопок «Симптомы»/«Заметка». Диалог по нажатию на дату получает
заголовок-дату и, кроме кнопок месячных (003), кнопки «Самочувствие» и «Заметки» — по новым
переключателям в Настройках (по умолчанию выключены). Переключатели управляют видимостью
записей (индикатор, сводка, легенда), не удаляя их. Настройки получают два поля; схема хранения
и формат копии — версия 2 с миграцией. Правила — чистые функции в `src/domain/dayDialog.ts`.
Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Primary Dependencies**: без новых
**Storage**: IndexedDB — `SCHEMA_VERSION` 2 (таблицы те же, миграция данных настроек)
**Testing**: Vitest — домен (диалог, видимость, фаза), миграции, Dexie v1→v2, резервная копия; браузер (CDP)
**Target Platform**: iOS 16.4+ Safari PWA · **Project Type**: web application (PWA), воркер не затрагивается
**Constraints**: Конституция I–VII; правка файлов только Edit/Write, UTF-8 без BOM (CLAUDE.md)

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Новые поля — только на устройстве и в локальной копии. | ✅ |
| II. Офлайн | Без сети. | ✅ |
| III. Сохранность данных | `SCHEMA_VERSION` 2 + `upgrade` + `migrations[1]` с тестами; выключение не удаляет записи; старые копии импортируются. | ✅ |
| IV. TDD | Правила диалога/видимости/фазы — чистые функции, тесты вперёд на все комбинации. | ✅ |
| V. Простота | Без зависимостей; кнопки из карточки переезжают в существующий диалог. | ✅ |
| VI. Дизайн | `design.md`: карточка (фаза), диалог, блок «Записи дня», легенда; кнопки ≥ 44 px. | ✅ |
| VII. Честность | Не затрагивается (пометка о прогнозе остаётся). | ✅ |

## Project Structure

```text
src/domain/types.ts            # Settings + showWellbeing/showNotes, DEFAULT_SETTINGS
src/domain/dayDialog.ts (+test)# dayDialogFor, hasWellbeing/hasNote, visibleEntryDates/Parts, cardPhase
src/storage/db.ts              # SCHEMA_VERSION 2, version(2).upgrade
src/storage/migrations/index.ts# migrations[1]
src/storage/backup.ts          # parseSettings: новые поля
src/hooks/useForecast.ts       # entries → visibleEntryDates
src/ui/components/DayDialog.tsx (бывший PeriodSheet), DaySheets.tsx, DayCard.tsx, EntrySummary.tsx,
  Legend.tsx, SymptomPicker.tsx, SettingsScreen.tsx (+ блок «Записи дня»), CalendarScreen.tsx
docs/design/design.md, specs/001, specs/003
```

## Complexity Tracking

Нарушений нет.
