# Implementation Plan: Сбой не оставляет пустой экран

**Branch**: `014-render-failure` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-render-failure/spec.md`; шаг 1 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-1-render-failure.md`).

## Summary

1. **Дизайн — сначала.** В `docs/design/design.md` (раздел «Дизайн-система», компоненты) — «Аварийный
   экран» и «Ошибка сохранения» из существующих классов; новых классов и токенов нет.
2. **Общий приём.** `attempt(what, action)` (`src/ui/attempt.ts`) — выполнить, отказ записать в консоль и
   вернуть `false`. На нём — `useSaveError()` + `<SaveError shown />` (`src/ui/components/SaveError.tsx`)
   для всех 10 мест записи из файла шага и `exportData()` (`src/ui/components/share.ts`) для экспорта.
3. **Аварийный экран.** `EmergencyScreen` (карточка «Что-то пошло не так», «Экспорт данных»,
   «Перезагрузить», сообщение об ошибке экспорта) и `EmergencyPage` (то же на всю страницу) —
   `src/ui/components/EmergencyScreen.tsx`.
4. **Границы ошибок.** `ErrorBoundary` (`src/ui/components/ErrorBoundary.tsx`): вокруг экрана вкладки в
   `App.tsx` с `key={tab}` и вокруг `<App />` в `main.tsx`.
5. **`useLiveQuery`** сохраняет ошибку подписки и бросает её при отрисовке — её ловит граница.

Тесты UI — в happy-dom по файлу (research R1); чистая часть — в `node`.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.3

**Primary Dependencies**: без новых runtime-зависимостей. Новая **dev**-зависимость `happy-dom@^21.0.4`
— только для тестов (обоснование — research R1 и «Complexity Tracking»)

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION`, таблицы, форма записей и блоки
`this.version(1…6)` не трогаются

**Testing**: Vitest 5; существующие тесты в `node` без изменений; новые UI-тесты —
`// @vitest-environment happy-dom` + `createRoot`/`act` + `fake-indexeddb/auto`; `vi.mock` для
подмены записи и экранов вкладок

**Target Platform**: iOS Safari (установленная PWA), остальные браузеры — по возможности

**Project Type**: офлайн-PWA (одно приложение, `src/`)

**Performance Goals**: обычный путь без накладных расходов — граница без сбоя рисует только детей

**Constraints**: обычный путь — прежние разметка, классы, тексты, порядок элементов (FR-017); существующие
проверки не меняются (FR-018); правила слоёв (`docs/refactoring-roadmap.md`); UI только из дизайн-системы

**Scale/Scope**: 3 новых компонента/модуля UI, правки в 13 файлах UI/хуков, 6 новых файлов тестов

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов нет; экспорт — локальный файл, как в Настройках. | ✅ |
| II. Офлайн-PWA | Всё работает офлайн; новых сервисов нет. | ✅ |
| III. Сохранность данных | Главная цель — путь к экспорту при любом сбое. Схема, миграции, формат копии не меняются; отказ записи не меняет данные (одна операция/транзакция, как сейчас). | ✅ |
| IV. TDD | Домен не меняется. Новые модули (`attempt`, `ErrorBoundary`, `EmergencyScreen`, `SaveError`) и новое поведение `useLiveQuery` — сначала падающий тест. Обычный путь `useLiveQuery` — характеризационный тест, зелёный до и после. | ✅ |
| V. Простота | Runtime-зависимостей нет (своя граница ~15 строк вместо `react-error-boundary`). Dev-зависимость happy-dom обоснована (Complexity Tracking). Один общий приём вместо десяти `try/catch`. | ✅ |
| VI. Дизайн и доступность | Компоненты описаны в design.md до кода; только существующие классы; пары цветов уже проверены `theme.test.ts` в обеих темах; кнопки 52 ≥ 44 px. | ✅ |
| VII. Честность | Прогноз не меняется. | ✅ |

Правила слоёв: новые модули — в `src/ui` (может импортировать всё); `src/hooks/useLiveQuery.ts`
по-прежнему импортирует только React и Dexie. `src/domain`, `src/storage`, `src/push`, `worker/` не
меняются.

**Повторная проверка после дизайна (Phase 1)**: нарушений не появилось — ✅.

## Project Structure

### Documentation (this feature)

```text
specs/014-render-failure/
├── spec.md
├── plan.md              # этот файл
├── research.md          # R1–R9
├── data-model.md        # состояния интерфейса (хранимые данные не меняются)
├── quickstart.md
├── contracts/ui.md      # разметка и тексты аварийного экрана и ошибки сохранения
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
docs/design/design.md                        # «Аварийный экран», «Ошибка сохранения»
package.json, package-lock.json              # devDependencies: happy-dom

src/ui/attempt.ts, attempt.test.ts           # новый: общий приём (node)
src/ui/components/
├── SaveError.tsx, SaveError.test.ts         # новый: useSaveError + сообщение; тест мест записи
├── EmergencyScreen.tsx, EmergencyScreen.test.ts  # новый: EmergencyScreen, EmergencyPage
├── ErrorBoundary.tsx, ErrorBoundary.test.ts # новый
├── share.ts                                 # + exportData()
├── BackupSection.tsx                        # «Экспорт» через exportData, сообщение об ошибке
├── DayDialog.tsx, MoodPicker.tsx, NoteEditor.tsx, SymptomPicker.tsx
├── RemindersSection.tsx, VersionTapper.tsx, FirstPeriodHint.tsx
src/ui/screens/SettingsScreen.tsx            # карточки «Цикл», «Записи дня»
src/ui/App.tsx, App.test.ts                  # граница вокруг экрана вкладки (key={tab})
src/main.tsx                                 # граница вокруг <App />
src/hooks/useLiveQuery.ts, useLiveQuery.test.ts   # ошибка → граница
```

`DaySheets.tsx` не меняется: отметку секса оборачивает `DayDialog`, получающий её как `onToggleSex`.

**Structure Decision**: одно приложение `src/`; новые модули — рядом с компонентами, которые их
используют. Тесты — рядом с кодом, как во всём проекте (`src/**/*.test.ts`).

## Порядок коммитов

Каждый коммит проходит `npm test` и `npm run build`.

1. design.md — описание компонентов.
2. happy-dom + `attempt` + `SaveError` (тесты вперёд).
3. Листы дня: `MoodPicker`, `SymptomPicker`, `NoteEditor`, `DayDialog`.
4. Вне листов: `SettingsScreen`, `RemindersSection`, `VersionTapper`, `FirstPeriodHint`.
5. `exportData` + `EmergencyScreen` + «Экспорт» в `BackupSection`.
6. `ErrorBoundary` + подключение в `App.tsx` и `main.tsx`.
7. `useLiveQuery`: ошибка → граница.

## Complexity Tracking

| Отступление | Зачем | Почему не проще |
|-------------|-------|-----------------|
| Dev-зависимость `happy-dom` | Критерии готовности поведенческие (навигация после сбоя, лист не закрылся, ошибка хука → аварийный экран); в `node` их не проверить: `renderToStaticMarkup` не запускает эффекты и не поддерживает границы ошибок | Только чистые части — связка (ключ границы, проброс ошибки, закрытие листа) осталась бы без теста; jsdom тяжелее и без `showModal()`; `react-test-renderer` устарел. В бандл не попадает, окружение — только в новых файлах тестов |
