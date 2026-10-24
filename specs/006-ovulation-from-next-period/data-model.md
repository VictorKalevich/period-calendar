# Data Model: фича 006

## Settings (IndexedDB `kv['settings']`, резервная копия `data.settings`)

| Поле | Тип | По умолчанию | Правила |
|------|-----|--------------|---------|
| `ovulationFromNextPeriod` | boolean | `false` | **новое**; `true` — овуляция = следующие месячные − 14 + сдвиг (FR-004, FR-005) |
| `ovulationShiftEnabled` | boolean | `false` | без изменений (005); применяется в обоих режимах |
| `ovulationShift` | целое −5…+5 | `0` | без изменений (005) |

Остальные поля — без изменений.

## Версии схемы

| Версия | Изменение | Миграция |
|--------|-----------|----------|
| 3 → 4 | `settings.ovulationFromNextPeriod` | `migrations[3]`: `ovulationFromNextPeriod ?? false`; идемпотентна; без `settings` — данные без изменений |

`SCHEMA_VERSION = 4`; таблицы и индексы не меняются. Импорт копии `schemaVersion` 1–3 проходит
цепочку миграций и получает `false`; копия v4 без boolean в поле — ошибка проверки.

## PredictedCycle (производное, не хранится)

`ovulation` считается по [contracts/ovulation-mode.md](./contracts/ovulation-mode.md); `fertile`,
`mediumDays`, фазы и напоминания — от неё, формулы 005 без изменений.
