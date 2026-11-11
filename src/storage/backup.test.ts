import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyBackup, buildBackup, parseBackup, BACKUP_FORMAT } from './backup';
import { db, SCHEMA_VERSION } from './db';
import {
  getDayEntries,
  getPeriods,
  getPushState,
  getSettings,
  saveDayEntry,
  savePeriods,
  savePushState,
  saveSettings,
  setDevMode,
} from './repository';
import { emptyDayEntry } from '../domain/dayEntry';
import { DEFAULT_SETTINGS, type LocalDate, type Period } from '../domain/types';

const ld = (s: string) => s as LocalDate;
const periods: Period[] = [
  { id: 'a', start: ld('2026-09-01'), end: ld('2026-09-05'), endEstimated: false },
  { id: 'b', start: ld('2026-09-29'), end: ld('2026-10-02'), endEstimated: true },
  { id: 'c', start: ld('2026-10-20'), end: null, endEstimated: false },
];

async function seed() {
  await savePeriods(periods);
  await saveDayEntry({ ...emptyDayEntry(ld('2026-10-01')), symptoms: ['cramps'], moods: ['calm'], note: 'ok' });
  await saveSettings({ ...DEFAULT_SETTINGS, defaultCycleLength: 30 });
  await savePushState({ clientId: 'c1', token: 'secret', subscribed: true, pendingSync: false, lastSyncedHash: null });
}

function validFile() {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    exportedAt: '2026-10-23T10:15:00.000Z',
    data: {
      periods: [{ id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false }] as Array<{
        id: string;
        start: string;
        end: string | null;
        endEstimated: boolean;
      }>,
      days: [{ date: '2026-08-02', symptoms: ['acne'], mood: null, note: 'из файла' }],
      settings: { defaultCycleLength: 27, defaultPeriodLength: 4, remindPeriod: false, remindOvulation: true },
    },
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('buildBackup', () => {
  it('exports everything except the push state', async () => {
    await seed();
    const b = await buildBackup(new Date('2026-10-23T10:15:00.000Z'));
    expect(b).toEqual({
      format: 'cycle-calendar-backup',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-10-23T10:15:00.000Z',
      data: {
        periods,
        days: [{ date: '2026-10-01', symptoms: ['cramps'], intensity: {}, moods: ['calm'], sex: false, note: 'ok' }],
        settings: { ...DEFAULT_SETTINGS, defaultCycleLength: 30 },
      },
    });
    expect(JSON.stringify(b)).not.toContain('secret');
  });

  it('exports schema version 6 with all switches (004–007, 009) and v6 day entries', async () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      showWellbeing: true,
      showNotes: false,
      ovulationShiftEnabled: true,
      ovulationShift: -3,
      ovulationFromNextPeriod: true,
      remindMissedPeriod: false,
      showMood: true,
      showIntensity: true,
      showSex: true,
    };
    await saveSettings(settings);
    const day = { ...emptyDayEntry(ld('2026-10-05')), symptoms: ['headache' as const], intensity: { headache: 'severe' as const }, moods: ['playful' as const, 'calm' as const], sex: true };
    await saveDayEntry(day);
    const b = await buildBackup(new Date());
    expect(b.schemaVersion).toBe(6);
    expect(b.data.settings).toEqual(settings);
    expect(b.data.days).toEqual([day]);
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.ok && parsed.value.settings).toEqual(settings);
    expect(parsed.ok && parsed.value.days).toEqual([day]);
  });

  it('does not export the dev mode flag (FR-003)', async () => {
    await seed();
    await setDevMode(true);
    expect(JSON.stringify(await buildBackup(new Date()))).not.toMatch(/devMode/i);
  });

  it('round-trips through parse and apply', async () => {
    await seed();
    const text = JSON.stringify(await buildBackup(new Date()));
    await db.delete();
    await db.open();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await applyBackup(parsed.value);
    expect(await getPeriods()).toEqual(periods);
    expect((await getSettings()).defaultCycleLength).toBe(30);
    expect(await getDayEntries()).toHaveLength(1);
  });
});

describe('parseBackup', () => {
  const err = (input: unknown) => {
    const r = parseBackup(typeof input === 'string' ? input : JSON.stringify(input));
    return r.ok ? null : r.error;
  };

  it('summarises a valid file', () => {
    const r = parseBackup(JSON.stringify(validFile()));
    expect(r.ok && r.value.summary).toEqual({ periods: 1, days: 1 });
  });

  it('rejects non-JSON and foreign files', () => {
    expect(err('not json')).toBe('Это не резервная копия Календаря цикла');
    expect(err({ hello: 1 })).toBe('Это не резервная копия Календаря цикла');
    expect(err({ ...validFile(), format: 'other' })).toBe('Это не резервная копия Календаря цикла');
  });

  it('rejects a newer schema version', () => {
    expect(err({ ...validFile(), schemaVersion: SCHEMA_VERSION + 1 })).toBe(
      'Резервная копия создана более новой версией приложения. Обновите приложение',
    );
  });

  const broken: Array<[string, (f: ReturnType<typeof validFile>) => void]> = [
    ['bad date', (f) => void (f.data.periods[0]!.start = '2026-02-30')],
    ['end before start', (f) => void (f.data.periods[0]!.end = '2026-07-30')],
    ['period longer than 15 days', (f) => void (f.data.periods[0]!.end = '2026-08-16')],
    ['missing endEstimated', (f) => void delete (f.data.periods[0] as Partial<Period>).endEstimated],
    ['non-boolean endEstimated', (f) => void ((f.data.periods[0] as unknown as { endEstimated: string }).endEstimated = 'no')],
    [
      'overlapping periods that cannot be merged (> 15 days)',
      (f) => {
        f.data.periods[0]!.end = '2026-08-10';
        f.data.periods.push({ id: 'y', start: '2026-08-08', end: '2026-08-17', endEstimated: false });
      },
    ],
    ['duplicate ids', (f) => void f.data.periods.push({ id: 'x', start: '2026-09-01', end: null, endEstimated: false })],
    ['missing data', (f) => void delete (f as Partial<typeof f>).data],
  ];

  it('imports an old schemaVersion 1 file with switches off, no shift, the mode off and the reminder on (004–007)', () => {
    const r = parseBackup(JSON.stringify(validFile()));
    expect(r.ok && r.value.settings).toEqual({
      defaultCycleLength: 27,
      defaultPeriodLength: 4,
      remindPeriod: false,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
      remindMissedPeriod: true,
      showMood: false,
      showIntensity: false,
      showSex: false,
    });
  });

  it('imports a schemaVersion 2 file with the shift off and 0 (005 FR-008)', () => {
    const f = { ...validFile(), schemaVersion: 2 };
    Object.assign(f.data.settings, { showWellbeing: true, showNotes: true });
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.settings).toMatchObject({
      showWellbeing: true,
      showNotes: true,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
    });
  });

  it('imports a schemaVersion 3 file with the mode off and keeps the shift (006 FR-008)', () => {
    const f = { ...validFile(), schemaVersion: 3 };
    Object.assign(f.data.settings, { showWellbeing: false, showNotes: true, ovulationShiftEnabled: true, ovulationShift: 2 });
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.settings).toMatchObject({
      ovulationShiftEnabled: true,
      ovulationShift: 2,
      ovulationFromNextPeriod: false,
      remindMissedPeriod: true,
    });
  });

  const v4Settings = { showWellbeing: false, showNotes: false, ovulationShiftEnabled: false, ovulationShift: 0 };

  it('imports the mode from a v4 file', () => {
    const f = { ...validFile(), schemaVersion: 4 };
    Object.assign(f.data.settings, { ...v4Settings, ovulationFromNextPeriod: true });
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.settings.ovulationFromNextPeriod).toBe(true);
  });

  it('imports a v4 file with the missed-period reminder on (007 FR-010)', () => {
    const f = { ...validFile(), schemaVersion: 4 };
    Object.assign(f.data.settings, { ...v4Settings, ovulationFromNextPeriod: true });
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.settings).toMatchObject({ ovulationFromNextPeriod: true, remindMissedPeriod: true });
  });

  const v5Settings = { ...v4Settings, ovulationFromNextPeriod: false };

  it('imports the missed-period reminder off from a v5 file', () => {
    const f = { ...validFile(), schemaVersion: 5 };
    Object.assign(f.data.settings, { ...v5Settings, remindMissedPeriod: false });
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.settings.remindMissedPeriod).toBe(false);
  });

  // 009 FR-005: испорченная настройка не отменяет импорт — остаётся значение устройства («старая база
  // имеет приоритет»).
  const device = { ...DEFAULT_SETTINGS, defaultCycleLength: 33, remindMissedPeriod: false, ovulationShift: 4, showWellbeing: true, showNotes: true };

  it.each([undefined, 'yes', 1])('remindMissedPeriod %s in a v5 file → device value', (value) => {
    const f = { ...validFile(), schemaVersion: 5 };
    Object.assign(f.data.settings, { ...v5Settings, remindMissedPeriod: value });
    const r = parseBackup(JSON.stringify(f), device);
    expect(r.ok && r.value.settings.remindMissedPeriod).toBe(false);
    expect(r.ok && r.value.settings.defaultCycleLength).toBe(27);
  });

  it.each([undefined, 'yes', 1])('ovulationFromNextPeriod %s in a v4 file → device value', (mode) => {
    const f = { ...validFile(), schemaVersion: 4 };
    Object.assign(f.data.settings, { ...v4Settings, ovulationFromNextPeriod: mode });
    const r = parseBackup(JSON.stringify(f), { ...device, ovulationFromNextPeriod: true });
    expect(r.ok && r.value.settings.ovulationFromNextPeriod).toBe(true);
  });

  it('non-boolean switches in a v2 file → device values, valid ones from the file', () => {
    const f = { ...validFile(), schemaVersion: 2 };
    (f.data.settings as Record<string, unknown>).showWellbeing = 'yes';
    (f.data.settings as Record<string, unknown>).showNotes = false;
    const r = parseBackup(JSON.stringify(f), device);
    expect(r.ok && r.value.settings).toMatchObject({ showWellbeing: true, showNotes: false });
  });

  it.each([6, -6, 1.5, '2'])('ovulationShift %s in a v3 file → device value', (shift) => {
    const f = { ...validFile(), schemaVersion: 3 };
    Object.assign(f.data.settings, { showWellbeing: false, showNotes: false, ovulationShiftEnabled: true, ovulationShift: shift });
    const r = parseBackup(JSON.stringify(f), device);
    expect(r.ok && r.value.settings).toMatchObject({ ovulationShiftEnabled: true, ovulationShift: 4 });
  });

  it.each([
    ['cycle length out of range', 'defaultCycleLength', 50, 33],
    ['period length out of range', 'defaultPeriodLength', 1, DEFAULT_SETTINGS.defaultPeriodLength],
    ['non-boolean showSex', 'showSex', 'yes', false],
  ] as const)('%s → device value', (_name, key, value, expected) => {
    const f = { ...validFile(), schemaVersion: 6 };
    Object.assign(f.data.settings, { ...v5Settings, remindMissedPeriod: true, showMood: true, showIntensity: true, showSex: true, [key]: value });
    const r = parseBackup(JSON.stringify(f), device);
    expect(r.ok && r.value.settings[key]).toBe(expected);
    expect(r.ok && r.value.settings.showMood).toBe(true);
  });

  it('no settings object → device settings', () => {
    const f = validFile() as unknown as { data: Record<string, unknown> };
    f.data.settings = 5;
    const r = parseBackup(JSON.stringify(f), device);
    expect(r.ok && r.value.settings).toEqual(device);
  });

  // 009: записи дней импортируются мягко.
  it('v5 file: mood → moods, «Настроение» = «Самочувствие»', () => {
    const f = { ...validFile(), schemaVersion: 5 };
    Object.assign(f.data.settings, { ...v5Settings, showWellbeing: true, remindMissedPeriod: true });
    f.data.days = [{ date: '2026-08-02', symptoms: ['acne'], mood: 'great', note: 'из файла' } as never];
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.days).toEqual([{ ...emptyDayEntry(ld('2026-08-02')), symptoms: ['acne'], moods: ['joyful'], note: 'из файла' }]);
    expect(r.ok && r.value.settings).toMatchObject({ showMood: true, showIntensity: false, showSex: false });
  });

  it('damaged day entries do not block the import: periods restored, damaged parts empty', () => {
    const f = validFile() as unknown as { data: { days: unknown[] } };
    f.data.days = [
      { date: '2026-08-02', symptoms: ['acne', 'sneezing'], mood: 'nope', note: 7 },
      { date: '2026-08-03', symptoms: 'x', moods: ['calm', 5], sex: 'yes', note: 'я'.repeat(1001) },
      { symptoms: ['acne'], note: 'без даты' },
      { date: '2026-02-30', note: 'неверная дата' },
      'мусор',
      null,
      { date: '2026-08-02', note: 'повтор — отбрасывается' },
    ];
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.periods).toHaveLength(1);
    expect(r.value.days).toEqual([
      { ...emptyDayEntry(ld('2026-08-02')), symptoms: ['acne'] },
      { ...emptyDayEntry(ld('2026-08-03')), moods: ['calm'], note: 'я'.repeat(1000) },
    ]);
    expect(r.value.summary).toEqual({ periods: 1, days: 2 });
  });

  it.each([
    ['days null', (f: Record<string, unknown>) => void (f.days = null)],
    ['days not an array', (f: Record<string, unknown>) => void (f.days = { a: 1 })],
    ['no days', (f: Record<string, unknown>) => void delete f.days],
  ])('%s → import without day entries', (_name, mutate) => {
    const f = validFile() as unknown as { data: Record<string, unknown> };
    mutate(f.data);
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.days).toEqual([]);
    expect(r.ok && r.value.periods).toHaveLength(1);
  });

  it.each([
    ['data is an array', { format: BACKUP_FORMAT, schemaVersion: 6, data: [] }],
    ['periods is a string', { format: BACKUP_FORMAT, schemaVersion: 6, data: { periods: 'x', days: [], settings: {} } }],
    ['periods contain null', { format: BACKUP_FORMAT, schemaVersion: 6, data: { periods: [null], days: [], settings: {} } }],
    ['old version with odd data', { format: BACKUP_FORMAT, schemaVersion: 1, data: { periods: [], days: 'x', settings: [] } }],
  ])('never throws: %s', (_name, file) => {
    expect(() => parseBackup(JSON.stringify(file))).not.toThrow();
  });

  it('merges adjacent and overlapping periods on import (003 FR-015)', () => {
    const f = validFile();
    f.data.periods.push({ id: 'y', start: '2026-08-06', end: '2026-08-08', endEstimated: false }); // вплотную к 1–5
    f.data.periods.push({ id: 'z', start: '2026-08-08', end: '2026-08-09', endEstimated: true }); // перекрытие
    const r = parseBackup(JSON.stringify(f));
    expect(r.ok && r.value.periods).toEqual([{ id: 'x', start: '2026-08-01', end: '2026-08-09', endEstimated: true }]);
    expect(r.ok && r.value.summary.periods).toBe(1);
  });

  it.each(broken)('rejects %s', (_name, mutate) => {
    const f = validFile();
    mutate(f);
    expect(err(f)).toMatch(/^Файл резервной копии повреждён/);
  });
});

describe('applyBackup', () => {
  it('replaces data, keeps push state, and is idempotent', async () => {
    await seed();
    const parsed = parseBackup(JSON.stringify(validFile()));
    if (!parsed.ok) throw new Error(parsed.error);
    await applyBackup(parsed.value);
    const first = { p: await getPeriods(), d: await getDayEntries(), s: await getSettings() };
    expect(first.p).toEqual([{ id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false }]);
    expect(first.s).toEqual({
      defaultCycleLength: 27,
      defaultPeriodLength: 4,
      remindPeriod: false,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
      remindMissedPeriod: true,
      showMood: false,
      showIntensity: false,
      showSex: false,
    });
    expect((await getPushState())?.token).toBe('secret');

    await applyBackup(parsed.value);
    expect({ p: await getPeriods(), d: await getDayEntries(), s: await getSettings() }).toEqual(first);
  });

  it('leaves the database untouched when periods in the file are damaged (009 FR-005)', async () => {
    await seed();
    const before = { p: await getPeriods(), d: await getDayEntries(), s: await getSettings() };
    const f = validFile();
    f.data.periods[0]!.start = '2026-02-30';
    const r = parseBackup(JSON.stringify(f));
    expect(!r.ok && r.error).toMatch(/^Файл резервной копии повреждён/);
    expect({ p: await getPeriods(), d: await getDayEntries(), s: await getSettings() }).toEqual(before);
  });
});
