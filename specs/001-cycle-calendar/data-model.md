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

- Периоды не пересекаются: для любых двух `a.start < b.start` выполняется `(a.end ?? a.start) < b.start`.
- Если отмечено новое начало, а у предыдущего периода `end = null`, предыдущий закрывается днём
  `min(start_prev + defaultPeriodLength − 1, start_new − 1)`.
- Длина периода (`end − start + 1`) — 1…15 дней; больше — ошибка ввода с подсказкой.

**Переходы состояний** (через карточку дня, FR-009):

```text
(нет) --«Начало» в день D--> {start: D, end: null}
{start, end: null} --«Конец» в день E (E >= start)--> {start, end: E}
{start, end} --«Конец» в другой день E'--> {start, end: E'}
любой --«Снять отметку»--> удалён (если день = start) / end = день − 1 (если день внутри)
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
| `isOutlier` | boolean | `length < 15 \|\| length > 60` — не участвует в среднем |

### Forecast

| Поле | Тип | Описание |
|------|-----|----------|
| `cycleLength` | number | среднее последних 6 не-выбросов, округлённое, или `defaultCycleLength` |
| `periodLength` | number | среднее последних 6 периодов с концом, или `defaultPeriodLength` |
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
| `fertile` | boolean |
| `ovulation` | boolean |
| `probability` | `'low' \| 'medium' \| 'high' \| null` |
| `isToday` | boolean |
| `hasEntry` | boolean |

Приоритет при пересечении: отмеченные месячные > прогнозные месячные; фертильность и
овуляция сохраняются и при пересечении (для очень коротких циклов), вероятность — максимальная.

## Резервная копия

Формат — см. [contracts/backup-format.md](./contracts/backup-format.md). Включает Period, DayEntry,
Settings; **не** включает PushState (токен — секрет устройства).

## Версионирование схемы

- `SCHEMA_VERSION = 1`. Каждая следующая версия добавляет `db.version(n)` и функцию
  `migrate_{n-1}_to_{n}`, используемую и для IndexedDB, и для импорта старых резервных копий.
- Миграции не удаляют неизвестные поля и идемпотентны (Конституция III).
