import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Конституция IV: доменный модуль — чистые функции без UI, хранилища, сети и часов.
const domainDir = __dirname;
const sources = readdirSync(domainDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

const forbiddenImport = /from\s+['"](react|react-dom|dexie|\.\.\/(storage|ui|push|hooks)\b[^'"]*)['"]/;
const clockRead = /new\s+Date\(\s*\)|Date\.now\(/;

describe('domain isolation', () => {
  it('has source files to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)('%s does not import UI, storage or push code', (file) => {
    const text = readFileSync(join(domainDir, file), 'utf8');
    expect(text).not.toMatch(forbiddenImport);
  });

  it.each(sources)('%s does not read the current time', (file) => {
    const text = readFileSync(join(domainDir, file), 'utf8');
    expect(text).not.toMatch(clockRead);
  });
});
