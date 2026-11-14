# Data Model: Напоминания — контракт с воркером под тестом, синхронизация без гонок

Хранимые формы не меняются (FR-022): `SCHEMA_VERSION = 6`, таблицы, запись `kv['push']`, запись KV воркера
`sub:<clientId>`. Ниже — существующие сущности и новые типы кода, которые ими оперируют.

## PushState — `kv['push']` на устройстве (без изменений)

| Поле | Тип | Кто пишет |
|------|-----|-----------|
| `clientId` | UUID | создаётся при первом включении; дальше не меняется |
| `token` | 32 байта base64url | то же; в резервную копию не входит |
| `subscribed` | boolean | включение — `true`; выключение и потеря подписки браузером — `false` |
| `pendingSync` | boolean | включение — `true`; проход: успех — `false`, отказ — `true`; выключение — `false` |
| `lastSyncedHash` | hex SHA-256 тела `PUT` \| `null` | проход: успех — отпечаток; включение и выключение — `null` |

**Переходы** (каждый — `updatePushState`, одна транзакция `rw` по `kv`, только перечисленные поля):

```text
(нет записи) --включение--> { новые clientId, token; subscribed: true; pendingSync: true; lastSyncedHash: null }
любое        --включение--> { subscribed: true, pendingSync: true, lastSyncedHash: null }   (clientId, token — прежние)
любое        --выключение-> { subscribed: false, pendingSync: false, lastSyncedHash: null }
subscribed   --проход: браузер без подписки--> { subscribed: false }
subscribed   --проход: PUT 2xx--------------> { pendingSync: false, lastSyncedHash: <отпечаток> }
subscribed   --проход: нет сети / не-2xx-----> { pendingSync: true }
```

Проход читает состояние в начале и пишет свои поля после ожидания сети поверх актуального: если между
ними прошло выключение, `subscribed` остаётся `false`.

## Новые типы кода

### `PushStatePatch`, `PushIdentity` (`src/storage/repository.ts`)

```ts
type PushStatePatch = Partial<Omit<PushState, 'clientId' | 'token'>>;
type PushIdentity = Pick<PushState, 'clientId' | 'token'>;
```

`updatePushState(patch, identity?)`: запись есть — `{ ...запись, ...patch }`; записи нет и `identity`
передан — `{ ...identity, subscribed: false, pendingSync: false, lastSyncedHash: null, ...patch }`; записи
нет и `identity` нет — ничего не пишется.

### `SyncDeps` (`src/push/syncCore.ts`)

Внешние зависимости прохода синхронизации: настроен ли push, чтение и изменение `PushState`, подписка
браузера (`toJSON()`), месячные и настройки, сетевой запрос (`{ ok }`), адрес клиента, часы. Подробно —
[contracts/sync-core.md](./contracts/sync-core.md).

### Проход и очередь (`createSyncRunner`)

```text
нет прохода --запрос--> идёт проход (вызов получает его результат)
идёт проход --запрос--> идёт проход + ожидающий повторный (все запросы до конца прохода — один повторный)
проход завершён (успех или ошибка) --есть ожидающий--> идёт повторный проход
```

### `NotificationContent` (`src/pwa/pushNotification.ts`)

| Поле | Откуда |
|------|--------|
| `title` | `data.title ?? 'Календарь цикла'` |
| `body` | `data.body ?? ''` |
| `tag` | `data.id` |

`data` — `event.data?.json() ?? {}`; при исключении разбора — `{ body: event.data?.text() }` (как в `sw.ts`).

## Сущности воркера (без изменений)

- **`ReminderJSON`** — `{ id, sendAt, title, body }`; ограничения — `worker/src/validate.ts`,
  [push-worker-api.md](../001-cycle-calendar/contracts/push-worker-api.md).
- **`StoredRecord`** — `{ tokenHash, subscription: { endpoint, keys }, reminders, lastTestAt? }` в KV под
  ключом `sub:<clientId>`.
- **Payload уведомления** — `{ title, body, id }` (`TEST_NOTIFICATION` — с `id: 'test'`).

**Рассылка по записи** (R8): `read` (чтение и разбор записи) → `send` (обход наступивших) → `save`
(перезапись оставшихся) | `delete` (подписка исчезла). Исключение на любом шаге — строка журнала
`scheduled record skipped: step=<шаг> reason=<имя ошибки>`, запись остаётся как есть, обход продолжается.
