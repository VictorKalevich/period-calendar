import { describe, expect, it } from 'vitest';
import { importFileKind } from './importFile';

// Фича 019 (FR-005; research R5): вид импортируемого файла по его тексту — прежнее правило «Резервной копии».

const BOM = String.fromCharCode(0xfeff);

describe('importFileKind', () => {
  it.each([
    ['{"a":1}'],
    ['  \n\t{'],
    [BOM + '{'],
    // Начинается с «{» — резервная копия, даже если внутри есть ключ текстовой выгрузки.
    ['{ "x": "Period start date: 2017-12-23" }'],
  ])('%j — резервная копия', (text) => {
    expect(importFileKind(text)).toBe('backup');
  });

  it.each([['cycle 1\nPeriod start date: 2017-12-23'], ['PERIOD START DATE:'], ['  period start date: x']])(
    '%j — текстовая выгрузка',
    (text) => {
      expect(importFileKind(text)).toBe('cycle-text');
    },
  );

  it.each([[''], ['   '], ['hello'], ['[1,2]']])('%j — не распознан', (text) => {
    expect(importFileKind(text)).toBe('unknown');
  });
});
