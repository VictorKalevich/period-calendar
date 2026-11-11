# Implementation Plan: Отчёт для врача в PDF

**Branch**: `011-doctor-report` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

## Summary

Чистый доменный модуль `src/domain/report.ts` считает содержимое отчёта за 12 месяцев
(`buildDoctorReport`) и готовые к рисованию строки (`reportView`): сводка из тех же функций, что и
«Статистика»/прогноз, график, таблицы циклов, самочувствия и настроений с учётом переключателей.
`src/report/render.ts` рисует страницы A4 на `<canvas>` шрифтом Nunito (светлая палитра для печати) с
переносом таблиц по страницам; страницы кодируются в JPEG. `src/report/pdf.ts` — минимальный сборщик
PDF 1.4 из JPEG-страниц (по одному изображению на страницу, `DCTDecode`) — без библиотек. На
«Статистике» — карточка «Отчёт для врача»; лист после создания: «Поделиться» (Web Share с файлом) и
«Сохранить на устройство» (скачивание). Схема хранения не меняется. Решения — [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) · **Dependencies**: без новых
**Storage**: без изменений (читаются месячные, записи дней, настройки)
**Testing**: Vitest — `src/domain/report.test.ts` (данные и строки отчёта: период, средние, разброс,
задержка, низкая уверенность, выбросы, переключатели, отсутствие заметок/секса), `src/report/pdf.test.ts`
(структура PDF: заголовок, объекты, xref-смещения, число страниц, trailer); ручная проверка: `qpdf --check`,
рендер страниц PDF в изображения, экран «Статистика» в обеих темах ([quickstart.md](./quickstart.md))
**Target Platform**: iOS Safari, установленная PWA · **Project Type**: офлайн-PWA (Worker не меняется)
**Constraints**: Конституция I–VII; git — у владельца (команды PowerShell)
**Scale/Scope**: 1 доменный модуль, 2 модуля `src/report/`, карточка и лист на «Статистике», `design.md`

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I. Приватность | PDF создаётся на устройстве; сетевых запросов нет; файл уходит только по действию пользовательницы (системное «Поделиться»/скачивание). Заметки и отметки секса в отчёт не входят. | ✅ |
| II. Офлайн | Холст, шрифт из бандла, сборка PDF — всё локально. | ✅ |
| III. Сохранность | Данные только читаются; схема не меняется. | ✅ |
| IV. TDD | Содержание отчёта — чистые функции, «сегодня» — параметр, тесты первыми; сборщик PDF — чистая функция с тестом структуры. | ✅ |
| V. Простота | Без зависимостей: вместо PDF-библиотеки (jsPDF ≈ 350 КБ + TTF-шрифт с кириллицей) — ~80 строк сборщика из JPEG-страниц (research R1). | ✅ |
| VI. Дизайн | Карточка и лист — существующие компоненты (`card`, `btn`, `BottomSheet`); `design.md` обновляется до UI; отчёт — токены светлой темы, Nunito. | ✅ |
| VII. Честность | Низкая уверенность → «ориентировочно» и пояснение; задержка показывается вместо даты. | ✅ |

**Повторная проверка после Phase 1**: нарушений нет.

## Project Structure

```text
specs/011-doctor-report/ — spec.md, plan.md, research.md, contracts/report.md, quickstart.md, tasks.md, checklists/
src/domain/report.ts (+ report.test.ts)   — buildDoctorReport, reportView
src/report/pdf.ts (+ pdf.test.ts)         — jpegPagesToPdf
src/report/render.ts                      — renderReportPages (canvas → JPEG), createReportFile
src/ui/components/DoctorReportSection.tsx — карточка и лист «Отчёт для врача»
src/ui/components/share.ts                — shareOrDownload / downloadFile (вынесены из BackupSection)
src/ui/screens/StatsScreen.tsx, src/ui/components/BackupSection.tsx, src/ui/app.css, docs/design/design.md
```

**Structure Decision**: новый каталог `src/report/` — рисование и файл (зависят от DOM, не домен);
содержание — в домене. `worker/` не меняется.

## Complexity Tracking

Нарушений нет.
