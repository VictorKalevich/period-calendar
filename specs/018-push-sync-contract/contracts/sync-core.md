# Contract: ядро синхронизации, состояние push, разбор уведомления, рассылка воркера

Внутренние интерфейсы шага 5. HTTP-контракт воркера не меняется — его описание приводится к коду в
[001 contracts/push-worker-api.md](../../001-cycle-calendar/contracts/push-worker-api.md) (research R11).

## `src/push/syncCore.ts`

```ts
import type { Period, Settings } from '../domain/types';
import type { PushState, PushStatePatch } from '../storage/repository';

export interface SyncDeps {
  /** Push настроен в сборке (адрес воркера и VAPID-ключ). */
  isConfigured(): boolean;
  getState(): Promise<PushState | undefined>;
  /** Только изменённые поля поверх актуального состояния, неделимо. */
  updateState(patch: PushStatePatch): Promise<void>;
  /** Подписка браузера; `null` — подписки нет. */
  getSubscription(): Promise<{ toJSON(): unknown } | null>;
  loadData(): Promise<{ periods: Period[]; settings: Settings }>;
  /** Сетевой запрос; исключение — нет сети. */
  send(url: string, init: RequestInit): Promise<{ ok: boolean }>;
  url(state: PushState): string;
  now(): Date;
}

export function syncPass(deps: SyncDeps): Promise<void>;
export function createSyncRunner(pass: () => Promise<void>): () => Promise<void>;
```

**`syncPass` — гарантии** (прежний `doSync`, FR-011):

1. `!isConfigured()` → ничего не делает.
2. Нет состояния или `subscribed: false` → ничего не делает.
3. `getSubscription()` → `null` → `updateState({ subscribed: false })`, запроса нет.
4. `today = toLocalDate(now())`; расписание —
   `toServerReminders(planReminders(buildForecast({ periods, settings, today }), settings, now()))`, без
   прогноза — `[]`; тело — `JSON.stringify({ subscription: subscription.toJSON(), reminders })`;
   отпечаток — SHA-256 тела, hex.
5. Отпечаток = `state.lastSyncedHash` и `!state.pendingSync` → запроса нет.
6. `send(url(state), { method: 'PUT', headers: { Authorization: 'Bearer ' + state.token,
   'Content-Type': 'application/json' }, body })`:
   - `ok` → `updateState({ pendingSync: false, lastSyncedHash: отпечаток })`;
   - не `ok` или исключение → `updateState({ pendingSync: true })`.
7. После шага 6 `subscribed`, `clientId`, `token` не записываются.
8. Ошибки `getState`, `loadData`, `getSubscription`, `updateState` не перехватываются — отклоняют проход
   (как раньше).

**`createSyncRunner(pass)` — гарантии** (FR-010):

- Возвращает функцию запуска. Без идущего прохода — запускает `pass()` и возвращает его промис.
- Во время прохода — возвращает общий промис одного повторного прохода, который стартует после завершения
  текущего (успехом или ошибкой); сколько бы раз ни вызвали, повторный — один.
- Два вызова `pass` никогда не выполняются одновременно.

## `src/push/sync.ts` (обвязка)

```ts
export const syncReminders: () => Promise<void>;       // createSyncRunner(() => syncPass(deps))
export function reminderDataQuery(): Promise<[Period[], Settings]>; // Promise.all([getPeriods(), getSettings()])
export function startReminderSync(): void;             // как раньше; liveQuery(reminderDataQuery)
```

`deps`: `isPushConfigured`, `getPushState`, `updatePushState`, `currentSubscription`,
`{ periods: await getPeriods(), settings: await getSettings() }` (параллельно, как раньше),
`(url, init) => fetch(url, init)`, `clientUrl`, `() => new Date()`. Импорта `storage/db` и литерала
`'settings'` нет.

## `src/storage/repository.ts`

```ts
export type PushStatePatch = Partial<Omit<PushState, 'clientId' | 'token'>>;
export type PushIdentity = Pick<PushState, 'clientId' | 'token'>;
export function updatePushState(patch: PushStatePatch, identity?: PushIdentity): Promise<void>;
```

Одна транзакция `rw` по `db.kv`. Есть запись — `{ ...запись, ...patch }`. Нет записи, есть `identity` —
`{ ...identity, subscribed: false, pendingSync: false, lastSyncedHash: null, ...patch }`. Нет ни того, ни
другого — ничего. Другие ключи `kv` не трогает. `getPushState`, `savePushState` — без изменений.

## `src/push/subscribe.ts`

- `enableReminders`: после подписки браузера —
  `updatePushState({ subscribed: true, pendingSync: true, lastSyncedHash: null },
  { clientId: crypto.randomUUID(), token: randomToken() })`. Остальное — как раньше.
- `disableReminders`: `state = getPushState()`; если есть — `DELETE` (ошибка сети игнорируется), затем
  `updatePushState({ subscribed: false, pendingSync: false, lastSyncedHash: null })`; затем
  `unsubscribe()` подписки браузера — как раньше.

## `src/pwa/pushNotification.ts`

```ts
export interface PushData { json(): unknown; text(): string }
export interface NotificationContent { title: string; body: string; tag: string | undefined }
export function notificationFromPush(data: PushData | null | undefined): NotificationContent;
```

Разбор как в прежнем `sw.ts`: `data?.json() ?? {}`; при исключении — `{ body: data?.text() }`; `title ??
'Календарь цикла'`, `body ?? ''`, `tag: id`. Значения полей не проверяются и не приводятся (как раньше).
`sw.ts`: `const n = notificationFromPush(event.data)` →
`showNotification(n.title, { body: n.body, tag: n.tag, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'ru' })`.

## `worker/src/index.ts` — `runSchedule`

Сигнатура та же. Для каждой записи страницы: `try { read → send → save | delete } catch (e) {
console.warn('scheduled record skipped: step=<шаг> reason=<e.name>') }`. В строке журнала нет ключа записи,
адреса подписки, текстов, содержимого записи и сообщения ошибки. Обработка исправной записи — прежняя.
