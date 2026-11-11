import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Фича 013: стили собираются только из токенов дизайн-системы (docs/design/design.md «Дизайн-система»).
// Отступы, радиусы и размеры текста — только `var(--space-*)`, `var(--radius-*)`, `var(--text-*)`.

const files = ['theme.css', 'app.css'].map((f) => ({ name: f, css: readFileSync(join(__dirname, f), 'utf8') }));

/** Объявления `свойство: значение` вне определений токенов `--*`, без комментариев. */
function declarations(css: string): Array<{ prop: string; value: string }> {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ prop: string; value: string }> = [];
  for (const m of body.matchAll(/(^|[;{\s])([a-z-]+)\s*:\s*([^;{}]+);/g)) {
    const prop = m[2]!;
    if (prop.startsWith('--')) continue;
    out.push({ prop, value: m[3]!.trim() });
  }
  return out;
}

const SPACING = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;

describe.each(files)('$name', ({ css }) => {
  const decls = declarations(css);

  it('отступы — только из шкалы --space-* (и раскладочных --gutter, --step, --safe-*, --nav-height, --tap-min)', () => {
    const bad = decls.filter((d) => SPACING.test(d.prop) && /\d*\.?\d+px/.test(d.value));
    expect(bad).toEqual([]);
  });

  it('радиусы — только --radius-*', () => {
    const bad = decls.filter((d) => d.prop === 'border-radius' && !/^(0|var\(--radius-[\w-]+\)(\s+var\(--radius-[\w-]+\)|\s+0)*)$/.test(d.value));
    expect(bad).toEqual([]);
  });

  it('размеры текста — только --text-*', () => {
    const bad = decls.filter((d) => d.prop === 'font-size' && !/^var\(--text-[\w-]+\)$/.test(d.value));
    expect(bad).toEqual([]);
  });

  it('цвета — только токены темы (rgba — лишь в тенях и подложке листа)', () => {
    const colorProps = /^(color|background|background-color|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke)$/;
    const bad = decls.filter((d) => colorProps.test(d.prop) && /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(d.value));
    expect(bad).toEqual([]);
  });
});

describe('токены', () => {
  const theme = files[0]!.css;
  const root = theme.slice(theme.lastIndexOf(':root'));

  it.each([
    ['--space-3xs', '2px'],
    ['--space-2xs', '4px'],
    ['--space-xs', '6px'],
    ['--space-s', '8px'],
    ['--space-m', '12px'],
    ['--space-l', '16px'],
    ['--space-xl', '20px'],
    ['--space-2xl', '24px'],
    ['--text-xs', '12px'],
    ['--text-s', '14px'],
    ['--text-m', '15px'],
    ['--text-l', '16px'],
    ['--text-xl', '18px'],
    ['--text-2xl', '24px'],
    ['--text-3xl', '34px'],
    ['--radius-field', '16px'],
    ['--radius-card', '24px'],
    ['--tap-min', '44px'],
    ['--control-h', '52px'],
  ])('%s: %s', (name, value) => {
    expect(root).toMatch(new RegExp(`${name}:\\s*${value};`));
  });
});
