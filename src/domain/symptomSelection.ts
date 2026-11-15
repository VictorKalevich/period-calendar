import { DEFAULT_INTENSITY, withDefaultIntensity } from './dayEntry';
import type { DayEntry, Intensity, SymptomId } from './types';

/**
 * Состояние листа «Самочувствие» (FR-010; 004 FR-003): отмеченные пункты в порядке отметки и их степени.
 * При включённой интенсивности у каждого отмеченного пункта ровно одна степень (012).
 */
export interface SymptomSelection {
  symptoms: SymptomId[];
  intensity: Partial<Record<SymptomId, Intensity>>;
}

/** Состояние при открытии листа. У старых пунктов без степени при включённой интенсивности — «средне» (012 FR-006). */
export function initialSymptomSelection(entry: DayEntry | undefined, showIntensity: boolean): SymptomSelection {
  const symptoms = entry?.symptoms ?? [];
  const intensity = entry?.intensity ?? {};
  return { symptoms, intensity: showIntensity ? withDefaultIntensity(symptoms, intensity) : intensity };
}

/**
 * Отметить или снять пункт. Снятый пункт теряет и свою степень (009 US4, сценарий 3). Новый пункт встаёт в конец
 * и сразу получает «средне»; при выключенной интенсивности степень не ставится (012).
 */
export function toggleSymptom(sel: SymptomSelection, id: SymptomId, showIntensity: boolean): SymptomSelection {
  if (sel.symptoms.includes(id)) {
    const { [id]: _dropped, ...rest } = sel.intensity;
    return { symptoms: sel.symptoms.filter((s) => s !== id), intensity: rest };
  }
  return {
    symptoms: [...sel.symptoms, id],
    intensity: showIntensity ? { ...sel.intensity, [id]: DEFAULT_INTENSITY } : sel.intensity,
  };
}

/** Степень — как переключатель-радио: всегда одна, повторный выбор её не снимает (012 FR-006). */
export function setSymptomIntensity(sel: SymptomSelection, id: SymptomId, level: Intensity): SymptomSelection {
  return { symptoms: sel.symptoms, intensity: { ...sel.intensity, [id]: level } };
}
