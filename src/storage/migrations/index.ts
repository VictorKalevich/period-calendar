// Миграции данных между версиями схемы (Конституция III). Используются и для IndexedDB,
// и для импорта старых резервных копий. Ключ — версия, С которой выполняется переход на ключ + 1.
// Чек-лист новой версии схемы — README.md в этой папке.

export type MigrationData = Record<string, unknown>;
export type Migration = (data: MigrationData) => MigrationData;

export const migrations: Record<number, Migration> = {};

/** Последовательно применяет миграции from → to. Неизвестные поля не трогает. */
export function migrateData(
  data: MigrationData,
  fromVersion: number,
  toVersion: number,
  registry: Record<number, Migration> = migrations,
): MigrationData {
  if (fromVersion > toVersion) throw new Error(`Cannot downgrade data from v${fromVersion} to v${toVersion}`);
  let out = data;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = registry[v];
    if (!step) throw new Error(`Missing migration from v${v}`);
    out = step(out);
  }
  return out;
}
