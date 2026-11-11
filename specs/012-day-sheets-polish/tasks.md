---

description: "Task list for feature 012-day-sheets-polish"
---

# Tasks: Доработки диалога дня и листов записей

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. UTF-8 без BOM; каждый коммит проходит `npm test` и `npm run build`. `worker/` не меняется.

## Phase 1–2: Setup / Foundational

Изменений схемы и зависимостей нет — фазы пропущены.

## Phase 3: User Story 1 — только прошедшие дни (P1)

- [X] T001 [US1] Failing tests `dayDialog.test.ts`: будущий день — `extras` только `notes` (при включённых); будущий день с `showWellbeing`/`showMood` без `showNotes` — `opens: false`; сегодня и прошлые — как раньше; заменить кейс 009 «будущий день только с „Настроением“ — диалог открывается»
- [X] T002 [US1] Implement в `dayDialogFor` — до прохождения T001

## Phase 4: User Story 2 — выделение кнопок с записями (P1)

- [X] T003 [US2] Failing tests `dayDialog.test.ts`: `filled` — подмножество `extras` по `hasWellbeing`/`hasMood`/`hasNote` записи; без записи — `[]`; выключенный тип не входит; будущий день — только `notes`
- [X] T004 [US2] Implement `filled` в `dayDialogFor` — до прохождения T003
- [X] T005 [US2] `docs/design/design.md` (до UI): правило «кнопка записи с данными», корзина заметки, подтверждение, степень по умолчанию, будущий день, фокус листов
- [X] T006 [US2] UI `DayDialog`: класс `btn--filled` и `<span class="visually-hidden">, есть записи</span>`; стили

## Phase 5: User Story 3 — удаление заметки (P2)

- [X] T007 [US3] UI `NoteEditor`: `TrashIcon` в шапке (только при сохранённой заметке), подтверждение в листе, «Удалить» сохраняет `{ ...entry, note: '' }`; убрать текстовую кнопку; `BottomSheet` — необязательное действие в шапке

## Phase 6: User Story 4 — без обводки при открытии (P2)

- [X] T008 [US4] `BottomSheet`: `tabIndex={-1}`, фокус на лист после `showModal()`; `.sheet:focus { outline: none }`

## Phase 7: User Story 5 — «средне» по умолчанию (P2)

- [X] T009 [US5] Failing tests `dayEntry.test.ts`: `withDefaultIntensity(symptoms, intensity)` — недостающим пунктам «moderate», сохранённые степени не меняются, степени неотмеченных отбрасываются
- [X] T010 [US5] Implement `DEFAULT_INTENSITY`, `withDefaultIntensity`; `SymptomPicker` — при включённой интенсивности уровни = `withDefaultIntensity`, отметка пункта даёт «средне», повторное нажатие не снимает; при выключенной — сохраняются прежние степени

## Phase 8: Polish

- [X] T011 Примечания в `specs/004…/spec.md` и `specs/009…/spec.md`; ручная проверка по quickstart (обе темы); diff без испорченной кириллицы и BOM; задачи выполнены

## Implementation Strategy

Коммиты: (1) документы; (2) домен (будущие дни, `filled`, степень по умолчанию) с тестами; (3) design.md и UI; (4) документы 004/009, задачи выполнены.

**Проверка (T011)**: Chrome 390×844, светлая и тёмная тема: будущий день — в диалоге только «Заметки» и
«Отмена»; у дня с самочувствием и заметкой эти кнопки выделены (`violetSoft`/`violetText`), «Настроение» —
нет; при открытии диалога дня, листов «Самочувствие» и «Настроение» фокус на самом листе — обводки нет;
старая запись без степени показывает «средне», новый пункт получает «средне»; корзина → «Отмена» — текст
на месте, корзина → «Удалить» — заметка удалена, самочувствие дня сохранено; ошибок в консоли нет.
