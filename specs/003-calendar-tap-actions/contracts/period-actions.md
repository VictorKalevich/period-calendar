# Contract: Domain API — действия «Месячные» (`src/domain/periods.ts`)

```ts
type PeriodActionKind =
  | 'extend-by-length' | 'end-one-day' | 'unmark'
  | 'end-here' | 'set-start' | 'unmark-day'
  | 'start' | 'extend-to' | 'set-next-start';

interface PeriodAction {
  kind: PeriodActionKind;
  label: string;                       // по-русски, даты через formatRangeRu / formatDayMonthRu
  apply: () => Result<Period[]>;
}

// Будущий день → []. Иначе случаи А/Б/В по data-model.md, кнопки в порядке таблицы.
function periodActionsFor(date: LocalDate, today: LocalDate, periods: Period[], periodLength: number,
                          newId?: () => string): PeriodAction[];

// Перенос начала с сохранением конца (research.md R3); используется set-start и set-next-start.
function setPeriodStart(periods: Period[], periodId: string, newStart: LocalDate,
                        today: LocalDate, periodLength: number): Period[];

// dates.ts — «1–5 октября», «30 сентября – 4 октября», «28 декабря 2026 – 2 января 2027»
function formatRangeRu(from: LocalDate, to: LocalDate): string;
```

Удаляется из UI: «Конец месячных (начались …)» и «Сдвинуть начало на этот день»
(`movePeriodStart` заменяется `setPeriodStart`).

## Обязательные тестовые случаи (тесты вперёд)

| # | Ситуация | Ожидаемые `kind` |
|---|----------|------------------|
| 1 | будущий день | `[]` |
| 2 | А: начало незакрытых, L = 5, конец по длине ≤ сегодня | `extend-by-length`, `end-one-day`, `unmark` |
| 3 | А: то же, конец по длине > сегодня | `end-one-day`, `unmark` |
| 4 | А: конец отмечен вручную | `end-one-day`, `unmark` |
| 5 | А: оценочный конец 1–3, L = 5 | есть `extend-by-length` (1–5) |
| 6 | А: оценочный конец 1–7 или 1–5, L = 5 | нет `extend-by-length` |
| 7 | А: конец по длине упирается в следующие месячные | нет `extend-by-length` |
| 8 | Б: день внутри (не начало) | `end-here`, `set-start`, `unmark-day` (+ `extend-by-length` по условиям) |
| 9 | В: день без соседних месячных | только `start` |
| 10 | В: 4 дня после конца | `start`, `extend-to` |
| 11 | В: 8 дней после конца | только `start` |
| 12 | В: продление превысит 15 дней | нет `extend-to` |
| 13 | В: 2 дня до начала следующих | `start`, `set-next-start` |
| 14 | В: 4 дня до начала | нет `set-next-start` |
| 15 | В: перенос начала превысит 15 дней | нет `set-next-start` |
| 16 | В: 3 дня после конца и 3 дня до начала | `start`, `extend-to`, `set-next-start` |
| 17 | `apply`: каждое действие даёт ожидаемые отметки, переход через месяц и год | — |
| 18 | `setPeriodStart`: оценочный конец в прошлом сохраняется (`endEstimated`), в будущем — `end = null` | — |
| 19 | без прогноза L = длина по умолчанию из настроек (через параметр `periodLength`) | — |
