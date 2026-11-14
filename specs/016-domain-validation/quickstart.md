# Quickstart: проверка фичи 016

Команды `npm …` запускать из PowerShell в папке проекта: из Git Bash с `cd /c/…` Vitest не стартует.

## 1. Автоматические проверки

```powershell
npm test
npm run build
```

Ожидается: всё зелёное, тестов не меньше базовых 695. `worker/` не меняется, его проверки не нужны.

Тесты фичи отдельно:

```powershell
npx vitest run src/domain/guards.test.ts src/domain/settings.test.ts src/domain/periodValidation.test.ts src/storage/backupRules.test.ts src/storage/settingsRead.test.ts src/storage/validationPlacement.test.ts src/domain/isolation.test.ts
```

| Файл | Что подтверждает |
|------|------------------|
| `src/domain/settings.test.ts` | SC-001, FR-001, FR-002: каждое из 13 полей — корректное принимается, некорректное заменяется запасным; не объект — копия запасного; неизвестные поля |
| `src/domain/periodValidation.test.ts` | SC-002, FR-006, FR-007: каждый код ошибки с параметрами; первая ошибка по порядку; корректный список; объединение и «сегодня» |
| `src/domain/guards.test.ts` | FR-011: `isObject` |
| `src/storage/backupRules.test.ts` | SC-003, FR-003, FR-008: точные тексты ошибок импорта (зелёный до и после переноса); настройки при импорте |
| `src/storage/settingsRead.test.ts` | SC-004, FR-004, FR-005: чтение корректных настроек — прежнее (значения и порядок ключей, неизвестные поля); некорректное поле и не объект — значения по умолчанию; `updateSettings` не теряет неизвестные поля |
| `src/storage/validationPlacement.test.ts` | SC-005, FR-010–FR-012: в `backup.ts` нет правил по полям; ключ настроек — одна константа; одна проверка «это объект» |
| `src/domain/isolation.test.ts` | FR-013: новые файлы домена не импортируют хранилище, UI, push и не читают время |
| `src/storage/backup.test.ts`, `repository.test.ts`, `migrations/migrations.test.ts`, `upgrade-v2.test.ts` | без изменений и зелёные |

## 2. Существующие тесты не изменены

```powershell
git diff --stat refactoring...HEAD -- "*.test.ts" "*.snap"
```

Ожидается: только новые файлы из таблицы выше.

## 3. Правила не в модуле резервной копии

```powershell
git grep -n -E "RANGE|MAX_PERIOD_DAYS|isLocalDate|isIntIn|SETTING_RULES|const isObject" -- src/storage/backup.ts
git grep -n "'settings'" -- src/storage/repository.ts src/storage/backup.ts
git grep -n "isRecord" -- src/domain
```

Ожидается: первая и третья команды — пусто; вторая — одна строка (`export const SETTINGS_KEY = 'settings'`).
То же проверяет `src/storage/validationPlacement.test.ts`.

## 4. Объём шага

```powershell
git diff --stat refactoring...HEAD
```

Ожидается: изменены только `src/domain/dayEntry.ts`, `src/storage/repository.ts`, `src/storage/backup.ts`;
новые — три файла домена, шесть файлов тестов и `specs/016-domain-validation/`. `src/storage/db.ts`,
`src/storage/migrations/`, `src/push/`, `src/ui/`, `worker/` — без изменений.

Проверка кодировки диффа (без испорченной кириллицы и BOM) — перед каждым коммитом.
