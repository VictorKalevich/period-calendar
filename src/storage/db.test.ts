import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, SCHEMA_VERSION } from './db';
import { getPeriods, getSettings, savePeriods, saveSettings, updateSettings } from './repository';
import { DEFAULT_SETTINGS, type LocalDate, type Period } from '../domain/types';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('db schema v5', () => {
  it('has schema version 5', () => {
    expect(SCHEMA_VERSION).toBe(5);
    expect(db.verno).toBe(5);
  });

  it('creates periods, days and kv tables with the expected keys', () => {
    const periods = db.table('periods').schema;
    expect(periods.primKey.name).toBe('id');
    expect(periods.indexes.map((i) => i.name)).toContain('start');
    expect(db.table('days').schema.primKey.name).toBe('date');
    expect(db.table('kv').schema.primKey.name).toBe('key');
  });
});

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual({
      defaultCycleLength: 28,
      defaultPeriodLength: 5,
      remindPeriod: true,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
      remindMissedPeriod: true,
    });
    expect(DEFAULT_SETTINGS.defaultCycleLength).toBe(28);
    expect(DEFAULT_SETTINGS.remindMissedPeriod).toBe(true);
  });

  it('applies quick consecutive patches without losing either (004)', async () => {
    await Promise.all([updateSettings({ showWellbeing: true }), updateSettings({ showNotes: true })]);
    expect(await getSettings()).toMatchObject({ showWellbeing: true, showNotes: true });
    await updateSettings({ showNotes: false });
    expect(await getSettings()).toMatchObject({ showWellbeing: true, showNotes: false, defaultCycleLength: 28 });
  });

  it('persists saved settings', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, defaultCycleLength: 30 });
    expect((await getSettings()).defaultCycleLength).toBe(30);
  });
});

describe('periods', () => {
  it('round-trips endEstimated and replaces all periods', async () => {
    const periods: Period[] = [
      { id: 'a', start: '2026-09-01' as LocalDate, end: '2026-09-05' as LocalDate, endEstimated: true },
      { id: 'b', start: '2026-09-29' as LocalDate, end: null, endEstimated: false },
    ];
    await savePeriods(periods);
    expect(await getPeriods()).toEqual(periods);
    await savePeriods([periods[1]!]);
    expect(await getPeriods()).toEqual([periods[1]]);
  });
});
