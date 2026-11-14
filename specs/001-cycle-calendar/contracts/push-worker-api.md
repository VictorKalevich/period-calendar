# Contract: Push Worker HTTP API (`worker/`)

Cloudflare Worker. Хранит только push-подписку, список напоминаний и технические идентификаторы
авторизации — случайный `clientId` и SHA-256 хэш токена, без персональных данных (Конституция I, v1.0.1).
Базовый URL — `VITE_PUSH_API_URL` (например, `https://cycle-push.<account>.workers.dev`).

Сверено с кодом 2026-11-14 (фича 018): `worker/src/index.ts`, `validate.ts`, `webpush.ts`,
`worker/wrangler.toml`, `src/sw.ts`, `src/pwa/pushNotification.ts`. Соответствие расписания приложения
и payload проверяет `worker/test/contract.test.ts`.

## Общие правила

- CORS: заголовки ответа ставятся, только если `Origin` запроса равен `ALLOWED_ORIGIN` (origin GitHub
  Pages): `Access-Control-Allow-Origin: <ALLOWED_ORIGIN>`, `Allow-Methods: PUT, DELETE, POST`,
  `Allow-Headers: Authorization, Content-Type`, `Max-Age: 86400`, `Vary: Origin`. Запрос с другим `Origin`
  обрабатывается так же, но без этих заголовков. `OPTIONS` на путь API — `204`, на другой путь — `404`.
- Авторизация: `Authorization: Bearer {token}`, токен — от 16 до 200 символов (иначе `401`). Worker
  сравнивает `SHA-256(token)` с сохранённым `tokenHash`; не совпал — `401`. Первый `PUT` для неизвестного
  `clientId` сохраняет хэш.
- `clientId` — UUID (иначе `400`). Неизвестный путь — `404`; метод, не разрешённый для пути, — `405`.
- Логи не содержат тел запросов, endpoint подписки, текстов напоминаний и содержимого записей.

## `PUT /v1/clients/{clientId}`

Создать или полностью заменить подписку и расписание (идемпотентно). Приложение отправляет подписку в
форме `PushSubscription.toJSON()`.

```json
{
  "subscription": {
    "endpoint": "https://web.push.apple.com/...",
    "expirationTime": null,
    "keys": { "p256dh": "<base64url>", "auth": "<base64url>" }
  },
  "reminders": [
    {
      "id": "ovulation:2026-11-05",
      "sendAt": "2026-11-05T09:00:00.000Z",
      "title": "Календарь цикла",
      "body": "Сегодня Ты КОРОЛЕВА"
    }
  ]
}
```

| Ограничение | Значение |
|-------------|----------|
| Тело | JSON, не более 16 КБ (`Content-Length` и фактический размер в байтах) |
| `subscription.endpoint` | `https://`, корректный URL, 1…1024 символов |
| `subscription.keys.p256dh` / `auth` | base64url, 1…200 / 1…100 символов |
| `reminders` | массив, 0…24 элемента |
| `id` | строка, 1…64 символов |
| `title` / `body` | строки, 1…100 / 1…200 символов (пустая строка недопустима) |
| `sendAt` | `YYYY-MM-DDTHH:mm:ss(.sss)Z` (UTC), не дальше 400 дней вперёд от текущего момента; прошлое допускается |

Сохраняется запись `sub:{clientId}`: `tokenHash`, `subscription` — только `endpoint` и `keys`
(`expirationTime` и другие поля отбрасываются), `reminders` — `{ id, sendAt, title, body }` с `sendAt` в
виде `toISOString()`; прежнее `lastTestAt` (тестовая отправка, фича 002) сохраняется.

Ответы: `204` — сохранено; `400` — невалидное тело или `clientId`; `401` — нет токена или он не совпадает;
`405` — другой метод; `413` — слишком большое тело.

## `DELETE /v1/clients/{clientId}`

Удалить подписку и все напоминания (выключение всех напоминаний).
Ответы: `204` — удалено, `400` — `clientId` не UUID, `401` — токен не совпадает, `404` — записи нет.

## `POST /v1/clients/{clientId}/test`

Тестовый push для режима разработчика (фича 002) — см.
[002 contracts/push-worker-test-api.md](../../002-dev-mode/contracts/push-worker-test-api.md).

## Cron `0 * * * *`

Для каждой записи `sub:{clientId}` в KV, напоминания — в сохранённом порядке:

1. Напоминания с `sendAt > now` остаются.
2. Наступившие (`sendAt <= now`) — Web Push (RFC 8291 aes128gcm, VAPID RFC 8292, `TTL: 86400`,
   `Urgency: normal`); payload — `{ "title": "...", "body": "...", "id": "..." }`.
3. Доставленное (ответ 2xx) удаляется; недоставленное остаётся, пока ему меньше 24 ч, затем удаляется.
4. Если push-сервис ответил `404`/`410` — оставшиеся напоминания записи не отправляются, запись удаляется
   целиком.
5. Запись перезаписывается, только если список напоминаний изменился.
6. Сбой на записи (не читается или не того формата, отказ KV при записи или удалении) пропускает её:
   запись остаётся как есть, в лог — строка `scheduled record skipped: step=<read|send|save|delete>
   reason=<имя ошибки>`, обход продолжается. Отказ получения списка записей прерывает проход этого часа.

Отказ push-сервиса пишется в лог статусом, причиной от сервиса, его хостом (без пути подписки),
самопроверкой пары VAPID-ключей и схемой `VAPID_SUBJECT` (без адреса).

## Payload в Service Worker

`push`-событие получает `{ title, body, id }`; разбор — `notificationFromPush`
(`src/pwa/pushNotification.ts`): `title` по умолчанию «Календарь цикла», `body` — `''`, не-JSON — текст
сообщения становится `body`. Уведомление — `showNotification(title, { body, tag: id, icon: 'icon-192.png',
badge: 'icon-192.png', lang: 'ru' })`; метка `id` заменяет, а не дублирует повторную доставку.
`notificationclick` открывает или фокусирует приложение на вкладке «Календарь» (`#calendar`).

## Секреты и переменные Worker

| Имя | Тип | Назначение |
|-----|-----|------------|
| `VAPID_PRIVATE_KEY` | secret | приватный ключ P-256 в формате JWK (строка JSON) |
| `VAPID_SUBJECT` | secret | `mailto:` контакт владельца для push-сервисов |
| `VAPID_PUBLIC_KEY` | var | тот же ключ, что `VITE_VAPID_PUBLIC_KEY` в клиенте (base64url, 65 байт) |
| `ALLOWED_ORIGIN` | var | `https://<user>.github.io` |
| `SUBS` | KV binding | хранилище подписок |

Секреты загружаются без BOM (`CLAUDE.md`); воркер всё же снимает BOM и пробелы по краям у ключей и
`VAPID_SUBJECT`.
