# Implementation Plan: Календарь цикла

**Branch**: `001-cycle-calendar` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-cycle-calendar/spec.md`

## Summary

Офлайн-PWA для iPhone: календарь месяца с перелистыванием свайпом, отметки месячных, симптомов,
настроения и заметок, прогноз месячных, овуляции, фертильного окна и вероятности зачатия, статистика,
настройки и резервная копия в JSON. Все данные — в IndexedDB на устройстве. Push-напоминания
(за 2 дня до месячных и в день овуляции, 12:00 местного времени) доставляет бесплатный Cloudflare
Worker, который хранит только подписку и готовые напоминания с моментом отправки.

Технический подход: Vite + React + TypeScript; логика прогноза — чистые функции в `src/domain`,
разработка TDD на Vitest; Dexie с версионированными миграциями; vite-plugin-pwa (`injectManifest`)
для офлайна и обработки push; свайп — нативный CSS scroll-snap без библиотек; деплой на GitHub Pages
через GitHub Actions; Worker с почасовым cron и собственной реализацией Web Push на WebCrypto.
Обоснования — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 24 LTS для сборки

**Primary Dependencies**: runtime — React 19, Dexie 4, date-fns 4 (+ локаль `ru`); build —
Vite, vite-plugin-pwa (Workbox); worker — без runtime-зависимостей, `wrangler` (dev)

**Storage**: IndexedDB через Dexie (устройство); Workers KV (только подписка и напоминания)

**Testing**: Vitest (домен, миграции с `fake-indexeddb`, резервная копия, Web Push-шифрование на
векторах RFC 8291); ручные сценарии на iPhone по [quickstart.md](./quickstart.md)

**Target Platform**: iOS 16.4+ Safari, PWA на экране «Домой»; Cloudflare Workers (free)

**Project Type**: web application (статический PWA-фронтенд) + маленький push-воркер

**Performance Goals**: запуск до календаря ≤ 1 с офлайн; свайп 60 fps; переход месяца ≤ 0,3 с

**Constraints**: полностью офлайн (кроме доставки push); данные цикла не покидают устройство;
только бесплатные сервисы; контраст ≥ 4.5:1, зоны нажатия ≥ 44 pt; интерфейс на русском

**Scale/Scope**: 1 пользовательница, 1 устройство; 4 экрана + карточка дня; ~десятки циклов за годы

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Отметки, симптомы, заметки — только IndexedDB. На Worker уходят подписка, `sendAt`, заголовок и текст напоминаний (contracts/push-worker-api.md). Нет аккаунтов, аналитики, сторонних скриптов. Часовой пояс не передаётся. Токен не экспортируется. | ✅ |
| II. Офлайн-PWA, бесплатно | vite-plugin-pwa precache всех ассетов; GitHub Pages; Cloudflare Workers free + KV free; iOS 16.4+ Web Push проверен (R5). Нативной сборки нет. | ✅ |
| III. Сохранность данных | Dexie `version(n).upgrade`, миграции с тестами, `storage.persist()`, экспорт/импорт JSON со `schemaVersion` через те же миграции (contracts/backup-format.md). | ✅ |
| IV. Корректность прогноза (TDD) | `src/domain` — чистые функции, «сегодня» параметром, даты `YYYY-MM-DD`; 17 обязательных тест-кейсов до реализации (contracts/domain-api.md). | ✅ |
| V. Простота | 3 runtime-зависимости (React, Dexie, date-fns), все заданы пользователем; без роутера, UI-китов, библиотек жестов и схем; Worker без зависимостей. CI блокирует деплой при падении тестов. | ✅ |
| VI. Дизайн и доступность | CSS-токены, `prefers-color-scheme`, проверка контраста токенов тестом, минимум 44 pt в токенах размеров, локаль `ru`, неделя с понедельника. Макеты — обязательный вход для UI-задач. | ✅ |
| VII. Честность | Постоянная пометка на главном экране и в «Сегодня»; при задержке — явное «Задержка N дн.». | ✅ |

**Отклонение от ввода пользователя (не от конституции)**: cron Worker — **почасовой**, а не
ежедневный, иначе нельзя отправить напоминание ровно в 12:00 местного времени (R6). Остаётся в
бесплатном тарифе.

**Post-design re-check (после Phase 1)**: data-model, контракты и quickstart не добавили
новых зависимостей, сетевых вызовов или хранимых на сервере данных сверх перечисленных выше.
Нарушений нет — Complexity Tracking не заполняется.

## Project Structure

### Documentation (this feature)

```text
specs/001-cycle-calendar/
├── plan.md              # This file
├── research.md          # Phase 0: решения R1–R13
├── data-model.md        # Phase 1: сущности, правила, миграции
├── quickstart.md        # Phase 1: запуск и сценарии проверки
├── contracts/
│   ├── domain-api.md      # API доменного модуля + обязательные тест-кейсы
│   ├── push-worker-api.md # HTTP API и cron Worker
│   └── backup-format.md   # формат резервной копии
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
index.html
vite.config.ts                # base '/period-calendar/', vite-plugin-pwa injectManifest
public/                       # иконки, apple-touch-icon, splash
src/
├── main.tsx
├── sw.ts                     # Workbox precache + push + notificationclick
├── domain/                   # чистые функции, без React/Dexie/date-now
│   ├── dates.ts
│   ├── cycles.ts
│   ├── forecast.ts
│   ├── periods.ts
│   ├── reminders.ts
│   ├── catalog.ts            # справочники симптомов и настроений
│   └── *.test.ts
├── storage/
│   ├── db.ts                 # Dexie, SCHEMA_VERSION
│   ├── migrations/           # migrate_{n}_to_{n+1}.ts + тесты
│   ├── repository.ts         # чтение/запись Period, DayEntry, Settings, PushState
│   └── backup.ts             # экспорт/импорт + тесты
├── push/
│   ├── subscribe.ts          # разрешение, подписка, DELETE
│   └── sync.ts               # planReminders → PUT, pendingSync
├── ui/
│   ├── App.tsx               # нижняя навигация, вкладка в location.hash
│   ├── theme.css             # токены, светлая/тёмная тема
│   ├── screens/              # TodayScreen, CalendarScreen, StatsScreen, SettingsScreen
│   └── components/           # MonthPager, MonthGrid, DayCell, DayCard, StatusBanner,
│                             # Legend, SymptomPicker, NoteEditor, Disclaimer
└── hooks/                    # useLiveQuery-обёртки, useToday
worker/
├── wrangler.toml             # cron "0 * * * *", KV SUBS
├── package.json
├── src/
│   ├── index.ts              # fetch: PUT/DELETE, CORS; scheduled: отправка
│   ├── webpush.ts            # RFC 8291 + VAPID RFC 8292 на WebCrypto
│   └── validate.ts
├── scripts/generate-vapid.mjs
└── test/
.github/workflows/deploy.yml  # test → build → Pages
```

**Structure Decision**: один репозиторий, корень — PWA (Vite), отдельный пакет `worker/` со своим
`package.json`, потому что он деплоится независимо в другую среду. Доменный модуль изолирован в
`src/domain` и не импортирует ничего из `storage`, `ui`, `push` (проверяется правилом линтера/
тестом импорта).

## Порядок реализации (для /speckit-tasks)

1. Каркас Vite + PWA + CI, деплой пустой страницы на Pages (каждый коммит рабочий).
2. `src/domain` TDD: dates → cycles → periods → forecast → reminders (US1, US2).
3. Хранилище Dexie v1 + репозиторий + тест миграционного каркаса.
4. UI: календарь с пейджером, карточка дня, отметки месячных (US1) → прогноз, плашка, легенда,
   пометка (US2) → «Сегодня».
5. Симптомы, настроение, заметки (US3).
6. Настройки + экспорт/импорт (US6).
7. Статистика (US5).
8. Worker + подписка + синхронизация напоминаний (US4).

## Complexity Tracking

Нарушений конституции нет.
