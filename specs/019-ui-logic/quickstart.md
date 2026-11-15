# Quickstart: проверка шага 6

Команды — из PowerShell в папке проекта (из Git Bash с `cd /c/…` Vitest не стартует).

## 1. Тесты и сборка

```powershell
npm test
npm run build
```

Ожидается: все тесты зелёные, их не меньше базовых 1121, а файлов тестов — не меньше 60 + 9 новых.
Сборка зелёная. `worker/` не затронут, его проверки не нужны.

## 2. Отдельные группы

```powershell
npx vitest run src/ui/toggleMarkup.test.ts src/ui/uiDecisions.test.ts      # характеризация: зелёная до и после
npx vitest run src/domain/plural.test.ts src/domain/dateFormats.test.ts src/domain/importFile.test.ts src/domain/symptomSelection.test.ts
npx vitest run src/ui/components/reminderToggle.test.ts src/ui/components/Toggle.test.ts
npx vitest run src/ui/uiLogicPlacement.test.ts                              # поиск по исходникам
npx vitest run src/ui/normalPath.test.ts src/ui/components/ForecastInfo.test.ts src/ui/design-system.test.ts src/ui/theme.test.ts
```

## 3. Существующие тесты не изменены

```powershell
git diff refactoring...HEAD --stat -- "*.test.ts" "*.snap"
```

Ожидается: изменён только `src/storage/textImport.test.ts`, одна строка импорта
(`looksLikeCycleText` — из `../domain/cycleText`). Остальные — новые файлы. `ForecastInfo.test.ts`,
`design-system.test.ts`, `theme.test.ts` и `__snapshots__/normalPath.test.ts.snap` в списке отсутствуют.

## 4. Критерии файла шага

- В `src/ui` нет `date-fns`: `git grep -n "date-fns" -- src/ui` — пусто.
- Разметка переключателя — только в компоненте: `git grep -n 'role="switch"' -- src/ui ':!*.test.ts'` —
  одна строка в `src/ui/components/Toggle.tsx`.
- Склонение и формат дат в `src/ui` не определяются: `git grep -nE "% 10|slice\(8, 10\)" -- src/ui` —
  пусто.

## 5. Кириллица и BOM

```bash
git diff refactoring...HEAD | LC_ALL=C.UTF-8 grep -nP "Р[ЃЌЎЏђѓ“”•–—™љ›њќћџ]|Ð|Ñ|\x{FEFF}"
```

Ожидается: пусто.

## 6. Вручную (по желанию)

`npm run dev` → «Настройки»: переключатели выглядят и работают как раньше. Включение «Самочувствия»
показывает «Интенсивность самочувствия». В «Напоминаниях» переключатели недоступны, пока идёт
включение. «Статистика» → «История циклов»: даты вида «8 ноября 2026». «Импорт» текстовой выгрузки:
«Найдено: 2 периода месячных (23.12.2017 – …)».
