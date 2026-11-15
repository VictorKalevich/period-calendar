# Implementation Plan: Напоминания — контракт с воркером под тестом, синхронизация без гонок

**Branch**: `018-push-sync-contract` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/018-push-sync-contract/spec.md`; шаг 5 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-5-push-sync-contract.md`).

## Summary

1. **Контрактный тест** `worker/test/contract.test.ts` (первым, зелёный на текущем коде): расписание домена
   для всех видов напоминаний, граничных циклов, задержки и пяти часовых поясов проходит `PUT` воркера и
   `validatePutBody`; предел числа напоминаний домена равен пределу воркера; `runSchedule` отправляет
   payload `{ title, body, id }` (подмена `sendPush`), а разбор уведомления service worker показывает его с
   тем же заголовком, текстом и меткой (R1–R3).
2. **Разбор push-данных** выносится из `src/sw.ts` в чистую `notificationFromPush` (`src/pwa/pushNotification.ts`)
   — чтобы его видел контрактный тест (R2).
3. **`updatePushState(patch, identity?)`** в репозитории — транзакционно, по образцу `updateSettings`;
   включение, выключение и проход синхронизации пишут только свои поля поверх актуального (R5).
4. **Ядро синхронизации** `src/push/syncCore.ts`: `syncPass(deps)` (прежние правила `doSync`) и
   `createSyncRunner(pass)` (повторный проход, если синхронизацию запросили во время идущей). `sync.ts` —
   обвязка; наблюдение `liveQuery` — через `getPeriods`/`getSettings`, без `db` и `'settings'` (R4, R6, R7).
5. **`runSchedule`** воркера: каждая запись в своём `try/catch`, в журнал — шаг и имя ошибки (R8).
   **Меняет рабочий код `worker/src`** — деплой воркера в шаге 8.
6. **Документ контракта** `specs/001-cycle-calendar/contracts/push-worker-api.md` — по коду (R11).

Тесты — только в новых файлах (R9). Сначала характеризационные (контракт, правила прохода и наблюдение
`liveQuery` на текущем `syncReminders`) — зелёные до и после; затем для каждой новой функции и каждой гонки
— падающий тест до кода.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict); приложение — React 19 (UI не меняется); воркер — Cloudflare
Workers (`@cloudflare/workers-types`)

**Primary Dependencies**: Dexie 4 (`liveQuery`, транзакции), WebCrypto (`crypto.subtle`, `randomUUID`);
новых зависимостей нет — ни runtime, ни dev

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION = 6`, `kv['push']` той же формы, блоки
`this.version(1…6)` не трогаются; KV воркера — те же записи `sub:<clientId>`

**Testing**: Vitest 5. Приложение — `node` + `fake-indexeddb/auto`; подмены браузера — `vi.stubEnv` в
`vi.hoisted`, `vi.stubGlobal` (`window`, `navigator`, `fetch`), `vi.useFakeTimers({ toFake: ['Date'] })`
(R9). Воркер — `node`, `MemoryKV`, `vi.mock('../src/webpush')` для перехвата payload. Поиск по исходникам —
`node:fs`, как `src/domain/isolation.test.ts`

**Target Platform**: iOS Safari (установленная PWA) + Cloudflare Worker (cron `0 * * * *`)

**Project Type**: офлайн-PWA (`src/`) + push-воркер (`worker/`, отдельный пакет)

**Performance Goals**: без изменений; повторный проход при неизменном расписании не делает сетевого запроса
(сравнение отпечатков)

**Constraints**: формат запросов и ответов воркера, ограничения приёма, тексты, расписание и
идентификаторы напоминаний, разметка — прежние (FR-005, FR-020); существующие проверки и файлы тестов не
меняются, `api.test.ts` и `webpush.test.ts` — тоже (FR-021); правила слоёв; без деплоя и `git push` (FR-025)

**Scale/Scope**: правки — `src/push/sync.ts`, `src/push/subscribe.ts`, `src/storage/repository.ts`,
`src/sw.ts`, `worker/src/index.ts`, документ контракта; новые — `src/push/syncCore.ts`,
`src/pwa/pushNotification.ts`, 8 файлов тестов и 1 вспомогательный (`worker/test/support.ts`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Новых сетевых запросов нет; состав и поля `PUT`, payload уведомления не меняются. Журнал воркера при сбое записи — только шаг и имя ошибки, без адреса подписки, текстов и сообщения ошибки (R8). | ✅ |
| II. Офлайн-PWA, бесплатная инфраструктура | Без сети — прежнее «ждёт отправки»; новых сервисов нет; воркер — тот же бесплатный Cloudflare Worker. | ✅ |
| III. Сохранность данных | Схема и форма `kv['push']` не меняются; запись состояния — по-прежнему одним `put`, теперь в транзакции поверх актуального (R5). Резервная копия push-состояние не содержит — как раньше. | ✅ |
| IV. TDD, домен — чистые функции | Домен не меняется. Новые функции (`notificationFromPush`, `updatePushState`, `syncPass`, `createSyncRunner`) и изоляция сбоев воркера — сначала падающие тесты; перенос (`doSync` → `syncPass`, разбор из `sw.ts`, наблюдение `liveQuery`) — сначала характеризационные (R9). | ✅ |
| V. Простота | Зависимостей нет. Одна функция репозитория, две функции ядра, одна чистая функция разбора; без классов и новых слоёв (R4–R6). | ✅ |
| VI. Дизайн и доступность | UI не меняется (снимок `normalPath.test.ts`). | ✅ |
| VII. Честность | Прогноз и тексты не меняются. | ✅ |

**Правила слоёв**: `src/push` → `domain`, `storage` (только `repository`, без `db`); `src/storage` →
`domain`, Dexie; `src/pwa/pushNotification.ts` — без импортов; `src/sw.ts` → `src/pwa/pushNotification.ts`
и workbox. **Исключение (названо, R1)**: тесты воркера `worker/test/*.test.ts` импортируют
`src/domain/*` и `src/pwa/pushNotification.ts`; рабочий код `worker/src` код приложения не импортирует —
охраняется поиском в `contract.test.ts`. Уже было в `api.test.ts` («contract with the app»).

**Повторная проверка после дизайна (Phase 1)**: нарушений не появилось — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/018-push-sync-contract/
├── spec.md
├── plan.md                  # этот файл
├── research.md              # R1–R12
├── data-model.md            # PushState и переходы, новые типы, рассылка по записи
├── quickstart.md
├── contracts/sync-core.md   # ядро, обвязка, updatePushState, разбор уведомления, runSchedule
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
src/push/syncCore.ts                    # новый: SyncDeps, syncPass, createSyncRunner
src/push/sync.ts                        # обвязка: deps, syncReminders, reminderDataQuery, startReminderSync
src/push/subscribe.ts                   # enable/disable — updatePushState
src/storage/repository.ts               # updatePushState, PushStatePatch, PushIdentity
src/pwa/pushNotification.ts             # новый: notificationFromPush
src/sw.ts                               # push-обработчик через notificationFromPush
worker/src/index.ts                     # runSchedule: try/catch на запись
specs/001-cycle-calendar/contracts/push-worker-api.md   # по коду (R11)

worker/test/support.ts                  # новый: MemoryKV, makeEnv, подписка (для новых тестов)
worker/test/contract.test.ts            # новый: R1–R3
worker/test/schedule.test.ts            # новый: R8
src/pwa/pushNotification.test.ts        # новый
src/storage/pushState.test.ts           # новый
src/push/sync.test.ts                   # новый: обвязка, характеризация, гонки, liveQuery
src/push/startReminderSync.test.ts      # новый: триггеры фоновой синхронизации (характеризация)
src/push/syncCore.test.ts               # новый
src/push/pushPlacement.test.ts          # новый: поиск по исходникам
```

**Structure Decision**: приложение `src/` и воркер `worker/` — как есть; ядро синхронизации — рядом с
обвязкой в `src/push`; разбор уведомления — в `src/pwa` (относится к service worker, импортов не имеет);
тесты приложения — рядом с кодом (`src/**/*.test.ts`), воркера — в `worker/test`.

## Порядок коммитов

Каждый коммит проходит `npm test` и `npm run build`; коммиты с `worker/` — ещё `npm test --prefix worker` и
`npm run typecheck --prefix worker`. Тест пишется первым, его падение проверяется до кода; тест и код идут в
одном коммите (красный коммит не прошёл бы `npm test`). Подробно — `tasks.md`.

1. Контрактный тест (`support.ts`, `contract.test.ts` без случаев service worker) — зелёный на текущем
   коде (US1).
2. `notificationFromPush` + `sw.ts` через неё; случаи service worker в контрактном тесте (US1).
3. Характеризационные тесты синхронизации (`sync.test.ts`: правила прохода, включение и выключение,
   наблюдение `liveQuery`; `startReminderSync.test.ts`: триггеры фоновой синхронизации) — зелёные на
   текущем коде; для наблюдения прежнее выражение выносится в экспорт `reminderDataQuery` без изменений
   (US2).
4. `updatePushState` (US2).
5. Ядро `syncCore.ts` (`syncPass`, `createSyncRunner`), `sync.ts` — обвязка; `enable`/`disable` через
   `updatePushState`; гонки в `sync.test.ts`; наблюдение через репозиторий; `pushPlacement.test.ts` (US2).
6. `runSchedule` — изоляция сбоев (US3).
7. Документ контракта (US4).
8. Задачи выполнены.

## Complexity Tracking

Нарушений Конституции нет. Отступления от «Наброска решения» файла шага (не от Конституции):

| Отступление | Зачем | Почему не как в наброске |
|-------------|-------|--------------------------|
| Разбор push-данных вынесен из `sw.ts` в `src/pwa/pushNotification.ts` (R2) | Контрактный тест должен видеть, что читает service worker; `sw.ts` нельзя импортировать в тест | Набросок требует проверки «payload соответствует тому, что читает `sw.ts`», но не говорит как; поведение `sw.ts` прежнее |
| `updatePushState` принимает необязательный `identity` (R5) | Включение на пустом устройстве создаёт состояние той же транзакцией; два одновременных включения не создают двух клиентов | Набросок называет только `updatePushState(patch)`; патч без `identity` не может создать запись |
| Ядро получает также чтение данных и признак настройки сборки (R4) | Тесты ядра без IndexedDB и `import.meta.env` | Набросок перечисляет «чтение и изменение состояния, подписку, `fetch`, часы» — список расширен, не изменён |
| В журнал воркера — имя ошибки, не сообщение (R8) | Сообщение `JSON.parse` содержит фрагмент записи (адрес подписки, тексты) | Набросок: «имя шага и причина»; причина — имя ошибки |
