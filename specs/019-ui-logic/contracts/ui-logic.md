# Contract: вспомогательные функции, решения интерфейса и `Toggle`

Внутренний контракт модулей приложения (внешних интерфейсов шаг не меняет). Все функции — чистые: не
меняют вход, не читают часы, хранилище и DOM.

## `src/domain/plural.ts`

```ts
/** «1 запись», «2 записи», «5 записей»: число, пробел, форма слова. */
export function pluralRu(n: number, forms: [one: string, few: string, many: string]): string;
```

Форма: `n % 10 === 1 && n % 100 !== 11` → `one`; `n % 10` в 2…4 и `n % 100` не в 12…14 → `few`; иначе
`many`. Ожидаемые значения для `['запись', 'записи', 'записей']`: 0 → «0 записей», 1 → «1 запись»,
2 → «2 записи», 4 → «4 записи», 5 → «5 записей», 11 → «11 записей», 12 → «12 записей»,
14 → «14 записей», 21 → «21 запись», 22 → «22 записи», 25 → «25 записей», 101 → «101 запись»,
111 → «111 записей», 112 → «112 записей», 122 → «122 записи».

## `src/domain/dates.ts` (дополнения)

```ts
/** «08.11.2026» */
export const formatDateNumeric: (d: LocalDate) => string;
/** «8 ноября 2026» */
export function formatFullDateRu(d: LocalDate): string;
```

- `formatDateNumeric` — тот же код, что был в `report.ts`. Ожидаемые значения: `2026-11-08` →
  «08.11.2026», `2024-02-29` → «29.02.2024», `2017-12-23` → «23.12.2017».
- `formatFullDateRu`: `2026-11-08` → «8 ноября 2026», `2027-01-01` → «1 января 2027», `2024-02-29` →
  «29 февраля 2024», `2026-12-31` → «31 декабря 2026». Значения не зависят от часового пояса и летнего
  времени (`Pacific/Kiritimati`, `America/Los_Angeles`, даты 2026-03-08 и 2026-11-01).
- `formatRangeRu(from, to)` при разных годах — `` `${formatFullDateRu(from)} – ${formatFullDateRu(to)}` ``;
  остальные ветки без изменений.
- `formatShiftRu(n)` — `` `${sign}${pluralRu(Math.abs(n), ['день', 'дня', 'дней'])}` ``; результат прежний
  (`dates.test.ts`).

## `src/domain/cycleText.ts` (дополнение)

```ts
/** Похоже ли содержимое на текстовую выгрузку месячных. */
export const looksLikeCycleText: (text: string) => boolean; // /period start date:/i
```

Перенесена без изменений из `src/storage/textImport.ts`; там больше не определяется.

## `src/domain/importFile.ts`

```ts
export type ImportFileKind = 'backup' | 'cycle-text' | 'unknown';
export function importFileKind(text: string): ImportFileKind;
```

Правило — `data-model.md`, «ImportFileKind». Ожидаемые значения: `'{"a":1}'`, `'  \n\t{'`,
знак U+FEFF перед `{`, `'{ "x": "Period start date: 2017-12-23" }'` → `'backup'`;
`'cycle 1\nPeriod start date: 2017-12-23'`, `'PERIOD START DATE:'` → `'cycle-text'`; `''`, `'   '`,
`'hello'`, `'[1,2]'` → `'unknown'`.

## `src/domain/symptomSelection.ts`

```ts
export interface SymptomSelection {
  symptoms: SymptomId[];
  intensity: Partial<Record<SymptomId, Intensity>>;
}
export function initialSymptomSelection(entry: DayEntry | undefined, showIntensity: boolean): SymptomSelection;
export function toggleSymptom(sel: SymptomSelection, id: SymptomId, showIntensity: boolean): SymptomSelection;
export function setSymptomIntensity(sel: SymptomSelection, id: SymptomId, level: Intensity): SymptomSelection;
```

Правила — `data-model.md`, «SymptomSelection». Вход не меняется (проверяется заморозкой входа в тесте).

## `src/ui/components/reminderToggle.ts`

```ts
export type ReminderToggleAction = 'unsubscribe' | 'subscribe' | 'none';
export function reminderToggleAction(
  next: Pick<Settings, 'remindPeriod' | 'remindOvulation' | 'remindMissedPeriod'>,
  subscribed: boolean,
  permission: ReturnType<typeof notificationPermission>,
): ReminderToggleAction;
```

Правило — `data-model.md`, «ReminderToggleAction». Таблица тестов: 8 сочетаний флагов × `subscribed` ×
`permission` ∈ {`granted`, `default`, `denied`, `unsupported`}.

## `src/ui/components/Toggle.tsx`

```ts
export function Toggle(props: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  describedBy?: string;
  onChange: (checked: boolean) => void;
}): JSX.Element;
```

`renderToStaticMarkup` — ожидаемые строки:

| Вариант | Строка |
|---------|--------|
| без подсказки, включён | `<label class="toggle"><span>Учитывать личный сдвиг овуляции</span><input type="checkbox" role="switch" checked=""/></label>` |
| со ссылкой на пояснение, выключен | `<label class="toggle"><span>Считать от следующей менструации</span><input type="checkbox" role="switch" aria-describedby="ovulation-mode-hint"/></label>` |
| с подсказкой, выключен | `<label class="toggle"><span>Настроение<span class="t-small toggle__hint">Можно выбрать несколько</span></span><input type="checkbox" role="switch"/></label>` |
| с подсказкой, недоступен, включён | `<label class="toggle"><span>За 2 дня до месячных<span class="t-small toggle__hint">…</span></span><input type="checkbox" role="switch" disabled="" checked=""/></label>` |

Серверная отрисовка React выводит `checked` у `input` последним, после остальных атрибутов в порядке
свойств (выяснено характеризацией T002: `aria-describedby="…" checked=""`).

Нажатие вызывает `onChange` с новым состоянием (`true` для выключенного, `false` для включённого).
