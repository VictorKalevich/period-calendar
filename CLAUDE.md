# Календарь цикла

Офлайн-PWA для iPhone: календарь женского цикла с прогнозом и push-напоминаниями.
Язык интерфейса и документации — русский.

## Ключевые документы

- Конституция (обязательные принципы): `.specify/memory/constitution.md`
- Макеты (источник правды для UI): `docs/design/design.md`
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
- UI строго по `docs/design/design.md` (токены цветов в CSS-переменных, Nunito, размеры, состояния дня);
  сверять с макетом в каждой UI-задаче. Главный экран — «Календарь». Светлая/тёмная тема по системе,
  контраст ≥ 4.5:1, зоны нажатия ≥ 44 CSS px (= 44 pt).

## Рабочий процесс (постоянное правило)

- Новые функции — только через Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-analyze` → `/speckit-implement`, в отдельной ветке фичи. Логика — тестами вперёд
  (Конституция IV): тест пишется первым и должен упасть.
- После `/speckit-implement`: если `npm test`, `npm run build` и (при изменениях в `worker/`)
  `npm test --prefix worker` + `npm run typecheck --prefix worker` зелёные — слить ветку фичи в `main`
  и выполнить `git push origin main` без отдельного вопроса. Push в `main` запускает сборку и деплой
  на GitHub Pages.
- Если изменён воркер (`worker/`) — задеплоить его `npx wrangler deploy` (из папки `worker`) до push.
- Если тесты или сборка падают — ничего не сливать и не отправлять, сообщить пользователю.
- После слияния ветки фичи в `main` и успешной сборки/деплоя в GitHub Actions («Test and deploy to
  GitHub Pages» для этого коммита) — удалить ветку фичи локально (`git branch -d`) и на origin, если
  она там есть (`git push origin --delete <ветка>`), без отдельного вопроса. Если сборка в Actions
  упала — ветку не удалять и сообщить пользователю. `gh` не установлен — статус смотреть через
  `https://api.github.com/repos/VictorKalevich/period-calendar/actions/runs?branch=main`.
- Секреты Worker загружать без BOM: не через конвейер Windows PowerShell 5.1 (`... | npx wrangler
  secret put`), а через Node (stdin) или интерактивный ввод.
- Файлы проекта править только инструментами редактирования (Edit/Write), не через PowerShell
  (`Set-Content`, `Out-File`, `-replace` и т. п.): Windows PowerShell 5.1 читает UTF-8 как ANSI и
  портит кириллицу, а при записи добавляет BOM. Все файлы — UTF-8 без BOM.
- Перед каждым коммитом проверять `git diff` на испорченную кириллицу (вида «РќР°…», «Ð…») и BOM.

## Команды

- `npm test` · `npm run dev` · `npm run build && npm run preview`
- `cd worker && npm test` · `npx wrangler deploy`
