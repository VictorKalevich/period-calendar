# Data Model: Календарь цикла

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Все даты — `LocalDate` (`YYYY-MM-DD`, см. R1). Хранимые сущности живут в IndexedDB на устройстве;
производные (Cycle, Forecast, DayInfo) вычисляются чистыми функциями домена и не хранятся.

## Хранимые сущности (IndexedDB, база `cycle-calendar`, схема v1)

### Period — месячные

| Поле | Тип | Правила |
|------|-----|---------|
| `id` | string (UUID) | первичный ключ |
| `start` | LocalDate | индекс; не позже «сегодня» |
| `end` | LocalDate \| null | `end >= start`; не позже «сегодня»; `null` — конец не отмечен |
| `endEstimated` | boolean | `true` — конец проставлен автоматически; такие периоды не входят в среднюю длину месячных (FR-014). По умолчанию `false` |

- Периоды не пересекаются: для любых двух `a.start < b.start` выполняется `(a.end ?? a.start) < b.start`.
- Если отмечено новое начало, а у предыдущего периода `end = null`, предыдущий закрывается днём
  `min(start_prev + periodLength − 1, start_new − 1)`, где `periodLength` — прогнозируемая длина
  месячных (без истории — `defaultPeriodLength`), и получает `endEstimated = true`.
- Длина периода (`end − start + 1`) — 1…15 дней; больше — ошибка `too-long` с подсказкой.
- Начало внутри существующего периода — ошибка `inside-existing`. Для дней внутри месячных диалог
  предлагает «Установить как начало» (`setPeriodStart`) и «Отметить конец в этот день»
  (`markPeriodEnd`) — состав диалога по фиче 003 (`periodActionsFor`).

**Переходы состояний** (через карточку дня, FR-009):

```text
(нет) --«Начало» в день D--> {start: D, end: null, endEstimated: false}
{start, end: null} --«Конец» в день E (E >= start)--> {start, end: E, endEstimated: false}
{start, end: null} --«Начало» следующих месячных--> {start, end: оценка, endEstimated: true}
{start, end} --«Конец» в другой день E'--> {start, end: E', endEstimated: false}
{start, end} --«Установить как начало» на день D внутри--> {start: D, end} (003: конец сохраняется)
любой --«Снять отметку»--> удалён (если день = start) / end = день − 1, endEstimated: false (если день внутри)
```

### DayEntry — запись дня

| Поле | Тип | Правила |
|------|-----|---------|
| `date` | LocalDate | первичный ключ |
| `symptoms` | SymptomId[] | уникальные значения из справочника (FR-010) |
| `mood` | MoodId \| null | одно значение из справочника (FR-011) |
| `note` | string | 0…1000 символов, обрезка пробелов по краям |

- Запись без симптомов, настроения и заметки удаляется.
- Справочники — константы в коде (`src/domain/catalog.ts`), хранятся только идентификаторы:
  - `SymptomId`: `cramps`, `headache`, `backache`, `bloating`, `breast_tenderness`, `acne`, `fatigue`,
    `nausea`, `cravings`, `insomnia`.
  - `MoodId`: `great`, `calm`, `sensitive`, `irritable`, `sad`, `anxious`.

### Settings — настройки (одна запись, ключ `settings`)

| Поле | Тип | По умолчанию | Правила |
|------|-----|--------------|---------|
| `defaultCycleLength` | number | 28 | 21…45 |
| `defaultPeriodLength` | number | 5 | 2…10 |
| `remindPeriod` | boolean | true | FR-024 |
| `remindOvulation` | boolean | true | FR-024 |

### PushState — состояние подписки (одна запись, ключ `push`)

| Поле | Тип | Правила |
|------|-----|---------|
| `clientId` | string (UUID) | генерируется при первом включении напоминаний |
| `token` | string | 32 байта base64url; никогда не экспортируется в резервную копию |
| `subscribed` | boolean | есть активная подписка |
| `pendingSync` | boolean | расписание изменилось, но не отправлено (офлайн) |
| `lastSyncedHash` | string \| null | хэш последнего отправленного списка — чтобы не слать дубликаты |

**Индексы Dexie v1**: `periods: 'id, start'`, `days: 'date'`, `kv: 'key'` (Settings и PushState).

## Производные сущности (домен, `src/domain/`)

### Cycle

| Поле | Тип | Описание |
|------|-----|----------|
| `start` | LocalDate | начало месячных |
| `length` | number \| null | дней до начала следующих месячных; `null` для текущего цикла |
| `periodLength` | number \| null | длина месячных, если конец отмечен |
| `periodEndEstimated` | boolean | конец месячных проставлен автоматически |
| `isOutlier` | boolean | `length < 15 \|\| length > 60` — не участвует в среднем |

### Forecast

| Поле | Тип | Описание |
|------|-----|----------|
| `cycleLength` | number | среднее последних 6 не-выбросов, округлённое, или `defaultCycleLength` |
| `periodLength` | number | среднее последних 6 периодов с концом и `endEstimated = false`, или `defaultPeriodLength` |
| `confidence` | `'normal' \| 'low'` | `low`, если не-выбросов среди завершённых циклов < 3 или `max − min` длин циклов, учтённых в среднем, > 7 (FR-019a) |
| `delayDays` | number | `max(0, today − predictedStart)`; при > 0 прогноз сдвигается на «сегодня» |
| `cycles` | PredictedCycle[] | текущий + прогнозируемые циклы на 12 месяцев вперёд |

`PredictedCycle`: `start`, `periodDays` (`start…start+periodLength−1`), `ovulation`
(`nextStart − 14`), `fertile` (`ovulation − 5 … ovulation`), `mediumDays`
(`ovulation − 7`, `ovulation − 6`, `ovulation + 1`). Для завершённых циклов те же поля вычисляются
ретроспективно от фактического начала следующих месячных.

### DayInfo — всё, что нужно для отрисовки одного дня

| Поле | Тип |
|------|-----|
| `date` | LocalDate |
| `cycleDay` | number \| null (null до первой отметки) |
| `period` | `'actual' \| 'predicted' \| null` |
| `fertile` | `'predicted' \| 'past' \| null` (`past` — день окна раньше `today`, в любом цикле, включая текущий: заливка без пунктира; `predicted` — сегодня и позже) |
| `ovulation` | boolean (для прошлых циклов тоже, с короной) |
| `phase` | `'menstrual' \| 'follicular' \| 'ovulation' \| 'luteal' \| null` (FR-019b; null до первой отметки) |
| `probability` | `'low' \| 'medium' \| 'high' \| null` |
| `isToday` | boolean |
| `hasEntry` | boolean |

Незакрытые текущие месячные (`end = null`) дорисовываются до `start + forecast.periodLength − 1`, а
без прогноза — до `start + defaultPeriodLength − 1`: дни ≤ сегодня — `actual`, позже — `predicted`.

Фаза: дни месячных (`actual` или `predicted`) → `menstrual`; день овуляции → `ovulation`; между
концом месячных и овуляцией → `follicular`; после овуляции до следующих месячных → `luteal`.
Приоритет фазы при пересечении: `menstrual` > `ovulation`.

Приоритет при пересечении: отмеченные месячные > прогнозные месячные; фертильность и
овуляция сохраняются и при пересечении (для очень коротких циклов), вероятность — максимальная.

### CycleStats — статистика

`avgCycleLength` и `avgPeriodLength` — **те же** значения, что `Forecast.cycleLength` и
`Forecast.periodLength` (последние 6, без выбросов и оценочных концов), либо `null`, если
завершённых циклов / периодов с отмеченным концом нет; подпись в UI — «по последним 6 циклам».
`history` — все циклы от новых к старым, включая выбросы.

## Резервная копия

Формат — см. [contracts/backup-format.md](./contracts/backup-format.md). Включает Period, DayEntry,
Settings; **не** включает PushState (токен — секрет устройства).

## Версионирование схемы

- `SCHEMA_VERSION = 1`. Каждая следующая версия добавляет `db.version(n)` и функцию
  `migrate_{n-1}_to_{n}`, используемую и для IndexedDB, и для импорта старых резервных копий.
- Миграции не удаляют неизвестные поля и идемпотентны (Конституция III).
