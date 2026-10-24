# Data Model: фича 005

## Settings (схема v3)

| Поле | Тип | По умолчанию | Правила |
|------|-----|--------------|---------|
| … (без изменений, см. 004) | | | |
| `ovulationShiftEnabled` | boolean | false | FR-006 |
| `ovulationShift` | integer | 0 | −5…+5; применяется только при `ovulationShiftEnabled` (FR-007) |

**Миграция v2 → v3** (`db.version(3).upgrade`, `migrations[2]`): отсутствующие поля → `false` и `0`.

## Прогноз (изменение 001 FR-016)

| Величина | Было | Стало |
|----------|------|-------|
| `ovulation` | `nextStart − 14` | `min(start + 13 + (enabled ? shift : 0), nextStart − 1)` (FR-003a) |
| `fertile` | `ovulation − 5 … ovulation` | без изменений формулы |
| `mediumDays` | `ovulation − 7, −6, +1` | без изменений формулы |
| `phase` | follicular до овуляции, luteal после | без изменений формулы |

`dayInfo`: при `period === 'actual'` — `fertile = null`, `ovulation = false` (FR-005).
