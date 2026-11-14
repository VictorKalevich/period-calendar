# Quickstart: проверка фичи 015

Команды `npm …` запускать из PowerShell в папке проекта: из Git Bash с `cd /c/…` Vitest не стартует.

## 1. Автоматические проверки

```powershell
npm test
npm run build
```

Ожидается: всё зелёное, тестов не меньше базовых 631. `worker/` не меняется, его проверки не нужны.

Тесты фичи отдельно:

```powershell
npx vitest run src/storage/atomicWrites.test.ts src/ui/dayWrites.test.ts src/ui/screens/CalendarScreen.test.ts
```

| Файл | Что подтверждает |
|------|------------------|
| `src/storage/atomicWrites.test.ts` | SC-001–SC-003: одновременные изменения сохраняются оба; день Y не меняется; пустая запись удаляется, несуществующая создаётся; нормализация не теряет запись, начатую после неё |
| `src/ui/dayWrites.test.ts` | FR-001, FR-007, FR-008, SC-005: листы и отметка пишут только своё поле в свой день; двойное «Отметить секс» оставляет отметку; `src/ui` не вызывает `saveDayEntry` |
| `src/ui/screens/CalendarScreen.test.ts` | FR-010, SC-004: после смены дня карточка, диалог и листы не получают запись прежнего дня |
| `src/ui/saveFailures.test.ts`, `src/ui/normalPath.test.ts`, `src/hooks/useLiveQuery.test.ts` | без изменений и зелёные: отказ записи, разметка обычного пути и поведение хука прежние |

## 2. Существующие тесты не изменены

```powershell
git diff --stat refactoring...HEAD -- "*.test.ts" "*.snap"
```

Ожидается: только новые файлы (`atomicWrites.test.ts`, `dayWrites.test.ts`, `CalendarScreen.test.ts`).

## 3. Нет записи дня из снимка в интерфейсе

```powershell
git grep -n "saveDayEntry" -- src/ui ":!*.test.ts"
```

Ожидается: пусто. То же проверяет тест в `src/ui/dayWrites.test.ts`.

## 4. Мигание карточки дня (research R4)

Сценарий `npm run dev` + headless Chrome через CDP (скрипт в scratchpad, без зависимостей):

1. Записать в IndexedDB `cycle-calendar` записи у двух соседних прошедших дней A и B (заметки «A» и «B»).
2. Нажать ячейку A, дождаться сводки «A»; нажать ячейку B.
3. В каждом кадре (`requestAnimationFrame`) в течение 300 мс записывать текст `.entry` карточки дня.

Сравнить прогон до правки `CalendarScreen` (переходные кадры с текстом «A») и после (переходные кадры без
`.entry`). Ожидается: переходных кадров после правки не больше, чем до.

## 5. Ручная проверка на iPhone (по желанию)

Отметить у дня секс, затем сразу открыть «Настроение» и сохранить: в карточке видны и «Секс», и
настроение. Выбрать другой день: карточка и диалог показывают только его записи.
