# Contract: `src/domain/dayDialog.ts` и миграция v2

```ts
type DayExtra = 'wellbeing' | 'notes';

interface DayDialog {
  title: string;                 // «24 октября»
  periodActions: PeriodAction[]; // periodActionsFor (003)
  extras: DayExtra[];            // по включённым переключателям, порядок: wellbeing, notes
  opens: boolean;                // есть хотя бы одна кнопка, кроме «Отмена»
}

function dayDialogFor(date: LocalDate, today: LocalDate, periods: Period[], periodLength: number,
                      settings: Settings): DayDialog;

function hasWellbeing(e: DayEntry): boolean;
function hasNote(e: DayEntry): boolean;
function visibleEntryDates(entries: DayEntry[], settings: Settings): Set<LocalDate>;
function visibleEntryParts(e: DayEntry | undefined, settings: Settings):
  { symptoms: SymptomId[]; mood: MoodId | null; note: string };   // скрытые типы — пустые
function cardPhase(info: DayInfo, forecast: Forecast | null): Phase | null;

// storage
SCHEMA_VERSION = 2;  // db.version(2).upgrade + migrations[1]
```

## Обязательные тесты (вперёд)

| # | Что | Ожидание |
|---|-----|----------|
| 1 | `dayDialogFor`: {прошлый вне, прошлый внутри (первый/не первый), сегодня, будущий} × 4 комбинации | `periodActions` по 003 (будущий — пусто), `extras` по переключателям, `opens` (будущий + оба выкл. → `false`), `title` |
| 2 | `visibleEntryDates`: 4 комбинации на днях «только заметка», «только самочувствие», «оба», «пусто» | точки только у включённых типов |
| 3 | `visibleEntryParts`: 4 комбинации | скрытые типы пустые |
| 4 | `cardPhase`: обычный день, задержка, без прогноза | фаза / `null` / `null` |
| 5 | `migrations[1]`: настройки без полей → `false`; явные значения сохраняются; идемпотентна | — |
| 6 | Dexie v1 → v2: сохранённые настройки получают поля `false` | — |
| 7 | Импорт копии `schemaVersion: 1` → оба `false`; экспорт → `schemaVersion: 2` с полями; не-boolean → ошибка | — |
