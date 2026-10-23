# Data Model: Нажатие на дату и умные действия «Месячные»

Схема хранения **не меняется** (IndexedDB v1, `Period { id, start, end, endEstimated }` — см.
[001 data-model](../001-cycle-calendar/data-model.md)). Новые сущности — производные, в домене.

## Понятия

- `L` — `forecast?.periodLength ?? settings.defaultPeriodLength`.
- `lastDay(p)` — `p.end ?? p.start + L − 1`.
- `containing(date)` — месячные с `start ≤ date ≤ lastDay`.
- `prev(date)` / `next(date)` — ближайшие месячные с `start < date` / `start > date`.

## PeriodAction

| Поле | Тип | Описание |
|------|-----|----------|
| `kind` | см. ниже | тип действия |
| `label` | string | подпись кнопки по-русски |
| `apply` | `() => Result<Period[]>` | новые отметки (исходные не меняются) |

`kind`:

| kind | Случай | Подпись | Условие показа | Результат |
|------|--------|---------|----------------|-----------|
| `extend-by-length` | А, Б | «Продлить месячные: {start}–{start+L−1}» | `end = null` или `endEstimated`; `newEnd = start+L−1 ≤ today`; `newEnd < next.start`; при `end ≠ null` — `newEnd > end` | `end = newEnd`, `endEstimated = false` |
| `end-one-day` | А | «Конец месячных (один день)» | всегда | `end = start`, `endEstimated = false` |
| `unmark` | А | «Убрать отметку» | всегда | месячные удалены |
| `end-here` | Б | «Отметить конец в этот день» | всегда | `end = date`, `endEstimated = false` |
| `set-start` | Б | «Установить как начало» | всегда | `start = date`, конец — правило R3 |
| `unmark-day` | Б | «Убрать отметку с этого дня» | всегда | `end = date − 1`, `endEstimated = false` |
| `start` | В | «Начало месячных» | всегда | новые месячные (правило 001) |
| `extend-to` | В | «Продлить месячные до {date}» | `prev`: `1 ≤ date − lastDay(prev) ≤ 7`, `date − prev.start + 1 ≤ 15` | `prev.end = date`, `endEstimated = false` |
| `set-next-start` | В | «Установить как начало месячных» | `next`: `1 ≤ next.start − date ≤ 3`; `!prev || date > lastDay(prev)`; `lastDay(next) − date + 1 ≤ 15` | `next.start = date`, конец — правило R3 |

Порядок кнопок — как в таблице спецификации. Будущий день (`date > today`) → `[]`.
