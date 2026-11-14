# Contract: запись дня и нормализация в `src/storage/repository.ts`

Внутренний программный интерфейс хранилища. Меняется только то, что перечислено ниже. Остальные функции
(`getDayEntry`, `getDayEntries`, `saveDayEntry`, `savePeriods`, `getSettings`, `updateSettings` и др.) —
без изменений.

## `updateDayEntry(date, patch)` — новая

```ts
export type DayEntryPatch = Partial<Omit<DayEntry, 'date'>>;
export function updateDayEntry(date: LocalDate, patch: DayEntryPatch): Promise<void>;
```

- Одна транзакция `rw` по `db.days`: мягко прочитать запись `date` (при отсутствии — пустая), наложить
  `patch`, затем `date`, и сохранить по правилам `saveDayEntry`: привести, пустую удалить.
- Не затронутые `patch` поля сохраняются как есть, после мягкого чтения.
- Записи других дат не читаются и не меняются.
- Некорректная `date` — промис отклоняется, база не меняется.
- Отказ записи базы — промис отклоняется, транзакция отменена, запись прежняя целиком.
- Одновременные вызовы для одного дня выполняются по очереди; каждый накладывается на результат
  предыдущего.

## `normalizeStoredPeriods(today)` — меняется внутреннее устройство

```ts
export function normalizeStoredPeriods(today: LocalDate): Promise<boolean>; // сигнатура прежняя
```

- Одна транзакция `rw` по `db.periods` и `db.kv`: чтение месячных и настроек, расчёт, запись.
- Возвращает `true`, если месячные объединены и записаны; `false`, если запись не нужна. Как и раньше.
- Другая запись месячных или настроек, начатая после вызова, выполняется после окончания нормализации.

## `saveDayEntry(entry)` — без изменений

Остаётся для `updateDayEntry` и тестов. Интерфейс (`src/ui`, кроме тестов) его не вызывает (SC-005).

## Использование в интерфейсе

| Место | Было | Стало |
|-------|------|-------|
| `DaySheets` — отметка секса | `saveDayEntry({ ...(entry ?? emptyDayEntry(date)), sex: !entry?.sex })` | `updateDayEntry(date, { sex: !entry?.sex })` |
| `SymptomPicker` — «Готово» | `saveDayEntry({ ...(entry ?? emptyDayEntry(date)), symptoms, intensity: levels })` | `updateDayEntry(date, { symptoms, intensity: levels })` |
| `MoodPicker` — «Готово» | `saveDayEntry({ ...(entry ?? emptyDayEntry(date)), moods })` | `updateDayEntry(date, { moods })` |
| `NoteEditor` — «Сохранить» / «Удалить» | `saveDayEntry({ ...(entry ?? emptyDayEntry(date)), note })` | `updateDayEntry(date, { note })` |
| `CalendarScreen` — запись выбранного дня | `entry = useLiveQuery(…, [day])` | `stored = useLiveQuery(…, [day])`; `entry = stored?.date === day ? stored : undefined` |

Обёртки ошибок записи из 014 (`saveError.save(...)`, `DayDialog` → `onToggleSex`) остаются прежними.
Разметка, тексты и закрытие листов не меняются.
