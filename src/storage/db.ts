import Dexie, { type Table } from 'dexie';
import type { DayEntry, LocalDate, Period } from '../domain/types';

export const SCHEMA_VERSION = 1;

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
