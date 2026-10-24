# Contract: овуляция, сдвиг, блокировка прокрутки

```ts
// src/domain/types.ts
const OVULATION_DAY_OFFSET = 13;   // 14-й день цикла
const OVULATION_SHIFT_RANGE = { min: -5, max: 5 };

// src/domain/forecast.ts — buildForecast учитывает settings.ovulationShiftEnabled / ovulationShift
function ovulationShiftOf(settings: Settings): number;  // enabled ? shift : 0
function ovulationFor(cycleStart: LocalDate, settings: Settings): LocalDate;

// src/domain/dates.ts
function formatShiftRu(n: number): string;  // «−5 дней», «−1 день», «0 дней», «+2 дня», «+5 дней»

// src/ui/scrollLock.ts
function createScrollLock(win: ScrollWindow): { lock(): void; unlock(): void };
```

## Тесты (вперёд)

| # | Что | Ожидание |
|---|-----|----------|
| 1 | начало 01.03 | овуляция 14.03, окно 09–14.03, средние 07, 08, 15.03 |
| 2 | начало 25.12.2026 / 20.02.2028 | 07.01.2027 / 04.03.2028 |
| 3 | циклы 21 и 45 дней | овуляция на 14-й день каждого цикла (прошлые и прогнозные) |
| 4 | сдвиг −5…+5 включён | овуляция = начало + 13 + сдвиг; окно и средние сдвинуты |
| 5 | сдвиг +3 выключен | овуляция = начало + 13 |
| 6 | задержка | овуляция текущего цикла не зависит от задержки |
| 7 | `planReminders` со сдвигом | напоминание «Овуляция» на сдвинутый день |
| 8 | окно на отмеченных месячных | `fertile = null`, `ovulation = false` |
| 9 | `formatShiftRu(−5…+5)` | 11 строк, знак U+2212, склонение |
| 10 | `migrations[2]`, Dexie v2→v3, импорт копии v2 | `false`, `0`; v3 — проверка целого −5…+5 |
| 11 | `createScrollLock` | первая блокировка фиксирует body, вложенные не трогают, последняя снимает и восстанавливает `scrollY` |
| 12 | контраст светлой темы с новыми цветами | ≥ 4.5:1 |
