import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

// Конституция III: база старой версии (данные прошлой сборки) открывается новой сборкой без потерь.
// Настройки получают новые поля фич 004 (v2), 005 (v3), 006 (v4), 007 (v5) и 009 (v6); записи дней
// переводятся в форму v6 (009), испорченные части становятся пустыми, месячные не меняются.

const periods = [
  { id: 'p1', start: '2026-08-01', end: '2026-08-05', endEstimated: false },
  { id: 'p2', start: '2026-08-29', end: '2026-09-02', endEstimated: true },
  { id: 'p3', start: '2026-09-27', end: null, endEstimated: false },
];

// Записи дней в форме v1–v5, в том числе испорченные (009 FR-003).
const oldDays = [
  { date: '2026-08-02', symptoms: ['cramps', 'headache'], mood: 'sad', note: 'болит' },
  { date: '2026-09-10', symptoms: [], mood: 'great', note: '' },
  { date: '2026-09-11', symptoms: ['fatigue', 'sneezing'], mood: 'nope', note: 7 },
  { date: '2026-09-12', symptoms: 'x', mood: 5, note: 'я'.repeat(1005) },
  { date: 'не-дата', symptoms: [], mood: 'calm', note: 'останется как есть' },
];

const v6Days = [
  { date: '2026-08-02', symptoms: ['cramps', 'headache'], intensity: {}, moods: ['sad'], sex: false, note: 'болит' },
  { date: '2026-09-10', symptoms: [], intensity: {}, moods: ['joyful'], sex: false, note: '' },
  { date: '2026-09-11', symptoms: ['fatigue'], intensity: {}, moods: [], sex: false, note: '' },
  { date: '2026-09-12', symptoms: [], intensity: {}, moods: [], sex: false, note: 'я'.repeat(1000) },
  { date: 'не-дата', symptoms: [], mood: 'calm', note: 'останется как есть' },
];

async function createOldDb(nativeVersion: number, settings: Record<string, unknown> | null, days: unknown[] = []) {
  await new Promise<void>((resolve, reject) => {
    const del = indexedDB.deleteDatabase('cycle-calendar');
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
  });
  // Dexie version(n) = нативная версия n × 10; таблицы во всех версиях одинаковые.
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('cycle-calendar', nativeVersion);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('periods', { keyPath: 'id' }).createIndex('start', 'start');
      d.createObjectStore('days', { keyPath: 'date' });
      d.createObjectStore('kv', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const d = req.result;
      const tx = d.transaction(['periods', 'days', 'kv'], 'readwrite');
      for (const p of periods) tx.objectStore('periods').put(p);
      for (const day of days) tx.objectStore('days').put(day);
      if (settings) tx.objectStore('kv').put({ key: 'settings', value: settings });
      tx.objectStore('kv').put({ key: 'push', value: { clientId: 'c', token: 't', subscribed: true, pendingSync: false, lastSyncedHash: null } });
      tx.oncomplete = () => {
        d.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function openWithNewBuild() {
  vi.resetModules();
  const { db } = await import('./db');
  await db.open();
  const out = {
    verno: db.verno,
    settings: (await db.kv.get('settings'))?.value,
    push: (await db.kv.get('push'))?.value as { token: string } | undefined,
    periods: await db.periods.orderBy('start').toArray(),
    days: (await db.days.toArray()).sort((a, b) => String(a.date).localeCompare(String(b.date))),
  };
  db.close();
  return out;
}

const sortByDate = <T extends { date: string }>(list: T[]) => [...list].sort((a, b) => a.date.localeCompare(b.date));

const base = { defaultCycleLength: 31, defaultPeriodLength: 4, remindPeriod: false, remindOvulation: true };
const added009 = (showWellbeing: boolean) => ({ showMood: showWellbeing, showIntensity: false, showSex: false });

describe('IndexedDB upgrade to the current schema (v6)', () => {
  it('v1 → v6: adds switches (004), the shift (005), the mode (006), the reminder (007) and 009 switches', async () => {
    await createOldDb(10, base);
    const r = await openWithNewBuild();
    expect(r.verno).toBe(6);
    expect(r.settings).toEqual({
      ...base,
      showWellbeing: false,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
      remindMissedPeriod: true,
      ...added009(false),
    });
  }, 30_000);

  it('v2 → v6: «Настроение» включено, если было включено «Самочувствие»', async () => {
    await createOldDb(20, { ...base, showWellbeing: true, showNotes: false });
    expect((await openWithNewBuild()).settings).toEqual({
      ...base,
      showWellbeing: true,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
      remindMissedPeriod: true,
      ...added009(true),
    });
  }, 30_000);

  it('v3 → v6: keeps the shift and adds the mode, the reminder and 009 switches', async () => {
    const v3 = { ...base, showWellbeing: false, showNotes: true, ovulationShiftEnabled: true, ovulationShift: -2 };
    await createOldDb(30, v3);
    expect((await openWithNewBuild()).settings).toEqual({ ...v3, ovulationFromNextPeriod: false, remindMissedPeriod: true, ...added009(false) });
  }, 30_000);

  it('v4 → v6: keeps the mode and adds the reminder and 009 switches', async () => {
    const v4 = { ...base, showWellbeing: true, showNotes: true, ovulationShiftEnabled: true, ovulationShift: -2, ovulationFromNextPeriod: true };
    await createOldDb(40, v4);
    expect((await openWithNewBuild()).settings).toEqual({ ...v4, remindMissedPeriod: true, ...added009(true) });
  }, 30_000);

  it('v5 → v6: keeps the reminder off and adds 009 switches', async () => {
    const v5 = { ...base, showWellbeing: false, showNotes: true, ovulationShiftEnabled: false, ovulationShift: 0, ovulationFromNextPeriod: false, remindMissedPeriod: false };
    await createOldDb(50, v5);
    expect((await openWithNewBuild()).settings).toEqual({ ...v5, ...added009(false) });
  }, 30_000);

  it.each([10, 20, 30, 40, 50])(
    'native %i: месячные и push без изменений, записи дней переведены в v6, ни одна не удалена (009)',
    async (native) => {
      await createOldDb(native, { ...base, showWellbeing: true, showNotes: true }, oldDays);
      const r = await openWithNewBuild();
      expect(r.verno).toBe(6);
      expect(r.periods).toEqual(periods);
      expect(r.push?.token).toBe('t');
      expect(r.days).toEqual(sortByDate(v6Days));
    },
    30_000,
  );

  it('свежая база без сохранённых настроек: новые переключатели выключены (значения по умолчанию)', async () => {
    await createOldDb(50, null, oldDays.slice(0, 1));
    const r = await openWithNewBuild();
    expect(r.settings).toBeUndefined();
    vi.resetModules();
    const { getSettings } = await import('./repository');
    const { db } = await import('./db');
    expect(await getSettings()).toMatchObject({ showMood: false, showIntensity: false, showSex: false, showWellbeing: false });
    db.close();
  }, 30_000);
});
