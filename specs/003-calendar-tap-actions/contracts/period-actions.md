# Contract: Domain API — действия «Месячные» и слияние (`src/domain/periods.ts`), ревизия 2

```ts
type PeriodActionKind = 'delete-period' | 'end-here' | 'set-start' | 'start' | 'extend-to' | 'set-next-start';

interface PeriodAction {
  kind: PeriodActionKind;
  label: string;
  confirm?: string;                     // только delete-period: «Удалить месячные 1–4 октября?»
  apply: () => Result<Period[]>;        // результат уже нормализован (слияние)
}

function periodActionsFor(date: LocalDate, today: LocalDate, periods: Period[], periodLength: number,
                          newId?: () => string): PeriodAction[];

// Слияние пересекающихся и соседних месячных (data-model.md «Инвариант»).
function normalizePeriods(periods: Period[], today: LocalDate, periodLength: number): Period[];

function setPeriodStart(periods: Period[], periodId: string, newStart: LocalDate,
                        today: LocalDate, periodLength: number): Period[];

// Изменены: результат нормализуется; markPeriodEnd получает periodLength
function markPeriodStart(periods, day, today, periodLength, newId?): Result<Period[]>;
function markPeriodEnd(periods, day, today, periodLength): Result<Period[]>;
```

Удалено: `extend-by-length`, `end-one-day`, `unmark`, `unmark-day` (и `movePeriodStart`).

## Обязательные тестовые случаи (тесты вперёд)

| # | Ситуация | Ожидание |
|---|----------|----------|
| 1 | будущий день | `[]` |
| 2 | А: первый день (закрытые, незакрытые, оценочный конец) | ровно `['delete-period']`; confirm с диапазоном start–lastDay |
| 3 | Б: второй и следующие дни | ровно `['end-here', 'set-start']` |
| 4 | В: без соседних месячных | ровно `['start']` |
| 5 | В: 4 дня после конца | `['start', 'extend-to']` |
| 6 | В: 8 дней после конца / итог > 15 | `['start']` |
| 7 | В: 2 дня до начала | `['start', 'set-next-start']` |
| 8 | В: 4 дня до начала / итог > 15 | `['start']` |
| 9 | В: 3 после и 3 до | `['start', 'extend-to', 'set-next-start']` |
| 10 | `apply` каждого действия, переход через месяц и год | ожидаемые отметки |
| 11 | `normalizePeriods`: вплотную, перекрытие, цепочка из трёх, оценочный конец, переход через месяц, незакрытые идущие (конец = сегодня, оценочный), > 15 дней — не сливаются | — |
| 12 | `markPeriodStart` вплотную к предыдущим → одни месячные; `extend-to` до дня перед следующими → одни месячные | — |
| 13 | `set-next-start` вплотную к предыдущим → слияние; итог > 15 → кнопки нет | — |
