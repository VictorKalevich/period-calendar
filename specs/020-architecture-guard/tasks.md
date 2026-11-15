---

description: "Task list for feature 020-architecture-guard"
---

# Tasks: Правила слоёв под тестом, карта архитектуры, гигиена репозитория

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/architecture-guard.md](./contracts/architecture-guard.md),
[quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV; `docs/refactoring-roadmap.md`, «Общие ограничения», п. 5).
- Новая функция теста (распознавание, отнесение, правила) и проверка карты — сначала образцы; их падение
  (функции нет или результат неверный) проверяется до кода.
- Существующие файлы тестов не меняются (FR-019). Единственное исключение — удаление
  `src/domain/isolation.test.ts` после того, как все его проверки есть в `src/architecture.test.ts`
  (research R1, разрешено файлом шага).
- Исходный код приложения (`src` вне `*.test.ts`) и `worker/` не меняются (FR-018). Временные нарушения
  (T007) в репозиторий не попадают.

Файлы — UTF-8 без BOM, правка только Edit/Write. Каждый коммит проходит `npm test` и `npm run build` (из
PowerShell; `build` включает `tsc --noEmit` и проверяет типы тестового файла: `noUnusedLocals`,
`noUncheckedIndexedAccess`). Тест и код одной задачи идут в одном коммите. Перед коммитом — `git diff` без
испорченной кириллицы и BOM (`LC_ALL=C.UTF-8 grep -cP` по шаблону из памяти проекта → 0). `git push`
и деплой не выполнять (план рефакторинга, «Ветки и запрет на push»).

**Обвязка теста** (`src/architecture.test.ts`):
- `import ts from 'typescript'` (проверено: 5.9.3, `ts.createSourceFile` доступен), `import { existsSync,
  readdirSync, readFileSync } from 'node:fs'`, `import { join, posix, relative } from 'node:path'`,
  `import { describe, expect, it } from 'vitest'`.
- Корень проекта — `const ROOT = join(__dirname, '..')`. Пути в таблицах и сообщениях — от корня, через
  `/` (`relative(ROOT, abs).split('\\').join('/')`).
- Обход: `readdirSync(dir, { recursive: true })` для `src` и `worker/src`, фильтр `/\.tsx?$/` и не
  `/\.test\.tsx?$/`.
- Имена тестов и сообщения — по-русски, как `src/ui/uiLogicPlacement.test.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: можно параллельно (разные файлы, нет зависимостей от незавершённых задач)
- **[Story]**: US1–US3 из spec.md

---

## Phase 1: Setup

- [X] T001 Базовая линия на ветке `020-architecture-guard`: `npm test` — 1348 тестов в 69 файлах;
  `npm run build` зелёный; `npm test --prefix worker` — 111 в 4 файлах; `npm run typecheck --prefix worker`
  зелёный; после сборки `git status` чистый (записано при подготовке шага; повторить, если ветка менялась).

---

## Phase 2: Foundational — распознавание импортов и отнесение к слою

**Purpose**: чистые функции теста, на которые опираются правила (US1) и проверка карты (US2). После T003 —
коммит «020: тест архитектуры — распознавание импортов и отнесение к слою».

- [X] T002 Новый `src/architecture.test.ts`: `describe('распознавание импортов')` — образцы для
  `importsOf(text: string, fileName = 'sample.ts'): ImportRef[]` (`ImportRef = { specifier: string |
  null; line: number }`, `line` — с 1; режим разбора — по расширению `fileName`: `.tsx` → TSX, иначе
  TS), каждый — отдельный `it` с `toEqual` полного списка (research R2):
  1. `import a from './a'` и `import { a, b } from '../x'`;
  2. многострочный `import {\n  a,\n  b,\n} from '../x'` — `line` строки `import`;
  3. `import type { T } from '../t'` и `import { type T, u } from '../t'`;
  4. `import './c.css'`;
  5. `export { b } from '../b'`, `export * from '../s'`, `export type { T } from '../t'`; а
     `export const x = 1` и `export { y }` (без `from`) — не импорт;
  6. `async function f() { return import('../d'); }`;
  7. `type E = import('../e').E` (тип через `import(…)`);
  8. `const r = require('../r')` и `import q = require('../q')`;
  9. `import(name)` и `` import(`../${name}`) `` — `specifier: null`;
  10. не импорт: `// import z from '../z'`, `/* import y from '../y' */`, `const s = "import w from '../w'"`,
      `` const t = `export * from '../t'` ``, `const re = /'/;` и `/// <reference types="vite/client" />`
      — результат `[]`;
  11. режим по расширению (по итогам `/speckit-analyze`, C1): `.ts`-текст `const id = <T>(x: T) => x;\nconst
      m = () => import('../d');` — найден `../d` (строка 2); `.tsx`-текст `const el = <div>{import('../e')}</div>;`
      с `fileName` `'x.tsx'` — найден `../e`.

  Запустить `npx vitest run src/architecture.test.ts` — красный (`importsOf` нет). Затем реализовать
  `importsOf` в том же файле: `ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true,
  fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)`, рекурсивный `ts.forEachChild`; `ImportDeclaration` и `ExportDeclaration` с
  `moduleSpecifier` (строковый литерал); `CallExpression` с `expression.kind ===
  ts.SyntaxKind.ImportKeyword` (литерал или шаблон без подстановок → имя, иначе `null`); вызов
  `require('…')`; `ImportTypeNode` (`argument` — `LiteralTypeNode` со строкой);
  `ImportEqualsDeclaration` с `ExternalModuleReference`. `line` —
  `sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1`. Зелёный. `violations` (T004) передаёт
  в `importsOf` путь проверяемого файла.
- [X] T003 В `src/architecture.test.ts`: таблица `LAYERS` и `describe('отнесение импорта')` — образцы для
  `targetOf(file: string, specifier: string | null): Target` (data-model «Цель импорта»), затем код.
  - `LAYERS: readonly Layer[]` — ровно таблица R3 research: `id`, `path`, `layers`, `packages`;
    `main.layers` — все семь слоёв приложения (`domain`, `storage`, `report`, `push`, `hooks`, `pwa`,
    `ui`).
  - `layerOf(path)` — слой с самым длинным совпадающим `path`: каталог — по префиксу `path + '/'`; файл —
    равенство с путём или с путём без расширения (`src/main.tsx` ↔ `src/main`).
  - Образцы (`toEqual`): `('src/storage/backup.ts', '../domain/dates')` → `{ kind: 'layer', id: 'domain'
    }`; `('src/storage/migrations/index.ts', '../../domain/dayEntry')` → `domain`;
    `('src/ui/screens/StatsScreen.tsx', '../components/DoctorReportButton')` → `ui`; `('src/main.tsx',
    './ui/theme.css')` → `ui`; `('worker/src/index.ts', './validate')` → `worker`; `('worker/src/index.ts',
    '../../src/domain/dates')` → `domain`; `('src/storage/db.ts', '../../package.json')` → `{ kind:
    'outside', path: 'package.json' }`; `('src/ui/App.tsx', '/src/x')` → `outside`; `'date-fns/locale'` →
    `{ kind: 'package', name: 'date-fns' }`; `'react-dom/client'` → `react-dom`; `'@scope/name/sub'` →
    `@scope/name`; `'node:fs'` → `node:fs`; `'virtual:pwa-register'` → `virtual:pwa-register`; `null` →
    `{ kind: 'computed' }`; файл с обратными косыми `'src\\storage\\backup.ts'` — тот же результат, что
    с прямыми.

  Красный (функций нет) → реализовать (`posix.normalize(posix.join(posix.dirname(file), specifier))`) →
  зелёный. `npm test`, `npm run build` (проверка типов тестового файла) → коммит.

**Checkpoint**: распознавание и отнесение под образцами; таблица слоёв — в одном месте.

---

## Phase 3: User Story 1 — правила слоёв проверяются тестом (P1) 🎯 MVP

**Goal**: один тест с таблицей правил для всех слоёв и воркера; все проверки прежнего
`isolation.test.ts` сохранены.

**Independent Test**: тест зелёный на текущем коде; временные нарушения T007 делают его красным с файлом,
импортом и правилом; после отката — зелёный.

- [X] T004 [US1] В `src/architecture.test.ts`: `EXCEPTIONS` и `describe('правила слоёв')` — образцы для
  `violations(file: string, text: string): string[]`, затем код.
  - `EXCEPTIONS: readonly Exception[]` — ровно таблица R5: `{ file: 'src/hooks/useLiveQuery.ts', target:
    'dexie', reason: '…' }`, `{ file: 'src/push/sync.ts', target: 'dexie', reason: '…' }`; причины — текст
    R5 со ссылками (Конституция V; 018 R7).
  - Формат строк — ровно data-model «Нарушение»: `<файл>:<строка>: '<specifier>' — слой <id> не может
    импортировать слой <id>`; `… — слою <id> не разрешён пакет <name>`; `… — импорт вне слоёв: <path>`;
    `<файл>:<строка>: 'import(…)' — динамический импорт с вычисляемым именем`; файл без слоя —
    `[<файл>: файл вне таблицы слоёв — отнесите его к слою]`. Импорт внутри своего слоя — разрешён.
    Исключение снимает нарушение, только если совпадают `file` и `target` (пакет — по имени, слой — по
    `id`, вычисляемый — `import(…)`).
  - Образцы — прежние запреты домена (R1), `it.each` по девяти импортам для `src/domain/x.ts`:
    `react`, `react-dom`, `dexie`, `../storage/repository`, `../ui/App`, `../push/sync`,
    `../hooks/useToday`, `../report/render`, `../pwa/registerUpdates` → у каждого ровно одно нарушение;
    `date-fns`, `date-fns/locale`, `./dates` → `[]`.
  - Образцы файлов верхнего уровня (по итогам `/speckit-analyze`, C2): `src/main.tsx` + `dexie` → «не
    разрешён пакет»; `src/main.tsx` + `./sw` → «слой main не может импортировать слой sw»; `src/main.tsx` +
    `./storage/repository`, `./ui/App`, `react-dom/client` → `[]`; `src/vite-env.d.ts` + `import 'react'` →
    нарушение; `src/sw.ts` + `./pwa/pushNotification`, `workbox-precaching` → `[]`.
  - Образцы сообщений (`toEqual` строк): `('src/storage/x.ts', "import { App } from '../ui/App';")` →
    `["src/storage/x.ts:1: '../ui/App' — слой storage не может импортировать слой ui"]`; `('src/ui/x.ts',
    "import { format } from 'date-fns';")` → `["src/ui/x.ts:1: 'date-fns' — слою ui не разрешён пакет
    date-fns"]`; `report` + `dexie`; `src/extra.ts` → «файл вне таблицы слоёв»; `src/ui/x.ts` +
    `import(name)` → вычисляемый; `src/storage/x.ts` + `'../../package.json'` → вне слоёв.
  - Образцы исключений: `src/push/sync.ts` + `dexie` → `[]`; `src/push/syncCore.ts` + `dexie` →
    нарушение; `src/hooks/useLiveQuery.ts` + `dexie` → `[]`; `src/hooks/useToday.ts` + `dexie` →
    нарушение; `src/ui/x.ts` + `import type { X } from '../push/subscribe'` → `[]` (R15).

  Красный → реализовать `violations` (через `importsOf`, `targetOf`, `layerOf`) → зелёный.
- [X] T005 [US1] В `src/architecture.test.ts` — проверки файлов проекта (зелёные на текущем коде):
  - `SOURCES` — исходные файлы `src` и `worker/src` (обвязка выше); `describe('файлы и слои')`:
    `it('исходники найдены')` — `SOURCES` содержит `src/main.tsx`, `src/sw.ts`, `src/vite-env.d.ts`,
    `src/ui/testing.ts`, `worker/src/index.ts` и не содержит ни одного `*.test.ts`;
    `it.each(LAYERS.map((l) => l.path))('в слое %s есть файлы')`;
    `it.each(SOURCES)('%s — по правилам слоя', (file) => expect(violations(file, read(file))).toEqual([]))`.
  - `it.each(EXCEPTIONS.map((e) => [e.file, e.target]))('исключение %s → %s нужно')` — файл импортирует
    `target`; иначе `expect.fail('<file>: исключение <target> больше не нужно — удалите его')`.
  - `describe('домен не читает часы')`: `it.each(файлы SOURCES с префиксом 'src/domain/')` — текст не
    совпадает с `/new\s+Date\(\s*\)|Date\.now\(/` (выражение — буквально из прежнего теста, R6).

  Если какой-то файл даёт нарушение — **остановиться и сообщить пользователю** (FR-008), код не
  переносить, правила не ослаблять.
- [X] T006 [US1] Удалить `src/domain/isolation.test.ts` (`git rm`); сверить соответствие проверок с
  таблицей R1 research. `npm test`: тестов ≥ 1348 (минус 39 прежних, плюс новые), все зелёные;
  `npm run build` → коммит «020: правила слоёв под тестом; isolation.test.ts — в architecture.test.ts».
- [X] T007 [US1] Красный → зелёный на настоящих файлах (research R7, quickstart §2). Для каждой строки
  таблицы R7: временный `__violation.ts` в каталоге слоя (для `src/sw.ts` — временная строка
  `import './ui/App';`), `npx vitest run src/architecture.test.ts` — красный с ожидаемой строкой
  нарушения; удалить файл (`git checkout -- src/sw.ts`) — зелёный. Исключение: временно добавить в
  `EXCEPTIONS` строку `{ file: 'src/push/syncCore.ts', target: 'dexie', … }` — красный «исключение
  больше не нужно»; убрать. В конце `git status` — без временных файлов, `git diff` пуст. Полученные
  сообщения записать в «Заметки T007» этого файла. Коммита нет (кроме отметок в `tasks.md` позже).

**Checkpoint**: правила слоёв охраняются тестом; прежний тест домена заменён без потери проверок.

---

## Phase 4: User Story 2 — карта архитектуры (P2)

**Goal**: `docs/architecture.md` ≤ 120 строк; ссылки из `CLAUDE.md` и `README.md`.

**Independent Test**: тест «карта архитектуры» зелёный; ссылки на месте; «Текущей фичи» нет.

- [ ] T008 [US2] В `src/architecture.test.ts` — `describe('карта архитектуры')` (research R9),
  `MAP = join(ROOT, 'docs/architecture.md')`:
  1. файл существует; строк ≤ 120 (`text.trimEnd().split('\n').length`);
  2. есть строки-заголовки `## Слои`, `## Пути данных`, `## Правила корректности данных`, `## Чек-листы`,
     `### Добавить настройку`, `### Добавить отметку дня`, `### Добавить вид напоминания`; есть
     `` `src/storage/migrations/README.md` ``;
  3. `it.each` по путям в обратных кавычках: фрагмент начинается с `src/`, `docs/`, `worker/`, `specs/`,
     `.specify/` или равен `CLAUDE.md`, `README.md`, `package.json`, `vitest.config.ts`, `.gitignore`;
     с `*`, `…`, `<`, `{` — пропускается; путь без суффикса `:число` и `existsSync(join(ROOT, путь))`;
     если путей ноль — тест красный (`expect(paths.length).toBeGreaterThan(0)`);
  4. первые ячейки строк таблицы между `## Слои` и следующим `## ` (строки `` | `…` | ``) как множество
     равны `LAYERS.map((l) => l.path)`.

  Запустить — красный (файла нет). Чтобы `it.each` по путям не падал на этапе сбора, читать файл через
  `existsSync(MAP) ? readFileSync(MAP, 'utf8') : ''`.
- [ ] T009 [US2] Новый `docs/architecture.md` по структуре `contracts/architecture-guard.md` и фактам
  research R10 (код ветки после шагов 1–6, не файлы шагов):
  - вступление (1–2 строки): что это, точные правила — `src/architecture.test.ts`, общие принципы —
    `.specify/memory/constitution.md`, интерфейс — `docs/design/design.md`;
  - `## Слои` — таблица из 11 строк (пути R3), колонки «Слой | Может импортировать | Зачем»; под ней —
    исключения R5 одной строкой и «тесты не проверяются; контрактный тест воркера импортирует
    `src/domain` и `src/pwa` (018 R1)»;
  - `## Пути данных` — чтение, запись (в том числе резервная копия, текстовый импорт, нормализация при
    запуске), напоминания, обновление приложения, отчёт — по R10;
  - `## Правила корректности данных` — по R10;
  - `## Чек-листы` — три подраздела по R10, со ссылкой на `src/storage/migrations/README.md`.

  Только пути без номеров строк; не больше 120 строк. Сверить каждый путь и имя функции с кодом
  (`grep`). Тест T008 — зелёный; `npm test`, `npm run build` → коммит «020: карта архитектуры
  docs/architecture.md».
- [ ] T010 [P] [US2] `CLAUDE.md` — правки ровно по research R11: в «Ключевых документах» строка «Текущая
  фича: …» заменяется двумя строками (карта архитектуры; спецификации и форматы обмена); в «Командах» —
  строка о запуске Vitest из PowerShell. Раздел «Рабочий процесс» и правила не меняются (`git diff
  CLAUDE.md` — только эти места).
- [ ] T011 [P] [US2] `README.md`, «Разработка» — пункт о карте архитектуры перед списком каталогов (R11).
  После T010–T011: `npm test`, `npm run build` → коммит «020: CLAUDE.md и README.md — ссылка на карту
  архитектуры».

**Checkpoint**: карта проверена тестом и найдена из обеих точек входа.

---

## Phase 5: User Story 3 — гигиена репозитория (P3)

**Goal**: артефакт компилятора вне git; пустой поиск тестов — ошибка; `*.test.tsx` находятся.

**Independent Test**: `git ls-files "*.tsbuildinfo"` пуст; после `npm run build` и `npm test`
`git status` пуст; `npx vitest run no-such-test-file` — код выхода 1.

- [ ] T012 [P] [US3] `.gitignore` — строка `*.tsbuildinfo` (после `build/`… рядом с артефактами сборки);
  `git rm --cached tsconfig.tsbuildinfo` (файл на диске остаётся). Проверить: `git ls-files
  "*.tsbuildinfo"` пуст; `npm run build`, `npm test`; `git status --short` — только `?? "Claude
  outputs/"` → коммит «020: tsconfig.tsbuildinfo — вне git» (R12).
- [ ] T013 [P] [US3] `vitest.config.ts`: убрать `passWithNoTests: true`; `include: ['src/**/*.test.ts',
  'src/**/*.test.tsx']` (R13). Проверить: `npm test` — то же число тестов, что после T011;
  `npx vitest run no-such-test-file` — «No test files found», код выхода 1; `npm run build` → коммит
  «020: настройки тестов — без passWithNoTests, с *.test.tsx».

**Checkpoint**: дерево чистое после сборки и тестов.

---

## Phase 6: Polish & проверки

- [ ] T014 Полные проверки (PowerShell): `npm test` — все зелёные, тестов ≥ 1348, файлов ≥ 69;
  `npm run build`; `npm test --prefix worker` — 111; `npm run typecheck --prefix worker`; после них
  `git status --short` — только `Claude outputs/`.
- [ ] T015 Объём и кодировка: `git diff refactoring...HEAD --stat` — только файлы из quickstart §5;
  `git diff refactoring...HEAD --stat -- src worker ':!src/**/*.test.ts' ':!src/*.test.ts'` — пусто;
  `git diff refactoring...HEAD` — проверка на испорченную кириллицу и BOM даёт 0 совпадений; BOM в
  начале новых файлов нет (`head -c 3 … | od -An -tx1`). Критерии готовности файла шага и SC-001…SC-008
  выполнены.
- [ ] T016 Отметить задачи `[X]` (Edit), «Заметки T007» заполнены → коммит «020: задачи выполнены».

---

## Заметки T007

Один прогон `npx vitest run src/architecture.test.ts` со всеми временными нарушениями сразу: 13 красных из
173. Двенадцать — сценарии R7, тринадцатый — образец «исключение действует только в своём файле»
(временное исключение для `syncCore.ts` его ожидаемо снимает). После удаления файлов, отката `sw.ts` и
строки исключения — 162 из 162 зелёные, `git status` и `git diff` пусты.

| Сценарий | Сообщение |
|----------|-----------|
| `src/domain/__violation.ts`: `import '../ui/app.css'` | `src/domain/__violation.ts:1: '../ui/app.css' — слой domain не может импортировать слой ui` |
| то же: `export { db } from '../storage/db'` | `…:2: '../storage/db' — слой domain не может импортировать слой storage` |
| то же: многострочный `import {\n useState,\n} from 'react'` | `…:3: 'react' — слою domain не разрешён пакет react` |
| то же: `() => import('../push/sync')` | `…:6: '../push/sync' — слой domain не может импортировать слой push` |
| то же: `Date.now()` | `домен не читает текущее время > src/domain/__violation.ts`: `expected '…' not to match /new\s+Date\(\s*\)\|Date\.now\(/` |
| `src/storage/__violation.ts`: `import type { App } from '../ui/App'` | `src/storage/__violation.ts:1: '../ui/App' — слой storage не может импортировать слой ui` |
| `src/report/__violation.ts`: `../storage/repository`, `import 'dexie'` | `…:1: '../storage/repository' — слой report не может импортировать слой storage`; `…:2: 'dexie' — слою report не разрешён пакет dexie` |
| `src/push/__violation.ts`: `../hooks/useToday` | `src/push/__violation.ts:1: '../hooks/useToday' — слой push не может импортировать слой hooks` |
| `src/hooks/__violation.ts`: `../push/sync` | `src/hooks/__violation.ts:1: '../push/sync' — слой hooks не может импортировать слой push` |
| `src/pwa/__violation.ts`: `../storage/repository` | `src/pwa/__violation.ts:1: '../storage/repository' — слой pwa не может импортировать слой storage` |
| `src/ui/__violation.ts`: `date-fns` | `src/ui/__violation.ts:1: 'date-fns' — слою ui не разрешён пакет date-fns` |
| новый `src/extra.ts` | `src/extra.ts: файл вне таблицы слоёв — отнесите его к слою` |
| `src/sw.ts`: временная строка `import './ui/App'` | `src/sw.ts:5: './ui/App' — слой sw не может импортировать слой ui` |
| `worker/src/__violation.ts`: `../../src/domain/dates` | `worker/src/__violation.ts:1: '../../src/domain/dates' — слой worker не может импортировать слой domain` |
| временное исключение `src/push/syncCore.ts` → `dexie` | `src/push/syncCore.ts: исключение dexie больше не нужно — удалите его` |

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: T002 → T003 (оба правят `src/architecture.test.ts`; `targetOf` опирается на
  `LAYERS`) → коммит.
- **US1 (T004–T007)** после Phase 2, по порядку: T004 → T005 → T006 (удаление — только когда T005
  зелёный) → T007.
- **US2 (T008–T011)** после T005: проверка карты сравнивает слои с `LAYERS`. T008 → T009. T010 и T011 —
  разные файлы, `[P]`, после T009 (ссылаются на существующий документ).
- **US3 (T012–T013)** не зависят от US1/US2 (разные файлы), `[P]` между собой; выполняются после US2,
  чтобы коммиты шли по порядку.
- **Polish (T014–T016)** — после всех историй.

Порядок для одного исполнителя: T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 →
T010 → T011 → T012 → T013 → T014 → T015 → T016.

## Parallel Examples

- US2: правки `CLAUDE.md` (T010) и `README.md` (T011) — разные файлы.
- US3: `.gitignore` с индексом git (T012) и `vitest.config.ts` (T013) — разные файлы.

## Implementation Strategy

- **MVP** — US1: правила слоёв под тестом, прежний тест домена заменён; самостоятельная ценность.
- Затем US2 (карта и ссылки) и US3 (гигиена).
- После каждой истории — `npm test` и `npm run build` зелёные.
- После T016 — шаги 7–10 «Порядка работы над шагом» в `docs/refactoring-roadmap.md`: проверки, слияние в
  `refactoring`, план, отчёт (с итоговым текстом правок `CLAUDE.md`). Без `git push` и деплоя.
