import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Фича 017 (SC-002–SC-004, FR-009–FR-011): у каждой производной прогноза один источник в домене;
// потребители её не выводят. Поиск по исходникам приложения (не тестам).
const srcDir = join(__dirname, '..');
const appSources = (readdirSync(srcDir, { recursive: true }) as string[])
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'));
const source = (file: string) => readFileSync(join(srcDir, file), 'utf8');

/** Строки исходников приложения, где встречается шаблон (без флага `g`). */
function linesMatching(pattern: RegExp): Array<{ file: string; line: string }> {
  return appSources.flatMap((file) =>
    source(file)
      .split('\n')
      .filter((line) => pattern.test(line))
      .map((line) => ({ file, line: line.trim() })),
  );
}

describe('производные прогноза — в одном месте', () => {
  it('есть исходники для проверки', () => {
    expect(appSources).toContain('domain/forecast.ts');
    expect(appSources).toContain('ui/screens/CalendarScreen.tsx');
  });

  it('правило «длина из настроек, если средней нет» — один раз, в effectivePeriodLength (SC-002)', () => {
    const found = linesMatching(/\?\?\s*[\w.?]*defaultPeriodLength/);
    expect(found.map((x) => x.file)).toEqual(['domain/forecast.ts']);
    expect(found[0]!.line).toContain('averagePeriodLength(buildCycles(periods))');
  });

  it.each(['storage/repository.ts', 'storage/textImport.ts'])('%s не строит прогноз ради длины месячных (SC-003)', (file) => {
    expect(source(file)).not.toContain('buildForecast');
  });
});
