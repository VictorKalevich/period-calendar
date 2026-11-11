# Implementation Plan: Отметка секса, несколько настроений и интенсивность самочувствия

**Branch**: `009-day-marks` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

## Summary

Запись дня v6: `moods: MoodId[]` вместо `mood`, `intensity` по кодам самочувствия, `sex: boolean`.
Справочник из 20 настроений с постоянными кодами; старое `great` → `joyful`, остальные старые коды
сохраняются. Единая чистая функция `coerceDayEntry` мягко приводит любые данные записи к корректной
форме и используется в переносе базы, чтении, импорте и сохранении — испорченные отметки становятся
пустыми, ничего не падает. Перенос v5 → v6 в Dexie защищён `try/catch`, месячные не трогает. Импорт
копии: месячные строго (иначе отказ, данные устройства целы), записи дней мягко, испорченные настройки —
текущее значение устройства. Три переключателя в «Записи дня» (по умолчанию выключены; «Настроение»
после обновления = прежнее «Самочувствие»). Сердечко в календаре, легенде и карточке; кнопка отметки в
диалоге дня; новый лист «Настроение»; степени в листе «Самочувствие». Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Dependencies**: без новых
**Storage**: IndexedDB (Dexie 4), схема v5 → v6 (таблицы те же; меняется форма записей `days`);
резервная копия `schemaVersion: 6`
**Testing**: Vitest — `dayEntry.test.ts` (контракт мягкого разбора), `catalog.test.ts` (коды),
`dayDialog.test.ts` (диалог, видимость), `dayInfo.test.ts` (`sex`), `migrations.test.ts`
(`migrations[5]`), `db.test.ts` (v6, значения по умолчанию), `upgrade-v2.test.ts` (базы v1–v5 **с
записями дней** → v6, испорченные записи), `update.test.ts`, `backup.test.ts` (мягкий импорт, отказ
при испорченных месячных, настройки из устройства); ручная проверка по [quickstart.md](./quickstart.md)
**Target Platform**: iOS Safari, установленная PWA · **Project Type**: офлайн-PWA (Worker не меняется)
**Constraints**: Конституция I–VII; правка файлов только Edit/Write, UTF-8 без BOM; git — у владельца
(команды PowerShell)
**Scale/Scope**: домен — `types`, `catalog`, `dayEntry`, `dayDialog`, `forecast` (DayInfo.sex);
хранилище — `db`, `migrations`, `repository`, `backup`; UI — `SettingsScreen`, `DaySheets`, `DayDialog`,
`SymptomPicker`, новый `MoodPicker`, `EntrySummary`, `DayCell`, `Legend`, `Icons`, `BackupSection`,
`useForecast`, `app.css`

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Отметки секса, настроения и степени хранятся только в IndexedDB и в файле копии пользовательницы; не уходят на Worker и не попадают в тексты напоминаний; новых сетевых запросов нет. | ✅ |
| II. Офлайн | Всё локально. | ✅ |
| III. Сохранность | `SCHEMA_VERSION = 6`, `db.version(6).upgrade` + `migrations[5]` (идемпотентны); перенос не удаляет записи и не трогает месячные; ошибки переноса перехватываются; тесты открытия баз v1–v5 с записями дней и импорта копий v1–v5. Импорт: при ошибке в месячных — отказ без изменений. | ✅ |
| IV. TDD | `coerceDayEntry`, видимость, состав диалога, перенос — тесты пишутся первыми и падают; «сегодня» — параметр. | ✅ |
| V. Простота | Без зависимостей; одна функция мягкого разбора на все входы вместо пары «строгая + мягкая». Один новый компонент (`MoodPicker`). | ✅ |
| VI. Дизайн | Новые элементы описываются в `design.md` до UI-кода: переключатели, лист «Настроение», сегменты степени, сердечко (`btnBg` с обводкой `surface`, ≥ 3:1 к фону), пункт легенды; зоны ≥ 44 px; обе темы. Без эмодзи. | ✅ |
| VII. Честность | Прогноз не меняется. | ✅ |

**Повторная проверка после Phase 1**: нарушений нет.

## Project Structure

### Documentation (this feature)

```text
specs/009-day-marks/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/day-entry.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/domain/types.ts            — DayEntry v6, Intensity, MoodId (20 кодов), Settings.showMood/showIntensity/showSex,
                                 DayInfo.sex, DayContext.sexDates
src/domain/catalog.ts          — MOODS (20), LEGACY_MOOD_CODES, INTENSITIES, isIntensity, intensityLabel
src/domain/dayEntry.ts         — coerceDayEntry (вместо normalizeDayEntry), isEmptyDayEntry, emptyDayEntry
src/domain/dayDialog.ts        — DayExtra + 'mood', DayDialog.sex, hasMood, visibleSexDates, visibleEntryParts v6
src/domain/forecast.ts         — dayInfo: sex из ctx.sexDates
src/storage/db.ts              — SCHEMA_VERSION 6, version(6).upgrade с защитой
src/storage/migrations/index.ts— migrations[5] (настройки + days)
src/storage/repository.ts      — чтение записей через coerceDayEntry, saveDayEntry мягко
src/storage/backup.ts          — parseBackup(text, current): try/catch, мягкие days, настройки с запасом
src/hooks/useForecast.ts       — getDayEntries, sexDates
src/ui/components/{DayDialog, DaySheets, SymptomPicker, MoodPicker (новый), EntrySummary, DayCell, Legend, Icons, BackupSection}.tsx
src/ui/screens/{SettingsScreen, CalendarScreen}.tsx, src/ui/app.css
docs/design/design.md, specs/001-cycle-calendar/{data-model.md, contracts/backup-format.md}, specs/004-day-dialog-wellbeing/spec.md (примечание)
```

**Structure Decision**: существующая структура; новый компонент — только `MoodPicker`. `worker/` и
`src/sw.ts` не меняются, деплой воркера не нужен.

## Complexity Tracking

Нарушений нет.
