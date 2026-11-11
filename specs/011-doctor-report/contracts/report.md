# Contract: содержание отчёта и сборщик PDF

## `buildDoctorReport(input): DoctorReport` — `src/domain/report.ts`

Вход: `{ periods, entries, settings, today, months = 12 }`. Чистая функция.

| Поле | Правило |
|------|---------|
| `from` / `to` | `today − months` (календарные месяцы) / `today` |
| `cycles` | циклы `buildCycles(periods)` с `start ∈ [from, to]`, по возрастанию |
| `avgCycleLength`, `avgPeriodLength` | как «Статистика» (`cycleStats`), по всем циклам |
| `cycleRange` | `{min, max}` длин завершённых невыбросов из `cycles`; нет таких — `null` |
| `lastPeriodStart` | начало последних месячных или `null` |
| `nextPeriod` | `todaySummary.nextPeriod` при `delayDays = 0`, иначе `null` |
| `delayDays` | `forecast.delayDays` |
| `lowConfidence` | `forecast.confidence === 'low'` |
| `chart` | завершённые циклы из `cycles`: `{ start, length, outlier }` |
| `symptoms` | `null`, если `!showWellbeing`; иначе по коду: дни записей в `[from, to]` с этим кодом, `>0`, по убыванию дней, затем по справочнику; `intensity` — `{mild, moderate, severe}` дней, только при `showIntensity`, иначе `null` |
| `moods` | `null`, если `!showMood`; иначе как `symptoms` без степени |

Заметки и отметки секса не читаются.

## `reportView(report, createdAt: LocalDate): ReportView`

| Поле | Пример |
|------|--------|
| `title` | «Отчёт о менструальном цикле» |
| `subtitle` | «Период: 11.11.2025 – 11.11.2026 · сформирован 11.11.2026» |
| `tiles` (4) | «Средняя длина цикла» — «28 дн.» — «по последним 6 циклам · от 26 до 31 дн.»; «Средняя длина месячных» — «5 дн.» — «по последним 6 циклам»; «Последние месячные» — «08.11.2026»; «Ожидаемые следующие» — «06.12.2026» / «≈ 06.12.2026» + «ориентировочно» / «Задержка 3 дн.» |
| `confidenceNote` | «Прогноз по средним значениям: мало данных или нерегулярный цикл» или `null` |
| `chart` | `{ bars: [{ label: '08.11', value, outlier }], average }` или `null` → текст «Пока нет завершённых циклов» |
| `cycleTable` | шапка «Начало месячных · Длина цикла · Длина месячных · Примечание»; строка: «08.11.2026», «28 дн.» / «идёт сейчас», «5 дн.» / «≈ 5 дн.» / «—», «не учитывается в средних» / «» |
| `symptomTable` | `null` или шапка «Самочувствие · Дней» (+ «Слабо · Средне · Сильно»), строки по `symptoms` |
| `moodTable` | `null` или шапка «Настроение · Дней», строки по `moods` |

Значение «—» — когда среднего нет.

## `jpegPagesToPdf(pages, { title }): Uint8Array` — `src/report/pdf.ts`

- `pages: { jpeg: Uint8Array; width: number; height: number }[]` (≥ 1), страница A4 595.28×841.89 pt.
- Файл начинается с `%PDF-1.4`, заканчивается `%%EOF`; объекты: 1 Catalog, 2 Pages (`/Count` =
  число страниц), 3 Info (`/Title` UTF-16BE hex с BOM, `/Producer (Calendar cycle)`), затем на страницу —
  Page, Image (`/DCTDecode`, `/Width`, `/Height`, `/Length` = размер JPEG), Contents.
- `startxref` указывает на `xref`; каждое смещение xref указывает на начало `N 0 obj`.
