---

description: "Task list for feature 011-doctor-report"
---

# Tasks: Отчёт для врача в PDF

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [contracts/report.md](./contracts/report.md), [quickstart.md](./quickstart.md)

**Tests**: обязательны (Конституция IV) — пишутся первыми и должны упасть. UTF-8 без BOM; каждый коммит проходит `npm test` и `npm run build`. `worker/` не меняется.

## Phase 1–2: Setup / Foundational

Новых зависимостей и изменений схемы нет — фазы пропущены.

## Phase 3: User Story 1 — отчёт для приёма у врача (P1) 🎯 MVP

**Goal**: «Создать отчёт» на «Статистике» → PDF → «Поделиться» / «Сохранить на устройство».

**Independent Test**: quickstart шаги 1–4, 6.

- [X] T001 [US1] Failing tests `src/domain/report.test.ts` по [contracts/report.md](./contracts/report.md): период `from`/`to` (в т.ч. 29.02 и переход года); циклы только с началом в периоде; средние равны `cycleStats`; `cycleRange` без выбросов и без текущего цикла; `lastPeriodStart`, `nextPeriod`; `chart` — только завершённые; `symptoms`/`moods` — счёт дней только в периоде, по убыванию, `null` при выключенных переключателях; `intensity` — только при `showIntensity`; записи вне периода не считаются; отчёт не зависит от `note` и `sex` (одинаков при любых значениях)
- [X] T002 [US1] Implement `buildDoctorReport` в `src/domain/report.ts` — до прохождения T001
- [X] T003 [US1] Failing tests `reportView` в `report.test.ts`: заголовок и подзаголовок с датами `ДД.ММ.ГГГГ`; плитки (значения, «—», «по последним 6 циклам · от 26 до 31 дн.»); строки таблицы циклов («28 дн.», «идёт сейчас», «≈ 5 дн.», «—»); подписи графика «08.11»; шапки и строки таблиц самочувствия (со степенями и без) и настроений
- [X] T004 [US1] Implement `reportView` в `src/domain/report.ts` — до прохождения T003
- [X] T005 [US1] Failing tests `src/report/pdf.test.ts`: 1 и 3 страницы — `%PDF-1.4`, `%%EOF`; `/Count`; на каждую страницу `/DCTDecode` с верными `/Width`, `/Height`, `/Length`; байты JPEG вложены без изменений; каждое смещение xref указывает на `N 0 obj`; `startxref` → `xref`; `/Title` — UTF-16BE с BOM; пустой список страниц — исключение
- [X] T006 [US1] Implement `jpegPagesToPdf` в `src/report/pdf.ts` — до прохождения T005
- [X] T007 [US1] Обновить `docs/design/design.md`: экран «Статистика» — карточка «Отчёт для врача»; лист «Отчёт готов»; вид PDF (R4 research)
- [X] T008 [US1] `src/report/render.ts`: `renderReportPages(view)` (холст A4 ×2, шрифт Nunito — дождаться `document.fonts.load`, светлая палитра, сводка, график, таблицы с переносом и повтором шапки, колонтитул «Календарь цикла · стр. N из M»), `createReportFile(input)` → `File` `cycle-report-ГГГГ-ММ-ДД.pdf`
- [X] T009 [US1] UI: вынести `shareOrDownload` в `src/ui/components/share.ts` (+ `downloadFile`, `canShareFile`), `BackupSection` использует его; `DoctorReportSection.tsx` — карточка (только при наличии месячных), «Создать отчёт», лист «Отчёт готов» («Поделиться» при `canShareFile`, «Сохранить на устройство», «Закрыть»), ошибка «Не удалось создать отчёт»; подключить на `StatsScreen`; стили; сверить с design.md

## Phase 4: User Story 2 — честный отчёт при малом количестве данных (P2)

**Goal**: «—», «Пока нет завершённых циклов», «ориентировочно», задержка, выбросы.

**Independent Test**: quickstart шаг 5; `npm test`.

- [X] T010 [US2] Failing tests `report.test.ts`: одна отметка — средние `null`, `chart` пуст → `view.chart === null`; `lowConfidence` → плитка «≈ ДД.ММ.ГГГГ» с пояснением «ориентировочно» и `confidenceNote`; задержка → «Задержка N дн.» и «ожидались ДД.ММ.ГГГГ»; выброс — «не учитывается в средних», `outlier: true` на графике
- [X] T011 [US2] Дополнить `buildDoctorReport`/`reportView` до прохождения T010; рисование: «Пока нет завершённых циклов» вместо графика, бледные столбцы выбросов

## Phase 5: Polish

- [X] T012 Проверка PDF: `qpdf --check`, рендер страниц в PNG и просмотр (13 циклов + все таблицы ≤ 2 страниц, SC-002); экран «Статистика» в обеих темах 390×844; diff без испорченной кириллицы и BOM; отметить задачи выполненными

## Dependencies

T001 → T002 → T003 → T004 → T008; T005 → T006 → T008; T007 → T009; T008 → T009; T010 → T011.

## Implementation Strategy

Коммиты: (1) документы фичи; (2) содержание отчёта (домен) с тестами, включая US2; (3) сборщик PDF;
(4) design.md, рисование, карточка и лист на «Статистике»; (5) задачи выполнены.

**Проверка (T012)**: Chrome 390×844, светлая и тёмная тема. История 14 циклов с выбросом, самочувствием
со степенями, настроениями, заметками и отметками секса → «Создать отчёт» → «Отчёт готов» →
«Сохранить на устройство»: PDF A4, 2 страницы (SC-002), 250 КБ, `qpdf --check` без ошибок, `/Title`
«Отчёт о менструальном цикле»; сводка совпадает со «Статистикой»; заметок и отметок секса в файле нет.
Одна отметка → 1 страница: «—», «Пока нет завершённых циклов», «≈ 29.11.2026 · ориентировочно» и пояснение.
«Поделиться» в Chrome на Linux не показывается (нет Web Share с файлами) — на iPhone проверить по quickstart шаг 6.
