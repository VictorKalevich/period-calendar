import { describe, expect, it } from 'vitest';
import { migrateData, migrations, type MigrationData } from './index';

// Реальная миграция v1 → v2 (фича 004): переключатели «Самочувствие» и «Заметки».
describe('migrations[1] (v1 → v2)', () => {
  const v1 = {
    periods: [],
    days: [],
    settings: { defaultCycleLength: 30, defaultPeriodLength: 4, remindPeriod: true, remindOvulation: false },
  };

  it('adds both switches as off when missing and keeps other fields', () => {
    expect(migrations[1]!(v1)).toEqual({
      ...v1,
      settings: { ...v1.settings, showWellbeing: false, showNotes: false },
    });
  });

  it('keeps explicit values and is idempotent', () => {
    const withValues = { ...v1, settings: { ...v1.settings, showWellbeing: true, showNotes: false } };
    expect(migrations[1]!(withValues)).toEqual(withValues);
    const once = migrations[1]!(v1);
    expect(migrations[1]!(once)).toEqual(once);
  });

  it('leaves data without settings untouched', () => {
    expect(migrations[1]!({ periods: [] })).toEqual({ periods: [] });
  });
});

// Реальная миграция v2 → v3 (фича 005): личный сдвиг овуляции.
describe('migrations[2] (v2 → v3)', () => {
  const v2 = {
    periods: [],
    settings: { defaultCycleLength: 28, defaultPeriodLength: 5, remindPeriod: true, remindOvulation: true, showWellbeing: true, showNotes: false },
  };

  it('adds the shift as off and 0 when missing', () => {
    expect(migrations[2]!(v2)).toEqual({
      ...v2,
      settings: { ...v2.settings, ovulationShiftEnabled: false, ovulationShift: 0 },
    });
  });

  it('keeps explicit values and is idempotent', () => {
    const withValues = { ...v2, settings: { ...v2.settings, ovulationShiftEnabled: true, ovulationShift: -2 } };
    expect(migrations[2]!(withValues)).toEqual(withValues);
    const once = migrations[2]!(v2);
    expect(migrations[2]!(once)).toEqual(once);
  });

  it('migrates a v1 copy through both steps', () => {
    const v1 = { settings: { defaultCycleLength: 28, defaultPeriodLength: 5, remindPeriod: true, remindOvulation: true } };
    expect(migrateData(v1, 1, 3).settings).toMatchObject({
      showWellbeing: false,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
    });
  });
});

// Реальная миграция v3 → v4 (фича 006): расчёт овуляции «от следующей менструации».
describe('migrations[3] (v3 → v4)', () => {
  const v3 = {
    periods: [],
    settings: {
      defaultCycleLength: 28,
      defaultPeriodLength: 5,
      remindPeriod: true,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: true,
      ovulationShiftEnabled: true,
      ovulationShift: 2,
    },
  };

  it('adds the mode as off when missing and keeps other fields', () => {
    expect(migrations[3]!(v3)).toEqual({ ...v3, settings: { ...v3.settings, ovulationFromNextPeriod: false } });
  });

  it('keeps an explicit value and is idempotent', () => {
    const withValue = { ...v3, settings: { ...v3.settings, ovulationFromNextPeriod: true } };
    expect(migrations[3]!(withValue)).toEqual(withValue);
    const once = migrations[3]!(v3);
    expect(migrations[3]!(once)).toEqual(once);
  });

  it('leaves data without settings untouched', () => {
    expect(migrations[3]!({ periods: [] })).toEqual({ periods: [] });
  });

  it('migrates a v1 copy through all steps', () => {
    const v1 = { settings: { defaultCycleLength: 28, defaultPeriodLength: 5, remindPeriod: true, remindOvulation: true } };
    expect(migrateData(v1, 1, 4).settings).toMatchObject({
      showWellbeing: false,
      showNotes: false,
      ovulationShiftEnabled: false,
      ovulationShift: 0,
      ovulationFromNextPeriod: false,
    });
  });
});

// Механизм миграций для будущих версий схемы: проверяется на вымышленных миграциях v1 → v2 → v3.
const registry: Record<number, (d: MigrationData) => MigrationData> = {
  1: (d) => ({ ...d, renamed: d.old ?? d.renamed, old: undefined }),
  2: (d) => ({ ...d, steps: [...((d.steps as string[] | undefined) ?? []), 'v2→v3'] }),
};

describe('migrateData', () => {
  it('returns data unchanged when already current', () => {
    const data = { a: 1 };
    expect(migrateData(data, 3, 3, registry)).toEqual(data);
  });

  it('applies migrations in order', () => {
    expect(migrateData({ old: 'x' }, 1, 3, registry)).toEqual({ renamed: 'x', old: undefined, steps: ['v2→v3'] });
    expect(migrateData({ renamed: 'y' }, 2, 3, registry)).toEqual({ renamed: 'y', steps: ['v2→v3'] });
  });

  it('preserves unknown fields', () => {
    expect(migrateData({ old: 'x', extra: { deep: true } }, 1, 2, registry).extra).toEqual({ deep: true });
  });

  it('is idempotent for already-migrated data', () => {
    const once = migrateData({ old: 'x' }, 1, 2, registry);
    expect(migrateData(once, 2, 2, registry)).toEqual(once);
  });

  it('fails loudly when a migration step is missing', () => {
    expect(() => migrateData({}, 0, 2, registry)).toThrow(/0/);
  });

  it('refuses to downgrade', () => {
    expect(() => migrateData({}, 3, 2, registry)).toThrow();
  });
});
