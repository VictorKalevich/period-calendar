import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

// Конституция III: база версии 1 (данные старой сборки) открывается новой сборкой, и сохранённые
// настройки получают переключатели фичи 004 в значении «выключено».
describe('IndexedDB upgrade v1 → v2', () => {
  it('adds showWellbeing/showNotes = false to stored settings', async () => {
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase('cycle-calendar');
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
    });
    // Схема v1 так, как её создаёт Dexie: version(1) = нативная версия 10.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('cycle-calendar', 10);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('periods', { keyPath: 'id' }).createIndex('start', 'start');
        d.createObjectStore('days', { keyPath: 'date' });
        d.createObjectStore('kv', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const d = req.result;
        const tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({
          key: 'settings',
          value: { defaultCycleLength: 31, defaultPeriodLength: 4, remindPeriod: false, remindOvulation: true },
        });
        tx.oncomplete = () => {
          d.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    vi.resetModules();
    const { db } = await import('./db');
    await db.open();
    expect(db.verno).toBe(2);
    const stored = await db.kv.get('settings');
    expect(stored?.value).toEqual({
      defaultCycleLength: 31,
      defaultPeriodLength: 4,
      remindPeriod: false,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: false,
    });
    db.close();
  }, 30_000);
});
