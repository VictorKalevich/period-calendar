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

  it('обратный счёт от задержки — один, в originalPredictedStart (SC-004)', () => {
    const found = linesMatching(/-\s*[\w.]*delayDays\b/);
    expect(found.map((x) => x.file)).toEqual(['domain/forecast.ts']);
  });

  it('отчёт не вызывает сводку «Сегодня» (FR-007)', () => {
    expect(source('domain/report.ts')).not.toContain('todaySummary');
  });

  it('сравнение месячных по началу — одно, в sortByStart (FR-009)', () => {
    const found = linesMatching(/\.start\s*<\s*\w+\.start\s*\?\s*-1/);
    expect(found.map((x) => x.file)).toEqual(['domain/periods.ts']);
  });

  it.each(['domain/forecast.ts', 'domain/cycles.ts'])('%s не сортирует месячные сам (FR-009, FR-010)', (file) => {
    expect(source(file)).not.toContain('.sort(');
  });

  it('прогноз не обращается к месячным по индексу цикла (FR-010)', () => {
    expect(source('domain/forecast.ts')).not.toContain('sorted[');
  });

  it('сборка цикла прогноза — с именованными полями (FR-011)', () => {
    const text = source('domain/forecast.ts');
    expect(text).toContain('cycleFrom({');
    expect(text).not.toMatch(/cycleFrom\(\s*(?!\{)/);
  });
});
