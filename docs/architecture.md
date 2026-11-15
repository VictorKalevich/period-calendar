# Архитектура

Короткая карта кода «Календаря цикла» (состояние после шагов рефакторинга 1–6). Точные правила слоёв —
`src/architecture.test.ts`; принципы — `.specify/memory/constitution.md`; интерфейс — `docs/design/design.md`.

## Слои

Разрешено только то, что названо; импорт внутри своего слоя — всегда.

| Слой | Может импортировать | Зачем |
|------|---------------------|-------|
| `src/domain` | свои файлы, `date-fns` | чистые функции: даты `YYYY-MM-DD`, прогноз, правила данных; «сегодня» — параметром, часы не читает |
| `src/storage` | `domain`, `dexie` | IndexedDB: схема и миграции, `repository.ts`, резервная копия, текстовый импорт |
| `src/report` | `domain` | отчёт для врача: страницы и PDF |
| `src/push` | `domain`, `storage` | подписка на push и синхронизация расписания с воркером |
| `src/hooks` | `domain`, `storage`, `react` | живые запросы, «сегодня» и прогноз для экранов |
| `src/pwa` | `virtual:pwa-register` | обновление приложения; разбор push-данных для service worker |
| `src/ui` | все слои, `react`, `react-dom` | экраны и компоненты из дизайн-системы |
| `src/main.tsx` | все слои, `react`, `react-dom` | точка сборки: обновления, нормализация, синхронизация, отрисовка |
| `src/sw.ts` | `pwa`, `workbox-core`, `workbox-precaching` | service worker: кэш сборки и уведомления |
| `src/vite-env.d.ts` | — | объявления типов сборки |
| `worker/src` | свои файлы | Cloudflare Worker: API, cron, Web Push; без runtime-зависимостей |

Исключения: Dexie (`liveQuery`) ещё в `src/hooks/useLiveQuery.ts` и `src/push/sync.ts`. Тесты правилам
не подчиняются: контрактный тест `worker/test/contract.test.ts` импортирует `src/domain` и `src/pwa`.
Новый каталог, пакет или исключение — сначала строка в таблице теста и здесь (тест сверяет слои).

## Пути данных

- **Чтение.** Экран → `useLiveQuery(getX, deps)` (`src/hooks/useLiveQuery.ts`) → функции чтения
  `src/storage/repository.ts`, которые приводят записи правилами домена. `useForecast` строит прогноз и
  сводку дня (`buildForecast`, `todaySummary`). Ошибка запроса уходит в `ErrorBoundary` — аварийный экран.
  При смене `deps` хук отдаёт значение прежних `deps`, пока не придёт новое: вызывающий проверяет, к чему
  оно относится (как `src/ui/screens/CalendarScreen.tsx`).
- **Запись.** Компоненты вызывают репозиторий, отказ показывают `SaveError` (`useSaveError`,
  `src/ui/attempt.ts`). День — `updateDayEntry(date, { поле })`: транзакция поверх сохранённой записи,
  только своё поле. Настройки — `updateSettings(patch)`. Месячные — `savePeriods` целиком, по результату
  `PeriodAction` (`src/domain/periods.ts`). При запуске `src/main.tsx` вызывает `normalizeStoredPeriods`.
- **Резервная копия и импорт.** `src/storage/backup.ts`: `exportBackup` — JSON; `parseBackup` —
  `migrateData` (`src/storage/migrations/index.ts`), затем `coerceSettings`, `validatePeriods`,
  `coerceDayEntry`; `applyBackup` — одна транзакция. Текстовая выгрузка — `src/storage/textImport.ts`.
  Формат — `specs/001-cycle-calendar/contracts/backup-format.md`.
- **Напоминания.** `startReminderSync` (`src/push/sync.ts`): проход при запуске, через 2 с после изменения
  месячных или настроек, при появлении сети и возврате в приложение. Проход — `syncPass`, повтор во время
  идущего — `createSyncRunner` (`src/push/syncCore.ts`): `planReminders` → `toServerReminders` (только
  `id`, `sendAt`, `title`, `body`) → `PUT` на воркер; отказ — `pendingSync`. Воркер
  (`worker/src/index.ts`, cron раз в час) шлёт Web Push; `src/sw.ts` показывает уведомление через
  `notificationFromPush` (`src/pwa/pushNotification.ts`). Контракт — `worker/test/contract.test.ts` и
  `specs/001-cycle-calendar/contracts/push-worker-api.md`.
- **Обновление.** `registerUpdates` (`src/pwa/registerUpdates.ts`) → `createUpdateController`
  (`src/pwa/updateController.ts`): новая сборка перезагружает приложение один раз, а если открыт диалог или
  идёт ввод — показывает `UpdateBanner`. IndexedDB при обновлении не трогается.
- **Отчёт.** `DoctorReportButton` → `createReportFile` (`src/report/render.ts`) → `buildDoctorReport`,
  `reportView` (`src/domain/report.ts`) → `jpegPagesToPdf` (`src/report/pdf.ts`) → «Поделиться» или
  скачивание (`src/ui/components/share.ts`).

## Правила корректности данных

Все — в домене; хранилище, импорт и интерфейс вызывают их, а не повторяют.

- Настройки — `SETTING_RULES`, `coerceSettings` (`src/domain/settings.ts`): при чтении и при импорте.
- Запись дня — `coerceDayEntry`, `isEmptyDayEntry` (`src/domain/dayEntry.ts`); коды — `src/domain/catalog.ts`.
- Месячные — `validatePeriods` с кодами ошибок (`src/domain/periodValidation.ts`); инвариант «без
  пересечений и соседних» — `normalizePeriods` (`src/domain/periods.ts`); тексты ошибок импорта —
  `src/storage/backup.ts`.
- Длина месячных для прогноза — `effectivePeriodLength` (`src/domain/forecast.ts`).
- Предел напоминаний `MAX_REMINDERS` (`src/domain/reminders.ts`) равен пределу `worker/src/validate.ts` —
  это охраняет контрактный тест.

## Чек-листы

Сначала тест, потом код; изменение интерфейса — сначала в `docs/design/design.md`.

### Добавить настройку

1. Поле и умолчание — `Settings`, `DEFAULT_SETTINGS` (`src/domain/types.ts`).
2. Правило поля — `SETTING_RULES` (`src/domain/settings.ts`, без правила не соберётся); тест —
   `src/domain/settings.test.ts`.
3. Новая версия схемы — по `src/storage/migrations/README.md`: `SCHEMA_VERSION` и `this.version(N + 1)` в
   `src/storage/db.ts`, `migrations[N]`; тесты `migrations.test.ts`, `update.test.ts`, `backup.test.ts`;
   ожидаемая версия — в `db.test.ts` и `upgrade-v2.test.ts`.
4. Экран — `Toggle` или `Stepper` в `src/ui/screens/SettingsScreen.tsx`.
5. Формат резервной копии — `specs/001-cycle-calendar/contracts/backup-format.md`.

### Добавить отметку дня

1. Поле — `DayEntry` (`src/domain/types.ts`); коды значений — `src/domain/catalog.ts`.
2. Разбор и пустота — `emptyDayEntry`, `coerceDayEntry`, `isEmptyDayEntry` (`src/domain/dayEntry.ts`).
3. Переключатель видимости — по чек-листу настройки; видимость — `src/domain/dayDialog.ts`,
   `src/hooks/useForecast.ts`.
4. Запись — `updateDayEntry(date, { поле })`; `saveDayEntry` из интерфейса не вызывается
   (`src/ui/dayWrites.test.ts`).
5. Экран — `DayDialog`, `DaySheets`, `EntrySummary`; значок в календаре — `DayCell`, `Legend`
   (`src/ui/components`).
6. Новая форма записи — новая версия схемы и миграция записей дней (как `toDayEntryV6`).

### Добавить вид напоминания

1. Настройка `remindX` — по чек-листу настройки.
2. Вид, текст и дата — `Reminder.kind`, `planReminders` (`src/domain/reminders.ts`); текст не раскрывает
   данные цикла сверх нужного (Конституция I).
3. Подписка и отписка — `reminderToggleAction` учитывает новый флаг (`src/ui/components/reminderToggle.ts`).
4. Экран — `Toggle` в `src/ui/components/RemindersSection.tsx`.
5. Воркер не меняется: поля `PUT` прежние; случаи контрактного теста `worker/test/contract.test.ts`
   дополняются.
