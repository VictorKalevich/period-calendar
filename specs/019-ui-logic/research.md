# Research: Решения — в чистых функциях, компоненты только рисуют

Шаг 6 плана рефакторинга. Разобраны пункты «Проверить на этапе плана» из
`docs/refactoring/step-6-ui-logic.md` и вопросы, возникшие при чтении кода (ветка `019-ui-logic` от
`refactoring`, коммит `25e4d0f`). Базовая линия: 1121 тест в 60 файлах, сборка зелёная.

## R1. Как зафиксировать прежнюю разметку переключателя

**Decision**: до появления `Toggle` пишется характеризационный тест `src/ui/toggleMarkup.test.ts`
(окружение happy-dom). Он проверяет разметку двумя способами.

1. **Серверная отрисовка настоящих экранов.** `useLiveQuery` подменяется через `vi.mock`: он синхронно
   отдаёт настройки, `devMode` и состояние push по функции-запросу (`getSettings`, `getDevMode`,
   `getPushState`). `push/subscribe` подменяется так же, как в `normalPath.test.ts`: сборка настроена,
   standalone, разрешение `granted`. Тогда `renderToStaticMarkup(<SettingsScreen/>)` даёт полную разметку
   экрана. В ней есть все 10 переключателей, включая 3 из `RemindersSection`. Из строки вырезаются
   фрагменты `<label class="toggle">…</label>` и сравниваются со списком строк-литералов в тесте. Варианты
   настроек:
   - «всё включено»: 10 переключателей, все `checked`;
   - «по умолчанию»: 9 штук, «Интенсивность» скрыта, личный сдвиг выключен.

   Так закрыты варианты «без подсказки», «с подсказкой» и «со ссылкой на пояснение», а также порядок
   атрибутов.
2. **DOM-отрисовка для недоступного варианта.** `disabled` бывает только у переключателей напоминаний,
   пока идёт включение (`busy`). На сервере до этого состояния не дойти. Поэтому `RemindersSection`
   монтируется через `mount`, `enableReminders` подменяется обещанием, которое ещё не выполнено, и
   нажимается «Включить напоминания». Разметка трёх переключателей в этот момент и после завершения
   сравнивается с inline-снимком.

Тест зелёный до замены и после неё. Отдельный тест компонента `src/ui/components/Toggle.test.ts`
(R2) сравнивает `renderToStaticMarkup(<Toggle …/>)` с теми же строками-литералами для четырёх
вариантов. Для варианта «недоступный» ожидаемая строка выводится из старого JSX по тем же правилам
отрисовки (`checked=""`, затем `disabled=""`), её подтверждает DOM-часть характеризационного теста.

Проверено на этапе плана временным тестом (удалён): подмена `useLiveQuery` даёт ровно 10 фрагментов,
например
`<label class="toggle"><span>Считать от следующей менструации</span><input type="checkbox" role="switch" aria-describedby="ovulation-mode-hint"/></label>`.

**Rationale**: файл шага требует зафиксировать разметку через `renderToStaticMarkup` до замены. Вариант
«проверять только компонент» доказал бы равенство компонента копии разметки в тесте, но не
настоящим экранам. Подмена хука позволяет снять разметку с самих экранов. Снимок `normalPath.test.ts`
покрывает только настройки по умолчанию и остаётся как есть.

**Alternatives considered**:
- Только снимок happy-dom всего экрана. В DOM-отрисовке `checked` — свойство, а не атрибут, поэтому
  снимок не видит состояние переключателя. Его оставляем только для `disabled`.
- Копия старого JSX в тесте как эталон. Копия может разойтись с экранами; отклонено.
- Включить `*.test.tsx` и писать тест на JSX. Не нужно (R9).

## R2. Интерфейс компонента `Toggle`

**Decision**: `src/ui/components/Toggle.tsx`:

```text
Toggle({ label: string; hint?: string; checked: boolean; disabled?: boolean;
         describedBy?: string; onChange: (checked: boolean) => void })
<label className="toggle">
  <span>{label}{hint !== undefined && <span className="t-small toggle__hint">{hint}</span>}</span>
  <input type="checkbox" role="switch" checked={checked} disabled={disabled}
         aria-describedby={describedBy} onChange={(e) => onChange(e.target.checked)} />
</label>
```

Порядок свойств `input` — прежний: `type`, `role`, `checked`, `disabled`, `aria-describedby`.
Серверная отрисовка выводит `checked` последним, после остальных атрибутов, а DOM-отрисовка —
`role` раньше `type`; обе строки зафиксированы характеризацией (T002). Компонент с тем же порядком
свойств даёт те же строки.
`disabled={false|undefined}` и `aria-describedby={undefined}` в разметку не попадают, поэтому
переключатели без них дают прежнюю строку. Текст подписи и элемент подсказки — соседние дочерние узлы.
Между текстом и элементом React комментариев-разделителей не ставит, поэтому строка та же, что у
`<span>Текст<span …>…</span></span>`.

**Rationale**: минимальный набор свойств для десяти мест: подпись есть всегда, подсказка — у шести,
`disabled` — у трёх, ссылка на пояснение — у одного. По образцу `Stepper`: обработчик получает
значение, а не событие.

**Alternatives considered**: передавать `ReactNode` в подпись и подсказку. Все десять — строки (у
напоминаний подсказка — `PERIOD_REMINDER.body` и `OVULATION_REMINDER.body`), лишняя общность не нужна
(YAGNI). Ещё вариант — `id` у `input`; его нет ни у одного переключателя.

## R3. Склонение

**Decision**: `pluralRu(n, [one, few, many])` → `` `${n} ${word}` `` переносится без изменений из
`BackupSection.tsx` в новый доменный модуль `src/domain/plural.ts`. Сдвиг овуляции `formatShiftRu`
считает слово через неё: `` `${sign}${pluralRu(abs, ['день', 'дня', 'дней'])}` ``. Существующий тест
`dates.test.ts` (все значения от −5 до +5, знак U+2212) этот перенос охраняет.

Тесты `pluralRu` не импортируют (поиск), поэтому пути импорта в существующих тестах не меняются.
Формы слов (`PERIOD_WORDS`, «запись дня» и т. д.) — тексты интерфейса, остаются в `BackupSection`.

**Rationale**: склонение — правило языка, а не дат, поэтому отдельный модуль, а не `dates.ts`.
Правило `mod10`/`mod100` остаётся в одном месте.

**Alternatives considered**: положить в `dates.ts` — смешивает темы; отдельная функция «только слово»
для сдвига — вторая функция того же правила, не нужна.

## R4. Числовая и полная дата

**Decision**:
- `formatDateNumeric` («08.11.2026») переносится из `src/domain/report.ts` в `src/domain/dates.ts`
  (тот же код); `report.ts` импортирует её из `./dates`. Импортёров `formatDateNumeric` из `report.ts`
  нет ни в коде, ни в тестах (поиск), поэтому повторный экспорт из `report.ts` не нужен.
  `BackupSection` вместо своей `numericDate` берёт её из домена.
- Новая `formatFullDateRu(d)` («8 ноября 2026», `'d MMMM yyyy'`, `ru`) в `dates.ts`. `formatRangeRu`
  считает через неё случай «через границу года», а `StatsScreen` выводит ей даты «Истории циклов». Из
  `StatsScreen` уходят импорты `date-fns`, `date-fns/locale` и `parseLD`.
- `formatDayMonthNumeric` («08.11») в `report.ts` — другой формат с единственным потребителем, не дубль;
  остаётся.

Тесты новых функций — в новом файле `src/domain/dateFormats.test.ts` (`dates.test.ts` не меняется).
Покрыты Конституция IV, переходы через месяц и год, 29 февраля, однозначные день и месяц, а также
часовые пояса: `Pacific/Kiritimati`, `America/Los_Angeles` и даты перехода на летнее время, по образцу
`dates.test.ts`.

**Rationale**: числовой формат нужен отчёту и интерфейсу, полный — интерфейсу и диапазону, поэтому
место обоих — общий модуль дат.

## R5. Вид импортируемого файла

**Decision**: новый доменный модуль `src/domain/importFile.ts`:
`importFileKind(text): 'backup' | 'cycle-text' | 'unknown'` с прежним правилом. Если
`text.trimStart().startsWith('{')` — `'backup'`; иначе, если `looksLikeCycleText(text)`, —
`'cycle-text'`; иначе `'unknown'`. Это тот же порядок проверок, что в `BackupSection.tsx:44-56`:
сначала «не `{` и похоже на выгрузку», потом «не `{`».

`looksLikeCycleText` (регулярное выражение `/period start date:/i`) — правило о данных. Она
переезжает из `src/storage/textImport.ts` в `src/domain/cycleText.ts`, к разбору того же формата: домен
не может импортировать хранилище. Существующий `src/storage/textImport.test.ts` импортирует её из
`./textImport`. Там меняется только путь импорта (`import { looksLikeCycleText } from
'../domain/cycleText'`) — это разрешено «Общими ограничениями», п. 2. Повторный экспорт из
`textImport.ts` ради одного теста не оставляется.

`trimStart` убирает и пробелы, и U+FEFF (BOM — пробельный символ в ECMAScript). `File.text()` к тому
же сам снимает BOM при декодировании UTF-8. Правило не меняется, тест домена фиксирует оба случая.

`BackupSection.readFile` выбирает ветку по `importFileKind(text)`. Побочные действия до выбора —
очистка `input.value`, чтение текста — остаются на месте.

**Rationale**: решение о ветке — чистая функция текста. «Сегодня» для `planTextImport` по-прежнему
вычисляет компонент (`toLocalDate(new Date())`): это вход хранилища, а не правило выбора.

**Alternatives considered**: функция в `src/ui/…ts` с импортом из хранилища — правило о данных вне
домена, против указания файла шага. Свой регулярный шаблон в домене — дубль `looksLikeCycleText`.
Внутренняя проверка `parseCycleText` (`sawKey`) — другое правило (по строкам); не трогается.

## R6. Состояние листа «Самочувствие»

**Decision**: новый доменный модуль `src/domain/symptomSelection.ts`:

- `SymptomSelection = { symptoms: SymptomId[]; intensity: Partial<Record<SymptomId, Intensity>> }`;
- `initialSymptomSelection(entry, showIntensity)`. Пункты — `entry?.symptoms ?? []`. Степени — при
  включённой интенсивности `withDefaultIntensity(symptoms, entry?.intensity ?? {})`, иначе
  `entry?.intensity ?? {}` как есть;
- `toggleSymptom(sel, id, showIntensity)`. Отмеченный пункт снимается вместе со своей степенью
  (новый объект степеней без ключа). Новый добавляется в конец и при включённой интенсивности
  получает `DEFAULT_INTENSITY`; при выключенной степени не меняются;
- `setSymptomIntensity(sel, id, level)` ставит степень пункту, повторный выбор её не снимает.

`SymptomPicker` хранит одно состояние `useState<SymptomSelection>`. При открытии —
`setSelection(initialSymptomSelection(entry, showIntensity))`. Нажатия идут через функциональное
обновление: `setSelection((cur) => toggleSymptom(cur, id, showIntensity))`. Сохранение —
`updateDayEntry(date, { symptoms: selection.symptoms, intensity: selection.intensity })`, тот же набор
полей.

**Равенство поведения**. Раньше `toggle` читал пункты и степени из замыкания отрисовки, а `setLevel`
обновлял функционально. Нажатие — дискретное событие: React 19 применяет его обновления синхронно, до
следующего события. Поэтому к моменту каждого нажатия замыкание совпадает с текущим состоянием.
Функциональное обновление даёт тот же результат на каждом достижимом пути. Охраняют существующие
`dayWrites.test.ts`, `saveFailures.test.ts`, снимок `normalPath.test.ts` и новый характеризационный
тест (R10).

**Rationale**: правила о данных записи дня — в домене, рядом с `withDefaultIntensity` и
`DEFAULT_INTENSITY`, которые модуль использует. Одно состояние вместо двух согласованных убирает
возможность рассинхронизации.

**Alternatives considered**: оставить два `useState` и вызывать функции поверх обоих — двойная запись
одного перехода. `useReducer` — больше кода ради трёх переходов.

## R7. Действие переключателя напоминаний

**Decision**: `src/ui/components/reminderToggle.ts`, рядом с компонентом, без разметки:
`reminderToggleAction(next, subscribed, permission): 'unsubscribe' | 'subscribe' | 'none'`, где
`next` — `Pick<Settings, 'remindPeriod' | 'remindOvulation' | 'remindMissedPeriod'>`, а `permission` —
`ReturnType<typeof notificationPermission>` (`NotificationPermission | 'unsupported'`, импорт типа из
`push/subscribe`). Правило прежнее: все три выключены — `'unsubscribe'`; иначе, если `!subscribed && permission
!== 'denied'`, — `'subscribe'`; иначе `'none'`.

`RemindersSection.toggle`: сохранить настройку. При неудаче — выйти, как сейчас (014). Затем
`reminderToggleAction({ ...settings, ...patch }, subscribed, permission)`: `'unsubscribe'` →
`await disableReminders()`, `'subscribe'` → `await enable()`. `settings`, `subscribed` и `permission`
берутся из замыкания той же отрисовки, что и раньше. Вычисление после `await` даёт те же значения,
что вычисление `next` до него.

**Rationale**: правило зависит от разрешения уведомлений браузера, а для таких правил файл шага велит
отдельный `.ts`-файл рядом с компонентом в `src/ui`. Часть «все выключены» отдельно в домен не
выносится: других потребителей у неё нет (поиск по `remind*`).

## R8. Размещение и правила слоёв

| Новое | Где | Импорты |
|-------|-----|---------|
| `pluralRu` | `src/domain/plural.ts` | — |
| `formatDateNumeric`, `formatFullDateRu` | `src/domain/dates.ts` | `date-fns`, `ru` (как сейчас) |
| `looksLikeCycleText` | `src/domain/cycleText.ts` | — |
| `importFileKind` | `src/domain/importFile.ts` | `./cycleText` |
| `SymptomSelection` и переходы | `src/domain/symptomSelection.ts` | `./dayEntry`, `./types` |
| `reminderToggleAction` | `src/ui/components/reminderToggle.ts` | типы `domain/types`, `push/subscribe` |
| `Toggle` | `src/ui/components/Toggle.tsx` | React |

Домен не импортирует `storage`, `ui`, `push` и не читает часы. Это охраняет `src/domain/isolation.test.ts`,
новые модули попадают под него автоматически. В `src/ui` после шага нет импорта `date-fns` — правило
шага 7 «`date-fns` только в `domain`» выполняется заранее.

## R9. `*.test.tsx` в конфигурации тестов

**Decision**: `vitest.config.ts` не меняется. В проекте нет ни одного `*.test.tsx`. Все 60 файлов
тестов, включая UI-тесты фич 014–018, — `*.test.ts` с `createElement`. Новые тесты шага пишутся так же.

**Rationale**: файл шага включает правку конфигурации «при необходимости»; необходимости нет (YAGNI).
Риск «тест `.tsx` молча не запустится» вместе с `passWithNoTests: true` уже записан в шаге 7
(«Гигиена»). Он повторяется в «Журнале» как находка.

## R10. Характеризационные тесты поведения трёх компонентов

**Decision**: до переноса правил пишется `src/ui/uiDecisions.test.ts` (happy-dom, `fake-indexeddb`,
подмены `push/subscribe` и `push/sync` как в `saveFailures.test.ts`). Он зелёный до и после.

- **«Резервная копия»**: выбор файла через `input[type=file]` (приём из `exportData.test.ts`).
  - Текстовая выгрузка с 1, 2 и 5 месячными: лист «Добавить месячные?» с «Найдено: … месячных
    (ДД.ММ.ГГГГ – ДД.ММ.ГГГГ)», строки «Будут заменены…» и «Пропущено…»; после «Добавить» —
    «Добавлено: N период(а/ов) месячных».
  - Резервная копия с 1, 3 и 12 записями дней: «Будет восстановлено: … записей дней».
  - JSON с пробелами и переводами строк в начале — резервная копия.
  - Текст на `{` со строкой «Period start date:» — резервная копия: ошибка разбора копии, а не лист
    импорта.
  - Пустой файл и прочий текст — «Файл не распознан».
- **«Самочувствие»**: снятие пункта со степенью убирает и степень (сохранённая запись без неё), степени
  остальных целы; выбор степени и повторное нажатие; повторное открытие листа сбрасывает несохранённое.
- **«Напоминания»** (`RemindersSection` через `mount`, состояние push — `updatePushState`).
  - Не подписана, разрешение `granted`: выключение одного из трёх вызывает `enableReminders`.
  - Выключение последнего вызывает `disableReminders`, в том числе без подписки.
  - Подписана: ни `enable`, ни `disable` не вызываются.

  Случай «разрешение `denied`» в карточке недостижим (переключатели не показываются), поэтому он
  покрыт только тестом функции (R7).
- **Переключатели «Настроек»** (добавлено по итогам `/speckit-analyze`). Нажатие каждого из 10
  переключателей меняет свой ключ настроек, остальные не трогает. При отказе записи сообщение
  появляется в своей карточке: «Цикл», «Записи дня» или «Напоминания». Снимки разметки не заметили бы
  перепутанного обработчика при замене на `Toggle`.
- **«Статистика»**: даты «Истории циклов» в полном формате — экран правится при переходе на
  `formatFullDateRu`.

**Rationale**: существующие тесты не проверяют на экране тексты листов импорта, снятие пункта со
степенью и выбор действия напоминаний. Без характеризации перенос этих правил шёл бы вслепую
(«Общие ограничения», п. 5).

## R11. Тест-поиск по исходникам

**Decision**: `src/ui/uiLogicPlacement.test.ts` (`node:fs`, по образцу `derivationPlacement.test.ts`).
Нерабочие файлы — тесты и `testing.ts` — исключаются. Проверки:

1. Ни один файл `src/ui/**/*.{ts,tsx}` не импортирует `date-fns` и `date-fns/locale`.
2. В `src/ui` нет правила склонения (`% 10`, `% 100`) и разбора даты срезами для вывода
   (`slice(8, 10)`). `function pluralRu` определена в `src` ровно один раз (`src/domain/plural.ts`);
   в `dates.ts` нет `% 10`.
3. Шаблон числовой даты (`slice(8, 10)}.${…slice(5, 7)}.`) встречается в `src` ровно один раз, в
   `dates.ts`. Формат `'d MMMM yyyy'` — тоже один раз, в `dates.ts`.
4. `role="switch"` и `className="toggle"` в `src/ui` — только в `Toggle.tsx`. `<Toggle` — 7 раз в
   `SettingsScreen.tsx` и 3 раза в `RemindersSection.tsx`.
5. `BackupSection` вызывает `importFileKind`, `pluralRu`, `formatDateNumeric` и не содержит
   `startsWith('{')` и `looksLikeCycleText`. `looksLikeCycleText` определена один раз
   (`domain/cycleText.ts`).
6. `SymptomPicker` вызывает `initialSymptomSelection`, `toggleSymptom`, `setSymptomIntensity` и не
   содержит `DEFAULT_INTENSITY` и `withDefaultIntensity`.
7. `RemindersSection` вызывает `reminderToggleAction` и не содержит `!next.remindPeriod`.

Проверки добавляются по частям, в коммитах соответствующих правок. Каждая сначала падает локально,
затем проходит. Коммит с красным тестом не создаётся: каждый коммит проходит `npm test`.

`DayCell.tsx` (`Number(info.date.slice(8))`, номер дня в ячейке) и `MonthPager.tsx` (индекс месяца через
`slice(0, 4)` и `slice(5, 7)`) под проверку 2 не попадают: шаблон — `slice(8, 10)`. `MonthPager` вне
объёма. Номер дня в ячейке — не копия доменной функции. Оба записываются в «Журнал» как находки.

## R12. Описание компонента в `design.md`

**Decision**: в таблице «Компоненты» раздела «Дизайн-система» строка «Переключатель» получает имя
компонента кода, как у листа: `` `Toggle` (`toggle`) ``. Вид, классы и токены не меняются.
`design-system.test.ts` читает только `theme.css` и `app.css`, на него правка не влияет.

**Rationale**: правило `CLAUDE.md` — элементы собираются из компонентов дизайн-системы. Имя компонента в
таблице показывает, чем собирать переключатель; так уже сделано для `BottomSheet`.

## R13. Порядок работы (TDD) и коммиты

1. Характеризация: `toggleMarkup.test.ts` и `uiDecisions.test.ts` — зелёные на текущем коде.
2. `pluralRu` → домен (тест красный → код), `formatShiftRu` и `BackupSection` через неё.
3. `formatDateNumeric` и `formatFullDateRu` (тест красный → код); `report.ts`, `formatRangeRu`,
   `BackupSection`, `StatsScreen`.
4. `looksLikeCycleText` → домен (путь импорта в `textImport.test.ts`); `importFileKind` (тест красный
   → код); `BackupSection`.
5. `symptomSelection` (тест красный → код); `SymptomPicker`.
6. `reminderToggleAction` (тест красный → код); `RemindersSection`.
7. `Toggle` (тест красный → код); замена десяти мест; строка в `design.md`.
8. Проверки, поиск по исходникам — финальные пункты; документы.

Каждый коммит проходит `npm test` и `npm run build`. После каждого шага с правкой компонентов
характеризационные тесты и `normalPath.test.ts` должны оставаться зелёными.
