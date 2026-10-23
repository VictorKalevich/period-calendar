# Data Model: фича 004

## Settings (IndexedDB `kv/settings`, схема v2)

| Поле | Тип | По умолчанию | Правила |
|------|-----|--------------|---------|
| `defaultCycleLength` | number | 28 | 21…45 (без изменений) |
| `defaultPeriodLength` | number | 5 | 2…10 (без изменений) |
| `remindPeriod` | boolean | true | без изменений |
| `remindOvulation` | boolean | true | без изменений |
| `showWellbeing` | boolean | **false** | новое (FR-004) |
| `showNotes` | boolean | **false** | новое (FR-004) |

**Миграция v1 → v2** (`db.version(2).upgrade` и `migrations[1]` для копий): если поля нет — записать
`false`; существующие значения не трогать; таблицы и индексы не меняются.

## Видимость записей (FR-009–FR-011)

- `hasWellbeing(e)` = `e.symptoms.length > 0 || e.mood !== null`; `hasNote(e)` = `e.note !== ''`.
- Индикатор дня: `(showWellbeing && hasWellbeing) || (showNotes && hasNote)`.
- Сводка в карточке: теги самочувствия — только при `showWellbeing`; заметка — только при `showNotes`.
- Легенда «Есть записи»: `showWellbeing || showNotes`.

## Диалог дня (FR-006, FR-007)

`DayDialog = { title: string; periodActions: PeriodAction[]; extras: ('wellbeing' | 'notes')[]; opens: boolean }`

- `title` — «24 октября».
- `periodActions` — `periodActionsFor` (003): для будущего дня `[]`.
- `extras` — `wellbeing`, если `showWellbeing`; `notes`, если `showNotes` (в этом порядке).
- `opens` — `periodActions.length > 0 || extras.length > 0`.

## Фаза в карточке (FR-001)

`cardPhase(info, forecast)` = `null`, если нет прогноза или `forecast.delayDays > 0`; иначе `info.phase`.
