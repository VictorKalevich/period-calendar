import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPORT_PALETTE } from './render';

// Фича 013: отчёт PDF рисуется на холсте и не читает CSS — его палитра обязана совпадать с токенами
// светлой темы (docs/design/design.md «Дизайн-система», печать — всегда светлая).

const css = readFileSync(join(__dirname, '../ui/theme.css'), 'utf8');
const light = css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)'));

describe('REPORT_PALETTE', () => {
  it.each(Object.entries(REPORT_PALETTE).filter(([name]) => name !== 'page'))('%s = токен светлой темы', (name, value) => {
    const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(light);
    expect(m, `--${name}`).not.toBeNull();
    expect(value.toLowerCase()).toBe(m![1]!.toLowerCase());
  });

  it('страница — белая, как surface светлой темы', () => {
    const m = /--surface:\s*(#[0-9a-fA-F]{6})\s*;/.exec(light)!;
    expect(REPORT_PALETTE.page.toLowerCase()).toBe(m[1]!.toLowerCase());
  });
});
