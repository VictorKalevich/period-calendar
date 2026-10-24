# Research: фича 006

## R1. Правило овуляции в двух режимах

- **Decision**: одна функция `ovulationFor({ start, periodLast, nextStart }, settings)`:
  - выключено: `raw = start + 13 + shift` (как в 005);
  - включено: `raw = nextStart − 14 + shift`, затем `max(raw, periodLast + 1)` (FR-005);
  - в обоих режимах затем `min(…, nextStart − 1)` (005 FR-003a — главнее).
  `shift = ovulationShiftOf(settings)` без изменений. Константа `LUTEAL_PHASE_DAYS = 14` рядом с
  `OVULATION_DAY_OFFSET`.
- **Rationale**: окно, средние дни, фазы, плашка и напоминания уже строятся от
  `PredictedCycle.ovulation` — достаточно поменять одну точку.
- **Alternatives**: отдельная функция на режим — дублирует ограничения; хранить режим в прогнозе —
  лишнее, режим — настройка.

## R2. «Следующие месячные» по видам циклов

- **Decision**: `nextStart` для расчёта — тот же `ovulationBound`, что в 005: прошлый — фактическое
  начало следующих; текущий — `predictedStart` (без задержки); прогнозный — `s + cycleLength`.
- **Rationale**: требование спецификации; уже реализовано для FR-003a.

## R3. Последний день месячных цикла (нижняя граница)

- **Decision**: `cycleFrom` получает `periodLast`: прошлый и текущий — `periodEnd(period,
  periodLength)` (отмеченный или оценочный конец; у незакрытых — по прогнозируемой длине);
  прогнозный — `start + periodLength − 1`. `buildForecast` берёт месячные в порядке начала (как
  `buildCycles`).
- **Rationale**: FR-005; `periodEnd` уже есть в `periods.ts`. Конфликт с FR-003a невозможен:
  месячные не бывают соседними, значит `periodLast + 1 ≤ nextStart − 1`; `min` всё равно последним.

## R4. Схема v4

- **Decision**: `Settings.ovulationFromNextPeriod: boolean` (по умолчанию `false`);
  `SCHEMA_VERSION = 4`, `db.version(4).upgrade` + `migrations[3]` (`?? false`); копия
  `schemaVersion: 4`, `validateSettings` требует boolean; копии v1–v3 проходят миграции и получают
  `false`.
- **Rationale**: Конституция III, чек-лист `src/storage/migrations/README.md`, как в 004/005.

## R5. Настройки и «Подробнее»

- **Decision**: в `SettingsScreen` блок «Учитывать личный сдвиг овуляции» (переключатель, подсказка,
  `Stepper`) переносится в конец карточки «Цикл»; ниже — `<label className="toggle">` «Считать от
  следующей менструации» и под ним `<p className="t-caption settings-card__hint">` с описанием,
  виден всегда. В `Disclaimer` абзац об овуляции выбирается по режиму: «на 14-й день цикла …» или
  «примерно за 14 дней до ожидаемого начала следующих месячных, но не раньше дня после месячных и не
  позже дня перед следующими»; строка о сдвиге — в обоих режимах.
- **Rationale**: существующие классы и компоненты, без новых токенов (design.md).
