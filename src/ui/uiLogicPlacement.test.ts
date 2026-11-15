import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Фича 019 (SC-002, SC-003, SC-005; research R11): у вспомогательных функций одно определение в домене,
// решения интерфейса — в чистых функциях, разметка переключателя — в одном компоненте.
// Поиск по исходникам приложения (не тестам и не обвязке тестов `ui/testing.ts`).
const srcDir = join(__dirname, '..');
const appSources = (readdirSync(srcDir, { recursive: true }) as string[])
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.') && file !== 'ui/testing.ts');
const uiSources = appSources.filter((file) => file.startsWith('ui/'));
const source = (file: string) => readFileSync(join(srcDir, file), 'utf8');

/** Файлы, в которых встречается подстрока, с числом вхождений. */
const occurrences = (files: string[], needle: string) =>
  files
    .map((file) => [file, source(file).split(needle).length - 1] as const)
    .filter(([, n]) => n > 0)
    .map(([file, n]) => `${file} × ${n}`);

describe('решения интерфейса — в чистых функциях', () => {
  it('есть исходники для проверки', () => {
    expect(uiSources).toContain('ui/components/BackupSection.tsx');
    expect(uiSources).not.toContain('ui/testing.ts');
    expect(appSources).toContain('domain/plural.ts');
  });

  it('в src/ui нет правила склонения (FR-001)', () => {
    expect(occurrences(uiSources, '% 10')).toEqual([]);
    expect(occurrences(uiSources, '% 100')).toEqual([]);
  });

  it('pluralRu определена один раз — в домене; сдвиг овуляции своего правила не держит (FR-001)', () => {
    expect(occurrences(appSources, 'function pluralRu')).toEqual(['domain/plural.ts × 1']);
    expect(source('domain/dates.ts')).not.toContain('% 10');
  });
});
