import Dexie, { type Table } from 'dexie';
import type { DayEntry, LocalDate, Period } from '../domain/types';
import { migrations } from './migrations';

export const SCHEMA_VERSION = 5;

export interface KvRecord<T = unknown> {
  key: string;
  value: T;
}

class CycleDb extends Dexie {
  periods!: Table<Period, string>;
  days!: Table<DayEntry, LocalDate>;
  kv!: Table<KvRecord, string>;

  constructor() {
    super('cycle-calendar');
    // Каждая новая версия схемы: db.version(n).stores(...).upgrade(...) + migrations[n - 1] + тест.
    this.version(1).stores({
      periods: 'id, start',
      days: 'date',
      kv: 'key',
    });
    // v2 (фича 004): таблицы те же; в сохранённые настройки добавляются переключатели (migrations[1]).
    this.version(2)
      .stores({ periods: 'id, start', days: 'date', kv: 'key' })
      .upgrade(async (tx) => {
        const kv = tx.table<KvRecord, string>('kv');
        const rec = await kv.get('settings');
        if (!rec) return;
        const migrated = migrations[1]!({ settings: rec.value }).settings;
        await kv.put({ key: 'settings', value: migrated });
      });
    // v3 (фича 005): таблицы те же; в настройки добавляется личный сдвиг овуляции (migrations[2]).
    this.version(3)
      .stores({ periods: 'id, start', days: 'date', kv: 'key' })
      .upgrade(async (tx) => {
        const kv = tx.table<KvRecord, string>('kv');
        const rec = await kv.get('settings');
        if (!rec) return;
        await kv.put({ key: 'settings', value: migrations[2]!({ settings: rec.value }).settings });
      });
    // v4 (фича 006): таблицы те же; в настройки добавляется режим расчёта овуляции (migrations[3]).
    this.version(4)
      .stores({ periods: 'id, start', days: 'date', kv: 'key' })
      .upgrade(async (tx) => {
        const kv = tx.table<KvRecord, string>('kv');
        const rec = await kv.get('settings');
        if (!rec) return;
        await kv.put({ key: 'settings', value: migrations[3]!({ settings: rec.value }).settings });
      });
    // v5 (фича 007): таблицы те же; в настройки добавляется напоминание о неотмеченном начале (migrations[4]).
    this.version(5)
      .stores({ periods: 'id, start', days: 'date', kv: 'key' })
      .upgrade(async (tx) => {
        const kv = tx.table<KvRecord, string>('kv');
        const rec = await kv.get('settings');
        if (!rec) return;
        await kv.put({ key: 'settings', value: migrations[4]!({ settings: rec.value }).settings });
      });
  }
}

export const db = new CycleDb();

let persistRequested = false;

/** Просит браузер не очищать хранилище (research.md R3). Вызывается один раз. */
export function requestPersistentStorage(): void {
  if (persistRequested) return;
  persistRequested = true;
  void globalThis.navigator?.storage?.persist?.().catch(() => undefined);
}

db.on('ready', () => requestPersistentStorage());
