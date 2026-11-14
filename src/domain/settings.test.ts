import { describe, expect, it } from 'vitest';
import { coerceSettings, extraSettingFields } from './settings';
import { DEFAULT_SETTINGS, type Settings } from './types';

// Фича 016: правила корректности настроек по полям (data-model.md, «Настройки»).

/** Отличается от DEFAULT_SETTINGS в каждом поле: видно, что подставлено запасное значение, а не умолчание. */
const FALLBACK: Settings = {
  defaultCycleLength: 33,
  defaultPeriodLength: 7,
  remindPeriod: false,
  remindOvulation: false,
  showWellbeing: true,
  showNotes: true,
  ovulationShiftEnabled: true,
  ovulationShift: 4,
  ovulationFromNextPeriod: true,
  remindMissedPeriod: false,
  showMood: true,
  showIntensity: true,
  showSex: true,
};

const BOOL = { valid: [true, false], invalid: ['true', 'false', 1, 0, null, undefined] };

const FIELDS: Record<keyof Settings, { valid: unknown[]; invalid: unknown[] }> = {
  defaultCycleLength: { valid: [21, 28, 45], invalid: [20, 46, 30.5, '30', NaN, Infinity, null, undefined, true] },
  defaultPeriodLength: { valid: [2, 5, 10], invalid: [1, 11, 4.5, '4', NaN, null] },
  ovulationShift: { valid: [-5, 0, 5], invalid: [-6, 6, 1.5, '2', NaN, null] },
  remindPeriod: BOOL,
  remindOvulation: BOOL,
  showWellbeing: BOOL,
  showNotes: BOOL,
  ovulationShiftEnabled: BOOL,
  ovulationFromNextPeriod: BOOL,
  remindMissedPeriod: BOOL,
  showMood: BOOL,
  showIntensity: BOOL,
  showSex: BOOL,
};

const keys = Object.keys(FIELDS) as Array<keyof Settings>;
const cases = (kind: 'valid' | 'invalid') => keys.flatMap((key) => FIELDS[key][kind].map((value) => [key, value] as const));

describe('coerceSettings', () => {
  it('таблица покрывает все 13 полей настроек', () => {
    expect([...keys].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(keys).toHaveLength(13);
  });

  it.each(cases('valid'))('%s = %j — корректно, берётся из входа', (key, value) => {
    const out = coerceSettings({ ...FALLBACK, [key]: value }, FALLBACK);
    expect(out).toEqual({ ...FALLBACK, [key]: value });
  });

  it.each(cases('invalid'))('%s = %j — некорректно, берётся запасное', (key, value) => {
    const out = coerceSettings({ ...DEFAULT_SETTINGS, [key]: value }, FALLBACK);
    expect(out[key]).toBe(FALLBACK[key]);
    for (const other of keys.filter((k) => k !== key)) expect(out[other]).toBe(DEFAULT_SETTINGS[other]);
  });

  it('все поля корректны → вход целиком', () => {
    expect(coerceSettings({ ...DEFAULT_SETTINGS }, FALLBACK)).toEqual(DEFAULT_SETTINGS);
  });

  it.each(keys)('поля %s нет во входе → запасное', (key) => {
    const raw: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete raw[key];
    expect(coerceSettings(raw, FALLBACK)).toEqual({ ...DEFAULT_SETTINGS, [key]: FALLBACK[key] });
  });

  it.each([undefined, null, 'x', 5, true, [], [1, 2]])('вход %j не объект → копия запасного', (raw) => {
    const out = coerceSettings(raw, FALLBACK);
    expect(out).toEqual(FALLBACK);
    expect(out).not.toBe(FALLBACK);
    const fromDefaults = coerceSettings(raw, DEFAULT_SETTINGS);
    expect(fromDefaults).toEqual(DEFAULT_SETTINGS);
    expect(fromDefaults).not.toBe(DEFAULT_SETTINGS);
    expect(Object.isFrozen(fromDefaults)).toBe(false);
  });

  it('неизвестные поля входа отбрасываются, неизвестные поля запасного сохраняются в его порядке', () => {
    const fallback = { ...FALLBACK, deviceExtra: 'x' } as Settings;
    const out = coerceSettings({ ...DEFAULT_SETTINGS, futureA: 1 }, fallback);
    expect(out).toEqual({ ...DEFAULT_SETTINGS, deviceExtra: 'x' });
    expect(out).not.toHaveProperty('futureA');
    expect(Object.keys(out)).toEqual(Object.keys(fallback));
  });

  it('не меняет вход и запасное', () => {
    const raw = Object.freeze({ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc', futureA: 1 });
    const fallback = Object.freeze({ ...FALLBACK });
    const out = coerceSettings(raw, fallback);
    expect(out.defaultCycleLength).toBe(33);
    expect(raw).toEqual({ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc', futureA: 1 });
    expect(fallback).toEqual(FALLBACK);
  });
});

describe('extraSettingFields', () => {
  it('только неизвестные поля, в порядке входа', () => {
    const out = extraSettingFields({ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc', b: 2, a: 1 });
    expect(out).toEqual({ b: 2, a: 1 });
    expect(Object.keys(out)).toEqual(['b', 'a']);
  });

  it.each([undefined, null, 'x', [1], {}])('%j → нет неизвестных полей', (raw) => {
    expect(extraSettingFields(raw)).toEqual({});
  });

  it('ключ __proto__ из данных не меняет прототип', () => {
    const out = extraSettingFields(JSON.parse('{"__proto__": {"polluted": 1}, "x": 1}'));
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out.x).toBe(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
