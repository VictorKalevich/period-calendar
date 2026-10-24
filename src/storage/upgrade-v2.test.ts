import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

// Конституция III: база старой версии (данные прошлой сборки) открывается новой сборкой, и
// сохранённые настройки получают новые поля по умолчанию: фича 004 (v2), 005 (v3), 006 (v4) и 007 (v5).

async function createOldDb(nativeVersion: number, settings: Record<string, unknown>) {
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
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ key: 'settings', value: settings });
      tx.oncomplete = () => {
        d.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function storedSettingsAfterOpen() {
  vi.resetModules();
  const { db } = await import('./db');
  await db.open();
  const verno = db.verno;
  const value = (await db.kv.get('settings'))?.value;
  db.close();
  return { verno, value };
}

const base = { defaultCycleLength: 31, defaultPeriodLength: 4, remindPeriod: false, remindOvulation: true };

describe('IndexedDB upgrade to the current schema', () => {
  it('v1 → v5: adds switches (004), the shift (005), the mode (006) and the missed-period reminder (007)', async () => {
    await createOldDb(10, base);
    expect(await storedSettingsAfterOpen()).toEqual({
      verno: 5,
      value: { ...base, showWellbeing: false, showNotes: false, ovulationShiftEnabled: false, ovulationShift: 0, ovulationFromNextPeriod: false, remindMissedPeriod: true },
    });
  }, 30_000);

  it('v2 → v5: keeps the switches and adds the shift, the mode and the reminder', async () => {
    await createOldDb(20, { ...base, showWellbeing: true, showNotes: false });
    expect(await storedSettingsAfterOpen()).toEqual({
      verno: 5,
      value: { ...base, showWellbeing: true, showNotes: false, ovulationShiftEnabled: false, ovulationShift: 0, ovulationFromNextPeriod: false, remindMissedPeriod: true },
    });
  }, 30_000);

  it('v3 → v5: keeps the shift and adds the mode as off and the reminder as on', async () => {
    const v3 = { ...base, showWellbeing: false, showNotes: true, ovulationShiftEnabled: true, ovulationShift: -2 };
    await createOldDb(30, v3);
    expect(await storedSettingsAfterOpen()).toEqual({ verno: 5, value: { ...v3, ovulationFromNextPeriod: false, remindMissedPeriod: true } });
  }, 30_000);

  it('v4 → v5: keeps the mode and remindPeriod off, adds the missed-period reminder as on (007)', async () => {
    const v4 = { ...base, showWellbeing: false, showNotes: true, ovulationShiftEnabled: true, ovulationShift: -2, ovulationFromNextPeriod: true };
    await createOldDb(40, v4);
    expect(await storedSettingsAfterOpen()).toEqual({ verno: 5, value: { ...v4, remindMissedPeriod: true } });
  }, 30_000);
});
