# Research: фича 005

## R1. Правило овуляции

- **Decision**: `ovulation = cycleStart + 13 + shift`, где `shift = settings.ovulationShiftEnabled ?
  settings.ovulationShift : 0`; константа `LUTEAL_PHASE_DAYS` заменяется `OVULATION_DAY_OFFSET = 13`.
  Окно `ovulation − 5 … ovulation`, средние дни `ovulation − 7, −6, +1` — без изменений формул.
  Задержка больше не влияет на дату овуляции текущего цикла (раньше считалась от «следующих месячных»).
- **Rationale**: требование пользовательницы; одна точка расчёта в `cycleFrom` (`forecast.ts`).
- **Alternatives**: хранить сдвиг в прогнозе отдельно — лишнее; сдвиг — настройка.

## R2. Приоритет отмеченных месячных

- **Decision**: в `dayInfo` для `period === 'actual'` — `fertile = null`, `ovulation = false`
  (фаза — `menstrual`, как раньше). Вероятность для плашки не меняется.
- **Rationale**: FR-005; со сдвигом окно может зайти на месячные следующего цикла.

## R3. Схема v3

- **Decision**: `Settings.ovulationShiftEnabled` (false), `ovulationShift` (0, целое −5…+5);
  `SCHEMA_VERSION = 3`, `db.version(3).upgrade` + `migrations[2]`; копия `schemaVersion: 3`.
- **Rationale**: Конституция III — как в фиче 004.

## R4. Счётчик сдвига

- **Decision**: `formatShiftRu(n)` в домене: знак «+» для > 0, «−» (U+2212) для < 0, склонение
  «день/дня/дней». `Stepper` получает `format` и `widest`: значение рисуется в ячейке grid поверх
  невидимого образца «−5 дней» — ширина фиксирована, `font-variant-numeric: tabular-nums`.

## R5. Блокировка прокрутки под шитами

- **Decision**: модуль `src/ui/scrollLock.ts` со счётчиком блокировок (переход «шит → шит» не
  разблокирует): при первой — запомнить `scrollY`, `body { position: fixed; top: −scrollY; width: 100%;
  overflow: hidden }`; при последней — вернуть стили и `scrollTo(0, y)`. `BottomSheet` берёт
  блокировку на время `open`; у `<dialog>` — `overscroll-behavior: contain`, `overflow-y: auto`;
  `touchmove` по подложке (цель — сам `<dialog>`) отменяется (`passive: false`). `showModal` уже
  делает фон инертным для нажатий.
- **Rationale**: iOS Safari игнорирует `overflow: hidden` на body для touch-прокрутки — нужен
  `position: fixed`; счётчик — из-за цепочек шитов (004).
- **Alternatives**: библиотеки body-scroll-lock — лишняя зависимость (Конституция V).
- Тест: `createScrollLock(win)` принимает объект окна — проверяется без DOM на фейке.
