# Data Model: Правила корректности настроек и месячных — в домене

Хранимые данные не меняются: `SCHEMA_VERSION = 6`, таблицы `periods`, `days`, `kv`, форма записей, формат
резервной копии — прежние. Ниже — правила, которые переезжают в домен, и новый тип ошибки.

## Настройки (`Settings`, запись `kv` под ключом `SETTINGS_KEY = 'settings'`)

Правила по полям (`src/domain/settings.ts`), прежние, из `backup.ts`:

| Поле | Корректное значение | По умолчанию |
|------|---------------------|--------------|
| `defaultCycleLength` | целое 21…45 (`CYCLE_LENGTH_RANGE`) | 28 |
| `defaultPeriodLength` | целое 2…10 (`PERIOD_LENGTH_RANGE`) | 5 |
| `ovulationShift` | целое −5…+5 (`OVULATION_SHIFT_RANGE`) | 0 |
| `remindPeriod` | логическое | `true` |
| `remindOvulation` | логическое | `true` |
| `showWellbeing` | логическое | `false` |
| `showNotes` | логическое | `false` |
| `ovulationShiftEnabled` | логическое | `false` |
| `ovulationFromNextPeriod` | логическое | `false` |
| `remindMissedPeriod` | логическое | `true` |
| `showMood` | логическое | `false` |
| `showIntensity` | логическое | `false` |
| `showSex` | логическое | `false` |

«Целое» — `Number.isInteger` (нет `NaN`, `Infinity`, дробных и строк). Границы включительно.

### Приведение по путям

| Путь | Вход | Запасное значение | Неизвестные поля входа | Неизвестные поля запасного |
|------|------|-------------------|------------------------|----------------------------|
| Чтение из базы (`getSettings`) | значение записи или `undefined` | `DEFAULT_SETTINGS` | **сохраняются** (после 13 полей, в порядке записи) | — |
| Импорт (`parseBackup`) | `data.settings` после миграций | настройки устройства (`current`) | отбрасываются | сохраняются |
| Изменение (`updateSettings`) | результат `getSettings` + изменение | — | сохраняются | — |

Вход — не объект (`undefined`, `null`, строка, число, список) → запасное значение (новый объект).

### Переход «некорректное поле в базе»

```text
в базе: { …, defaultCycleLength: 'abc', futureField: 1 }
  getSettings → { …, defaultCycleLength: 28, futureField: 1 }       (база не меняется)
  updateSettings({ showNotes: true })
    → в базе: { …, defaultCycleLength: 28, showNotes: true, futureField: 1 }
```

## Месячные (`Period`) из резервной копии

Строгая проверка (`validatePeriods`, `src/domain/periodValidation.ts`) — только при импорте; чтение из базы
(`getPeriods`) месячные не проверяет и не фильтрует.

### Ошибка проверки (`PeriodValidationError`)

Проверки идут в порядке строк таблицы, по каждой записи в порядке входа; возвращается первая ошибка. Текст
строит `backup.ts` и оборачивает в `Файл резервной копии повреждён: <текст>`.

| `code` | Параметры | Когда | Текст (прежний, символ в символ) |
|--------|-----------|-------|----------------------------------|
| `not-a-list` | — | вход — не список | `нет списка месячных` |
| `not-an-object` | — | запись — не объект (в т. ч. `null`, список) | `запись месячных не объект` |
| `invalid-id` | `id: unknown` | `id` — не строка или пустая строка | `` некорректный или повторный id: ${String(id)} `` |
| `duplicate-id` | `id: string` | `id` уже встречался | `` некорректный или повторный id: ${id} `` |
| `invalid-start` | `start: unknown` | `start` — не корректная дата `YYYY-MM-DD` | `` некорректная дата начала: ${String(start)} `` |
| `invalid-end` | `end: unknown` | `end` — не `null` и не корректная дата (в т. ч. поля нет) | `` некорректная дата конца: ${String(end)} `` |
| `invalid-end-estimated` | — | `endEstimated` — не логическое (в т. ч. поля нет) | `нет признака endEstimated` |
| `end-before-start` | `start: LocalDate` | `end < start` | `` конец раньше начала: ${start} `` |
| `too-long` | `start: LocalDate`, `maxDays: number` | `end − start + 1 > 15` | `` месячные длиннее ${maxDays} дней: ${start} `` |
| `overlap` | `first: LocalDate`, `second: LocalDate` | после объединения последний день одних месячных (`periodEnd`, для незакрытых — оценка) не раньше начала следующих: объединение было бы длиннее 15 дней. Соприкосновение без пересечения — не ошибка | `` месячные пересекаются: ${first} и ${second} `` |

Корректный вход → месячные только с полями `id`, `start`, `end`, `endEstimated` (лишние поля отбрасываются),
объединённые `normalizePeriods(…, today, periodLength)` и отсортированные по началу.

## Общая проверка «это объект» (`isObject`, `src/domain/guards.ts`)

`typeof v === 'object' && v !== null && !Array.isArray(v)`. Заменяет `isRecord` (`dayEntry.ts`) и `isObject`
(`backup.ts`) — тело то же.
