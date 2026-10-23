// Миграции данных между версиями схемы (Конституция III). Используются и для IndexedDB,
// и для импорта старых резервных копий. Ключ — версия, С которой выполняется переход на ключ + 1.

export type MigrationData = Record<string, unknown>;

export const migrations: Record<number, (data: MigrationData) => MigrationData> = {};
