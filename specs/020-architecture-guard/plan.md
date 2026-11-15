# Implementation Plan: Правила слоёв под тестом, карта архитектуры, гигиена репозитория

**Branch**: `020-architecture-guard` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/020-architecture-guard/spec.md`; шаг 7 плана рефакторинга
(`docs/refactoring-roadmap.md`, `docs/refactoring/step-7-architecture-guard.md`).

## Summary

1. **Тест архитектуры** `src/architecture.test.ts` — тестами вперёд:
   - распознавание импортов разбором синтаксиса TypeScript (`typescript` уже dev-зависимость, R2) —
     сначала образцы текста для каждой формы, они падают;
   - отнесение импорта к слою или пакету (R4) — сначала образцы;
   - таблица «слой → разрешённые слои и пакеты» (R3) и два исключения с причинами (R5); проверка каждого
     из 79 файлов (`src` без тестов и `worker/src`), непустых слоёв, файлов вне таблицы, нужности
     исключений; прежняя проверка часов домена — тем же выражением (R6);
   - постоянные тесты правила на прежние запреты домена (R1);
   - срабатывание показывается временными нарушениями в каждом слое (R7), в репозиторий они не попадают.
2. **Замена** `src/domain/isolation.test.ts`: удаляется в коммите, где новый тест зелёный; соответствие
   проверок — R1.
3. **Карта** `docs/architecture.md` (≤ 120 строк): сначала её проверка в тесте архитектуры (падает), потом
   документ, сверенный с кодом (R9, R10).
4. **`CLAUDE.md`, `README.md`** — ссылка на карту, без «Текущей фичи», строка о PowerShell (R11).
5. **Гигиена**: `git rm --cached tsconfig.tsbuildinfo`, `*.tsbuildinfo` в `.gitignore` (R12);
   `vitest.config.ts` — без `passWithNoTests`, с `*.test.tsx` (R13).

Исходный код приложения (`src` без тестов) и `worker/` не меняются. Из существующих тестов удаляется только
`isolation.test.ts` с переносом всех его проверок (разрешено файлом шага).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict)

**Primary Dependencies**: `typescript` (dev-зависимость, уже есть) — разбор исходников в тесте; `node:fs`,
`node:path`. Новых зависимостей нет — ни runtime, ни dev

**Storage**: IndexedDB (Dexie 4) — без изменений: `SCHEMA_VERSION`, таблицы и блоки `this.version(1…6)` не
трогаются

**Testing**: Vitest 5, окружение `node`; тест читает файлы `src/**` и `worker/src/**` через `node:fs`
(`__dirname`, как прежний `isolation.test.ts`)

**Target Platform**: разработка (Windows, PowerShell); приложение — iOS Safari, не затрагивается

**Project Type**: офлайн-PWA (`src/`) и отдельный пакет воркера (`worker/`) — оба только читаются тестом

**Performance Goals**: тест архитектуры — не дольше нескольких секунд (79 файлов)

**Constraints**: поведение и код приложения не меняются (FR-018); существующие проверки не ослабляются
(FR-019); без деплоя и `git push` (план рефакторинга); `docs/architecture.md` ≤ 120 строк

**Scale/Scope**: новые файлы — `src/architecture.test.ts`, `docs/architecture.md`; удаляется
`src/domain/isolation.test.ts`; правки — `CLAUDE.md`, `README.md`, `.gitignore`, `vitest.config.ts`;
из индекса git убирается `tsconfig.tsbuildinfo`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | Сетевых запросов не добавляется; код приложения и воркера не меняется. | ✅ |
| II. Офлайн-PWA, бесплатная инфраструктура | Без изменений; сборка и бандл прежние (тест в бандл не входит). | ✅ |
| III. Сохранность данных | Схема, миграции, формат резервной копии не трогаются. Карта описывает чек-лист новой версии схемы и ссылается на `src/storage/migrations/README.md`, не меняя его. | ✅ |
| IV. TDD, домен — чистые функции | Тест архитектуры усиливает охрану домена: только `date-fns` и свои файлы, без часов, на любой глубине. Распознавание и проверка карты — тестами вперёд, падают до кода. Прежние проверки домена сохраняются (R1, R6). | ✅ |
| V. Простота | Новых зависимостей нет: разбор — `typescript`, уже стоящий для `tsc`. Один тестовый файл и один документ ≤ 120 строк; без ESLint и новых слоёв. | ✅ |
| VI. Дизайн и доступность | Интерфейс не меняется. | ✅ |
| VII. Честность | Прогноз и тексты не меняются. | ✅ |
| Процесс | Ветка от `refactoring`; маленькие коммиты, каждый проходит `npm test` и `npm run build`. | ✅ |

**Post-design re-check**: те же результаты; отступлений нет — Complexity Tracking пуст.

## Project Structure

### Documentation (this feature)

```text
specs/020-architecture-guard/
├── plan.md              # этот файл
├── research.md          # R1–R15
├── data-model.md        # таблица слоёв, исключение, импорт, нарушение
├── quickstart.md        # проверки шага
├── contracts/
│   └── architecture-guard.md   # контракт теста архитектуры и карты
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── architecture.test.ts        # новый: правила слоёв, распознавание импортов, карта архитектуры
├── domain/
│   └── isolation.test.ts       # удаляется: все проверки — в architecture.test.ts (R1)
├── storage/ report/ push/ hooks/ pwa/ ui/   # не меняются, только читаются тестом
├── main.tsx  sw.ts  vite-env.d.ts           # не меняются
worker/src/                                   # не меняется, только читается тестом
docs/
└── architecture.md             # новый: карта архитектуры (≤ 120 строк)
CLAUDE.md                       # «Ключевые документы», «Команды» (R11)
README.md                       # «Разработка» (R11)
.gitignore                      # *.tsbuildinfo (R12)
vitest.config.ts                # без passWithNoTests, include *.test.tsx (R13)
tsconfig.tsbuildinfo            # убирается из индекса git (R12)
```

**Structure Decision**: тест лежит в корне `src`, потому что проверяет все слои, а не один; шаблон
`src/**/*.test.ts` его находит. Вспомогательные функции (распознавание, отнесение, правила) — внутри
тестового файла: другим модулям они не нужны, а модуль в `src` без тестов сам попал бы под проверку как
файл вне слоёв.

## Complexity Tracking

Отступлений от Конституции нет.
