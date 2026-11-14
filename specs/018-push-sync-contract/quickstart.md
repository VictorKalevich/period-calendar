# Quickstart: проверка шага 5

Команды `npm …` — из PowerShell в папке проекта (из Git Bash с `cd /c/…` Vitest не стартует). Деплой
воркера и `git push` в этом шаге не выполняются.

## 1. Тесты, сборка, воркер

```powershell
npm test
npm run build
npm test --prefix worker
npm run typecheck --prefix worker
```

Ожидается: всё зелёное; тестов приложения не меньше базовых 1040 (54 файла), воркера — не меньше 37
(2 файла).

## 2. Новые тесты по отдельности

```powershell
npm test --prefix worker -- test/contract.test.ts    # расписание и payload проходят воркер (SC-001)
npm test --prefix worker -- test/schedule.test.ts    # сбой одной записи не мешает остальным (SC-004)
npx vitest run src/push/syncCore.test.ts             # ядро: гонки, повторный проход, правила (SC-002)
npx vitest run src/push/sync.test.ts                 # обвязка на настоящем репозитории, наблюдение liveQuery
npx vitest run src/storage/pushState.test.ts         # updatePushState
npx vitest run src/pwa/pushNotification.test.ts      # разбор уведомления как в sw.ts
npx vitest run src/push/pushPlacement.test.ts        # нет storage/db, 'settings', savePushState (SC-003)
```

## 3. Контрактный тест ловит нарушение (SC-001)

По очереди временно уменьшить в `worker/src/validate.ts` `MAX_TITLE` (до 10), `MAX_BODY` (до 10), `MAX_ID`
(до 10), `MAX_REMINDERS` (до 17), `MAX_AHEAD_MS` (до 300 дней) и запустить
`npm test --prefix worker -- test/contract.test.ts` — каждый раз тест должен упасть. Вернуть значения.

## 4. Существующие тесты не изменены (SC-005)

```bash
git diff refactoring...HEAD --stat -- '*.test.ts' '*.snap'
```

Ожидается: только новые файлы из п. 2; `worker/test/api.test.ts`, `worker/test/webpush.test.ts` и
остальные существующие — без изменений.

## 5. Критерии готовности поиском

```bash
grep -rn "storage/db\|'settings'\|\"settings\"\|savePushState" src/push --include=*.ts | grep -v test   # пусто
grep -rn "from '\.\./\.\." worker/src                                                                   # пусто
```

## 6. Документ контракта (SC-006)

Сверить `specs/001-cycle-calendar/contracts/push-worker-api.md` с `worker/src/index.ts`, `validate.ts`,
`webpush.ts`, `wrangler.toml`, `src/sw.ts` по таблице research R11: каждая строка документа подтверждается
кодом.

## 7. Сборка service worker

После `npm run build` в `dist/sw.js` есть обработчик `push` с заголовком по умолчанию
`Календарь цикла` (разбор вынесен в `src/pwa/pushNotification.ts`, но собран в тот же файл):

```bash
grep -c "Календарь цикла" dist/sw.js   # ≥ 1
```

## 8. Кодировка

`git diff refactoring...HEAD` проверить на испорченную кириллицу и BOM (правило `CLAUDE.md`):
`grep -cP` с `LC_ALL=C.UTF-8` по типичным последовательностям испорченного UTF-8 и `\xEF\xBB\xBF` — 0
совпадений. Сам шаблон здесь не приводится, чтобы проверка диффа не находила его в этом файле.
