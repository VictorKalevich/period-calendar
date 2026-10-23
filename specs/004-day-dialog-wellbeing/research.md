# Research: Диалог дня, фаза в карточке, «Самочувствие» и «Заметки» по выбору

## R1. Хранение переключателей и миграция

- **Decision**: поля `showWellbeing`, `showNotes` в `Settings` (запись `kv/settings`), по умолчанию
  `false`. `SCHEMA_VERSION` 1 → 2: `db.version(2)` с теми же таблицами и `upgrade`, дописывающим
  отсутствующие поля в сохранённые настройки; `migrations[1]` — та же правка для данных резервной
  копии (идемпотентна, явные значения не трогает). Экспорт пишет `schemaVersion: 2`.
- **Rationale**: Конституция III — любое изменение формы хранимых данных через версию и миграцию с
  тестом; общий `migrateData` уже применяется к импорту.
- **Alternatives**: только значения по умолчанию в `getSettings` без версии — формат копии менялся
  бы без версии, старое приложение молча теряло бы поля.

## R2. Правила видимости и состава диалога

- **Decision**: чистые функции в `src/domain/dayDialog.ts`:
  - `dayDialogFor(date, today, periods, periodLength, settings)` → `{ title, periodActions, extras, opens }`
    (`periodActions` — из `periodActionsFor` фичи 003, `extras` ⊂ `['wellbeing','notes']`);
  - `hasWellbeing(entry)`, `hasNote(entry)`, `visibleEntryDates(entries, settings)`,
    `visibleEntryParts(entry, settings)` — для индикатора и сводки;
  - `cardPhase(info, forecast)` — фаза для карточки (нет при задержке и без прогноза).
- **Rationale**: FR-012 — все комбинации тестируются без DOM; UI только рисует.

## R3. Где показывается фаза

- **Decision**: строка под заголовком карточки («24 октября · 10-й день» → ниже «Фолликулярная
  фаза»), 14 px `muted`, на месте прежних кнопок в составе карточки.
- **Rationale**: пример из запроса; кнопки убраны, их функции — в диалоге.

## R4. Диалог

- **Decision**: `PeriodSheet` → `DayDialog`: заголовок `formatDayMonthRu(date)`; кнопки месячных из
  `periodActionsFor`, подтверждение «Удалить период» как в 003; затем «Самочувствие», «Заметки»;
  «Отмена». Кнопки самочувствия/заметок закрывают диалог и открывают существующие листы.
