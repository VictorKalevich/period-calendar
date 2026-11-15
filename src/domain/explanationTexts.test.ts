import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVERAGE_WINDOW, OUTLIER_CYCLE } from './types';

// Фича 017 (FR-012, SC-006, research R8): числа в пояснительных текстах написаны вручную; тест связывает их
// с константами прогноза. Изменили константу — тест напомнит поправить тексты (сами тексты не меняются).
const srcDir = join(__dirname, '..');
const appSources = (readdirSync(srcDir, { recursive: true }) as string[])
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'));

/** Все вхождения шаблона (с флагом `g`) в исходниках приложения: файл и числа из групп. */
function occurrences(pattern: RegExp): Array<{ file: string; numbers: number[] }> {
  return appSources.flatMap((file) =>
    [...readFileSync(join(srcDir, file), 'utf8').matchAll(pattern)].map((m) => ({ file, numbers: m.slice(1).map(Number) })),
  );
}

const countByFile = (found: Array<{ file: string }>) =>
  found.reduce<Record<string, number>>((acc, { file }) => ({ ...acc, [file]: (acc[file] ?? 0) + 1 }), {});

describe('числа в пояснительных текстах = константы', () => {
  const window = occurrences(/по последним (\d+) циклам/g);
  const outliers = occurrences(/короче (\d+) и длиннее (\d+) дней/g);

  it('«по последним N циклам» — на экране «Статистика», в листе «Как считается прогноз» и в отчёте', () => {
    expect(window.length).toBeGreaterThanOrEqual(5);
    expect(countByFile(window)).toMatchObject({
      'ui/screens/StatsScreen.tsx': 2,
      'domain/report.ts': 2,
      'ui/components/ForecastInfo.tsx': 1,
    });
  });

  it('«по последним N циклам»: N = AVERAGE_WINDOW', () => {
    for (const { file, numbers } of window) expect(numbers, file).toEqual([AVERAGE_WINDOW]);
  });

  it('«короче N и длиннее M дней» — в листе «Как считается прогноз»', () => {
    expect(countByFile(outliers)).toMatchObject({ 'ui/components/ForecastInfo.tsx': 1 });
  });

  it('«короче N и длиннее M дней»: N, M = OUTLIER_CYCLE', () => {
    for (const { file, numbers } of outliers) expect(numbers, file).toEqual([OUTLIER_CYCLE.min, OUTLIER_CYCLE.max]);
  });
});
