import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Фича 016 (FR-010–FR-012, SC-005): правила корректности — в домене, а не в модуле резервной копии.
const source = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('правила корректности — в домене', () => {
  it('одна проверка «это объект»: в dayEntry.ts нет isRecord, в backup.ts нет своего isObject', () => {
    expect(source('domain/dayEntry.ts')).not.toMatch(/\bisRecord\b/);
    expect(source('storage/backup.ts')).not.toMatch(/const\s+isObject\b/);
  });
});
