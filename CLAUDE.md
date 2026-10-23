# Календарь цикла

Офлайн-PWA для iPhone: календарь женского цикла с прогнозом и push-напоминаниями.
Язык интерфейса и документации — русский.

## Ключевые документы

- Конституция (обязательные принципы): `.specify/memory/constitution.md`
- Текущая фича: `specs/001-cycle-calendar/` — spec.md, plan.md, research.md, data-model.md,
  contracts/, quickstart.md

## Стек

- Приложение: Vite + React 19 + TypeScript (strict), vite-plugin-pwa (`injectManifest`, `src/sw.ts`),
  Dexie 4 (IndexedDB), date-fns 4 (локаль `ru`), Vitest.
- Push: `worker/` — Cloudflare Worker без runtime-зависимостей, KV, cron `0 * * * *`, Web Push на WebCrypto.
- Деплой: GitHub Pages через GitHub Actions (`base: '/period-calendar/'`), Worker — `wrangler deploy`.

## Правила

- `src/domain` — только чистые функции; не импортирует `storage`, `ui`, `push`; «сегодня» передаётся
  параметром; даты — строки `YYYY-MM-DD`. Сначала тест, потом код (TDD).
- Данные цикла не покидают устройство. На Worker — только подписка и напоминания (`sendAt`, title, body).
- Любое изменение схемы Dexie — новая версия + миграция + тест; та же миграция применяется к импорту.
- Новая runtime-зависимость — только с обоснованием в плане.
- Маленькие коммиты, каждый проходит `npm test` и `npm run build`.
- UI: токены цветов в CSS-переменных, светлая/тёмная тема по системе, контраст ≥ 4.5:1, зоны нажатия ≥ 44 pt.

## Команды

- `npm test` · `npm run dev` · `npm run build && npm run preview`
- `cd worker && npm test` · `npx wrangler deploy`
