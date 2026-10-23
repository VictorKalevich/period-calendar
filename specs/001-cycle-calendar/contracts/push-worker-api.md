# Contract: Push Worker HTTP API (`worker/`)

Cloudflare Worker. Хранит только push-подписку и список напоминаний (Конституция I).
Базовый URL — `VITE_PUSH_API_URL` (например, `https://cycle-push.<account>.workers.dev`).

## Общие правила

- CORS: `Access-Control-Allow-Origin` — только origin GitHub Pages (переменная `ALLOWED_ORIGIN`);
  ответ на `OPTIONS` с `Allow-Methods: PUT, DELETE`, `Allow-Headers: Authorization, Content-Type`.
- Авторизация: `Authorization: Bearer {token}`; Worker сравнивает `SHA-256(token)` с сохранённым
  `tokenHash`. Первый `PUT` для неизвестного `clientId` сохраняет хэш.
- Тело — JSON, не более 16 КБ. `clientId` — UUID.
- Логи не содержат тел запросов, endpoint подписки и текстов напоминаний.

## `PUT /v1/clients/{clientId}`

Создать или полностью заменить подписку и расписание (идемпотентно).

```json
{
  "subscription": {
    "endpoint": "https://web.push.apple.com/...",
    "keys": { "p256dh": "<base64url>", "auth": "<base64url>" }
  },
  "reminders": [
    {
      "id": "ovulation:2026-11-05",
      "sendAt": "2026-11-05T09:00:00.000Z",
      "title": "Овуляция",
      "body": "Сегодня Ты КОРОЛЕВА"
    }
  ]
}
```

| Ограничение | Значение |
|-------------|----------|
| `reminders.length` | 0…24 |
| `title` / `body` | ≤ 100 / ≤ 200 символов |
| `sendAt` | ISO-8601, не дальше 400 дней от текущего момента |
| `subscription.endpoint` | `https://`, ≤ 1024 символов |

Ответы: `204` — сохранено; `400` — невалидное тело; `401` — неверный токен; `413` — слишком большое
тело.

## `DELETE /v1/clients/{clientId}`

Удалить подписку и все напоминания (выключение обоих напоминаний или отзыв разрешения).
Ответы: `204`, `401`, `404`.

## Cron `0 * * * *`

Для каждой записи `sub:{clientId}` в KV:

1. Выбрать напоминания с `sendAt <= now`.
2. Для каждого отправить Web Push (RFC 8291 aes128gcm, VAPID RFC 8292, `TTL: 86400`,
   `Urgency: normal`); payload — `{"title": "...", "body": "..."}`.
3. Удалить отправленные напоминания; напоминания старше 24 ч, которые не удалось отправить, тоже
   удалить.
4. Если push-сервис ответил `404`/`410` — удалить запись целиком.

## Payload в Service Worker

`push`-событие получает `{ title, body }` и показывает `showNotification(title, { body, icon,
badge, tag: id })`. `notificationclick` открывает/фокусирует приложение на вкладке «Сегодня».

## Секреты и переменные Worker

| Имя | Тип | Назначение |
|-----|-----|------------|
| `VAPID_PRIVATE_KEY` | secret | JWK/PKCS8 приватного ключа P-256 |
| `VAPID_PUBLIC_KEY` | var | тот же ключ, что `VITE_VAPID_PUBLIC_KEY` в клиенте |
| `VAPID_SUBJECT` | var | `mailto:` контакт владельца приложения |
| `ALLOWED_ORIGIN` | var | `https://<user>.github.io` |
| `SUBS` | KV binding | хранилище подписок |
