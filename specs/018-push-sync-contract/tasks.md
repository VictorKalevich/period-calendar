---

description: "Task list for feature 018-push-sync-contract"
---

# Tasks: Напоминания — контракт с воркером под тестом, синхронизация без гонок

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/sync-core.md](./contracts/sync-core.md),
[quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV; `docs/refactoring-roadmap.md`, «Общие ограничения», п. 5).
- Новая функция — сначала тест, и его падение проверяется до кода.
- Перенос существующего кода — сначала характеризационный тест, зелёный до и после.
- Существующие файлы тестов не меняются (FR-021), в том числе `worker/test/api.test.ts` и
  `worker/test/webpush.test.ts`; новые тесты — только в новых файлах (research R9).

Файлы — UTF-8 без BOM, правка только Edit/Write. Каждый коммит проходит `npm test` и `npm run build` (из
PowerShell); коммиты с `worker/` — ещё `npm test --prefix worker` и `npm run typecheck --prefix worker`.
Тест и код одной задачи идут в одном коммите: красный коммит не прошёл бы `npm test`. `git push` и
`npx wrangler deploy` не выполнять (FR-025).

**Обвязка тестов**:
- **Воркер** (`node`): помощники из `worker/test/support.ts` (T002). Запрос `PUT` —
  `new Request('https://cycle-push.example.workers.dev/v1/clients/<uuid>', { method: 'PUT', headers: { Origin: ORIGIN, Authorization: 'Bearer <token ≥ 16>', 'Content-Type': 'application/json' }, body })`, как `req` в `api.test.ts`.
- **Часовые пояса**: `process.env.TZ = …` до построения дат; в `afterEach` — исходное значение, как в
  `src/domain/reminders.test.ts:15-18`. «Сейчас» — местное `new Date(y, m - 1, d, 9)` после установки
  пояса: «сегодня» одно и то же во всех поясах.
- **Хранилище** (`node`): `import 'fake-indexeddb/auto'`; `beforeEach` — `await db.delete(); await db.open();`.
- **Обвязка push** (`src/push/sync.test.ts`, `node`): `vi.hoisted(() => { vi.stubEnv('VITE_PUSH_API_URL', 'https://push.example/'); vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '<base64url>'); })` до импортов (проверено пробным прогоном: `subscribe.ts` читает их при загрузке);
  в `beforeEach` — `vi.stubGlobal('window', { PushManager: class {}, Notification: {} })`,
  `vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn(async () => permission) })`,
  `vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve(reg) } })` с
  `reg.pushManager = { getSubscription: async () => current, subscribe: vi.fn(async () => (current = makeSub('new-' + ++n))) }`,
  `vi.stubGlobal('fetch', fetchMock)`; `vi.useFakeTimers({ toFake: ['Date'] })` и
  `vi.setSystemTime(new Date(2026, 9, 23, 9))` (подменяется только `Date`, таймеры IndexedDB настоящие);
  в `afterEach` — `vi.useRealTimers()`, `vi.unstubAllGlobals()`. Подписка браузера — как в браузере: `makeSub(path)` →
  `{ toJSON: () => subJson(path), unsubscribe: vi.fn(async () => { current = null; return true; }) }`,
  `subJson(path) = { endpoint: 'https://web.push.apple.com/' + path, expirationTime: null, keys: { p256dh: 'p256', auth: 'auth' } }`;
  `current = makeSub('abc')`, `SUB_JSON = subJson('abc')`; `reg.pushManager.subscribe` создаёт новую подписку
  с новым endpoint (`makeSub('new-' + n)`).
- **Отложенный ответ** (гонки): `deferred<T>()` → `{ promise, resolve, reject }`; `fetchMock` для `PUT` отдаёт
  `promise`, для `DELETE` — сразу `new Response(null, { status: 204 })`; момент «запрос ушёл» —
  `await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(n))`.
- **Ожидаемое тело** — так же, как в синхронизации: `JSON.stringify({ subscription: SUB_JSON, reminders })`,
  `reminders = forecast ? toServerReminders(planReminders(forecast, settings, now)) : []`,
  `forecast = buildForecast({ periods, settings, today: toLocalDate(now) })`; отпечаток — SHA-256 hex
  через `crypto.subtle.digest`.
- **Поиск по исходникам**: `readdirSync`/`readFileSync(…, 'utf8')`, как `src/domain/isolation.test.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US4 из spec.md

---

## Phase 1: Setup

- [X] T001 Базовая линия на ветке `018-push-sync-contract`: `npm test` — 1040 тестов в 54 файлах, `npm run build` зелёный, `npm test --prefix worker` — 37 тестов в 2 файлах, `npm run typecheck --prefix worker` зелёный (записано при подготовке шага; повторить, если ветка менялась)

---

## Phase 2: Foundational

- [X] T002 Новый `worker/test/support.ts` (не тест: `vitest.config.ts` воркера берёт только `test/**/*.test.ts`) — помощники для новых тестов воркера, `api.test.ts` их не использует и не меняется: `class MemoryKV` (как в `api.test.ts:10-26`: `store: Map<string, string>`, `get(key, type?)` с `JSON.parse` при `'json'`, `put`, `delete`, `list({ prefix })` в порядке вставки, `list_complete: true`); `ORIGIN = 'https://owner.github.io'`; `TOKEN = 'tok_secret_value_1234567890'`; `uuid(n)` → `6f1c2b8e-3a4d-4c5e-9f00-${String(n).padStart(12, '0')}`; `subscription(path = 'QGuQyavXutnMH-iA')` — `endpoint: 'https://web.push.apple.com/' + path` и ключи RFC 8291 из `api.test.ts:44-50`; `async makeEnv(kv)` → `Env` с новой парой VAPID (как `api.test.ts:31-41`); `putRequest(id, body)` → `Request` `PUT` с `Origin`, `Authorization: Bearer ${TOKEN}`, JSON-телом. Проверить `npm run typecheck --prefix worker`.

---

## Phase 3: User Story 1 — расхождение приложения и воркера ловится тестом (P1) 🎯 MVP

**Goal**: контрактный тест расписания и payload; разбор уведомления service worker — чистая функция.

**Independent Test**: `npm test --prefix worker -- test/contract.test.ts` и `npx vitest run src/pwa/pushNotification.test.ts`.

- [X] T003 [US1] Новый `worker/test/contract.test.ts` — **до любых правок кода, зелёный на текущем коде** (FR-001, FR-003; research R1, R3). Импорты: `handleRequest`, `runSchedule` из `../src/index`; `validatePutBody` из `../src/validate`; `buildForecast` из `../../src/domain/forecast`; `planReminders`, `toServerReminders`, `MAX_REMINDERS` из `../../src/domain/reminders`; `toLocalDate` из `../../src/domain/dates`; `DEFAULT_SETTINGS` и типы из `../../src/domain/types`; помощники из `./support`. В начале файла `vi.mock('../src/webpush', async (importOriginal) => ({ ...(await importOriginal<typeof import('../src/webpush')>()), sendPush: vi.fn(async () => ({ status: 201, detail: '' })) }))`. Функция `schedule(periods, settings, now)` — ровно выражение `src/push/sync.ts:36-39` (`today = toLocalDate(now)`). Тело — `{ subscription: { ...subscription(), expirationTime: null }, reminders }` (форма `PushSubscription.toJSON()`).
  1. `describe.each(['UTC', 'Europe/Moscow', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])` × `it.each(CASES)`; на каждый случай: `handleRequest(putRequest(uuid(1), body), env, now.getTime())` → `204`; `validatePutBody(JSON.parse(JSON.stringify(body)), now.getTime())?.reminders` `toEqual` `reminders`; множество видов по префиксу `id` (`period:`, `ovulation:`, `missed-period:`) равно ожидаемому; `reminders.length <= MAX_REMINDERS`. Случаи (`p(id, start, end = null)` — месячные; `S = DEFAULT_SETTINGS`):
     - «обычный цикл»: `[p('a', '2026-10-15')]`, сегодня 2026-10-23, `S` → все три вида, 18 напоминаний;
     - «самый короткий цикл в настройках»: `[p('a', '2026-10-20')]`, сегодня 2026-10-23, `{ ...S, defaultCycleLength: 21 }` → все три;
     - «самый короткий учитываемый цикл»: `[p('a', '2026-09-23', '2026-09-26'), p('b', '2026-10-08', '2026-10-11')]` (цикл 15 — граница выбросов), сегодня 2026-10-09, `S` → все три;
     - «самый длинный цикл в настройках»: `[p('a', '2026-10-15')]`, сегодня 2026-10-23, `{ ...S, defaultCycleLength: 45 }` → все три;
     - «самый длинный учитываемый цикл, сегодня — первый день месячных»: `[p('a', '2026-06-24', '2026-06-28'), p('b', '2026-08-23')]` (цикл 60), сегодня 2026-08-23, `S` → все три; дополнительно `max(Date.parse(sendAt)) - now` больше 300 и не больше 400 дней (≈ 362, research R3);
     - «задержка 1 день»: `[p('a', '2026-09-24', '2026-09-28')]` (прогноз 2026-10-22), сегодня 2026-10-23, `S` → только `missed-period:2026-10-24`;
     - «сдвиг овуляции +5» `{ ...S, ovulationShiftEnabled: true, ovulationShift: 5 }` и «от следующей менструации, сдвиг −5» `{ ...S, ovulationFromNextPeriod: true, ovulationShiftEnabled: true, ovulationShift: -5 }`: месячные и сегодня — как «обычный цикл» → все три;
     - «только о месячных» / «только об овуляции» / «только о неотмеченном начале»: как «обычный цикл», включено одно из `remindPeriod`, `remindOvulation`, `remindMissedPeriod` → только этот вид;
     - «все выключены»: все три `false` → `[]`, `PUT` всё равно `204`;
     - «нет месячных»: `[]` → прогноза нет, `[]`, `204`.
     Если фактический состав видов в каком-то случае на текущем коде другой — разобраться до правок (тест фиксирует текущее поведение домена, а не догадку) и записать причину в комментарии теста.
  2. «предел числа напоминаний домена равен пределу воркера»: `r` — первое напоминание «обычного цикла»; `validatePutBody({ subscription, reminders: Array(MAX_REMINDERS).fill(r) }, now)` — не `null`; с `MAX_REMINDERS + 1` — `null`.
  3. «воркер отправляет payload `{ title, body, id }`»: принять расписание «обычного цикла» (`PUT` → `204`), `at` — наибольший из `sendAt` первых напоминаний каждого вида; `runSchedule(env, at, fetcher)`; `sendPush` (подмена) вызван для каждого напоминания с `Date.parse(sendAt) <= at` по порядку, второй аргумент `toStrictEqual({ title: r.title, body: r.body, id: r.id })`; виды отправленных — все три. `vi.mocked(sendPush).mockClear()` в `beforeEach`.
  4. «рабочий код воркера не импортирует код приложения» (research R1): ни один `worker/src/*.ts` не содержит `from '../` / `from "../` и `import('../`.
  Проверить: `npm test --prefix worker` и `npm run typecheck --prefix worker` зелёные на текущем коде.
- [X] T004 [US1] Проверка, что контрактный тест ловит нарушение (SC-001, quickstart п. 3): по очереди временно поменять в `worker/src/validate.ts` `MAX_TITLE` → 10, `MAX_BODY` → 10, `MAX_ID` → 10, `MAX_REMINDERS` → 17, `MAX_AHEAD_MS` → 300 дней; каждый раз `npm test --prefix worker -- test/contract.test.ts` должен упасть; вернуть значения (`git diff worker/src/validate.ts` пуст). Результат записать здесь.
  **Результат (2026-11-14)**: `MAX_TITLE` → 10, `MAX_BODY` → 10, `MAX_ID` → 10 — по 57 упавших из 68 (все случаи с напоминаниями, сравнение пределов, payload); `MAX_REMINDERS` → 17 — падают случаи с 18 напоминаниями и сравнение пределов; `MAX_AHEAD_MS` → 300 дней — 5 упавших: случай «самый длинный учитываемый цикл (60 дней)» во всех пяти поясах. Значения возвращены, `git diff worker/src/validate.ts` пуст.

**Checkpoint**: коммит «018: контрактный тест приложения и воркера» (T002–T004)

- [X] T005 [P] [US1] Failing test до кода — новый `src/pwa/pushNotification.test.ts` (`node`) для `notificationFromPush(data)` (contracts/sync-core.md; поведение — как `src/sw.ts:20-29` сейчас):
  1. `{ json: () => ({ title: 'T', body: 'B', id: 'x' }), text: () => '' }` → `toStrictEqual({ title: 'T', body: 'B', tag: 'x' })`;
  2. `json` → `{}` → `{ title: 'Календарь цикла', body: '', tag: undefined }`;
  3. `json` → `null` → то же, что п. 2 (`?? {}`);
  4. `json` бросает `SyntaxError`, `text` → `'plain'` → `{ title: 'Календарь цикла', body: 'plain', tag: undefined }`;
  5. `data` — `null` и `undefined` → как п. 2;
  6. лишние поля (`kind`, `sendAt`) не попадают в результат;
  7. `title: ''` остаётся `''` (`??`, а не `||`).
  Убедиться, что тест падает (модуля нет).
- [X] T006 [US1] Новый `src/pwa/pushNotification.ts` без импортов: `PushData { json(): unknown; text(): string }`, `NotificationContent { title: string; body: string; tag: string | undefined }`, `notificationFromPush(data: PushData | null | undefined)` — выражения из `sw.ts` без изменений: `data?.json() ?? {}`, при исключении `{ body: data?.text() }`, `title ?? 'Календарь цикла'`, `body ?? ''`, `tag: id`; комментарий со ссылкой на `specs/001-cycle-calendar/contracts/push-worker-api.md`. В `src/sw.ts` обработчик `push`: `const n = notificationFromPush(event.data)` → `self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'ru' })`; комментарий «payload { title, body, id }» сохранить. T005 зелёный; `npm run build` (проверка типов `tsconfig.sw.json`) зелёный; `grep -c "Календарь цикла" dist/sw.js` ≥ 1.
- [X] T007 [US1] Дополнить `worker/test/contract.test.ts` (FR-002, research R2): импорт `notificationFromPush` из `../../src/pwa/pushNotification` и `TEST_NOTIFICATION` из `../src/index`. В случае 3 из T003 для каждого отправленного payload: `notificationFromPush({ json: () => JSON.parse(JSON.stringify(payload)), text: () => JSON.stringify(payload) })` `toStrictEqual({ title: r.title, body: r.body, tag: r.id })`. Отдельный `it`: `TEST_NOTIFICATION` через `notificationFromPush` → `{ title: 'Календарь цикла', body: 'Уведомления работают', tag: 'test' }`. `npm test --prefix worker`, `npm run typecheck --prefix worker` зелёные.

**Checkpoint**: коммит «018: разбор уведомления — чистая функция, контракт с service worker» (T005–T007)

---

## Phase 4: User Story 2 — синхронизация не затирает выключение и не теряет изменения (P1)

**Goal**: `updatePushState` поверх актуального; ядро `syncPass` + `createSyncRunner`; обвязка без `db`.

**Independent Test**: `npx vitest run src/push src/storage/pushState.test.ts`.

- [X] T008 [US2] Характеризация — **до правок логики, зелёная до и после**. В `src/push/sync.ts` вынести прежнее выражение наблюдения в экспорт без изменений: `export const reminderDataQuery = () => Promise.all([db.periods.toArray(), db.kv.get('settings')]);` и `liveQuery(reminderDataQuery)` в `startReminderSync`. Новый `src/push/sync.test.ts` (обвязка — см. «Обвязка push» выше; `S0 = { clientId: uuid, token: 'tok_…', subscribed: true, pendingSync: true, lastSyncedHash: null }`, месячные `[p('a', '2026-10-15')]`):
  `describe('syncReminders — правила прохода как раньше')`:
  1. нет состояния → `fetch` не вызван, состояния нет;
  2. `subscribed: false` → `fetch` не вызван, состояние то же;
  3. браузер без подписки (`current = null`) → состояние `{ ...S0, subscribed: false }`, `fetch` не вызван;
  4. первый проход → `fetch` один раз с `('https://push.example/v1/clients/<clientId>', { method: 'PUT', headers: { Authorization: 'Bearer <token>', 'Content-Type': 'application/json' }, body: ожидаемое тело })`; состояние `{ ...S0, pendingSync: false, lastSyncedHash: sha256(тело) }`;
  5. повторный проход без изменений → новых вызовов `fetch` нет, состояние то же;
  6. после `updateSettings({ remindOvulation: false })` → ещё один `PUT` с новым телом;
  7. `it.each([400, 401, 500])` ответ → `{ ...S0, pendingSync: true }` (`lastSyncedHash` прежний);
  8. `fetch` отклоняется (`TypeError`) → `pendingSync: true`;
  9. `pendingSync: true` и отпечаток совпадает → `PUT` отправляется снова;
  10. нет месячных → тело с `reminders: []` отправляется.
  `describe('enableReminders / disableReminders — как раньше')`:
  11. включение на пустом устройстве (`permission = 'granted'`, `current = null`) → `'granted'`, `reg.pushManager.subscribe` вызван, состояние: `clientId` — UUID, `token` — `/^[A-Za-z0-9_-]{43}$/`, `subscribed: true`, `pendingSync: true`, `lastSyncedHash: null`;
  12. включение при существующем состоянии `{ ...S0, subscribed: false, pendingSync: false, lastSyncedHash: 'h' }` → те же `clientId` и `token`, `subscribed: true`, `pendingSync: true`, `lastSyncedHash: null`; `subscribe` не вызван (подписка есть);
  13. `permission = 'denied'` → `'denied'`, состояние не меняется;
  14. выключение → `fetch('…/v1/clients/<clientId>', { method: 'DELETE', headers: { Authorization: 'Bearer <token>' } })`; состояние `{ ...S0, subscribed: false, pendingSync: false, lastSyncedHash: null }`; `unsubscribe` прежней подписки вызван;
  15. выключение без сети (`fetch` отклоняется) → то же состояние;
  16. выключение без состояния → `fetch` не вызван, `unsubscribe` вызван.
  `describe('reminderDataQuery — наблюдение')` (research R7): `liveQuery(reminderDataQuery).subscribe` со счётчиком; после каждой записи ждать 50 мс (`setTimeout`, настоящий); первое значение → 1; `savePushState(…)` → без новых; `setDevMode(true)` → без новых; `updateSettings({ remindPeriod: false })` → +1; `savePeriods([...])` с другим концом → +1; `unsubscribe()` в конце.
  Новый `src/push/startReminderSync.test.ts` — триггеры фоновой синхронизации (FR-014; research R9), отдельный файл: подписка `startReminderSync` не отменяется и не должна попасть в другие тесты. `vi.hoisted` — те же `vi.stubEnv`; `vi.mock('dexie', async (importOriginal) => ({ ...(await importOriginal()), liveQuery: vi.fn(() => ({ subscribe: ({ next }) => ((onData = next), { unsubscribe() {} }) })) }))`; `vi.mock('../storage/repository', …)` — `getPushState: vi.fn(async () => undefined)` (каждый проход вызывает его ровно один раз — по нему считаются проходы), `getPeriods`, `getSettings`, `updatePushState`, `savePushState` — `vi.fn`; `vi.stubGlobal('window', { addEventListener: vi.fn() })`, `vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() })`; `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`; `startReminderSync()` вызывается один раз (`beforeAll`), обработчики берутся из вызовов `addEventListener`; между случаями `vi.mocked(getPushState).mockClear()`. Случаи:
  1. `liveQuery` вызван один раз с `reminderDataQuery`; `window.addEventListener` — с `'online'`, `document.addEventListener` — с `'visibilitychange'`;
  2. `onData()` → до 1999 мс проходов нет, на 2000 мс (`await vi.advanceTimersByTimeAsync`) — один;
  3. три `onData()` с промежутком 1 с → один проход через 2 с после последнего;
  4. обработчик `'online'` → проход сразу, без таймера;
  5. `visibilitychange` при `visibilityState: 'hidden'` → нет прохода; при `'visible'` → один.
  Если что-то на текущем коде ведёт себя иначе — разобраться до правок.

**Checkpoint**: коммит «018: характеризационные тесты синхронизации» (T008)

- [X] T009 [P] [US2] Failing tests до кода — новый `src/storage/pushState.test.ts` (`node` + `fake-indexeddb/auto`) для `updatePushState(patch, identity?)` (research R5, data-model «PushStatePatch»):
  1. нет записи, нет `identity` → `getPushState()` — `undefined`;
  2. нет записи, `identity = { clientId: 'id-1', token: 't-1' }`, патч `{ subscribed: true, pendingSync: true, lastSyncedHash: null }` → `toStrictEqual({ clientId: 'id-1', token: 't-1', subscribed: true, pendingSync: true, lastSyncedHash: null })`;
  3. нет записи, `identity`, пустой патч → `{ clientId: 'id-1', token: 't-1', subscribed: false, pendingSync: false, lastSyncedHash: null }`;
  4. запись есть → меняются только поля патча; `clientId` и `token` прежние, даже если передан другой `identity`;
  5. два одновременных `updatePushState(P, { clientId: 'id-1', … })` и `updatePushState(P, { clientId: 'id-2', … })` на пустой базе (`Promise.all`) → итог `clientId: 'id-1'`, `token` первого;
  6. одновременные патчи разных полей (`{ subscribed: false }` и `{ pendingSync: true, lastSyncedHash: 'h' }`) → применены оба;
  7. «снимок устарел»: прочитать состояние, затем `updatePushState({ subscribed: false })`, затем `updatePushState({ pendingSync: false, lastSyncedHash: 'h' })` → `subscribed: false`;
  8. другие ключи `kv` (настройки, режим разработчика) не меняются.
  Убедиться, что тест падает (функции нет).
- [X] T010 [US2] `src/storage/repository.ts`: `export type PushStatePatch = Partial<Omit<PushState, 'clientId' | 'token'>>`, `export type PushIdentity = Pick<PushState, 'clientId' | 'token'>`, `export async function updatePushState(patch: PushStatePatch, identity?: PushIdentity)` — одна транзакция `rw` по `db.kv`: `current = await getPushState()`; основа `current ?? (identity && { ...identity, subscribed: false, pendingSync: false, lastSyncedHash: null })`; нет основы — выход; `db.kv.put({ key: PUSH_KEY, value: { ...основа, ...patch } })`. Комментарий — по образцу `updateSettings`. `getPushState`, `savePushState` не меняются. T009 зелёный.

**Checkpoint**: коммит «018: updatePushState — состояние push поверх актуального» (T009–T010)

- [X] T011 [P] [US2] Failing tests до кода — новый `src/push/syncCore.test.ts` (`node`, без IndexedDB) для `syncPass` и `createSyncRunner` (contracts/sync-core.md). Подмена `fakeDeps(over)`: состояние в памяти, `updateState: vi.fn(async (patch) => { if (state) state = { ...state, ...patch } })`, `getSubscription → { toJSON: () => SUB_JSON }`, `loadData → { periods, settings }` (изменяемые), `send: vi.fn(async () => ({ ok: true }))`, `url: (s) => 'https://push.example/v1/clients/' + s.clientId`, `now: () => NOW`, `NOW = new Date(2026, 9, 23, 9)`.
  `describe('syncPass')`:
  1. `isConfigured() === false` → `getState` не вызван, `send` не вызван;
  2. нет состояния / `subscribed: false` → `send` и `updateState` не вызваны;
  3. подписки нет → `updateState` один раз ровно с `{ subscribed: false }`, `send` не вызван;
  4. первый проход → `send(url, { method: 'PUT', headers: { Authorization: 'Bearer <token>', 'Content-Type': 'application/json' }, body })`, тело — ожидаемое для `NOW`; `updateState` ровно с `{ pendingSync: false, lastSyncedHash: sha256(тело) }`;
  5. отпечаток совпадает и не `pendingSync` → ни `send`, ни `updateState`;
  6. `pendingSync: true` при совпадающем отпечатке → `send`;
  7. `send` → `{ ok: false }` → `updateState` ровно с `{ pendingSync: true }`; `send` бросает → то же;
  8. часы внедрены: при `now: () => new Date(2026, 10, 30, 9)` тело — ожидаемое для этой даты и отличается от тела для `NOW`;
  9. нет месячных → `reminders: []`;
  10. **выключение во время синхронизации не отменяется**: `send` отдаёт отложенный ответ; пока он не пришёл, состояние меняется на `{ ...state, subscribed: false, pendingSync: false, lastSyncedHash: null }` (как выключение); ответ `{ ok: true }` → итог `subscribed: false`; ни один патч `updateState` не содержит `subscribed`, `clientId`, `token`;
  11. **без сети ставится «ждёт отправки»**: `send` бросает `TypeError` → состояние `pendingSync: true`;
  12. **неизменное расписание повторно не отправляется**: два прохода подряд → `send` один раз;
  13. отказ `getState` / `loadData` → проход отклоняется.
  `describe('createSyncRunner')` (`pass` — `vi.fn` с отложенными промисами, счётчик одновременных):
  14. без идущего прохода → `pass` вызван один раз, вызов разрешается вместе с ним;
  15. три вызова во время прохода → после его конца `pass` вызван ровно ещё один раз; все три вызова разрешаются после второго прохода; одновременно — не больше одного;
  16. вызов во время повторного прохода → третий проход;
  17. первый проход отклонён → первый вызов отклонён, вызов во время него получает результат второго прохода;
  18. после завершения всего новый вызов запускает новый проход;
  19. **изменение во время синхронизации отправляется повторным проходом**: `createSyncRunner(() => syncPass(deps))`; первый `send` отложен; пока он идёт — меняются настройки в `loadData` и снова вызывается запуск; после ответа — `send` вызван дважды, второе тело — по новым настройкам; итоговый `lastSyncedHash` — отпечаток второго тела.
  Убедиться, что тест падает (модуля нет).
- [X] T012 [US2] Новый `src/push/syncCore.ts` (contracts/sync-core.md; research R4, R6): `SyncDeps`, `syncPass(deps)` — шаги 1–8 контракта (прежние правила `doSync`, записи только `deps.updateState(patch)`), SHA-256 через `crypto.subtle` внутри модуля; `createSyncRunner(pass)` — как в research R6. Импорты — только `domain` и `import type` из `storage/repository`; без `fetch`, `navigator`, `import.meta.env`, `new Date(`. T011 зелёный.

**Checkpoint**: коммит «018: ядро синхронизации — проход и повторный проход» (T011–T012)

- [X] T013 [US2] Failing tests до кода — дополнить `src/push/sync.test.ts` новым `describe('гонки')` (красные на текущем коде):
  1. **выключение во время синхронизации не отменяется**: `S0`; `p = syncReminders()`; дождаться `PUT`; `await disableReminders()` (`DELETE` отвечает сразу); ответить на `PUT` `204`; `await p` → `subscribed: false`;
  2. **изменение во время синхронизации отправляется повторным проходом**: `p1 = syncReminders()`; дождаться `PUT`; `await updateSettings({ remindOvulation: false })`; `p2 = syncReminders()`; ответить `204`; `await p2` → `PUT` дважды, второе тело — по новым настройкам; `lastSyncedHash` — отпечаток второго тела;
  3. три вызова во время синхронизации после изменения данных → ровно два `PUT`;
  4. выключение и включение во время синхронизации (`await disableReminders()`, затем `await enableReminders()` и `p2 = syncReminders()`, как `RemindersSection.enable`) → после ответа на первый `PUT` выполняется ещё один проход с новой подпиской браузера (новый endpoint в теле); итог `subscribed: true`, `pendingSync: false`, `lastSyncedHash` — отпечаток второго тела.
  И новый `src/push/pushPlacement.test.ts` (поиск по исходникам `src/push/*.ts` без `.test.`; FR-013, SC-003): нет `storage/db`; нет `'settings'` и `"settings"`; нет `savePushState`; `syncCore.ts` не содержит `fetch(`, `navigator`, `import.meta.env`, `new Date(`. Убедиться, что оба падают на текущем коде.
- [X] T014 [US2] `src/push/sync.ts` — обвязка (contracts/sync-core.md): `deps: SyncDeps` из `isPushConfigured`, `getPushState`, `updatePushState`, `currentSubscription`, `loadData: async () => { const [periods, settings] = await Promise.all([getPeriods(), getSettings()]); return { periods, settings }; }`, `send: (url, init) => fetch(url, init)`, `url: clientUrl`, `now: () => new Date()`; `export const syncReminders = createSyncRunner(() => syncPass(deps))`; `reminderDataQuery = () => Promise.all([getPeriods(), getSettings()])`; `startReminderSync` — как раньше; импорт `db`, `savePushState`, `sha256`, `running`, `doSync` уходят; комментарий R10 сохранить. `src/push/subscribe.ts`: `enableReminders` — `updatePushState({ subscribed: true, pendingSync: true, lastSyncedHash: null }, { clientId: crypto.randomUUID(), token: randomToken() })` вместо чтения `prev` и `savePushState`; `disableReminders` — после `DELETE` `updatePushState({ subscribed: false, pendingSync: false, lastSyncedHash: null })`; остальное без изменений. Все тесты `src/push`, `src/storage`, `src/ui` (в том числе `normalPath.test.ts`, `saveFailures.test.ts`) зелёные.

**Checkpoint**: коммит «018: синхронизация — обвязка над ядром, состояние push поверх актуального» (T013–T014)

---

## Phase 5: User Story 3 — сбой одной подписки не мешает рассылке остальным (P2)

**Goal**: `runSchedule` обрабатывает каждую запись в своём `try/catch`.

**Independent Test**: `npm test --prefix worker -- test/schedule.test.ts`.

- [X] T015 [P] [US3] Failing tests до кода — новый `worker/test/schedule.test.ts` (помощники `./support`; research R8). Три записи в KV в порядке вставки; исправные — `{ tokenHash: 'h', subscription: subscription('a' | 'c'), reminders: [наступившее, будущее] }` (наступившее — `sendAt` = `NOW − 1 ч`, будущее — `NOW + 7 дней`; тексты — `'Календарь цикла'` / `'Сегодня Ты КОРОЛЕВА'`); `fetcher` — `vi.fn` с ответом `201` (или `410` для отдельного endpoint); `vi.spyOn(console, 'warn')`.
  1. первая запись — не JSON (`'{oops https://web.push.apple.com/secret Сегодня'`) → `runSchedule` разрешается; `fetcher` вызван для обеих исправных; у них осталось только будущее напоминание; повреждённая запись — байт в байт прежняя; `console.warn` ровно один раз с `'scheduled record skipped: step=read reason=SyntaxError'`;
  2. запись не той формы `{ tokenHash: 'x' }` (нет `reminders`) → исправные обработаны; журнал `'scheduled record skipped: step=send reason=TypeError'`;
  3. `put` в KV падает для одной исправной записи (наследник `MemoryKV`) → другая исправная обработана; журнал `'scheduled record skipped: step=save reason=Error'`;
  4. `delete` в KV падает для записи, чей push-сервис ответил `410` → другая исправная обработана; журнал — `step=delete reason=Error` (строки `attemptPush` о `410` — его прежнее поведение, проверяется только строка пропуска);
  5. во всех случаях ни одна строка журнала пропуска не содержит `sub:`, `web.push.apple.com/`, текстов напоминаний и `oops`;
  6. отказ `list` → `runSchedule` отклоняется (как раньше; зелёный и до правки).
  Убедиться, что п. 1–4 падают на текущем коде.
- [X] T016 [US3] `worker/src/index.ts`, `runSchedule`: обработка одной записи — в `try/catch`; `let step = 'read'` перед `SUBS.get`, `'send'` перед обходом напоминаний, `'delete'` / `'save'` перед записью; в `catch` — `console.warn(\`scheduled record skipped: step=${step} reason=${e instanceof Error ? e.name : typeof e}\`)` и переход к следующей; комментарий: почему не сообщение (фрагмент записи в сообщении `JSON.parse`). `SUBS.list` — вне `try`. Обработка исправной записи — без изменений. T015, `worker/test/api.test.ts`, `worker/test/contract.test.ts` зелёные; `npm run typecheck --prefix worker` зелёный.

**Checkpoint**: коммит «018: рассылка воркера — сбой одной записи не мешает остальным» (T015–T016)

---

## Phase 6: User Story 4 — документ контракта соответствует коду (P3)

**Goal**: `specs/001-cycle-calendar/contracts/push-worker-api.md` — по коду.

**Independent Test**: сверка по таблице research R11 (quickstart п. 6).

- [ ] T017 [US4] Обновить `specs/001-cycle-calendar/contracts/push-worker-api.md` по research R11, сохранив разделы: CORS — `PUT, DELETE, POST`, заголовки только для `ALLOWED_ORIGIN`; пример — `"title": "Календарь цикла"`, `"body": "Сегодня Ты КОРОЛЕВА"`; таблица ограничений — `reminders.length` 0…24, `id` 1…64, `title` 1…100, `body` 1…200, формат `sendAt` и «не дальше 400 дней вперёд», ключи подписки, токен 16…200; что сохраняется (`endpoint`, `keys`; `sendAt` как `toISOString()`); ответы `PUT` — 204, 400 (тело или `clientId`), 401, 405, 413; неизвестный путь — 404; cron — payload `{ title, body, id }`, после 404/410 запись удаляется и остальные её напоминания не отправляются, сбой на записи пропускает её со строкой журнала «шаг и имя ошибки»; service worker — `{ title, body, id }`, `tag: id`, разбор в `src/pwa/pushNotification.ts`; секреты — `VAPID_PRIVATE_KEY` (JWK, строка JSON) и `VAPID_SUBJECT` — secret, `VAPID_PUBLIC_KEY`, `ALLOWED_ORIGIN` — var. Сверить каждое утверждение с кодом.

**Checkpoint**: коммит «018: документ контракта воркера — по коду» (T017)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T018 Полная проверка: `npm test` (не меньше 1040), `npm run build`, `npm test --prefix worker` (не меньше 37), `npm run typecheck --prefix worker` — всё зелёное; числа записать в отчёт. Для «Журнала» плана рефакторинга (FR-025): шаг **меняет рабочий код `worker/src`** (`index.ts`, `runSchedule`) — шагу 8 нужен `npx wrangler deploy`; подтвердить по `git diff refactoring...HEAD --stat -- worker/src`.
- [ ] T019 Проверки quickstart п. 4, 5, 7, 8: существующие тесты и снимки не изменены (`git diff refactoring...HEAD --stat -- '*.test.ts' '*.snap'` — только новые файлы); поиск `storage/db`, `'settings'`, `savePushState` в `src/push` (кроме тестов) — пусто; `worker/src` не импортирует `../`; `dist/sw.js` содержит «Календарь цикла»; дифф без испорченной кириллицы и BOM; изменений вне объёма шага нет.
- [ ] T020 Отметить задачи выполненными в этом файле; коммит «018: задачи выполнены».

---

## Dependencies & Execution Order

- **T001 → T002 → T003 → T004**: контрактный тест — первым, до любых правок кода (FR-003).
- **US1** (T005–T007): T007 зависит от T003 и T006.
- **US2** (T008–T014): T008 (характеризация) — до T010, T012, T014. T009 → T010; T011 → T012; T013 → T014;
  T014 зависит от T010 и T012.
- **US3** (T015–T016): зависит только от T002; может идти параллельно с US2.
- **US4** (T017): после US1 и US3 (документ описывает разбор в `src/pwa` и изоляцию сбоев).
- **Polish** (T018–T020): после всех историй.

### Parallel Opportunities

- T005 (тест разбора уведомления) — параллельно с T003/T004 по файлам, но коммит после контрактного теста.
- T009 и T011 — разные файлы, без зависимостей друг от друга.
- T015 — параллельно с US2 (воркер и приложение не пересекаются).

```text
# После T008:
T009 src/storage/pushState.test.ts   ||   T011 src/push/syncCore.test.ts   ||   T015 worker/test/schedule.test.ts
```

## Implementation Strategy

1. **MVP — US1**: контрактный тест ловит расхождение приложения и воркера (самое ценное: молча
   пропадающие напоминания).
2. **US2**: гонки синхронизации — характеризация, хранилище, ядро, обвязка; каждый шаг — свой коммит.
3. **US3**: изоляция сбоев рассылки (меняет рабочий код `worker/src` — деплой в шаге 8).
4. **US4**: документ по итоговому коду.
5. Проверки, отметка задач. Слияние в `refactoring` и запись в «Журнал» — по `docs/refactoring-roadmap.md`
   («Порядок работы над шагом», пп. 7–9), не в этом файле.
