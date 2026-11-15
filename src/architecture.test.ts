import { posix } from 'node:path';
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
