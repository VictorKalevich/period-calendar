# Quickstart: проверка шага 4

Команды `npm …` — из PowerShell в папке проекта (из Git Bash с `cd /c/…` Vitest не стартует).

## 1. Тесты и сборка

```powershell
npm test
npm run build
```

Ожидается: все тесты зелёные, их не меньше базовых 957 (49 файлов); сборка без ошибок. `worker/` не
затрагивается — его проверки не нужны.

## 2. Новые тесты по отдельности

```powershell
npx vitest run src/domain/forecastDerivations.test.ts       # новые функции, равенство длины (SC-001, SC-005)
npx vitest run src/domain/forecastCharacterization.test.ts  # прогноз, сводка, отчёт, напоминания — как раньше
npx vitest run src/domain/derivationPlacement.test.ts       # поиск по исходникам (SC-002–SC-004)
npx vitest run src/domain/explanationTexts.test.ts          # числа в текстах = константы (SC-006)
npx vitest run src/storage/periodLength.test.ts             # нормализация и текстовый импорт по длине из истории
```

## 3. Тест текстов ловит рассинхронизацию (SC-006)

Временно поменять `AVERAGE_WINDOW` в `src/domain/types.ts` с 6 на 5 и запустить
`npx vitest run src/domain/explanationTexts.test.ts` — тест должен упасть. То же — для `OUTLIER_CYCLE.min`.
Вернуть значения.

## 4. Существующие тесты не изменены

```bash
git diff refactoring...HEAD --stat -- '*.test.ts' '*.snap'
```

Ожидается: только новые файлы из п. 2, ни одного изменённого существующего.

## 5. Критерии готовности поиском

```bash
grep -rnE '\?\?\s*[A-Za-z.?]*defaultPeriodLength' src --include=*.ts --include=*.tsx | grep -v '\.test\.'  # одна строка — effectivePeriodLength
grep -n 'buildForecast' src/storage/repository.ts src/storage/textImport.ts                                # пусто
grep -rnE -e '-\s*[A-Za-z.]*delayDays' src --include=*.ts --include=*.tsx | grep -v '\.test\.'          # одна строка — originalPredictedStart
grep -n 'todaySummary' src/domain/report.ts                                                                 # пусто
```

## 6. Кириллица и BOM

```bash
git diff refactoring...HEAD | LC_ALL=C.UTF-8 grep -cP "Р[°µѕёЅќ]|С[‚Ђ]|Ð|\xEF\xBB\xBF"   # 0
```
