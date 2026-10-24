# Implementation Plan: Напоминание о неотмеченном начале месячных и единый заголовок

**Branch**: `007-missed-period-reminder` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

## Summary

Новый вид напоминания `missedPeriod`: 12:00 в день «исходное прогнозное начало + 2», если включено
`Settings.remindMissedPeriod` (по умолчанию `true`, в том числе после миграции и импорта старых копий);
одно на каждое прогнозное начало, без повторов. При задержке `planReminders` планирует только его (для
текущего цикла), прежние виды — как раньше не планируются. Снятие при отметке — существующим полным
PUT расписания после пересчёта прогноза. Заголовок всех уведомлений — `NOTIFICATION_TITLE =
'Календарь цикла'` (= `name` манифеста). Третий переключатель в «Напоминаниях». Схема v5. Worker не
меняется. Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Dependencies**: без новых
**Storage**: IndexedDB (Dexie 4), схема v4 → v5; резервная копия `schemaVersion: 5`
**Testing**: Vitest — `reminders.test.ts` (контракт M1–M11), `migrations.test.ts`, `db.test.ts` (версия и значения по умолчанию),
`update.test.ts` (открытие базы v4 новой сборкой), `backup.test.ts` (импорт копии v4);
ручная проверка секции «Напоминания» и PUT расписания
**Target Platform**: iOS Safari, установленная PWA · **Project Type**: офлайн-PWA + Cloudflare Worker (без изменений)
**Constraints**: Конституция I–VII; правка файлов только Edit/Write, UTF-8 без BOM, проверка diff
**Scale/Scope**: 1 доменная функция (`planReminders`), 1 поле настроек, 1 UI-компонент (`RemindersSection`)

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | На сервер — те же `{ id, sendAt, title, body }`; признак «отмечено» и даты месячных не уходят; новых сетевых запросов нет. Текст не раскрывает данных сверх необходимого, заголовок без слова «Овуляция» — даже сдержаннее. | ✅ |
| II. Офлайн | Расчёт локальный; доставка — прежний push. | ✅ |
| III. Сохранность | `SCHEMA_VERSION = 5`, `db.version(5).upgrade` + `migrations[4]` (идемпотентна, `true` по умолчанию); тесты миграции, открытия базы v4, импорта копии v4. | ✅ |
| IV. TDD | Кейсы M1–M10 пишутся первыми и падают; «сегодня»/`now` — параметры; DST и переход года покрыты. | ✅ |
| V. Простота | Без зависимостей и новых модулей; дата выводится из существующего `Forecast` (`nextStart − delayDays`). | ✅ |
| VI. Дизайн | Существующий компонент `toggle` с подписью `t-small toggle__hint`; зоны ≥ 44 px; `design.md` обновляется до UI-кода. | ✅ |
| VII. Честность | Текст «Похоже, …» — мягкий, без утверждения о факте. | ✅ |

**Повторная проверка после Phase 1**: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/007-missed-period-reminder/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/missed-period-reminder.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/domain/types.ts          — Settings.remindMissedPeriod, DEFAULT_SETTINGS (true)
src/domain/reminders.ts      — NOTIFICATION_TITLE, MISSED_PERIOD_REMINDER, kind 'missedPeriod', правило задержки, toServerReminders
src/push/sync.ts             — отправляет toServerReminders(planReminders(...))
src/domain/reminders.test.ts — M1–M11; прежний кейс «delayDays > 0 → []» уточняется
src/storage/db.ts            — SCHEMA_VERSION 5, version(5).upgrade
src/storage/migrations/index.ts (+ migrations.test.ts), backup.ts (+ backup.test.ts), db.test.ts, update.test.ts
src/ui/components/RemindersSection.tsx — третий переключатель, отписка при трёх выключенных
docs/design/design.md        — таблица уведомлений (заголовки, новая строка), переключатель в «Напоминаниях»
specs/001-cycle-calendar/{spec.md (FR-022–FR-024, задержка), data-model.md, contracts/domain-api.md, contracts/backup-format.md}
```

**Structure Decision**: существующая структура; новых модулей нет. `worker/` и `src/sw.ts` не меняются
(fallback-заголовок уже «Календарь цикла»), деплой воркера не нужен.

## Complexity Tracking

Нарушений нет.
