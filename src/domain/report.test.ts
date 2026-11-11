import { describe, expect, it } from 'vitest';
import { buildCycles } from './cycles';
import { emptyDayEntry } from './dayEntry';
import { buildDoctorReport, reportView, type DoctorReportInput } from './report';
import { cycleStats } from './stats';
import { DEFAULT_SETTINGS, type DayEntry, type LocalDate, type Period, type Settings } from './types';

// Фича 011: содержание отчёта для врача — specs/011-doctor-report/contracts/report.md.

const ld = (s: string) => s as LocalDate;
const P = (start: string, end: string | null = null, endEstimated = false): Period => ({
  id: start,
  start: ld(start),
  end: end ? ld(end) : null,
  endEstimated,
});

// Регулярная история: 14 месячных, последние начались 21.10.2026; сегодня 11.11.2026 (22-й день).
const REGULAR: Period[] = [
  P('2025-10-20', '2025-10-24'),
  P('2025-11-17', '2025-11-21'),
  P('2025-12-15', '2025-12-19'),
  P('2026-01-12', '2026-01-16'),
  P('2026-02-09', '2026-02-13'),
  P('2026-03-09', '2026-03-13'),
  P('2026-04-06', '2026-04-10'),
  P('2026-05-04', '2026-05-08'),
  P('2026-06-01', '2026-06-05'),
  P('2026-06-30', '2026-07-04'),
  P('2026-07-28', '2026-08-01'),
  P('2026-08-26', '2026-08-30'),
  P('2026-09-23', '2026-09-27', true),
  P('2026-10-21', '2026-10-25'),
];
const TODAY = ld('2026-11-11');

const all: Settings = { ...DEFAULT_SETTINGS, showWellbeing: true, showMood: true, showIntensity: true, showNotes: true, showSex: true };
const entry = (date: string, over: Partial<DayEntry>): DayEntry => ({ ...emptyDayEntry(ld(date)), ...over });

const input = (over: Partial<DoctorReportInput> = {}): DoctorReportInput => ({
  periods: REGULAR,
  entries: [],
  settings: all,
  today: TODAY,
  ...over,
});

describe('buildDoctorReport — период и циклы', () => {
  it('период — последние 12 месяцев до сегодня', () => {
    const r = buildDoctorReport(input());
    expect([r.from, r.to]).toEqual(['2025-11-11', '2026-11-11']);
  });

  it('29 февраля и переход года', () => {
    expect(buildDoctorReport(input({ today: ld('2028-02-29') })).from).toBe('2027-02-28');
    expect(buildDoctorReport(input({ today: ld('2027-01-05') })).from).toBe('2026-01-05');
  });

  it('циклы — только с началом в периоде, по возрастанию; текущий — без длины', () => {
    const r = buildDoctorReport(input());
    expect(r.cycles.map((c) => c.start)).toEqual(REGULAR.slice(1).map((p) => p.start));
    expect(r.cycles.at(-1)).toMatchObject({ start: '2026-10-21', length: null, periodLength: 5 });
    expect(r.cycles.find((c) => c.start === '2026-09-23')).toMatchObject({ length: 28, periodLength: 5, periodEndEstimated: true });
  });

  it('средние — те же, что на «Статистике» (по всем циклам)', () => {
    const r = buildDoctorReport(input());
    const stats = cycleStats(buildCycles(REGULAR));
    expect(r.avgCycleLength).toBe(stats.avgCycleLength);
    expect(r.avgPeriodLength).toBe(stats.avgPeriodLength);
  });

  it('разброс — по завершённым циклам периода без выбросов', () => {
    expect(buildDoctorReport(input()).cycleRange).toEqual({ min: 28, max: 29 });
  });

  it('последние месячные, ожидаемые следующие, без задержки', () => {
    const r = buildDoctorReport(input());
    expect(r.lastPeriodStart).toBe('2026-10-21');
    expect(r.delayDays).toBe(0);
    expect(r.nextPeriod).toBe('2026-11-18');
    expect(r.lowConfidence).toBe(false);
  });

  it('график — только завершённые циклы периода', () => {
    const r = buildDoctorReport(input());
    expect(r.chart).toHaveLength(12);
    expect(r.chart[0]).toEqual({ start: '2025-11-17', length: 28, outlier: false });
    expect(r.chart.at(-1)).toEqual({ start: '2026-09-23', length: 28, outlier: false });
  });
});

describe('buildDoctorReport — самочувствие и настроение', () => {
  const entries = [
    entry('2026-10-21', { symptoms: ['cramps', 'fatigue'], intensity: { cramps: 'severe' }, moods: ['sad'] }),
    entry('2026-10-22', { symptoms: ['cramps'], intensity: { cramps: 'moderate' }, moods: ['sad', 'calm'] }),
    entry('2026-09-23', { symptoms: ['cramps', 'headache'], intensity: { headache: 'mild' } }),
    entry('2025-11-01', { symptoms: ['acne'], moods: ['angry'] }), // до периода — не считается
    entry('2026-11-12', { symptoms: ['acne'] }), // после сегодня — не считается
  ];

  it('дни в периоде, по убыванию, затем по справочнику; степени — при «Интенсивности»', () => {
    const r = buildDoctorReport(input({ entries }));
    expect(r.symptoms).toEqual([
      { id: 'cramps', days: 3, intensity: { mild: 0, moderate: 1, severe: 1 } },
      { id: 'headache', days: 1, intensity: { mild: 1, moderate: 0, severe: 0 } },
      { id: 'fatigue', days: 1, intensity: { mild: 0, moderate: 0, severe: 0 } },
    ]);
    expect(r.moods).toEqual([
      { id: 'sad', days: 2 },
      { id: 'calm', days: 1 },
    ]);
  });

  it('выключенная «Интенсивность» — без степеней', () => {
    const r = buildDoctorReport(input({ entries, settings: { ...all, showIntensity: false } }));
    expect(r.symptoms?.[0]).toEqual({ id: 'cramps', days: 3, intensity: null });
  });

  it('выключенные «Самочувствие» и «Настроение» — null', () => {
    const r = buildDoctorReport(input({ entries, settings: { ...all, showWellbeing: false, showMood: false } }));
    expect(r.symptoms).toBeNull();
    expect(r.moods).toBeNull();
  });

  it('заметки и отметки секса на отчёт не влияют', () => {
    const plain = buildDoctorReport(input({ entries }));
    const withPrivate = buildDoctorReport(
      input({ entries: entries.map((e) => ({ ...e, note: 'личное', sex: true })).concat(entry('2026-10-30', { note: 'x', sex: true })) }),
    );
    expect(withPrivate).toEqual(plain);
    expect(JSON.stringify(reportView(withPrivate, TODAY))).not.toMatch(/личное|секс/i);
  });
});

describe('buildDoctorReport — мало данных, задержка, выбросы (US2)', () => {
  it('одна отметка: средних нет, график пуст, прогноз ориентировочный', () => {
    const r = buildDoctorReport(input({ periods: [P('2026-11-01', '2026-11-05')] }));
    expect(r).toMatchObject({ avgCycleLength: null, avgPeriodLength: 5, cycleRange: null, chart: [], lowConfidence: true });
    expect(r.cycles).toEqual([{ start: '2026-11-01', length: null, periodLength: 5, periodEndEstimated: false, outlier: false }]);
  });

  it('задержка: delayDays и ожидавшаяся дата', () => {
    const r = buildDoctorReport(input({ periods: [P('2026-09-01', '2026-09-05'), P('2026-09-29', '2026-10-03')] }));
    expect(r.delayDays).toBe(15);
    expect(r.nextPeriod).toBe('2026-10-27');
  });

  it('выброс: в графике outlier, в разброс не входит', () => {
    const periods = [P('2026-03-01', '2026-03-05'), P('2026-03-11', '2026-03-14'), P('2026-04-08', '2026-04-12'), P('2026-05-06', '2026-05-10')];
    const r = buildDoctorReport(input({ periods }));
    expect(r.chart).toEqual([
      { start: '2026-03-01', length: 10, outlier: true },
      { start: '2026-03-11', length: 28, outlier: false },
      { start: '2026-04-08', length: 28, outlier: false },
    ]);
    expect(r.cycleRange).toEqual({ min: 28, max: 28 });
  });
});

describe('reportView — строки отчёта', () => {
  it('заголовок, период и дата создания', () => {
    const v = reportView(buildDoctorReport(input()), TODAY);
    expect(v.title).toBe('Отчёт о менструальном цикле');
    expect(v.subtitle).toBe('Период: 11.11.2025 – 11.11.2026 · сформирован 11.11.2026');
  });

  it('сводка', () => {
    const v = reportView(buildDoctorReport(input()), TODAY);
    expect(v.tiles).toEqual([
      { label: 'Средняя длина цикла', value: '28 дн.', note: 'по последним 6 циклам · от 28 до 29 дн.' },
      { label: 'Средняя длина месячных', value: '5 дн.', note: 'по последним 6 циклам' },
      { label: 'Последние месячные', value: '21.10.2026', note: 'сегодня 22-й день цикла' },
      { label: 'Ожидаемые следующие', value: '18.11.2026', note: 'по средней длине цикла' },
    ]);
    expect(v.confidenceNote).toBeNull();
  });

  it('график: подписи дат и средняя', () => {
    const v = reportView(buildDoctorReport(input()), TODAY);
    expect(v.chart?.bars[0]).toEqual({ label: '17.11', value: 28, outlier: false });
    expect(v.chart?.average).toBe(28);
  });

  it('таблица циклов — новые сверху', () => {
    const v = reportView(buildDoctorReport(input()), TODAY);
    expect(v.cycleTable.head).toEqual(['Начало месячных', 'Длина цикла', 'Длина месячных', 'Примечание']);
    expect(v.cycleTable.rows[0]).toEqual(['21.10.2026', 'идёт сейчас', '5 дн.', '']);
    expect(v.cycleTable.rows[1]).toEqual(['23.09.2026', '28 дн.', '≈ 5 дн.', '']);
    expect(v.cycleTable.rows).toHaveLength(13);
  });

  it('таблицы самочувствия (со степенями и без) и настроений', () => {
    const entries = [entry('2026-10-21', { symptoms: ['cramps'], intensity: { cramps: 'severe' }, moods: ['sad'] })];
    const v = reportView(buildDoctorReport(input({ entries })), TODAY);
    expect(v.symptomTable).toEqual({ head: ['Самочувствие', 'Дней', 'Слабо', 'Средне', 'Сильно'], rows: [['Боль внизу живота', '1', '—', '—', '1']] });
    expect(v.moodTable).toEqual({ head: ['Настроение', 'Дней'], rows: [['Грустная', '1']] });
    const noLevels = reportView(buildDoctorReport(input({ entries, settings: { ...all, showIntensity: false } })), TODAY);
    expect(noLevels.symptomTable).toEqual({ head: ['Самочувствие', 'Дней'], rows: [['Боль внизу живота', '1']] });
  });

  it('нет отметок самочувствия/настроения за период или выключены — таблиц нет', () => {
    const v = reportView(buildDoctorReport(input()), TODAY);
    expect(v.symptomTable).toBeNull();
    expect(v.moodTable).toBeNull();
  });

  it('мало данных: «—», графика нет, «≈» и пояснение', () => {
    const v = reportView(buildDoctorReport(input({ periods: [P('2026-11-01', '2026-11-05')] })), TODAY);
    expect(v.tiles[0]).toEqual({ label: 'Средняя длина цикла', value: '—', note: 'по последним 6 циклам' });
    expect(v.tiles[1]!.value).toBe('5 дн.');
    expect(v.tiles[3]).toEqual({ label: 'Ожидаемые следующие', value: '≈ 29.11.2026', note: 'ориентировочно' });
    expect(v.chart).toBeNull();
    expect(v.confidenceNote).toBe('Прогноз по средним значениям: мало данных или нерегулярный цикл');
  });

  it('задержка', () => {
    const v = reportView(buildDoctorReport(input({ periods: [P('2026-09-01', '2026-09-05'), P('2026-09-29', '2026-10-03')] })), TODAY);
    expect(v.tiles[3]).toEqual({ label: 'Ожидаемые следующие', value: 'Задержка 15 дн.', note: 'ожидались 27.10.2026' });
  });

  it('выброс в таблице и одинаковый разброс', () => {
    const periods = [P('2026-03-01', '2026-03-05'), P('2026-03-11', '2026-03-14'), P('2026-04-08', '2026-04-12'), P('2026-05-06', '2026-05-10')];
    const v = reportView(buildDoctorReport(input({ periods })), TODAY);
    expect(v.cycleTable.rows.at(-1)).toEqual(['01.03.2026', '10 дн.', '5 дн.', 'не учитывается в средних']);
    expect(v.tiles[0]!.note).toBe('по последним 6 циклам · все по 28 дн.');
    expect(v.chart?.bars[0]).toMatchObject({ outlier: true });
  });
});
