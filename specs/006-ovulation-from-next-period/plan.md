# Implementation Plan: Сдвиг овуляции в карточке «Цикл» и расчёт «от следующей менструации»

**Branch**: `006-ovulation-from-next-period` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

## Summary

Новый переключатель «Считать от следующей менструации» (`Settings.ovulationFromNextPeriod`, по
умолчанию выключен). Включён — овуляция = начало следующих месячных − 14 + сдвиг, не раньше дня
после месячных своего цикла и не позже дня перед следующими (005 FR-003a). Выключен — как в 005.
Расчёт — одна функция `ovulationFor` в домене, окно/вероятность/фазы/напоминания уже строятся от
её результата. Блок сдвига и новый переключатель — в карточке «Цикл». «Подробнее» описывает режим.
Схема v4 с миграцией; копия — поле в настройках. Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Dependencies**: без новых
**Storage**: IndexedDB (Dexie 4), схема v3 → v4; резервная копия `schemaVersion: 4`
**Testing**: Vitest — прогноз (`forecast.test.ts`, `dayInfo.test.ts`), напоминания, миграции,
обновление базы, импорт копии; ручная проверка экрана Настроек и «Подробнее» в браузере
**Target Platform**: iOS Safari, установленная PWA · **Project Type**: офлайн-PWA
**Constraints**: Конституция I–VII; правка файлов только Edit/Write, UTF-8 без BOM, проверка diff
**Scale/Scope**: 1 доменная функция, 1 поле настроек, 2 экрана UI (Настройки, «Подробнее»)

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Новое поле только на устройстве и в локальной копии; Worker получает те же готовые напоминания. Сетевых запросов не добавляется. | ✅ |
| II. Офлайн | Расчёт локальный. | ✅ |
| III. Сохранность | `SCHEMA_VERSION = 4`, `db.version(4).upgrade` + `migrations[3]` (идемпотентна, `false` по умолчанию); тесты миграции, открытия базы v3 и импорта копии v3. | ✅ |
| IV. TDD | Новый режим, нижняя граница и FR-003a — тесты вперёд в `forecast.test.ts`; при выключенном режиме существующие тесты не меняются (SC-002). «Сегодня» — параметр. | ✅ |
| V. Простота | Без зависимостей; одна функция расчёта, режим — параметр настроек. | ✅ |
| VI. Дизайн | Переключатель — существующий компонент `toggle`, описание 13 px `muted`; зоны ≥ 44 px; `design.md` обновляется до UI-кода. | ✅ |
| VII. Честность | «Подробнее» называет включённый способ расчёта; пометка о неточности остаётся. | ✅ |

**Повторная проверка после Phase 1**: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/006-ovulation-from-next-period/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/ovulation-mode.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/domain/types.ts          — Settings.ovulationFromNextPeriod, DEFAULT_SETTINGS, LUTEAL_PHASE_DAYS = 14
src/domain/forecast.ts       — ovulationFor(режим, нижняя граница), cycleFrom получает последний день месячных
src/domain/forecast.test.ts, dayInfo.test.ts, reminders.test.ts
src/storage/db.ts            — SCHEMA_VERSION 4, version(4).upgrade
src/storage/migrations/index.ts (+ migrations.test.ts), backup.ts (+ backup.test.ts), update.test.ts
src/ui/screens/SettingsScreen.tsx — блок сдвига → карточка «Цикл», новый переключатель
src/ui/components/Disclaimer.tsx  — абзац об овуляции по режиму
docs/design/design.md
specs/005-ovulation-shift-theme/spec.md (FR-003, FR-006, FR-009 — ревизии)
specs/001-cycle-calendar/{data-model.md, contracts/domain-api.md, contracts/backup-format.md}
```

**Structure Decision**: существующая структура; новых модулей нет. Worker не меняется.

## Complexity Tracking

Нарушений нет.
