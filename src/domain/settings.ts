import { isObject } from './guards';
import { CYCLE_LENGTH_RANGE, OVULATION_SHIFT_RANGE, PERIOD_LENGTH_RANGE, type Settings } from './types';

// Правила корректности настроек по полям (фича 016, specs/016-domain-validation/data-model.md).
// Применяются при чтении из базы и при импорте резервной копии.

const isIntIn = (v: unknown, r: { min: number; max: number }) => Number.isInteger(v) && (v as number) >= r.min && (v as number) <= r.max;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Правило для каждого поля; новая настройка без правила не соберётся. */
const SETTING_RULES: { readonly [K in keyof Settings]: (v: unknown) => boolean } = {
  defaultCycleLength: (v) => isIntIn(v, CYCLE_LENGTH_RANGE),
  defaultPeriodLength: (v) => isIntIn(v, PERIOD_LENGTH_RANGE),
  remindPeriod: isBool,
  remindOvulation: isBool,
  showWellbeing: isBool,
  showNotes: isBool,
  ovulationShiftEnabled: isBool,
  ovulationShift: (v) => isIntIn(v, OVULATION_SHIFT_RANGE),
  ovulationFromNextPeriod: isBool,
  remindMissedPeriod: isBool,
  showMood: isBool,
  showIntensity: isBool,
  showSex: isBool,
};

const SETTING_KEYS = Object.keys(SETTING_RULES) as Array<keyof Settings>;

/**
 * Приводит значение к корректным настройкам (009 FR-005): каждое известное поле — из `raw`, если оно
 * корректно, иначе из `fallback`. Неизвестные поля `raw` отбрасываются, неизвестные поля `fallback`
 * сохраняются. Не объект — копия `fallback`. Всегда новый объект; входы не меняются.
 */
export function coerceSettings(raw: unknown, fallback: Readonly<Settings>): Settings {
  const out: Record<string, unknown> = { ...fallback };
  if (!isObject(raw)) return out as unknown as Settings;
  for (const key of SETTING_KEYS) {
    if (SETTING_RULES[key](raw[key])) out[key] = raw[key];
  }
  return out as unknown as Settings;
}

/** Собственные поля `raw`, которых нет в `Settings`, в порядке `raw`; не объект — `{}`. */
export function extraSettingFields(raw: unknown): Record<string, unknown> {
  if (!isObject(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !Object.hasOwn(SETTING_RULES, key)));
}
