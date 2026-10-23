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
import { DEFAULT_SETTINGS, type LocalDate, type Period } from '../domain/types';

const ld = (s: string) => s as LocalDate;
const periods: Period[] = [
  { id: 'a', start: ld('2026-09-01'), end: ld('2026-09-05'), endEstimated: false },
  { id: 'b', start: ld('2026-09-29'), end: ld('2026-10-02'), endEstimated: true },
  { id: 'c', start: ld('2026-10-20'), end: null, endEstimated: false },
];

async function seed() {
  await savePeriods(periods);
  await saveDayEntry({ date: ld('2026-10-01'), symptoms: ['cramps'], mood: 'calm', note: 'ok' });
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
        days: [{ date: '2026-10-01', symptoms: ['cramps'], mood: 'calm', note: 'ok' }],
        settings: { ...DEFAULT_SETTINGS, defaultCycleLength: 30 },
      },
    });
    expect(JSON.stringify(b)).not.toContain('secret');
  });

  it('exports schema version 2 with both switches (004)', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, showWellbeing: true, showNotes: false });
    const b = await buildBackup(new Date());
    expect(b.schemaVersion).toBe(2);
    expect(b.data.settings).toMatchObject({ showWellbeing: true, showNotes: false });
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.ok && parsed.value.settings).toMatchObject({ showWellbeing: true, showNotes: false });
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
    ['cycle length out of range', (f) => void (f.data.settings.defaultCycleLength = 50)],
    ['period length out of range', (f) => void (f.data.settings.defaultPeriodLength = 1)],
    ['unknown symptom', (f) => void (f.data.days[0]!.symptoms = ['sneezing'])],
    ['note too long', (f) => void (f.data.days[0]!.note = 'я'.repeat(1001))],
    ['duplicate day', (f) => void f.data.days.push({ ...f.data.days[0]! })],
    ['missing data', (f) => void delete (f as Partial<typeof f>).data],
  ];

  it('imports an old schemaVersion 1 file with both switches off (004 FR-005)', () => {
    const r = parseBackup(JSON.stringify(validFile()));
    expect(r.ok && r.value.settings).toEqual({
      defaultCycleLength: 27,
      defaultPeriodLength: 4,
      remindPeriod: false,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: false,
    });
  });

  it('rejects non-boolean switches in a v2 file', () => {
    const f = { ...validFile(), schemaVersion: 2 };
    (f.data.settings as Record<string, unknown>).showWellbeing = 'yes';
    (f.data.settings as Record<string, unknown>).showNotes = false;
    expect(parseBackup(JSON.stringify(f)).ok).toBe(false);
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
    });
    expect((await getPushState())?.token).toBe('secret');

    await applyBackup(parsed.value);
    expect({ p: await getPeriods(), d: await getDayEntries(), s: await getSettings() }).toEqual(first);
  });

  it('leaves the database untouched when parsing fails', async () => {
    await seed();
    const f = validFile();
    f.data.settings.defaultCycleLength = 99;
    expect(parseBackup(JSON.stringify(f)).ok).toBe(false);
    expect(await getPeriods()).toEqual(periods);
  });
});
