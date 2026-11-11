import { describe, expect, it } from 'vitest';
import { emptyDayEntry } from './dayEntry';
import {
  cardPhase,
  dayDialogFor,
  hasMood,
  hasNote,
  hasWellbeing,
  visibleEntryDates,
  visibleEntryParts,
  visibleSexDates,
  wellbeingTags,
} from './dayDialog';
import { buildForecast, dayInfo } from './forecast';
import { DEFAULT_SETTINGS, type DayEntry, type LocalDate, type Period, type Settings } from './types';

// Фича 004: состав диалога дня, видимость записей, фаза в карточке (contracts/day-dialog.md).

const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-10-20');
const L = 5;
const periods: Period[] = [{ id: 'a', start: ld('2026-10-01'), end: ld('2026-10-04'), endEstimated: false }];

const COMBOS: Array<[string, Settings]> = [
  ['оба выключены', { ...DEFAULT_SETTINGS, showWellbeing: false, showNotes: false }],
  ['только самочувствие', { ...DEFAULT_SETTINGS, showWellbeing: true, showNotes: false }],
  ['только заметки', { ...DEFAULT_SETTINGS, showWellbeing: false, showNotes: true }],
  ['оба включены', { ...DEFAULT_SETTINGS, showWellbeing: true, showNotes: true }],
];
const extrasFor = (s: Settings) => [...(s.showWellbeing ? ['wellbeing'] : []), ...(s.showNotes ? ['notes'] : [])];

describe('dayDialogFor — все комбинации дней и переключателей', () => {
  const DAYS: Array<[string, string, string[]]> = [
    ['прошлый день вне месячных', '2026-10-15', ['start']],
    ['первый день месячных', '2026-10-01', ['delete-period']],
    ['не первый день месячных', '2026-10-03', ['end-here', 'set-start']],
    ['сегодня вне месячных', '2026-10-20', ['start']],
    ['будущий день', '2026-10-25', []],
  ];

  for (const [dayName, date, periodKinds] of DAYS) {
    describe(dayName, () => {
      it.each(COMBOS)('%s', (_combo, settings) => {
        const d = dayDialogFor(ld(date), TODAY, periods, L, settings);
        expect(d.periodActions.map((a) => a.kind)).toEqual(periodKinds);
        expect(d.extras).toEqual(extrasFor(settings));
        expect(d.opens).toBe(periodKinds.length > 0 || extrasFor(settings).length > 0);
      });
    });
  }

  it('заголовок — дата без слова «Месячные»', () => {
    expect(dayDialogFor(ld('2026-10-24'), TODAY, periods, L, DEFAULT_SETTINGS).title).toBe('24 октября');
  });

  it('будущий день при выключенных переключателях не открывает диалог', () => {
    expect(dayDialogFor(ld('2026-10-25'), TODAY, periods, L, COMBOS[0]![1]).opens).toBe(false);
  });

  it('будущий день внутри прогнозной части идущих месячных — тоже без кнопок месячных', () => {
    const open: Period[] = [{ id: 'b', start: ld('2026-10-19'), end: null, endEstimated: false }];
    const d = dayDialogFor(ld('2026-10-21'), TODAY, open, L, COMBOS[3]![1]);
    expect(d.periodActions).toEqual([]);
    expect(d.extras).toEqual(['wellbeing', 'notes']);
  });
});

describe('видимость записей — 4 комбинации', () => {
  const entries: DayEntry[] = [
    { ...emptyDayEntry(ld('2026-10-10')), note: 'только заметка' },
    { ...emptyDayEntry(ld('2026-10-11')), symptoms: ['cramps'] },
    { ...emptyDayEntry(ld('2026-10-12')), moods: ['calm'] },
    { ...emptyDayEntry(ld('2026-10-13')), symptoms: ['acne'], moods: ['sad'], note: 'и то и другое' },
  ];

  it('hasWellbeing / hasMood / hasNote (009: настроение — отдельно от самочувствия)', () => {
    expect(entries.map(hasWellbeing)).toEqual([false, true, false, true]);
    expect(entries.map(hasMood)).toEqual([false, false, true, true]);
    expect(entries.map(hasNote)).toEqual([true, false, false, true]);
  });

  it.each([
    ['оба выключены', COMBOS[0]![1], []],
    ['только самочувствие', COMBOS[1]![1], ['2026-10-11', '2026-10-13']],
    ['только заметки', COMBOS[2]![1], ['2026-10-10', '2026-10-13']],
    ['оба включены', COMBOS[3]![1], ['2026-10-10', '2026-10-11', '2026-10-13']],
    ['только настроение (009)', { ...DEFAULT_SETTINGS, showMood: true }, ['2026-10-12', '2026-10-13']],
  ] as const)('индикатор: %s', (_name, settings, dates) => {
    expect([...visibleEntryDates(entries, settings)].sort()).toEqual([...dates]);
  });

  it.each([
    ['оба выключены', COMBOS[0]![1], { symptoms: [], intensity: {}, moods: [], sex: false, note: '' }],
    ['только самочувствие', COMBOS[1]![1], { symptoms: ['acne'], intensity: {}, moods: [], sex: false, note: '' }],
    ['только заметки', COMBOS[2]![1], { symptoms: [], intensity: {}, moods: [], sex: false, note: 'и то и другое' }],
    ['оба включены', COMBOS[3]![1], { symptoms: ['acne'], intensity: {}, moods: [], sex: false, note: 'и то и другое' }],
    ['только настроение (009)', { ...DEFAULT_SETTINGS, showMood: true }, { symptoms: [], intensity: {}, moods: ['sad'], sex: false, note: '' }],
  ] as const)('сводка в карточке: %s', (_name, settings, parts) => {
    expect(visibleEntryParts(entries[3], settings)).toEqual(parts);
  });

  it('сводка без записи — пустая', () => {
    expect(visibleEntryParts(undefined, COMBOS[3]![1])).toEqual({ symptoms: [], intensity: {}, moods: [], sex: false, note: '' });
  });
});

describe('cardPhase — фаза в карточке дня', () => {
  const single: Period[] = [{ id: 'a', start: ld('2026-03-01'), end: ld('2026-03-05'), endEstimated: false }];
  const ctxAt = (today: string, ps: Period[]) => {
    const forecast = buildForecast({ periods: ps, settings: DEFAULT_SETTINGS, today: ld(today) });
    return { forecast, periods: ps, settings: DEFAULT_SETTINGS, entries: new Set<LocalDate>(), today: ld(today) };
  };

  it('обычный день — фаза', () => {
    const c = ctxAt('2026-03-09', single);
    expect(cardPhase(dayInfo(ld('2026-03-09'), c), c.forecast)).toBe('follicular');
    expect(cardPhase(dayInfo(ld('2026-03-20'), c), c.forecast)).toBe('luteal');
  });

  it('при задержке — нет', () => {
    const c = ctxAt('2026-04-01', single); // ожидались 29 марта
    expect(c.forecast!.delayDays).toBeGreaterThan(0);
    expect(cardPhase(dayInfo(ld('2026-03-09'), c), c.forecast)).toBeNull();
  });

  it('без данных — нет', () => {
    const c = ctxAt('2026-03-09', []);
    expect(cardPhase(dayInfo(ld('2026-03-09'), c), c.forecast)).toBeNull();
  });
});

// Фича 009: «Настроение» — отдельный переключатель и отдельная кнопка диалога.
describe('dayDialogFor — «Настроение» (009)', () => {
  const all: Settings = { ...DEFAULT_SETTINGS, showWellbeing: true, showMood: true, showNotes: true };

  it('порядок: самочувствие, настроение, заметки — только включённые', () => {
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, all).extras).toEqual(['wellbeing', 'mood', 'notes']);
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, { ...DEFAULT_SETTINGS, showMood: true }).extras).toEqual(['mood']);
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, { ...all, showMood: false }).extras).toEqual(['wellbeing', 'notes']);
  });

  it('будущий день только с «Настроением» — диалог открывается', () => {
    const d = dayDialogFor(ld('2026-10-25'), TODAY, periods, L, { ...DEFAULT_SETTINGS, showMood: true });
    expect(d).toMatchObject({ periodActions: [], extras: ['mood'], opens: true });
  });
});

// Фича 009: отметка секса — кнопка в диалоге сегодняшнего и прошлых дней, сердечко в календаре.
describe('отметка секса (009)', () => {
  const on: Settings = { ...DEFAULT_SETTINGS, showSex: true };
  const marked = { ...emptyDayEntry(ld('2026-10-15')), sex: true };

  it('выключена — кнопки нет', () => {
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, DEFAULT_SETTINGS, marked).sex).toBeNull();
  });

  it('прошлый день и сегодня: «mark» без отметки, «unmark» с отметкой', () => {
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, on).sex).toBe('mark');
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, on, emptyDayEntry(ld('2026-10-15'))).sex).toBe('mark');
    expect(dayDialogFor(ld('2026-10-15'), TODAY, periods, L, on, marked).sex).toBe('unmark');
    expect(dayDialogFor(TODAY, TODAY, periods, L, on).sex).toBe('mark');
  });

  it('будущий день — кнопки нет; если включена только отметка секса, диалог не открывается', () => {
    const d = dayDialogFor(ld('2026-10-25'), TODAY, periods, L, on);
    expect(d).toMatchObject({ sex: null, extras: [], opens: false });
  });

  it('visibleSexDates — дни с отметкой только при включённом переключателе', () => {
    const entries: DayEntry[] = [marked, { ...emptyDayEntry(ld('2026-10-16')), note: 'x' }, { ...emptyDayEntry(ld('2026-10-17')), sex: true }];
    expect([...visibleSexDates(entries, on)].sort()).toEqual(['2026-10-15', '2026-10-17']);
    expect(visibleSexDates(entries, DEFAULT_SETTINGS).size).toBe(0);
  });

  it('отметка секса не влияет на точку «Есть записи»', () => {
    const all: Settings = { ...on, showWellbeing: true, showMood: true, showNotes: true };
    expect(visibleEntryDates([marked], all).size).toBe(0);
  });

  it('сводка в карточке: sex только при включённом переключателе', () => {
    expect(visibleEntryParts(marked, on).sex).toBe(true);
    expect(visibleEntryParts(marked, DEFAULT_SETTINGS).sex).toBe(false);
  });
});

// Фича 009: интенсивность самочувствия — видна только при включённых «Самочувствии» и «Интенсивности».
describe('интенсивность (009)', () => {
  const e = { ...emptyDayEntry(ld('2026-10-15')), symptoms: ['cramps' as const, 'acne' as const], intensity: { cramps: 'severe' as const } };
  const both: Settings = { ...DEFAULT_SETTINGS, showWellbeing: true, showIntensity: true };

  it('visibleEntryParts.intensity — только при обоих переключателях', () => {
    expect(visibleEntryParts(e, both).intensity).toEqual({ cramps: 'severe' });
    expect(visibleEntryParts(e, { ...both, showIntensity: false }).intensity).toEqual({});
    expect(visibleEntryParts(e, { ...both, showWellbeing: false }).intensity).toEqual({});
    expect(visibleEntryParts(undefined, both).intensity).toEqual({});
  });

  it('wellbeingTags: «Боль внизу живота · сильно», без степени — просто подпись', () => {
    expect(wellbeingTags(visibleEntryParts(e, both))).toEqual(['Боль внизу живота · сильно', 'Акне']);
    expect(wellbeingTags(visibleEntryParts(e, { ...both, showIntensity: false }))).toEqual(['Боль внизу живота', 'Акне']);
  });
});
