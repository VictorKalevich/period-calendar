import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackup } from './backup';
import { DEFAULT_SETTINGS, type Settings } from '../domain/types';

// Фича 016: характеризация импорта до переноса правил в домен (research R8). Тексты ошибок — символ в
// символ; backup.test.ts для повреждённых месячных проверяет только префикс.

type RawPeriod = Record<string, unknown>;

const P = 'Файл резервной копии повреждён: ';

function file(periods: unknown = [{ id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false }], settings: unknown = { ...DEFAULT_SETTINGS }) {
  return { format: BACKUP_FORMAT, schemaVersion: 6, exportedAt: '2026-11-14T10:00:00.000Z', data: { periods, days: [], settings } };
}

const withPeriod = (patch: RawPeriod, drop: string[] = []): RawPeriod[] => {
  const p: RawPeriod = { id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false, ...patch };
  for (const key of drop) delete p[key];
  return [p];
};

const parse = (f: unknown, current?: Settings) => parseBackup(JSON.stringify(f), current);

function err(f: unknown): string | null {
  const r = parse(f);
  return r.ok ? null : r.error;
}

describe('импорт месячных — тексты ошибок как раньше', () => {
  it('нет списка месячных', () => {
    expect(err(file('x'))).toBe(P + 'нет списка месячных');
    const noPeriods = file() as { data: Record<string, unknown> };
    delete noPeriods.data.periods;
    expect(err(noPeriods)).toBe(P + 'нет списка месячных');
  });

  it.each([null, [1], 's'])('запись месячных %j — не объект', (record) => {
    expect(err(file([record]))).toBe(P + 'запись месячных не объект');
  });

  it('некорректный или повторный id', () => {
    expect(err(file(withPeriod({ id: 5 })))).toBe(P + 'некорректный или повторный id: 5');
    expect(err(file(withPeriod({ id: '' })))).toBe(P + 'некорректный или повторный id: ');
    expect(err(file(withPeriod({}, ['id'])))).toBe(P + 'некорректный или повторный id: undefined');
    const twice = [...withPeriod({}), { id: 'x', start: '2026-09-01', end: null, endEstimated: false }];
    expect(err(file(twice))).toBe(P + 'некорректный или повторный id: x');
  });

  it('некорректная дата начала', () => {
    expect(err(file(withPeriod({ start: '2026-02-30' })))).toBe(P + 'некорректная дата начала: 2026-02-30');
    expect(err(file(withPeriod({}, ['start'])))).toBe(P + 'некорректная дата начала: undefined');
  });

  it('некорректная дата конца', () => {
    expect(err(file(withPeriod({ end: '2026-13-01' })))).toBe(P + 'некорректная дата конца: 2026-13-01');
    expect(err(file(withPeriod({}, ['end'])))).toBe(P + 'некорректная дата конца: undefined');
  });

  it('нет признака endEstimated', () => {
    expect(err(file(withPeriod({}, ['endEstimated'])))).toBe(P + 'нет признака endEstimated');
    expect(err(file(withPeriod({ endEstimated: 'no' })))).toBe(P + 'нет признака endEstimated');
  });

  it('конец раньше начала', () => {
    expect(err(file(withPeriod({ end: '2026-07-30' })))).toBe(P + 'конец раньше начала: 2026-08-01');
  });

  it('месячные длиннее 15 дней; ровно 15 — можно', () => {
    expect(err(file(withPeriod({ end: '2026-08-16' })))).toBe(P + 'месячные длиннее 15 дней: 2026-08-01');
    expect(err(file(withPeriod({ end: '2026-08-15' })))).toBeNull();
  });

  it('пересечение, которое нельзя объединить', () => {
    const periods = [
      { id: 'x', start: '2026-08-01', end: '2026-08-10', endEstimated: false },
      { id: 'y', start: '2026-08-08', end: '2026-08-17', endEstimated: false },
    ];
    expect(err(file(periods))).toBe(P + 'месячные пересекаются: 2026-08-01 и 2026-08-08');
  });

  it('соприкосновение без объединения (больше 15 дней) — не ошибка', () => {
    const periods = [
      { id: 'x', start: '2026-08-01', end: '2026-08-10', endEstimated: false },
      { id: 'y', start: '2026-08-11', end: '2026-08-20', endEstimated: false },
    ];
    const r = parse(file(periods));
    expect(r.ok && r.value.periods).toHaveLength(2);
  });

  it('первая ошибка — по порядку записей и проверок', () => {
    const startFirst = [
      { id: 'a', start: '2026-02-30', end: null, endEstimated: false },
      { id: 5, start: '2026-08-01', end: null, endEstimated: false },
    ];
    expect(err(file(startFirst))).toBe(P + 'некорректная дата начала: 2026-02-30');
    expect(err(file([{ id: 5, start: 'плохо', end: null, endEstimated: false }]))).toBe(P + 'некорректный или повторный id: 5');
    expect(err(file([{ id: 'a', start: '2026-08-01', end: '2026-07-30', endEstimated: 'no' }]))).toBe(P + 'нет признака endEstimated');
    const overlapThenBad = [
      { id: 'x', start: '2026-08-01', end: '2026-08-10', endEstimated: false },
      { id: 'y', start: '2026-08-08', end: '2026-08-17', endEstimated: false },
      { id: 'z', start: '2026-02-30', end: null, endEstimated: false },
    ];
    expect(err(file(overlapThenBad))).toBe(P + 'некорректная дата начала: 2026-02-30');
  });

  it('лишние поля у записи месячных отбрасываются', () => {
    const r = parse(file(withPeriod({ color: 'red' })));
    expect(r.ok && r.value.periods).toEqual([{ id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false }]);
  });
});

describe('импорт настроек — как раньше', () => {
  it('неизвестное поле файла отбрасывается, неизвестное поле устройства сохраняется', () => {
    const device = { ...DEFAULT_SETTINGS, defaultCycleLength: 33, deviceExtra: 'x' } as Settings;
    const r = parse(file(undefined, { ...DEFAULT_SETTINGS, defaultCycleLength: 30, futureField: 1 }), device);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.settings).toEqual({ ...device, defaultCycleLength: 30 });
    expect(r.value.settings).not.toHaveProperty('futureField');
    expect(Object.keys(r.value.settings)).toEqual(Object.keys(device));
  });

  const device = { ...DEFAULT_SETTINGS, defaultCycleLength: 33, defaultPeriodLength: 7, ovulationShift: 4 };

  it.each([
    ['defaultCycleLength', 21],
    ['defaultCycleLength', 45],
    ['defaultPeriodLength', 2],
    ['defaultPeriodLength', 10],
    ['ovulationShift', -5],
    ['ovulationShift', 5],
  ] as const)('%s = %d (граница) принимается', (key, value) => {
    const r = parse(file(undefined, { ...DEFAULT_SETTINGS, [key]: value }), device);
    expect(r.ok && r.value.settings[key]).toBe(value);
  });

  it.each([
    ['defaultCycleLength', 20],
    ['defaultCycleLength', 46],
    ['defaultPeriodLength', 1],
    ['defaultPeriodLength', 11],
    ['ovulationShift', -6],
    ['ovulationShift', 6],
  ] as const)('%s = %d (за границей) → значение устройства', (key, value) => {
    const r = parse(file(undefined, { ...DEFAULT_SETTINGS, [key]: value }), device);
    expect(r.ok && r.value.settings[key]).toBe(device[key]);
  });
});
