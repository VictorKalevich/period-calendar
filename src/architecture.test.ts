import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Правила слоёв (docs/refactoring-roadmap.md, «Целевые правила слоёв»; specs/020-architecture-guard).
// Импорты находит разбор синтаксиса TypeScript: «импорт» в комментарии или строке не считается (research R2).

interface ImportRef {
  /** Имя модуля; `null` — динамический импорт с вычисляемым именем. */
  specifier: string | null;
  /** Строка в файле, с 1. */
  line: number;
}

/** Все зависимости файла: import/export … from, import '…', import(…), import('…').T, require. */
function importsOf(text: string, fileName = 'sample.ts'): ImportRef[] {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const out: ImportRef[] = [];
  const add = (node: ts.Node, specifier: string | null) =>
    out.push({ specifier, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  const literal = (node: ts.Node | undefined) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;

  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      add(node, literal(node.moduleSpecifier));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node, literal(node.moduleReference.expression));
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node, literal(node.arguments[0]));
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') {
      add(node, literal(node.arguments[0]));
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, literal(node.argument.literal));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

type LayerId = 'domain' | 'storage' | 'report' | 'push' | 'hooks' | 'pwa' | 'ui' | 'main' | 'sw' | 'env' | 'worker';

interface Layer {
  id: LayerId;
  /** Путь от корня проекта: каталог или файл. */
  path: string;
  /** Слои, которые можно импортировать (свой — всегда). */
  layers: readonly LayerId[];
  /** Пакеты, которые можно импортировать (по имени пакета). */
  packages: readonly string[];
}

/** Список разрешённого: всё, что не названо, запрещено (research R3). */
const LAYERS: readonly Layer[] = [
  { id: 'domain', path: 'src/domain', layers: [], packages: ['date-fns'] },
  { id: 'storage', path: 'src/storage', layers: ['domain'], packages: ['dexie'] },
  { id: 'report', path: 'src/report', layers: ['domain'], packages: [] },
  { id: 'push', path: 'src/push', layers: ['domain', 'storage'], packages: [] },
  { id: 'hooks', path: 'src/hooks', layers: ['domain', 'storage'], packages: ['react'] },
  { id: 'pwa', path: 'src/pwa', layers: [], packages: ['virtual:pwa-register'] },
  { id: 'ui', path: 'src/ui', layers: ['domain', 'storage', 'report', 'push', 'hooks', 'pwa'], packages: ['react', 'react-dom'] },
  // Точка сборки приложения: подключает все слои и CSS.
  { id: 'main', path: 'src/main.tsx', layers: ['domain', 'storage', 'report', 'push', 'hooks', 'pwa', 'ui'], packages: ['react', 'react-dom'] },
  // Service worker — отдельная сборка (tsconfig.sw.json): только разбор push-данных.
  { id: 'sw', path: 'src/sw.ts', layers: ['pwa'], packages: ['workbox-core', 'workbox-precaching'] },
  { id: 'env', path: 'src/vite-env.d.ts', layers: [], packages: [] },
  // Отдельный пакет без runtime-зависимостей; кода приложения не импортирует.
  { id: 'worker', path: 'worker/src', layers: [], packages: [] },
];

type Target =
  | { kind: 'layer'; id: LayerId }
  | { kind: 'package'; name: string }
  | { kind: 'outside'; path: string }
  | { kind: 'computed' };

const toPosix = (path: string) => path.split('\\').join('/');
const withoutExtension = (path: string) => path.replace(/(\.d)?\.tsx?$/, '');

/** Слой файла или пути импорта: каталог — по префиксу, файл — по имени с расширением или без. */
function layerOf(path: string): Layer | undefined {
  const p = toPosix(path);
  return LAYERS.filter((l) =>
    /\.tsx?$/.test(l.path) ? p === l.path || p === withoutExtension(l.path) : p.startsWith(l.path + '/'),
  ).sort((a, b) => b.path.length - a.path.length)[0];
}

/** К чему относится импорт из файла `file` (путь от корня проекта): слой, пакет или «вне слоёв» (R4). */
function targetOf(file: string, specifier: string | null): Target {
  if (specifier === null) return { kind: 'computed' };
  if (specifier.startsWith('/')) return { kind: 'outside', path: specifier };
  if (specifier.startsWith('.')) {
    const path = posix.normalize(posix.join(posix.dirname(toPosix(file)), specifier));
    const layer = layerOf(path);
    return layer ? { kind: 'layer', id: layer.id } : { kind: 'outside', path };
  }
  const parts = specifier.split('/');
  return { kind: 'package', name: specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]! };
}

interface Exception {
  file: string;
  /** Пакет, `id` слоя или `import(…)` для вычисляемого динамического импорта. */
  target: string;
  reason: string;
}

/** Единичные импорты против правил слоя — явно, с причиной (research R5). Ненужное исключение — ошибка. */
const EXCEPTIONS: readonly Exception[] = [
  {
    file: 'src/hooks/useLiveQuery.ts',
    target: 'dexie',
    reason: 'живые запросы: своя обёртка над liveQuery вместо dexie-react-hooks (Конституция V); единственный хук с Dexie',
  },
  {
    file: 'src/push/sync.ts',
    target: 'dexie',
    reason: 'startReminderSync подписывается liveQuery(reminderDataQuery) и отправляет расписание после изменения данных (018 R7)',
  },
];

/** Нарушения правил слоёв в файле `file` (путь от корня проекта) с текстом `text`; пусто — всё в порядке. */
function violations(file: string, text: string): string[] {
  const path = toPosix(file);
  const layer = layerOf(path);
  if (!layer) return [`${path}: файл вне таблицы слоёв — отнесите его к слою`];
  const excepted = (target: string) => EXCEPTIONS.some((e) => e.file === path && e.target === target);
  const out: string[] = [];
  for (const { specifier, line } of importsOf(text, path)) {
    const at = `${path}:${line}: '${specifier ?? 'import(…)'}' — `;
    const target = targetOf(path, specifier);
    if (target.kind === 'layer') {
      if (target.id !== layer.id && !layer.layers.includes(target.id) && !excepted(target.id)) {
        out.push(`${at}слой ${layer.id} не может импортировать слой ${target.id}`);
      }
    } else if (target.kind === 'package') {
      if (!layer.packages.includes(target.name) && !excepted(target.name)) {
        out.push(`${at}слою ${layer.id} не разрешён пакет ${target.name}`);
      }
    } else if (target.kind === 'outside') {
      out.push(`${at}импорт вне слоёв: ${target.path}`);
    } else if (!excepted('import(…)')) {
      out.push(`${at}динамический импорт с вычисляемым именем`);
    }
  }
  return out;
}

describe('распознавание импортов', () => {
  it('import … from', () => {
    expect(importsOf("import a from './a';\nimport { a, b } from '../x';")).toEqual([
      { specifier: './a', line: 1 },
      { specifier: '../x', line: 2 },
    ]);
  });

  it('многострочный импорт — строка слова import', () => {
    expect(importsOf("const z = 1;\nimport {\n  a,\n  b,\n} from '../x';")).toEqual([{ specifier: '../x', line: 2 }]);
  });

  it('импорт только типов', () => {
    expect(importsOf("import type { T } from '../t';\nimport { type T, u } from '../u';")).toEqual([
      { specifier: '../t', line: 1 },
      { specifier: '../u', line: 2 },
    ]);
  });

  it('импорт без привязок', () => {
    expect(importsOf("import './c.css';")).toEqual([{ specifier: './c.css', line: 1 }]);
  });

  it('повторный экспорт; экспорт без from — не импорт', () => {
    const text = "export { b } from '../b';\nexport * from '../s';\nexport type { T } from '../t';\nexport const x = 1;\nconst y = 2;\nexport { y };";
    expect(importsOf(text)).toEqual([
      { specifier: '../b', line: 1 },
      { specifier: '../s', line: 2 },
      { specifier: '../t', line: 3 },
    ]);
  });

  it('динамический импорт внутри функции', () => {
    expect(importsOf("async function f() {\n  return import('../d');\n}")).toEqual([{ specifier: '../d', line: 2 }]);
  });

  it('тип через import(…)', () => {
    expect(importsOf("type E = import('../e').E;")).toEqual([{ specifier: '../e', line: 1 }]);
  });

  it('require и import = require', () => {
    expect(importsOf("const r = require('../r');\nimport q = require('../q');")).toEqual([
      { specifier: '../r', line: 1 },
      { specifier: '../q', line: 2 },
    ]);
  });

  it('динамический импорт с вычисляемым именем — specifier null', () => {
    expect(importsOf('const a = import(name);\nconst b = import(`../${name}`);')).toEqual([
      { specifier: null, line: 1 },
      { specifier: null, line: 2 },
    ]);
  });

  it('шаблон без подстановок — имя модуля', () => {
    expect(importsOf('const a = import(`../a`);')).toEqual([{ specifier: '../a', line: 1 }]);
  });

  it('комментарии, строки, шаблоны, регулярные выражения и директивы — не импорт', () => {
    const text = [
      '/// <reference types="vite/client" />',
      "// import z from '../z'",
      "/* import y from '../y' */",
      `const s = "import w from '../w'";`,
      "const t = `export * from '../t'`;",
      "const re = /'/;",
      "const u = 'import(\"../u\")';",
    ].join('\n');
    expect(importsOf(text)).toEqual([]);
  });

  it('режим разбора — по расширению файла', () => {
    expect(importsOf("const id = <T>(x: T) => x;\nconst m = () => import('../d');", 'x.ts')).toEqual([
      { specifier: '../d', line: 2 },
    ]);
    expect(importsOf("const el = <div>{import('../e')}</div>;", 'x.tsx')).toEqual([{ specifier: '../e', line: 1 }]);
  });
});

describe('отнесение импорта', () => {
  it.each([
    ['src/storage/backup.ts', '../domain/dates', { kind: 'layer', id: 'domain' }],
    ['src/storage/migrations/index.ts', '../../domain/dayEntry', { kind: 'layer', id: 'domain' }],
    ['src/ui/screens/StatsScreen.tsx', '../components/DoctorReportButton', { kind: 'layer', id: 'ui' }],
    ['src/main.tsx', './ui/theme.css', { kind: 'layer', id: 'ui' }],
    ['src/main.tsx', './sw', { kind: 'layer', id: 'sw' }],
    ['src/ui/App.tsx', '../main', { kind: 'layer', id: 'main' }],
    ['worker/src/index.ts', './validate', { kind: 'layer', id: 'worker' }],
    ['worker/src/index.ts', '../../src/domain/dates', { kind: 'layer', id: 'domain' }],
    ['src/storage/db.ts', '../../package.json', { kind: 'outside', path: 'package.json' }],
    ['src/storage/db.ts', '../extra', { kind: 'outside', path: 'src/extra' }],
    ['src/ui/App.tsx', '/src/x', { kind: 'outside', path: '/src/x' }],
    ['src/domain/dates.ts', 'date-fns/locale', { kind: 'package', name: 'date-fns' }],
    ['src/main.tsx', 'react-dom/client', { kind: 'package', name: 'react-dom' }],
    ['src/ui/App.tsx', '@scope/name/sub', { kind: 'package', name: '@scope/name' }],
    ['src/ui/App.tsx', 'node:fs', { kind: 'package', name: 'node:fs' }],
    ['src/pwa/registerUpdates.ts', 'virtual:pwa-register', { kind: 'package', name: 'virtual:pwa-register' }],
    ['src/ui/App.tsx', null, { kind: 'computed' }],
  ] as const)('%s: %s', (file, specifier, expected) => {
    expect(targetOf(file, specifier)).toEqual(expected);
  });

  it('обратные косые в пути файла не влияют', () => {
    expect(targetOf(String.raw`src\storage\migrations\index.ts`, '../../domain/dayEntry')).toEqual(
      targetOf('src/storage/migrations/index.ts', '../../domain/dayEntry'),
    );
    expect(layerOf(String.raw`src\ui\App.tsx`)?.id).toBe('ui');
  });

  it('файл относится к слою по самому длинному пути; файлы верхнего уровня — по имени', () => {
    expect(layerOf('src/storage/migrations/index.ts')?.id).toBe('storage');
    expect(layerOf('src/main.tsx')?.id).toBe('main');
    expect(layerOf('src/sw.ts')?.id).toBe('sw');
    expect(layerOf('src/vite-env.d.ts')?.id).toBe('env');
    expect(layerOf('worker/src/webpush.ts')?.id).toBe('worker');
    expect(layerOf('src/extra.ts')).toBeUndefined();
    expect(layerOf('src/domainx/a.ts')).toBeUndefined();
  });
});

describe('правила слоёв', () => {
  // Прежние запреты src/domain/isolation.test.ts (react, react-dom, dexie, storage, ui, push, hooks) и новые
  // (report, pwa) — research R1.
  it.each([
    'react',
    'react-dom',
    'dexie',
    '../storage/repository',
    '../ui/App',
    '../push/sync',
    '../hooks/useToday',
    '../report/render',
    '../pwa/registerUpdates',
  ])('домену запрещён %s', (specifier) => {
    expect(violations('src/domain/x.ts', `import { x } from '${specifier}';`)).toHaveLength(1);
  });

  it.each(['date-fns', 'date-fns/locale', './dates'])('домену разрешён %s', (specifier) => {
    expect(violations('src/domain/x.ts', `import { x } from '${specifier}';`)).toEqual([]);
  });

  it('сообщение называет файл, строку, импорт и правило', () => {
    expect(violations('src/storage/x.ts', "import { App } from '../ui/App';")).toEqual([
      "src/storage/x.ts:1: '../ui/App' — слой storage не может импортировать слой ui",
    ]);
    expect(violations('src/ui/x.ts', "const a = 1;\nimport { format } from 'date-fns';")).toEqual([
      "src/ui/x.ts:2: 'date-fns' — слою ui не разрешён пакет date-fns",
    ]);
    expect(violations('src/report/x.ts', "import 'dexie';")).toEqual([
      "src/report/x.ts:1: 'dexie' — слою report не разрешён пакет dexie",
    ]);
    expect(violations('src/storage/x.ts', "import pkg from '../../package.json';")).toEqual([
      "src/storage/x.ts:1: '../../package.json' — импорт вне слоёв: package.json",
    ]);
    expect(violations('src/ui/x.ts', 'const m = import(name);')).toEqual([
      "src/ui/x.ts:1: 'import(…)' — динамический импорт с вычисляемым именем",
    ]);
    expect(violations('src/extra.ts', "import { a } from './domain/dates';")).toEqual([
      'src/extra.ts: файл вне таблицы слоёв — отнесите его к слою',
    ]);
  });

  it('импорт внутри своего слоя разрешён', () => {
    expect(violations('src/ui/screens/X.tsx', "import { A } from '../components/A';\nimport './x.css';")).toEqual([]);
    expect(violations('worker/src/index.ts', "import { v } from './validate';")).toEqual([]);
  });

  it('воркер не импортирует код приложения', () => {
    expect(violations('worker/src/index.ts', "import { toLocalDate } from '../../src/domain/dates';")).toEqual([
      "worker/src/index.ts:1: '../../src/domain/dates' — слой worker не может импортировать слой domain",
    ]);
  });

  it('исключение действует только в своём файле', () => {
    const dexie = "import { liveQuery } from 'dexie';";
    expect(violations('src/push/sync.ts', dexie)).toEqual([]);
    expect(violations('src/push/syncCore.ts', dexie)).toHaveLength(1);
    expect(violations('src/hooks/useLiveQuery.ts', dexie)).toEqual([]);
    expect(violations('src/hooks/useToday.ts', dexie)).toHaveLength(1);
  });

  it('импорт только типов — зависимость; разрешённое направление не нарушение', () => {
    expect(violations('src/ui/x.ts', "import type { X } from '../push/subscribe';")).toEqual([]);
    expect(violations('src/storage/x.ts', "import type { X } from '../push/subscribe';")).toHaveLength(1);
  });

  // Файлы верхнего уровня src (по итогам /speckit-analyze, C2).
  it('точка входа приложения', () => {
    expect(violations('src/main.tsx', "import Dexie from 'dexie';")).toEqual([
      "src/main.tsx:1: 'dexie' — слою main не разрешён пакет dexie",
    ]);
    expect(violations('src/main.tsx', "import './sw';")).toEqual([
      "src/main.tsx:1: './sw' — слой main не может импортировать слой sw",
    ]);
    const allowed = "import { a } from './storage/repository';\nimport { App } from './ui/App';\nimport { createRoot } from 'react-dom/client';";
    expect(violations('src/main.tsx', allowed)).toEqual([]);
  });

  it('service worker и объявления типов', () => {
    expect(violations('src/vite-env.d.ts', "import 'react';")).toHaveLength(1);
    expect(violations('src/sw.ts', "import { n } from './pwa/pushNotification';\nimport { p } from 'workbox-precaching';")).toEqual([]);
    expect(violations('src/sw.ts', "import { App } from './ui/App';")).toHaveLength(1);
  });
});

const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** Исходные файлы приложения и воркера без тестов, пути от корня проекта. */
const SOURCES = ['src', 'worker/src']
  .flatMap((dir) => (readdirSync(join(ROOT, dir), { recursive: true }) as string[]).map((f) => `${dir}/${toPosix(f)}`))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .sort();

describe('файлы и слои', () => {
  it('исходники найдены, тесты не проверяются', () => {
    expect(SOURCES).toEqual(
      expect.arrayContaining(['src/main.tsx', 'src/sw.ts', 'src/vite-env.d.ts', 'src/ui/testing.ts', 'worker/src/index.ts']),
    );
    expect(SOURCES.filter((f) => f.includes('.test.'))).toEqual([]);
  });

  it.each(LAYERS.map((l) => l.path))('в слое %s есть файлы', (path) => {
    expect(SOURCES.filter((f) => layerOf(f)?.path === path).length).toBeGreaterThan(0);
  });

  it.each(SOURCES)('%s — по правилам слоя', (file) => {
    expect(violations(file, read(file))).toEqual([]);
  });

  it.each(EXCEPTIONS.map((e) => [e.file, e.target] as const))('исключение %s → %s нужно', (file, target) => {
    const used = importsOf(read(file), file).some(({ specifier }) => {
      const t = targetOf(file, specifier);
      return (t.kind === 'package' && t.name === target) || (t.kind === 'layer' && t.id === target) || (t.kind === 'computed' && target === 'import(…)');
    });
    if (!used) expect.fail(`${file}: исключение ${target} больше не нужно — удалите его`);
  });
});

// Конституция IV: домен не читает часы — выражение прежнего src/domain/isolation.test.ts без изменений (R6).
const clockRead = /new\s+Date\(\s*\)|Date\.now\(/;

describe('домен не читает текущее время', () => {
  it.each(SOURCES.filter((f) => f.startsWith('src/domain/')))('%s', (file) => {
    expect(read(file)).not.toMatch(clockRead);
  });
});

// Карта архитектуры: разделы, существующие пути и те же слои, что в LAYERS (research R9).
const MAP_FILE = 'docs/architecture.md';
const map = existsSync(join(ROOT, MAP_FILE)) ? read(MAP_FILE) : '';
const mapLines = map.trimEnd().split(/\r?\n/);
const PROJECT_PATH = /^(src|docs|worker|specs|\.specify)\//;
const ROOT_FILES = new Set(['CLAUDE.md', 'README.md', 'package.json', 'vitest.config.ts', '.gitignore']);
/** Пути проекта в обратных кавычках; шаблоны (`*`, `…`, `<`, `{`) пропускаются. */
const mapPaths = [...new Set([...map.matchAll(/`([^`\r\n]+)`/g)].map((m) => m[1]!))].filter(
  (s) => (PROJECT_PATH.test(s) || ROOT_FILES.has(s)) && !/[*…<{]/.test(s),
);

describe('карта архитектуры', () => {
  it(`${MAP_FILE} есть и не длиннее 120 строк`, () => {
    expect(map, `нет ${MAP_FILE}`).not.toBe('');
    expect(mapLines.length).toBeLessThanOrEqual(120);
  });

  it.each([
    '## Слои',
    '## Пути данных',
    '## Правила корректности данных',
    '## Чек-листы',
    '### Добавить настройку',
    '### Добавить отметку дня',
    '### Добавить вид напоминания',
  ])('есть раздел «%s»', (heading) => {
    expect(mapLines).toContain(heading);
  });

  it('ссылается на чек-лист новой версии схемы', () => {
    expect(map).toContain('`src/storage/migrations/README.md`');
  });

  it('пути проекта упомянуты', () => {
    expect(mapPaths.length).toBeGreaterThan(0);
  });

  it.each(mapPaths)('путь %s существует, без номера строки', (path) => {
    expect(path).not.toMatch(/:\d+$/);
    expect(existsSync(join(ROOT, path))).toBe(true);
  });

  it('таблица «Слои» — те же слои, что в тесте', () => {
    const section = map.split(/^## /m).find((s) => s.startsWith('Слои')) ?? '';
    const rows = [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]!);
    expect(rows.sort()).toEqual(LAYERS.map((l) => l.path).sort());
  });
});
