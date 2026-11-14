# Contract: правила корректности в домене и их вызовы

Внутренние интерфейсы модулей приложения. Внешние интерфейсы (формат резервной копии, запросы к воркеру,
схема IndexedDB) не меняются.

## `src/domain/guards.ts` (новый)

```ts
/** Обычный объект: не `null` и не список. */
export const isObject: (v: unknown) => v is Record<string, unknown>;
```

## `src/domain/settings.ts` (новый)

```ts
/**
 * Приводит значение к корректным настройкам: каждое известное поле — из `raw`, если оно корректно, иначе из
 * `fallback`. Неизвестные поля `raw` отбрасываются, неизвестные поля `fallback` сохраняются. Не объект —
 * копия `fallback`. Всегда новый объект; `raw` и `fallback` не меняются. Никогда не бросает исключение.
 */
export function coerceSettings(raw: unknown, fallback: Readonly<Settings>): Settings;

/** Собственные поля `raw`, которых нет в `Settings`, в порядке `raw`; не объект — `{}`. */
export function extraSettingFields(raw: unknown): Record<string, unknown>;
```

Правила полей — `data-model.md`, «Настройки». Импортирует только `./types` и `./guards`.

## `src/domain/periodValidation.ts` (новый)

```ts
export type PeriodValidationError =
  | { code: 'not-a-list' }
  | { code: 'not-an-object' }
  | { code: 'invalid-id'; id: unknown }
  | { code: 'duplicate-id'; id: string }
  | { code: 'invalid-start'; start: unknown }
  | { code: 'invalid-end'; end: unknown }
  | { code: 'invalid-end-estimated' }
  | { code: 'end-before-start'; start: LocalDate }
  | { code: 'too-long'; start: LocalDate; maxDays: number }
  | { code: 'overlap'; first: LocalDate; second: LocalDate };

/**
 * Строгая проверка списка месячных из внешнего источника (резервная копия): каждая запись по порядку до
 * первой ошибки, затем объединение пересекающихся и соседних (`normalizePeriods`); пересечение, которое
 * нельзя объединить, — ошибка (003 FR-015). Никогда не бросает исключение на любом `input`.
 */
export function validatePeriods(
  input: unknown,
  today: LocalDate,
  periodLength: number,
): Result<Period[], PeriodValidationError>;
```

Порядок проверок и случаи — `data-model.md`, «Ошибка проверки». Импортирует только `./types`, `./dates`,
`./periods`, `./guards`.

## `src/domain/dayEntry.ts` (правка)

`isRecord` удаляется, используется `isObject` из `./guards`. Экспорт и поведение не меняются.

## `src/storage/repository.ts` (правка)

```ts
export const SETTINGS_KEY = 'settings';

/** Правила по полям с запасом DEFAULT_SETTINGS; неизвестные поля записи сохраняются (не теряются при updateSettings). */
export async function getSettings(): Promise<Settings>;
// = { ...coerceSettings(raw, DEFAULT_SETTINGS), ...extraSettingFields(raw) }, raw = (await db.kv.get(SETTINGS_KEY))?.value
```

`saveSettings`, `updateSettings`, `getPeriods`, `savePeriods` и остальные функции не меняются.

## `src/storage/backup.ts` (правка)

- Удаляются: `isObject`, `isIntIn`, `isBool`, `SETTING_RULES`, `parseSettings`, `parsePeriods`, `mergeImported`.
- Добавляется закрытая `periodErrorText(e: PeriodValidationError): string` — коды в прежние тексты
  (`data-model.md`).
- `parseBackupUnsafe`: `coerceSettings(data.settings, current)`; затем
  `validatePeriods(data.periods, toLocalDate(new Date()), settings.defaultPeriodLength)`; при ошибке —
  `{ ok: false, error: corrupted(periodErrorText(error)) }`. Порядок шагов прежний: настройки → месячные →
  записи дней.
- `applyBackup` пишет `{ key: SETTINGS_KEY, value: b.settings }`.
- Экспорт модуля (`BACKUP_FORMAT`, `BackupFile`, `ParsedBackup`, `buildBackup`, `exportBackup`,
  `parseBackup`, `applyBackup`) и тексты `NOT_A_BACKUP`, `TOO_NEW`, `corrupted` не меняются.

## Не меняются

`src/storage/db.ts` (в т. ч. литералы `'settings'` в `this.version(…)`), `src/storage/migrations/`,
`src/push/` (литерал в `sync.ts` — шаг 5), `src/ui/`, `src/hooks/`, `worker/`.
