# Implementation Plan: Кнопка «Отчёт» в шапке «Статистики» и дизайн-система

**Branch**: `013-report-button-design-system` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

## Summary

1. **Дизайн-система.** В `src/ui/theme.css` (`:root`) — токены: отступы `--space-3xs…2xl`
   (2, 4, 6, 8, 12, 16, 20, 24), радиусы `--radius-card` (24), `--radius-field` (16), `--radius-pill`,
   `--radius-round`; текст `--text-xs…3xl` (12, 14, 15, 16, 18, 24, 34); размеры `--tap-min` (44),
   `--control-h` (52). `app.css` и классы типографики переводятся на токены. Дубли объединяются в
   компоненты: `.btn` (+ `--primary`, `--ghost`, `--filled`, `--compact`, `--raised`, `--icon`),
   `.icon-btn` (+ `--raised`, `--secondary`, `--danger`), `.notice` (+ `--ok`, `--error`), общее состояние
   «выбрано» для `.chip`/`.segment`/`.btn--filled`. Тест `src/ui/design-system.test.ts` запрещает «сырые»
   px в отступах, радиусах и размерах текста; `src/report/palette.test.ts` сверяет палитру PDF с токенами.
   Раздел «Дизайн-система» в `design.md`, правило в `CLAUDE.md`.
2. **Кнопка «Отчёт».** `StatsScreen` — шапка `.screen__header` (заголовок + `DoctorReportButton`);
   компонент — бывший `DoctorReportSection` без карточки: кнопка `btn btn--compact btn--raised`, тот же
   лист (пояснение перенесено), ошибка — лист «Отчёт не создан».

## Technical Context

**Language/Version**: TypeScript 5.9, CSS · **Dependencies**: без новых · **Storage**: без изменений
**Testing**: Vitest — `design-system.test.ts`, `palette.test.ts`; снимки экранов до/после в Chrome
390×844 (обе темы); прежние тесты без изменений
**Constraints**: Конституция I–VII; править только то, что требует дизайн-система (спецификация)

## Решения (research)

- **R1. Шкала**: сетка 4 px — общепринятая и уже основная в стилях (4, 8, 12, 16, 20, 24 — 60 из 95
  значений); 2 и 6 px нужны для плотных групп (подписи, теги) — оставлены как мелкие шаги. Привязка
  остальных: 5→4, 9→8, 10→12, 14→12 (карточка календаря, поле заметки) или 16 (плашки), 18→16 (карточки) или
  20 (плашка обновления), 28→24. Шаг между блоками экрана `--step` = 14 px остаётся (задан макетами,
  design.md) как отдельный токен раскладки.
- **R2. Радиусы**: всё, что «половина высоты», — `--radius-pill` (вид не меняется); поле заметки и сообщения
  (16 и 14) — `--radius-field` 16; неиспользуемые `--radius-hero`, `--radius-inner` удаляются.
- **R3. Текст**: 13 px (легенда, пилюли) → 14 (как прочие подписи, design.md «13–14»); 17 px у главной
  кнопки → 16 (как у обычной); 22 px знаков «−/+» → 24.
- **R4. Не трогаем**: толщины рамок, геометрию значков (корона, сердечко, точка, ручка листа), размеры
  ячеек календаря, тени — это не отступы; для них тест делает исключение по свойствам.

## Constitution Check

| Принцип | Проверка | Статус |
|---------|----------|--------|
| I–III | Данные, сеть, хранение не меняются. | ✅ |
| IV. TDD | Тесты дизайн-системы и палитры пишутся первыми и падают. | ✅ |
| V. Простота | Без зависимостей; меньше классов-дублей. | ✅ |
| VI. Дизайн | Токены и компоненты описаны в design.md; контраст — прежние пары; зоны ≥ 44 px; обе темы. | ✅ |
| VII. Честность | Прогноз не меняется. | ✅ |

## Project Structure

```text
src/ui/theme.css, src/ui/app.css, src/ui/design-system.test.ts (новый)
src/report/render.ts (REPORT_PALETTE), src/report/palette.test.ts (новый)
src/ui/components/{DoctorReportButton (бывш. DoctorReportSection), MonthPager, Stepper, FirstPeriodHint,
  NoteEditor, UpdateBanner, RemindersSection, BackupSection, DevSection, DayDialog}.tsx
src/ui/screens/StatsScreen.tsx
docs/design/design.md, CLAUDE.md
```

## Complexity Tracking

Нарушений нет.
