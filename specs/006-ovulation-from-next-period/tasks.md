---

description: "Task list for feature 006-ovulation-from-next-period"
---

# Tasks: Сдвиг овуляции в карточке «Цикл» и расчёт «от следующей менструации»

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ovulation-mode.md](./contracts/ovulation-mode.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. Правка файлов — только Edit/Write; перед коммитом — проверка diff на испорченную кириллицу и BOM. Каждый коммит проходит `npm test` и `npm run build`.

## Phase 1: Setup

Новых зависимостей и модулей нет — фаза пропущена.

## Phase 2: Foundational — настройки v4 (блокирует US1, US2, US4)

- [X] T001 Failing tests: `src/storage/migrations/migrations.test.ts` — `migrations[3]` добавляет `ovulationFromNextPeriod: false`, сохраняет явное `true`, идемпотентна, данные без `settings` не меняет; `migrateData(v1, 1, 4)` даёт все поля 004–006; `src/storage/db.test.ts` — `SCHEMA_VERSION === 4`, `DEFAULT_SETTINGS.ovulationFromNextPeriod === false`; `src/storage/update.test.ts` — база v3 с сохранёнными настройками открывается новой сборкой, поле `false`, прочие настройки и месячные на месте
- [X] T002 Implement: `Settings.ovulationFromNextPeriod: boolean` (по умолчанию `false`) и `LUTEAL_PHASE_DAYS = 14` в `src/domain/types.ts`; `migrations[3]` (`ovulationFromNextPeriod ?? false`) в `src/storage/migrations/index.ts`; `SCHEMA_VERSION = 4` + `this.version(4).stores(...).upgrade(...)` по образцу v3 в `src/storage/db.ts` — до прохождения T001

**Checkpoint**: `npm test` зелёный, поведение приложения не изменилось.

## Phase 3: User Story 1 — расчёт от следующей менструации (P1) 🎯 MVP

**Goal**: при `ovulationFromNextPeriod` овуляция = следующие − 14 + сдвиг, не раньше дня после месячных цикла, не позже дня перед следующими.

**Independent Test**: контракт 1–11, 13–16 в `npm test`; выключенный режим — все тесты 005 без изменений ожиданий.

- [X] T003 [US1] Failing tests (контракт 2–9, 13–14) в `src/domain/forecast.test.ts`: прошлый 01.03 → 05.04 — овуляция 22.03, окно 17–22.03, средние 15, 16, 23.03; текущий с 01.10 и прогнозом 29.10 — 15.10, при задержке 3 дня — 15.10; прогнозный 26.11 при длине 30 — 12.12; сдвиг +2 включён (01.03 → 29.03) — 17.03, выключенный +2 — 15.03; циклы 21 и 45 (прошлые и прогнозные) — следующие − 14; переход через год (следующие 05.01.2027) — 22.12.2026; сдвиг −5, месячные 01–05.03, следующие 16.03 — 06.03, то же с неотмеченным концом и прогнозируемой длиной 5 — 06.03; одна отметка 01.10 без истории (длина по умолчанию 28) — 15.10; прошлый цикл-выброс 01.03 → 10.05 (70 дней) — 26.04
- [X] T004 [P] [US1] Failing tests (контракт 10–11, 15): `src/domain/reminders.test.ts` — «Овуляция» на новую дату при включённом режиме; `src/domain/dayInfo.test.ts` — фаза `ovulation` на новой дате, `follicular` до, `luteal` после; `todaySummary` (сегодня 05.10, текущий с 01.10, прогноз 29.10) — `nextOvulation` 15.10, `nextFertile` 10–15.10
- [X] T005 [P] [US1] Failing test (контракт 16, FR-009) в `src/domain/forecast.test.ts`: для одних и тех же месячных (несколько циклов разной длины, задержка) и сдвигов 0 и +3 режим не меняет `cycleLength`, `periodLength`, `delayDays`, `confidence` и `start`/`nextStart`/`periodDays` каждого цикла; в `src/domain/stats.test.ts` — `cycleStats` одинаков (статистика не зависит от настроек). Тест падает, пока `buildForecast` не учитывает режим (сравнение `ovulation` должно различаться — проверка, что режим вообще применён)
- [X] T006 [US1] Implement в `src/domain/forecast.ts`: `ovulationFor({ start, periodLast, nextStart }, settings)` по контракту (выключено — `start + 13 + shift`; включено — `max(nextStart − 14 + shift, periodLast + 1)`; затем `min(…, nextStart − 1)`); `cycleFrom` получает `periodLast` — прошлый и текущий `periodEnd(period, periodLength)` по месячным, отсортированным по началу, прогнозный `start + periodLength − 1`; текущий цикл по-прежнему ограничен `predictedStart` — до прохождения T003–T005 и всех прежних тестов

**Checkpoint**: режим работает в домене; UI ещё без переключателя.

## Phase 4: User Story 2 — блок сдвига и новый переключатель в карточке «Цикл» (P1)

**Goal**: «Записи дня» — только «Самочувствие» и «Заметки»; в «Цикл» после «Длина месячных по умолчанию» — сдвиг (подсказка и счётчик при включённом), ниже — «Считать от следующей менструации» с описанием, виден всегда.

**Independent Test**: quickstart шаги 1–4 в браузере.

- [ ] T007 [US2] Обновить `docs/design/design.md` (раздел «Ещё не нарисовано», Настройки): блок сдвига — в конце карточки «Цикл»; ниже — переключатель «Считать от следующей менструации» (по умолчанию выключен) и описание 13 px `muted` «Овуляция будет рассчитана примерно за 14 дней до ожидаемого начала месячных», виден всегда; в «Записи дня» — только «Самочувствие» и «Заметки»
- [ ] T008 [US2] `src/ui/screens/SettingsScreen.tsx`: перенести `<label className="toggle">` сдвига, подсказку и `Stepper` из секции `entries-title` в конец секции `cycle-title`; добавить ниже `<label className="toggle">` «Считать от следующей менструации» (`checked={settings.ovulationFromNextPeriod}`, `update({ ovulationFromNextPeriod })`) и `<p className="t-caption settings-card__hint">` с описанием; сверить с design.md (зона нажатия ≥ 44 px, контраст в обеих темах)

## Phase 5: User Story 3 — «Подробнее» (P2)

**Goal**: текст об овуляции соответствует включённому режиму; строка о сдвиге — в обоих режимах.

**Independent Test**: quickstart шаг 5.

- [ ] T009 [US3] `src/ui/components/Disclaimer.tsx`: абзац об овуляции по `settings.ovulationFromNextPeriod` — выключено: текущий текст «на 14-й день цикла …»; включено: «Овуляция — примерно за 14 дней до ожидаемого начала следующих месячных, но не раньше дня после месячных и не позже дня перед следующими. Способ расчёта меняется в Настройках.»; окно и строка о сдвиге без изменений; обновить описание «Подробнее» в `docs/design/design.md`

## Phase 6: User Story 4 — резервная копия (P2)

**Goal**: поле экспортируется и импортируется; старые копии — «выключено».

**Independent Test**: `npm test` (backup.test.ts), quickstart шаг 6.

- [X] T010 [US4] Failing tests `src/storage/backup.test.ts`: экспорт — `schemaVersion: 4` и `ovulationFromNextPeriod` в `data.settings`; импорт копий v3, v2, v1 — `false`; импорт v4 с `true` — `true`; v4 с не-boolean — ошибка проверки
- [X] T011 [US4] `src/storage/backup.ts`: проверка и перенос `ovulationFromNextPeriod` (boolean обязателен) в разборе настроек — до прохождения T010

## Phase 7: Polish & документы

- [ ] T012 [P] Ревизии `specs/005-ovulation-shift-theme/spec.md`: FR-003 (режим выбирается переключателем 006), FR-006 (расположение — карточка «Цикл»), FR-009 (текст по режиму) — пометкой «Ревизия 006»
- [ ] T013 [P] `specs/001-cycle-calendar/spec.md` (FR-016 и связанные места о правиле овуляции — два режима со ссылкой на 006 FR-003–FR-005), `specs/001-cycle-calendar/data-model.md` (Settings + схема v4), `specs/001-cycle-calendar/contracts/domain-api.md` (`ovulationFor`, режим), `specs/001-cycle-calendar/contracts/backup-format.md` (v4, новое поле)
- [ ] T014 `npm test`, `npm run build`, проверка `git diff` (кириллица, BOM); браузер: quickstart 1–7, светлая и тёмная темы
- [ ] T015 Слить ветку в `main` и `git push origin main` (CLAUDE.md; worker не менялся)

## Dependencies

Рекомендуемый порядок: T001 → T002 → (US1: T003 ‖ T004 ‖ T005 → T006) → (US2: T007 → T008) → US3: T009 → (US4: T010 → T011) → T012 ‖ T013 → T014 → T015.

Жёсткие зависимости: US2 и US4 — только от Phase 2; US3 — от T002 (поле настроек); US1 — независимая доменная часть после T002.

## Parallel Example

```text
US1: T003 (forecast.test.ts) ‖ T004 (reminders.test.ts, dayInfo.test.ts) ‖ T005 (forecast.test.ts — отдельный describe, stats.test.ts)
Polish: T012 (005 spec) ‖ T013 (001 docs)
```

## Implementation Strategy

1. Phase 2 → US1 (MVP: правильный расчёт в домене, тестами).
2. US2 — пользовательница может включить режим; US3 — объяснение; US4 — копия.
3. Документы, проверка, слияние и push одним блоком после зелёных тестов и сборки.
