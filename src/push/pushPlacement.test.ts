import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Фича 018 (FR-013, SC-003): модуль push обращается к базе только через функции репозитория, а состояние
// push пишет только изменёнными полями (`updatePushState`). Ядро синхронизации не трогает браузер, сеть и
// часы напрямую — только внедрённые зависимости.

const pushDir = __dirname;
const sources = readdirSync(pushDir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
const read = (file: string) => readFileSync(join(pushDir, file), 'utf8');

describe('push: доступ к базе', () => {
  it('есть исходники для проверки, среди них ядро синхронизации', () => {
    expect(sources).toContain('sync.ts');
    expect(sources).toContain('syncCore.ts');
  });

  it.each(sources)('%s не импортирует storage/db', (file) => {
    expect(read(file)).not.toMatch(/storage\/db\b/);
  });

  it.each(sources)('%s не содержит литерала ключа настроек', (file) => {
    expect(read(file)).not.toMatch(/['"]settings['"]/);
  });

  it.each(sources)('%s не записывает состояние push целиком (savePushState)', (file) => {
    expect(read(file)).not.toMatch(/\bsavePushState\b/);
  });
});

describe('push: ядро синхронизации', () => {
  it.each([
    ['fetch(', /\bfetch\(/],
    ['navigator', /\bnavigator\b/],
    ['import.meta.env', /import\.meta\.env/],
    ['new Date(', /new\s+Date\(/],
  ])('syncCore.ts не обращается к %s напрямую', (_name, pattern) => {
    expect(read('syncCore.ts')).not.toMatch(pattern);
  });
});
