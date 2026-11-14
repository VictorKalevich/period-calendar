# Research: Напоминания — контракт с воркером под тестом, синхронизация без гонок

Фича 018, шаг 5 плана рефакторинга. Пункты «Проверить на этапе плана» файла шага разобраны в R1 (где жить
контрактному тесту), R1 (исключение из правила слоёв) и R10 (ответы 4xx).

## R1. Контрактный тест — в `worker/test/contract.test.ts`, домен приложения импортируется из теста

**Decision**: новый файл `worker/test/contract.test.ts` в пакете воркера. Он импортирует домен приложения
(`../../src/domain/forecast`, `reminders`, `dates`, `types`) и разбор уведомления service worker
(`../../src/pwa/pushNotification`, R2), а из воркера — `handleRequest`, `runSchedule`, `validatePutBody`.
Рабочий код `worker/src` код приложения не импортирует; это проверяет тот же файл поиском по исходникам
`worker/src/*.ts` (нет импорта, выходящего за `worker/`).

**Rationale**:
- Приём уже работает: `worker/test/api.test.ts:118-135` («contract with the app») импортирует домен
  приложения, и базовая линия зелёная (`npm test --prefix worker` — 37, `npm run typecheck --prefix worker`
  — без ошибок). `worker/tsconfig.json` включает `test`, поэтому файлы домена, достижимые из теста,
  проверяются типами воркера (`lib: ES2022`, `@cloudflare/workers-types`): домен не использует DOM, проверка
  проходит. `date-fns` разрешается от файла домена — из корневого `node_modules`; в CI корневой `npm ci`
  выполняется до тестов воркера (`.github/workflows`, шаги `npm ci` → `npm test` → `npm ci --prefix worker`
  → `npm test --prefix worker`).
- Тест в `src/` с импортом `worker/src/validate.ts` втянул бы в проверку типов приложения
  `worker/src/webpush.ts` (через `import type { PushSubscriptionJSON }`: `tsc` проверяет все достижимые
  файлы, `skipLibCheck` касается только `.d.ts`), а там `SubtleCryptoDeriveKeyAlgorithm` из
  `@cloudflare/workers-types`, которого нет в `tsconfig.json` приложения — `npm run build` упал бы.
- `api.test.ts` по условиям шага не меняется, поэтому контрактный тест — отдельный файл; прежняя проверка
  «contract with the app» остаётся как есть.

**Исключение из правила слоёв** («`worker/` — ничего из `src/`»): тесты воркера (`worker/test/*.test.ts`)
MAY импортировать `src/domain/*` и `src/pwa/pushNotification.ts` — оба модуля не зависят от браузера и
хранилища. `worker/src` — нет; охраняется тестом.

**Alternatives considered**:
- *Вынести `PushSubscriptionJSON` из `webpush.ts` в отдельный файл, тест — в `src/`*: правка рабочего кода
  воркера только ради места теста, а тест приложения всё равно зависел бы от исходников воркера. Отклонено.
- *Дописать случаи в `api.test.ts`*: запрещено условиями шага. Отклонено.

## R2. Payload: перехват отправки в воркере, разбор в service worker — чистая функция

**Decision**:
- Воркер: в `contract.test.ts` `vi.mock('../src/webpush', …)` подменяет только `sendPush` (остальное —
  оригинал). `runSchedule` по принятому расписанию вызывает подмену, тест берёт её второй аргумент —
  payload — и сверяет: ровно `{ title, body, id }` наступившего напоминания.
- Service worker: разбор данных push-события переносится из `src/sw.ts:20-25,27-29` в чистую функцию
  `notificationFromPush(data)` в новом `src/pwa/pushNotification.ts` (без импортов). `sw.ts` вызывает её и
  передаёт результат в `showNotification` с прежними `icon`, `badge`, `lang`. Выражения переносятся как
  есть: `event.data?.json() ?? {}`, при исключении — `{ body: event.data?.text() }`,
  `title ?? 'Календарь цикла'`, `body ?? ''`, `tag: id`.
- Контрактный тест прогоняет payload воркера (через `JSON.stringify`/`JSON.parse`, как при доставке) через
  `notificationFromPush` и сверяет: заголовок, текст и метка = заголовок, текст и идентификатор
  напоминания.

**Rationale**:
- `sw.ts` нельзя импортировать в тест: при загрузке он вызывает `precacheAndRoute(self.__WB_MANIFEST)` и
  вешает обработчики на `self`. Чистая функция проверяется и в приложении (`node`), и из теста воркера; её
  типы не требуют DOM (`{ json(): unknown; text(): string }`), поэтому она проходит проверку типов
  приложения, `tsconfig.sw.json` (WebWorker) и воркера.
- `src/pwa` по правилам слоёв не импортирует слои приложения — новая функция не импортирует ничего; литерал
  `'Календарь цикла'` остаётся литералом (как в `sw.ts` сейчас), а не импортом `NOTIFICATION_TITLE` из
  домена.
- Подмена `sendPush` проверяет именно то, что `runSchedule` передаёт на шифрование; само шифрование уже
  покрыто эталонными векторами RFC 8291 в `webpush.test.ts`.
- Вынос — перенос кода: функция пишется по тесту, в котором зафиксировано текущее поведение `sw.ts`
  (обычный payload, отсутствующие поля, не-JSON, нет данных). До выноса тест падает (модуля нет), после —
  зелёный; поведение `sw.ts` прежнее.

**Alternatives considered**:
- *Расшифровать тело запроса в тесте (aes128gcm, закрытый ключ UA из RFC 8291)*: настоящее сквозное
  сравнение, но 30–40 строк криптографии в тесте ради того, что уже проверено векторами. Отклонено.
- *Экспортировать из `worker/src/index.ts` функцию сборки payload*: не доказывает, что `runSchedule`
  пользуется именно ею. Отклонено.
- *Поиск `data.title`/`data.body`/`data.id` в тексте `sw.ts`*: хрупко, ломается от переименования
  переменной. Отклонено.

## R3. Набор случаев контрактного теста

**Decision**: расписание строится так же, как в синхронизации: `today = toLocalDate(now)`,
`toServerReminders(planReminders(buildForecast({ periods, settings, today }), settings, now))`; тело —
`{ subscription, reminders }` с подпиской в форме `PushSubscription.toJSON()` (`endpoint`,
`expirationTime: null`, `keys`). Для каждого случая:

1. `PUT` через `handleRequest` отвечает `204` (весь путь приёма: размер, JSON, правило);
2. `validatePutBody(body, now)` возвращает те же напоминания (поле в поле);
3. виды напоминаний в расписании — ожидаемые для случая (по префиксу `id`).

| Случай | Данные | Ожидаемые виды |
|--------|--------|----------------|
| Обычный цикл | умолчания, одна запись | месячные, овуляция, неотмеченное начало (18) |
| Самый короткий цикл | `defaultCycleLength: 21` (нижняя граница настроек) | все три; число ≤ предела |
| Самый короткий учитываемый цикл | история с циклом 15 дней (граница выбросов) | все три |
| Самый длинный цикл | `defaultCycleLength: 45` | все три |
| Самый длинный учитываемый цикл, сегодня — первый день месячных | история с циклом 60 дней | все три; самое дальнее — не дальше 400 дней (≈ 362) |
| Задержка | прогнозное начало вчера | только неотмеченное начало |
| Овуляция со сдвигом и «от следующей менструации» | `ovulationShiftEnabled`, `ovulationShift: ±5`, `ovulationFromNextPeriod` | все три |
| Каждое напоминание по отдельности | один из `remind*` включён | только этот вид |
| Все выключены | `remind*: false` | пусто |

Каждый случай — в пяти часовых поясах: `UTC`, `Europe/Moscow`, `America/New_York` (переход на летнее
время внутри горизонта), `Pacific/Kiritimati` (UTC+14) и `Pacific/Pago_Pago` (UTC−11) — по образцу
`src/domain/reminders.test.ts` (`process.env.TZ`, восстановление в `afterEach`).

Предел числа напоминаний продублирован в домене (`MAX_REMINDERS = 24`, `src/domain/reminders.ts:36`) и в
воркере (`worker/src/validate.ts:6`, не экспортируется). Отдельный случай связывает их поведением:
`MAX_REMINDERS` напоминаний домена воркер принимает, `MAX_REMINDERS + 1` — нет. Значит, константы равны;
экспорт из `validate.ts` не нужен.

**Проверка, что тест ловит нарушение (SC-001)**: при реализации временно уменьшить в `validate.ts`
`MAX_TITLE`, `MAX_BODY`, `MAX_ID`, `MAX_REMINDERS` или `MAX_AHEAD_MS` — тест должен упасть; вернуть.

**Rationale**: самое дальнее напоминание — о неотмеченном начале шестого цикла: `nextStart` текущего цикла
плюс пять длин цикла плюс 2 дня. Длина цикла по истории не больше 60 (`OUTLIER_CYCLE.max`), по настройкам —
не больше 45 (`CYCLE_LENGTH_RANGE`), поэтому худший случай — около 362 дней при пределе 400. Предел
числа: 6 циклов × 3 вида = 18 ≤ 24. Тексты — константы домена (≤ 70 символов), `id` — не длиннее
`missed-period:YYYY-MM-DD` (24 символа). Тест фиксирует эти выводы и упадёт, если правило или домен
изменятся.

## R4. Ядро синхронизации: `src/push/syncCore.ts` с внедряемыми зависимостями

**Decision**:

```ts
export interface SyncDeps {
  isConfigured(): boolean;
  getState(): Promise<PushState | undefined>;
  updateState(patch: PushStatePatch): Promise<void>;
  getSubscription(): Promise<{ toJSON(): unknown } | null>;
  loadData(): Promise<{ periods: Period[]; settings: Settings }>;
  send(url: string, init: RequestInit): Promise<{ ok: boolean }>;
  url(state: PushState): string;
  now(): Date;
}
export function syncPass(deps: SyncDeps): Promise<void>;           // прежний doSync
export function createSyncRunner(pass: () => Promise<void>): () => Promise<void>; // R6
```

`src/push/sync.ts` — обвязка: собирает `SyncDeps` из `isPushConfigured`, `getPushState`, `updatePushState`,
`currentSubscription`, `getPeriods` + `getSettings`, глобального `fetch` (вызывается при каждом запросе, не
захватывается при загрузке), `clientUrl`, `() => new Date()`; экспортирует
`syncReminders = createSyncRunner(() => syncPass(deps))`, `startReminderSync` и запрос наблюдения (R7).

`syncPass` — прежние правила `doSync` (`sync.ts:26-55`) по порядку, с одним отличием: каждая запись
состояния — `updateState(patch)` только своих полей:

| Шаг | Было | Стало |
|-----|------|-------|
| push не настроен / нет состояния / `subscribed: false` | выход | то же |
| браузер потерял подписку | `savePushState({ ...state, subscribed: false })` | `updateState({ subscribed: false })` |
| отпечаток тела = `lastSyncedHash` и не `pendingSync` | выход без запроса | то же |
| `PUT` успешен | `savePushState({ ...state, pendingSync: false, lastSyncedHash })` | `updateState({ pendingSync: false, lastSyncedHash })` |
| нет сети или не-2xx | `savePushState({ ...state, pendingSync: true })` | `updateState({ pendingSync: true })` |

Тело (`JSON.stringify({ subscription: subscription.toJSON(), reminders })`), метод `PUT`, заголовки
(`Authorization: Bearer <token>`, `Content-Type: application/json`), адрес и отпечаток (SHA-256 тела, hex)
— прежние. SHA-256 считается внутри ядра через `crypto.subtle` (есть и в браузере, и в Node).

**Rationale**:
- Внедрены все внешние зависимости из набросков (состояние, подписка, сеть, часы) и, дополнительно,
  чтение данных и признак настройки сборки: тесты ядра идут в `node` без IndexedDB, без `import.meta.env`
  и без браузера. Подключение к настоящему репозиторию проверяет интеграционный тест обвязки (R9).
- Снимок `state`, прочитанный в начале прохода, используется только до сетевого запроса (токен, адрес,
  сравнение отпечатка) — как раньше. После ожидания сети пишутся только поля прохода поверх актуального
  состояния, поэтому выключение во время синхронизации не отменяется (FR-007).
- `send` возвращает `{ ok }`: ядру нужен только признак успеха, любой не-2xx — отказ (R10).

**Alternatives considered**:
- *Ядро вызывает репозиторий напрямую (тесты — с `fake-indexeddb`)*: проще обвязка, но тест ядра снова
  привязан к базе. Отклонено: набросок требует внедряемых зависимостей; база проверяется отдельно (R5, R9).
- *Класс `ReminderSync` с состоянием*: две функции проще. Отклонено (Конституция V).

## R5. `updatePushState(patch, identity?)` в репозитории

**Decision**:

```ts
export type PushStatePatch = Partial<Omit<PushState, 'clientId' | 'token'>>;
export type PushIdentity = Pick<PushState, 'clientId' | 'token'>;
/** Меняет поля состояния push поверх сохранённого, в одной транзакции (по образцу `updateSettings`). */
export async function updatePushState(patch: PushStatePatch, identity?: PushIdentity): Promise<void>;
```

В транзакции `rw` по `db.kv`: прочитать состояние; если его нет и `identity` не передан — ничего не писать;
если нет, но `identity` есть — основа `{ ...identity, subscribed: false, pendingSync: false,
lastSyncedHash: null }`; записать `{ ...основа, ...patch }`. Идентификатор клиента и токен патчем не
меняются (тип не даёт).

Вызывающие места:

| Место | Было | Стало |
|-------|------|-------|
| `enableReminders` (`subscribe.ts:52-59`) | `prev = getPushState()`, затем `savePushState({ clientId: prev?.clientId ?? uuid, token: prev?.token ?? random, subscribed: true, pendingSync: true, lastSyncedHash: null })` | `updatePushState({ subscribed: true, pendingSync: true, lastSyncedHash: null }, { clientId: crypto.randomUUID(), token: randomToken() })` |
| `disableReminders` (`subscribe.ts:64-73`) | `state` до `DELETE`, после — `savePushState({ ...state, subscribed: false, pendingSync: false, lastSyncedHash: null })` | `state` до `DELETE` (адрес и токен), после — `updatePushState({ subscribed: false, pendingSync: false, lastSyncedHash: null })` |
| `syncPass` | см. R4 | см. R4 |

`savePushState` остаётся в репозитории: им пользуется существующий `src/storage/backup.test.ts`. В
`src/push` вызовов `savePushState` не остаётся — проверяет тест-поиск (R9).

**Rationale**:
- Результат каждого вызова на непараллельном пути — тот же, что раньше: у включения при существующем
  состоянии — прежние `clientId`/`token` и три поля; без состояния — новые `clientId`/`token`; у выключения
  — те же три поля поверх. Форма записи не меняется (FR-022).
- Два одновременных включения на пустом устройстве: транзакции IndexedDB по одному хранилищу в режиме `rw`
  выполняются по очереди, второе видит запись первого и сохраняет её идентификатор и токен (FR-009). Раньше
  каждое записывало свои — один из двух клиентов оставался на воркере сиротой.
- Новые `uuid` и токен создаются до транзакции (синхронно), неиспользованные просто отбрасываются: внутри
  транзакции Dexie нельзя ждать ничего, кроме операций базы, а `crypto.randomUUID()` — синхронный.
- Запись без `clientId` в базе не возникает (пишут только эти функции), поэтому прежнее
  `prev?.clientId ?? uuid` при существующем `prev` равно `prev.clientId`.

**Alternatives considered**:
- *Функция-преобразователь `updatePushState(change: (s) => s)`*: общее, но снова позволяет вернуть целый
  объект «как прочитали раньше»; патч по типу этого не позволяет. Отклонено.
- *Сравнение-и-запись (писать результат прохода, только если состояние не менялось)*: выключение и так не
  отменяется, а «ждёт отправки» / отпечаток у выключенных напоминаний нигде не показываются
  (`RemindersSection` и `DevSection` смотрят на них только при `subscribed`); при новом включении они
  сбрасываются. Отклонено (Конституция V).

## R6. Повторный проход: `createSyncRunner`

**Decision**:

```ts
export function createSyncRunner(pass: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let queued: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (!running) return (running = pass().finally(() => (running = null)));
    return (queued ??= running.then(noop, noop).then(() => ((queued = null), run())));
  };
  return run;
}
```

- Нет идущего прохода — запускается проход, вызов получает его результат (как раньше).
- Проход идёт — все вызовы до его конца получают один общий ожидающий повторный проход; он стартует после
  завершения текущего (успехом или ошибкой) и сам может породить следующий, если его запросят во время него.
- Проходы не идут одновременно: повторный стартует только после `finally` текущего.

**Rationale**:
- Изменение данных во время прохода (подписка `liveQuery` с задержкой 2 с, «онлайн», возврат в
  приложение, включение) раньше получало уже идущий проход, собранный по старым данным. Теперь после него
  выполняется ещё один, а неизменное расписание повторный проход не отправляет — сравнение отпечатков
  (FR-010, FR-011).
- Ожидающие вызовы получают результат повторного прохода: `RemindersSection.enable` и
  `sendTestNotification` ждут `syncReminders()` и после него читают состояние — теперь они видят результат
  по последним данным.
- Ошибка прохода (например, отказ чтения базы) по-прежнему отклоняет вызовы этого прохода; повторный проход
  от ошибки предыдущего не зависит.

**Alternatives considered**:
- *Флаг «повторить» и цикл внутри одного промиса*: вызовы во время повторного прохода ждали бы вместе с
  первым, ошибки сложнее разнести. Отклонено.
- *Отменять идущий запрос (`AbortController`)*: расписание могло уже дойти до воркера; отмена ничего не даёт.
  Отклонено.

## R7. Наблюдение за данными — через функции репозитория

**Decision**: `sync.ts` экспортирует `reminderDataQuery = () => Promise.all([getPeriods(), getSettings()])`;
`startReminderSync` подписывается `liveQuery(reminderDataQuery)`. Импорт `db` и литерал `'settings'` из
`src/push` уходят.

**Rationale**:
- Пробный прогон (2026-11-14, `fake-indexeddb`, Dexie 4): после подписки прежний запрос
  `Promise.all([db.periods.toArray(), db.kv.get('settings')])` и новый дают одинаковые срабатывания:
  первое значение; запись состояния push — нет; запись режима разработчика — нет; `updateSettings` — да;
  изменение конца месячных — да (счётчики `[1, 1, 1, 2, 3]` у обоих). `getPeriods` читает индекс `start`
  целиком, `getSettings` — один ключ `kv`, поэтому синхронизация не запускает сама себя записью состояния.
- Характеризационный тест пишется на прежнем выражении (оно выносится в экспорт без изменений), затем
  выражение заменяется — тест остаётся зелёным.
- `getSettings` возвращает приведённые настройки, `db.kv.get` — сырую запись; `startReminderSync` значение не
  читает (только сам факт срабатывания), поэтому разница не важна.

**Alternatives considered**: *функция наблюдения в репозитории* (`watchReminderData`): репозиторий не
работает с `liveQuery`, а набросок прямо называет «функции репозитория внутри `liveQuery`». Отклонено.

## R8. Рассылка воркера: изоляция сбоя по записи

**Decision**: в `runSchedule` обработка одной записи — в своём `try/catch`; переменная шага меняется по ходу
(`read` → `send` → `save` | `delete`). При исключении — одна строка журнала
`scheduled record skipped: step=<шаг> reason=<имя ошибки>` (`e instanceof Error ? e.name : typeof e`) и
переход к следующей записи. Получение страницы списка (`SUBS.list`) — вне `try`, как сейчас: без списка
обходить нечего.

**Rationale**:
- Сейчас исключение из `SUBS.get(name, 'json')` (повреждённый JSON), из обхода `rec.reminders` (запись не той
  формы), из `SUBS.put`/`SUBS.delete` (отказ KV) прерывает весь `runSchedule`. `attemptPush` свои ошибки уже
  ловит (статус 0) — его поведение не меняется.
- В журнал — только имя ошибки, не сообщение: сообщение `JSON.parse` содержит фрагмент входа
  (Node 24: `Unexpected token 'h', "https://we"... is not valid JSON`), то есть мог бы попасть адрес
  подписки или текст напоминания (правило шапки `worker/src/index.ts:13`). Ключ записи (`sub:<clientId>`) тоже
  не пишется.
- Повреждённая запись остаётся в KV как есть и будет пропускаться каждый час; удалять её — изменение
  поведения, вне объёма шага.
- Исправные записи обрабатываются тем же кодом, что раньше (FR-017): существующие тесты «scheduled» в
  `api.test.ts` не меняются и остаются зелёными.
- **Шаг меняет рабочий код `worker/src`** (`index.ts`) — шагу 8 нужно задеплоить воркер.

**Alternatives considered**:
- *Отдельная функция `processRecord` и `try/catch` вокруг вызова*: то же самое, но шаг сбоя пришлось бы
  возвращать через тип ошибки. Допустимо; выбор формы — на этапе реализации, требования те же.
- *Писать в журнал ключ записи для отладки*: технический идентификатор, правилом не запрещён, но набросок
  требует «только имя шага и причину». Отклонено.

## R9. Тесты: порядок, файлы, подмены

**Decision** — только новые файлы:

| Файл | Что проверяет | Когда пишется |
|------|---------------|---------------|
| `worker/test/support.ts` | общий для новых тестов воркера `MemoryKV`, `makeEnv`, подписка RFC 8291 (не тест) | с первым тестом воркера |
| `worker/test/contract.test.ts` | R1–R3 | первым, до любых правок; зелёный на текущем коде. Случаи с `notificationFromPush` — вместе с выносом (R2) |
| `src/pwa/pushNotification.test.ts` | разбор push-данных как в `sw.ts` | до выноса; падает (нет модуля) |
| `src/push/sync.test.ts` | интеграция обвязки: правила прохода (FR-011) на настоящем репозитории; выключение и изменение во время синхронизации; наблюдение `liveQuery` (R7) | характеризация правил и наблюдения — до правок, зелёная до и после; гонки — до кода, красные на текущем коде |
| `src/push/startReminderSync.test.ts` | триггеры фоновой синхронизации (FR-014): старт, задержка 2 с после изменения данных, «онлайн», возврат в приложение; `liveQuery` получает `reminderDataQuery`. `liveQuery` и репозиторий подменены (`vi.mock`), подменены `setTimeout`/`clearTimeout` — база не открывается | до правок, зелёный до и после |
| `src/storage/pushState.test.ts` | `updatePushState` (R5) | до кода |
| `src/push/syncCore.test.ts` | `syncPass` и `createSyncRunner` с подменами (R4, R6) | до кода |
| `src/push/pushPlacement.test.ts` | в `src/push` нет импорта `storage/db`, литерала `'settings'`, вызовов `savePushState`; `syncCore.ts` не обращается к `fetch`, `navigator`, `import.meta.env`, `new Date()` | до правки, падает на текущем коде |
| `worker/test/schedule.test.ts` | R8: повреждённая запись (не JSON и не той формы), отказ `put`/`delete` у одной записи не мешают остальным; журнал без адреса, текстов и содержимого | до кода; падает на текущем коде |

Подмены в `src/push/sync.test.ts` (окружение `node`): `vi.hoisted(() => vi.stubEnv('VITE_PUSH_API_URL', …),
vi.stubEnv('VITE_VAPID_PUBLIC_KEY', …))` — модуль `subscribe.ts` читает их при загрузке (проверено пробным
прогоном); `vi.stubGlobal` для `window` (`PushManager`, `Notification`), `navigator`
(`serviceWorker.ready` → `pushManager.getSubscription`) и `fetch` (отложенный ответ — для гонок);
`vi.useFakeTimers({ toFake: ['Date'] })` + `setSystemTime` — расписание не зависит от момента прогона
(таймеры IndexedDB не подменяются); `fake-indexeddb/auto` и настоящий репозиторий.

`worker/test/api.test.ts`, `worker/test/webpush.test.ts` и все существующие тесты приложения не меняются
(FR-021).

**Rationale**: характеризация правил прохода на настоящем `syncReminders` до правок — то, что требует п. 5
«Общих ограничений» для переноса кода; тесты ядра с подменами дают точные сценарии гонок и повторного
прохода без браузера (SC-002).

## R10. Ответы 4xx — по-прежнему «ждёт отправки»

**Decision**: любой ответ, кроме 2xx, и отказ сети ставят `pendingSync: true` (прежнее
`if (!res.ok) throw`). Различение постоянного и временного отказа вынесено в «Вне плана» плана рефакторинга
(п. 2) и в этом шаге не делается.

## R11. Документ контракта: расхождения с кодом

Сверка `specs/001-cycle-calendar/contracts/push-worker-api.md` с `worker/src/index.ts`, `validate.ts`,
`webpush.ts`, `wrangler.toml` и `src/sw.ts`. Кроме четырёх расхождений из файла шага, найдены ещё:

| Место документа | Сейчас в документе | В коде |
|-----------------|--------------------|--------|
| CORS | `PUT, DELETE` | `PUT, DELETE, POST` (`index.ts:47`); заголовки CORS только для `ALLOWED_ORIGIN`, запрос с другого origin обрабатывается без них |
| Payload (cron, service worker) | `{ title, body }` | `{ title, body, id }` (`index.ts:198`, `sw.ts:20-29`); `id` — метка уведомления |
| Пример | `"title": "Овуляция"` | `"Календарь цикла"` (фича 007, `NOTIFICATION_TITLE`) |
| `VAPID_SUBJECT` | var | secret (`wrangler.toml:19-21`) |
| `VAPID_PRIVATE_KEY` | «JWK/PKCS8» | только JWK (строка JSON, `webpush.ts:101-104`) |
| `title` / `body` | ≤ 100 / ≤ 200 | 1…100 / 1…200 (пустая строка — 400, `validate.ts:32`) |
| `id` | — | 1…64 символов |
| `sendAt` | ISO-8601, ≤ 400 дней | `YYYY-MM-DDTHH:mm:ss(.sss)Z` (UTC), не дальше 400 дней вперёд; прошлое допускается; хранится как `toISOString()` |
| Ключи подписки | — | `p256dh` — base64url до 200, `auth` — base64url до 100; сохраняются только `endpoint` и `keys` (`expirationTime` отбрасывается) |
| Токен | — | `Bearer` + 16…200 символов, иначе 401 |
| Ответы `PUT` | 204, 400, 401, 413 | ещё 400 для `clientId` не-UUID, 405 для другого метода; неизвестный путь — 404 |
| Cron | — | после ответа 404/410 запись удаляется целиком, оставшиеся напоминания этой записи не отправляются; сбой на записи пропускает её (R8) |

`specs/002-dev-mode/contracts/push-worker-test-api.md` сверен с кодом — расхождений нет; не меняется.

**Decision**: обновить `push-worker-api.md` по коду (таблица выше), сохранив его разделы. Новый раздел
не нужен; изоляция сбоев — пункт в «Cron».

## R12. Порядок `PUT` и `DELETE` на воркере при выключении во время синхронизации

Если напоминания выключают, пока `PUT` в пути, `DELETE` может дойти до воркера раньше `PUT`, и запись
появится снова. Подписка в браузере при выключении отменяется (`sub.unsubscribe()`), поэтому ближайшая
рассылка получит от push-сервиса 404/410 и удалит запись (`index.ts:199-206`). Уведомление до этого не
придёт: по отменённой подписке push-сервис не доставляет. Шаг этого не меняет — в «Журнал» как находка.

Выключение и повторное включение во время одной синхронизации: включение сбрасывает `lastSyncedHash` в
`null`, а завершившийся старый проход записывает поверх отпечаток старого тела. Повторный проход (R6) всё
равно отправляет расписание: после `unsubscribe()` браузер создаёт при включении новую подписку с новым
endpoint, тело и отпечаток другие. Различить «тот же отпечаток до и после выключения» без нового поля
состояния нельзя, а форма `kv['push']` по условиям шага не меняется.
