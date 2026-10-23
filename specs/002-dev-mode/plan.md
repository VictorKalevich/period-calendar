# Implementation Plan: Скрытый режим разработчика

**Branch**: `002-dev-mode` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

## Summary

Строка версии внизу «Настроек» с переключателем режима по 7 нажатиям; флаг в IndexedDB (`kv`,
ключ `devMode`), вне резервной копии. Раздел «Для разработчика» с кнопкой тестового push.
Новый эндпоинт воркера `POST /v1/clients/{id}/test` с авторизацией по токену клиента и
ограничением 1 раз в минуту ([contracts/push-worker-test-api.md](./contracts/push-worker-test-api.md)).

## Technical Context

Стек и структура — как в 001 ([plan](../001-cycle-calendar/plan.md)). Новых зависимостей нет.

- Версия: `package.json` → `define: { __APP_VERSION__ }` в `vite.config.ts`; версия поднимается до 0.2.0.
- Счётчик нажатий — чистая функция `src/ui/tapCounter.ts` (тест без DOM).
- Флаг: `getDevMode` / `setDevMode` в `src/storage/repository.ts`; `buildBackup` его не читает.
- Клиент: `src/push/testNotification.ts` — синхронизирует подписку, затем `POST …/test`.
- Воркер: `handleRequest` различает путь `/v1/clients/{id}/test`; `StoredRecord.lastTestAt`.

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | На сервер ничего нового от клиента не уходит; сервер хранит момент последней тестовой попытки — технические метаданные ограничения частоты, не данные цикла. Тексты задаёт сервер. | ✅ |
| II. Офлайн-PWA | Режим и раздел работают офлайн; без сети — понятное сообщение. | ✅ |
| III. Сохранность | Схема IndexedDB не меняется (новый ключ в `kv`); флаг не попадает в копию. | ✅ |
| IV. TDD | Счётчик нажатий, флаг и эндпоинт воркера — тесты вперёд. | ✅ |
| V. Простота | Без зависимостей. | ✅ |
| VI. Дизайн | Карточки, пилюли, токены из `docs/design/design.md`; кнопка ≥ 44 px. | ✅ |
| VII. Честность | Не затрагивается. | ✅ |

## Project Structure

```text
src/ui/tapCounter.ts (+ test)        src/ui/components/VersionTapper.tsx
src/ui/components/DevSection.tsx     src/push/testNotification.ts
src/storage/repository.ts (+ test)   worker/src/index.ts, worker/test/api.test.ts
```
