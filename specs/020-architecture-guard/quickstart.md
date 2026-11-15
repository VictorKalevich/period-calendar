# Quickstart: проверка шага 7

Команды `npm …` — из PowerShell в папке проекта (из Git Bash с `cd /c/…` Vitest падает целиком).

## 1. Тесты и сборка

```powershell
npm test                 # все зелёные; тестов ≥ 1348, файлов ≥ 69 (isolation.test.ts заменён architecture.test.ts)
npm run build            # зелёная
npm test --prefix worker # 111, зелёные (воркер не менялся)
npm run typecheck --prefix worker
npx vitest run src/architecture.test.ts   # отдельно: файлы, слои, исключения, часы, карта
```

## 2. Тест падает на нарушении (красный → зелёный)

Сценарии — `research.md` R7. Для каждого: создать временный `__violation.ts` в каталоге слоя (для
`src/sw.ts` — временная строка), запустить `npx vitest run src/architecture.test.ts`, убедиться в красном
результате и сообщении по формату `contracts/architecture-guard.md`, удалить файл (откатить `sw.ts`) и
убедиться, что тест снова зелёный. В конце `git status` не показывает временных файлов.

## 3. Карта архитектуры

- `docs/architecture.md` — не больше 120 строк; разделы и чек-листы на месте (тест «карта архитектуры»).
- Ссылки: `CLAUDE.md` («Ключевые документы») и `README.md` («Разработка») ведут на карту; строки «Текущая
  фича» в `CLAUDE.md` нет; в «Командах» — строка о PowerShell (`research.md` R11).

## 4. Гигиена

```powershell
git ls-files "*.tsbuildinfo"   # пусто
npm run build; npm test
git status --short             # пусто (кроме ?? "Claude outputs/")
npx vitest run no-such-test-file       # «No test files found», код выхода 1 (без passWithNoTests)
```

## 5. Объём

```powershell
git diff refactoring...HEAD --stat
```

Изменены только: `src/architecture.test.ts` (новый), `src/domain/isolation.test.ts` (удалён),
`docs/architecture.md` (новый), `CLAUDE.md`, `README.md`, `.gitignore`, `vitest.config.ts`,
`tsconfig.tsbuildinfo` (удалён из индекса), `specs/020-architecture-guard/**`. Исходный код `src` вне тестов и
`worker/` — без изменений. Diff без испорченной кириллицы и BOM.
