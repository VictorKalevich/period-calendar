import { describe, expect, it } from 'vitest';
import { emptyDayEntry } from './dayEntry';
import {
  initialSymptomSelection,
  setSymptomIntensity,
  toggleSymptom,
  type SymptomSelection,
} from './symptomSelection';
import type { DayEntry, LocalDate } from './types';

// Фича 019 (FR-006; research R6; data-model «SymptomSelection»): состояние листа «Самочувствие» — чистые
// переходы. Правила прежние: снятый пункт теряет степень (009 US4, сц. 3), новый пункт и пункты без степени
// получают «средне» при включённой интенсивности (012 FR-006).

const DAY = '2026-11-10' as LocalDate;

/** Глубокая заморозка: переход не должен менять вход. */
function frozen(sel: SymptomSelection): SymptomSelection {
  Object.freeze(sel.symptoms);
  Object.freeze(sel.intensity);
  return Object.freeze(sel);
}

const sel = (symptoms: SymptomSelection['symptoms'], intensity: SymptomSelection['intensity'] = {}) =>
  frozen({ symptoms: [...symptoms], intensity: { ...intensity } });

const entry = (patch: Partial<DayEntry>): DayEntry => {
  const e = { ...emptyDayEntry(DAY), ...patch };
  Object.freeze(e.symptoms);
  Object.freeze(e.intensity);
  return Object.freeze(e);
};

describe('initialSymptomSelection', () => {
  it.each([true, false])('записи нет (интенсивность %s) — ничего не отмечено', (showIntensity) => {
    expect(initialSymptomSelection(undefined, showIntensity)).toEqual({ symptoms: [], intensity: {} });
  });

  it('с интенсивностью: у пунктов без степени — «средне», степени неотмеченных отброшены', () => {
    const e = entry({ symptoms: ['headache', 'nausea'], intensity: { headache: 'severe', cramps: 'mild' } });
    expect(initialSymptomSelection(e, true)).toEqual({
      symptoms: ['headache', 'nausea'],
      intensity: { headache: 'severe', nausea: 'moderate' },
    });
  });

  it('без интенсивности: степени — как в записи', () => {
    const e = entry({ symptoms: ['headache', 'nausea'], intensity: { headache: 'severe', cramps: 'mild' } });
    expect(initialSymptomSelection(e, false)).toEqual({
      symptoms: ['headache', 'nausea'],
      intensity: { headache: 'severe', cramps: 'mild' },
    });
  });
});

describe('toggleSymptom', () => {
  it('с интенсивностью: новый пункт — в конец и «средне»', () => {
    expect(toggleSymptom(sel(['headache'], { headache: 'severe' }), 'nausea', true)).toEqual({
      symptoms: ['headache', 'nausea'],
      intensity: { headache: 'severe', nausea: 'moderate' },
    });
  });

  it('без интенсивности: новый пункт — в конец, степени не меняются', () => {
    expect(toggleSymptom(sel(['headache'], { headache: 'severe' }), 'cramps', false)).toEqual({
      symptoms: ['headache', 'cramps'],
      intensity: { headache: 'severe' },
    });
  });

  it.each([true, false])('снятие (интенсивность %s): пункт и его степень пропадают, остальные целы', (showIntensity) => {
    expect(toggleSymptom(sel(['headache', 'nausea'], { headache: 'severe', nausea: 'mild' }), 'headache', showIntensity)).toEqual({
      symptoms: ['nausea'],
      intensity: { nausea: 'mild' },
    });
  });

  it('снятие пункта без степени', () => {
    expect(toggleSymptom(sel(['headache', 'nausea'], { nausea: 'mild' }), 'headache', false)).toEqual({
      symptoms: ['nausea'],
      intensity: { nausea: 'mild' },
    });
  });

  it('снятый и снова отмеченный пункт получает «средне», а не прежнюю степень', () => {
    const off = toggleSymptom(sel(['headache'], { headache: 'severe' }), 'headache', true);
    expect(toggleSymptom(frozen(off), 'headache', true)).toEqual({ symptoms: ['headache'], intensity: { headache: 'moderate' } });
  });
});

describe('setSymptomIntensity', () => {
  it('ставит степень пункту, пункты не меняются', () => {
    expect(setSymptomIntensity(sel(['headache', 'nausea'], { headache: 'moderate', nausea: 'mild' }), 'nausea', 'severe')).toEqual({
      symptoms: ['headache', 'nausea'],
      intensity: { headache: 'moderate', nausea: 'severe' },
    });
  });

  it('повторный выбор той же степени её не снимает', () => {
    const once = setSymptomIntensity(sel(['nausea'], { nausea: 'mild' }), 'nausea', 'severe');
    expect(setSymptomIntensity(frozen(once), 'nausea', 'severe')).toEqual({ symptoms: ['nausea'], intensity: { nausea: 'severe' } });
  });
});
