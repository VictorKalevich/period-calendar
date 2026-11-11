# Contract: запись дня v6 и мягкий разбор

`src/domain/dayEntry.ts`, `src/domain/catalog.ts`. Чистые функции, без хранилища и «сегодня».

## Форма

```ts
type Intensity = 'mild' | 'moderate' | 'severe';      // слабо · средне · сильно

interface DayEntry {
  date: LocalDate;
  symptoms: SymptomId[];                               // порядок справочника, без повторов
  intensity: Partial<Record<SymptomId, Intensity>>;    // только для кодов из symptoms
  moods: MoodId[];                                     // порядок справочника, без повторов
  sex: boolean;
  note: string;                                        // trim, ≤ 1000
}
```

## `coerceDayEntry(raw: unknown): DayEntry | null`

Никогда не бросает исключение.

| Вход | Результат |
|------|-----------|
| не объект, массив, `null` | `null` |
| `date` не `YYYY-MM-DD` реальной даты | `null` |
| `symptoms` не массив | `[]` |
| элемент `symptoms` — неизвестный код или не строка | отброшен |
| `intensity` не объект | `{}` |
| `intensity[k]`: `k` не в `symptoms` или значение не `Intensity` | отброшено |
| `moods` массив | известные коды; старые — через `LEGACY_MOOD_CODES`; прочие отброшены |
| `moods` нет или не массив, есть строка `mood` | `[перевод(mood)]`, если код известен, иначе `[]` |
| `moods` и `mood` оба отсутствуют / `mood: null` | `[]` |
| `sex` | `true` только для `true`, иначе `false` |
| `note` не строка | `''` |
| `note` длиннее 1000 после trim | обрезается до 1000 |
| лишние поля (в т.ч. `mood`) | отбрасываются |

Повторы схлопываются; `symptoms` и `moods` упорядочены по справочнику.

`LEGACY_MOOD_CODES = { great: 'joyful' }`; коды `calm`, `sensitive`, `sad`, `anxious`, `irritable`
сохраняются как есть.

## `isEmptyDayEntry(e)`

`true` ⇔ нет самочувствия, настроений, отметки секса и заметки (степени без пунктов не считаются).
Пустая запись не хранится (`saveDayEntry` удаляет).

## Видимость (`src/domain/dayDialog.ts`)

| Функция | Правило |
|---------|---------|
| `hasWellbeing(e)` | `symptoms.length > 0` |
| `hasMood(e)` | `moods.length > 0` |
| `hasNote(e)` | `note !== ''` |
| `visibleEntryDates` | день с точкой ⇔ (showWellbeing ∧ hasWellbeing) ∨ (showMood ∧ hasMood) ∨ (showNotes ∧ hasNote) |
| `visibleSexDates` | дни с `sex`, только при `showSex`; иначе пусто |
| `visibleEntryParts` | `{ symptoms, intensity, moods, sex, note }` — выключенные типы пустые; `intensity` пуст при `!showIntensity` |

## Диалог дня (`dayDialogFor(date, today, periods, periodLength, settings, entry?)`)

| Поле | Правило |
|------|---------|
| `periodActions` | по 003 (будущий день — пусто) |
| `sex` | `null`, если `!showSex` или день будущий; иначе `'unmark'`, если `entry?.sex`, иначе `'mark'` |
| `extras` | по порядку: `wellbeing` (showWellbeing), `mood` (showMood), `notes` (showNotes) |
| `opens` | есть `periodActions`, `sex` или `extras` |

Порядок кнопок в UI: месячные → секс → «Самочувствие» → «Настроение» → «Заметки» → «Отмена».
