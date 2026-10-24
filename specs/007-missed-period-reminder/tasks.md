---

description: "Task list for feature 007-missed-period-reminder"
---

# Tasks: Напоминание о неотмеченном начале месячных и единый заголовок

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/missed-period-reminder.md](./contracts/missed-period-reminder.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. Правка файлов — только Edit/Write; перед коммитом — проверка diff на испорченную кириллицу и BOM. Каждый коммит проходит `npm test` и `npm run build`. `worker/` не меняется.

## Phase 1: Setup

Новых зависимостей и модулей нет — фаза пропущена.

## Phase 2: Foundational — настройки v5 (блокирует US1, US3, US4)

- [X] T001 Failing tests: `src/storage/migrations/migrations.test.ts` — `migrations[4]` добавляет `remindMissedPeriod: true`, сохраняет явное `false`, идемпотентна, данные без `settings` не меняет; `migrateData(v1, 1, 5)` даёт все поля 004–007; `src/storage/db.test.ts` — `SCHEMA_VERSION === 5`, `DEFAULT_SETTINGS.remindMissedPeriod === true`, `getSettings()` без сохранённых настроек — `remindMissedPeriod: true`; `src/storage/update.test.ts` — база v4 с сохранёнными настройками (`remindPeriod: false`) открывается новой сборкой, `remindMissedPeriod: true`, прочие настройки и месячные на месте
- [X] T002 Implement: `Settings.remindMissedPeriod: boolean` с комментарием «Напоминать о неотмеченном начале месячных — фича 007» и `DEFAULT_SETTINGS.remindMissedPeriod = true` в `src/domain/types.ts`; `migrations[4]` (`addMissedPeriodReminder`: `remindMissedPeriod ?? true`, по образцу `addOvulationMode`) в `src/storage/migrations/index.ts`; `SCHEMA_VERSION = 5` + `this.version(5).stores({ periods: 'id, start', days: 'date', kv: 'key' }).upgrade(...)` через `migrations[4]` по образцу v4 в `src/storage/db.ts`; поправить фикстуры тестов, где `Settings` собирается полностью (TS strict) — до прохождения T001

**Checkpoint**: `npm test` зелёный, поведение приложения не изменилось.

## Phase 3: User Story 1 — напоминание о неотмеченном начале (P1) 🎯 MVP

**Goal**: `planReminders` планирует `missedPeriod` на 12:00 «исходный прогноз + 2»; при задержке — только его для текущего цикла; без повторов.

**Independent Test**: контракт M1–M7, M9, M11 в `npm test`.

- [X] T003 [US1] Failing tests в `src/domain/reminders.test.ts` (контракт M1–M7, M9; последние месячные 01.03.2026, длина 28): M1 сегодня 02.03 09:00, всё включено — `missedPeriod` ids `missed-period:2026-03-31`, `…-04-28`, `…-05-26`, `…-06-23`, `…-07-21`, `…-08-18`, всего ≤ 24, отсортировано по `sendAt`; M2 `remindMissedPeriod: false` — нет `missedPeriod`, прочие виды прежние; M3 сегодня 30.03 09:00 (задержка 1) — ровно `[missed-period:2026-03-31]` с `sendAt` = 12:00 местного 31.03; M4 сегодня 31.03 09:00 — `[missed-period:2026-03-31]`, 31.03 13:00 — `[]`; M5 сегодня 01.04 (задержка 3) — `[]`; M6 месячные 01.03 и 27.03, сегодня 28.03 — первый `missedPeriod` = `current.nextStart + 2` нового прогноза, записи `2026-03-31` нет; M7 месячные 03.12.2026, сегодня 04.12.2026 — первый `missed-period:2027-01-02`; M9 `TZ=Europe/Berlin`, дата отправки после перехода на летнее/зимнее время — 12:00 местного; заменить прежний кейс «`delayDays > 0` → `[]`» на «при задержке — только `missedPeriod` текущего цикла, при `remindMissedPeriod: false` — `[]`»
- [X] T004 [US1] Implement в `src/domain/reminders.ts`: `kind: 'period' | 'ovulation' | 'missedPeriod'`; `export const NOTIFICATION_TITLE = 'Календарь цикла'`; `MISSED_PERIOD_REMINDER = { daysAfter: 2, title: NOTIFICATION_TITLE, body: 'Похоже, месячные уже начались — не забудь отметить их в календаре' }`; при `forecast.delayDays > 0` — только `missedPeriod` для цикла `kind === 'current'` на `addDaysLD(addDaysLD(c.nextStart, -forecast.delayDays), MISSED_PERIOD_REMINDER.daysAfter)`, если `settings.remindMissedPeriod`; без задержки — в цикле по `upcoming` добавить `missedPeriod` на `c.nextStart + 2` (id `missed-period:${date}`); общий фильтр `sendAt > now`, сортировка, `MAX_REMINDERS` без изменений; обновить комментарий о L3 — до прохождения T003 и всех прежних тестов
- [X] T005 [US1] Failing test в `src/domain/reminders.test.ts` (контракт M11, FR-009, SC-004): `toServerReminders(planReminders(...))` — у каждой записи ровно ключи `['body', 'id', 'sendAt', 'title']` (сравнение `Object.keys(r).sort()`), значения совпадают с исходными, `kind` отсутствует; пустой список → `[]`
- [X] T006 [US1] Implement: чистая функция `export function toServerReminders(reminders: Reminder[]): ServerReminder[]` (`ServerReminder = Omit<Reminder, 'kind'>`, собирает объект `{ id, sendAt, title, body }` явно, без rest-оператора) в `src/domain/reminders.ts`; `src/push/sync.ts` использует её вместо `.map(({ kind: _k, ...r }) => r)` — до прохождения T005

**Checkpoint**: расписание в домене готово; UI ещё без переключателя (по умолчанию включено — напоминание уже уходит в расписание подписанным).

## Phase 4: User Story 3 — переключатель в «Напоминаниях» (P1)

**Goal**: третий переключатель «Напоминать, если забыла отметить начало месячных» с описанием; участвует в правилах подписки.

**Independent Test**: quickstart шаги 1–2 в браузере.

- [X] T007 [US3] Обновить `docs/design/design.md`: таблица уведомлений — заголовок у «День овуляции» «Календарь цикла», новая строка «Прогноз + 2 дня (3-й день), 12:00, если начало не отмечено | Календарь цикла | Похоже, месячные уже начались — не забудь отметить их в календаре»; в разделе «Ещё не нарисовано» — секция «Напоминания»: «За 2 дня до месячных», «В день овуляции», «Напоминать, если забыла отметить начало месячных» (по умолчанию включён) с описанием 13 px `muted` «Придёт на 3-й день после ожидаемого начала месячных, если оно не отмечено»; подпись может занимать две строки
- [X] T008 [US3] `src/ui/components/RemindersSection.tsx`: после «В день овуляции» — `<label className="toggle">` «Напоминать, если забыла отметить начало месячных» с `<span className="t-small toggle__hint">Придёт на 3-й день после ожидаемого начала месячных, если оно не отмечено</span>`, `checked={settings.remindMissedPeriod}`, `disabled={busy}`, `onChange={(e) => toggle({ remindMissedPeriod: e.target.checked })}`; в `toggle` отписка, когда `!next.remindPeriod && !next.remindOvulation && !next.remindMissedPeriod`; сверить с design.md (зона нажатия ≥ 44 px, контраст в обеих темах)

## Phase 5: User Story 2 — единый заголовок (P2)

**Goal**: у всех уведомлений заголовок «Календарь цикла»; тела прежних без изменений.

**Independent Test**: контракт M8, M10 в `npm test`.

- [X] T009 [US2] Failing tests в `src/domain/reminders.test.ts` (M8, M10): у `period`, `ovulation`, `missedPeriod` `title === 'Календарь цикла'`; `PERIOD_REMINDER.body` и `OVULATION_REMINDER.body` — прежние побуквенно; `MISSED_PERIOD_REMINDER.body === 'Похоже, месячные уже начались — не забудь отметить их в календаре'` и у записей `missedPeriod` тот же `body`; `NOTIFICATION_TITLE` равен значению `name:` манифеста, прочитанному из `vite.config.ts` как текст (`node:fs`, регулярное выражение `/\bname:\s*'([^']+)'/`); в кейсе «uses the exact texts» заменить ожидание `'Овуляция'`
- [X] T010 [US2] Implement в `src/domain/reminders.ts`: `PERIOD_REMINDER.title` и `OVULATION_REMINDER.title` — `NOTIFICATION_TITLE` (введён в T004) — до прохождения T009

## Phase 6: User Story 4 — резервная копия (P2)

**Goal**: поле экспортируется и импортируется; старые копии — «включено».

**Independent Test**: `npm test` (backup.test.ts), quickstart шаг 6.

- [X] T011 [US4] Failing tests `src/storage/backup.test.ts`: экспорт — `schemaVersion: 5` и `remindMissedPeriod` в `data.settings`; импорт копий v4, v3, v1 — `true`; импорт v5 с `false` — `false`; v5 с не-boolean `remindMissedPeriod` — ошибка «некорректные настройки напоминаний»
- [X] T012 [US4] `src/storage/backup.ts`: проверка (`typeof remindMissedPeriod !== 'boolean'` → «некорректные настройки напоминаний», комментарий «Старые копии получают поле миграцией v4 → v5 (migrations[4])») и перенос `remindMissedPeriod` в разборе настроек — до прохождения T011

## Phase 7: Polish & документы

- [X] T013 [P] `specs/001-cycle-calendar/spec.md`: FR-023 — заголовок «Календарь цикла» (ревизия 007), FR-024 — три напоминания, Clarifications/Edge Cases «Задержка» — при задержке планируется только напоминание о неотмеченном начале (ревизия 007, ссылка на 007 FR-002–FR-006)
- [X] T014 [P] `specs/001-cycle-calendar/data-model.md` (Settings `remindMissedPeriod`, схема v5), `specs/001-cycle-calendar/contracts/domain-api.md` (`planReminders`: вид `missedPeriod`, правило задержки, кейс 16 и «delayDays > 0»), `specs/001-cycle-calendar/contracts/backup-format.md` (v5, новое поле)
- [X] T015 `npm test`, `npm run build`, проверка `git diff` (кириллица, BOM); браузер: quickstart 1–6, светлая и тёмная темы
- [X] T016 Слить ветку в `main` и `git push origin main` (CLAUDE.md; worker не менялся — без `wrangler deploy`); после успешного «Test and deploy to GitHub Pages» удалить ветку локально и на origin

## Dependencies

Рекомендуемый порядок: T001 → T002 → (US1: T003 → T004 → T005 → T006) → (US3: T007 → T008) → (US2: T009 → T010) → (US4: T011 → T012) → T013 ‖ T014 → T015 → T016.

Жёсткие зависимости: US1, US3, US4 — от Phase 2; US2 — от T004 (`NOTIFICATION_TITLE`, `missedPeriod`) и тот же файл тестов, что T003.

## Parallel Example

```text
US3: T007 (design.md) ‖ US4: T011 (backup.test.ts) — разные файлы
Polish: T013 (001 spec) ‖ T014 (001 data-model, contracts)
```

## Implementation Strategy

1. Phase 2 → US1 (MVP: напоминание в расписании, тестами; по умолчанию включено).
2. US3 — управление переключателем; US2 — единый заголовок; US4 — копия.
3. Документы, проверка, слияние и push одним блоком после зелёных тестов и сборки.
