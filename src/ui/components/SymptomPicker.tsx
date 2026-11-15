import { useEffect, useState } from 'react';
import { INTENSITIES, SYMPTOMS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import {
  initialSymptomSelection,
  setSymptomIntensity,
  toggleSymptom,
  type SymptomSelection,
} from '../../domain/symptomSelection';
import type { DayEntry, Intensity, LocalDate, SymptomId } from '../../domain/types';
import { updateDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';
import { SaveError, useSaveError } from './SaveError';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
  /** «Интенсивность самочувствия» включена (009 FR-016). */
  showIntensity: boolean;
}

/**
 * «Самочувствие»: несколько пунктов (FR-010; 004 FR-003). С 009 настроение — в отдельном листе;
 * при включённой интенсивности у каждого отмеченного пункта ровно одна степень, по умолчанию «средне» (012).
 * Переходы состояния — чистые функции домена (`domain/symptomSelection.ts`, 019).
 */
export function SymptomPicker({ open, onClose, date, entry, showIntensity }: Props) {
  const [selection, setSelection] = useState<SymptomSelection>({ symptoms: [], intensity: {} });
  const saveError = useSaveError();

  useEffect(() => {
    if (!open) return;
    saveError.reset();
    setSelection(initialSymptomSelection(entry, showIntensity));
  }, [open, entry, showIntensity]);

  const toggle = (id: SymptomId) => setSelection((cur) => toggleSymptom(cur, id, showIntensity));

  const setLevel = (id: SymptomId, level: Intensity) => setSelection((cur) => setSymptomIntensity(cur, id, level));

  const save = async () => {
    // Меняются только пункты и степени, поверх записи в базе (015); остальные поля — как есть.
    // При выключенной интенсивности степени не меняются. Отказ записи — лист открыт, пункты и степени целы (014).
    const patch = { symptoms: selection.symptoms, intensity: selection.intensity };
    if (await saveError.save(() => updateDayEntry(date, patch))) onClose();
  };

  const { symptoms, intensity } = selection;
  const selected = SYMPTOMS.filter((s) => symptoms.includes(s.id));

  return (
    <BottomSheet open={open} onClose={onClose} title={`Самочувствие · ${formatDayMonthRu(date)}`}>
      <fieldset className="chips">
        <legend className="visually-hidden">Самочувствие</legend>
        {SYMPTOMS.map((s) => (
          <button key={s.id} type="button" className="chip" aria-pressed={symptoms.includes(s.id)} onClick={() => toggle(s.id)}>
            {s.label}
          </button>
        ))}
      </fieldset>
      {showIntensity && selected.length > 0 && (
        <div className="intensity">
          <p className="t-caption chips__legend">Интенсивность</p>
          {selected.map((s) => (
            <fieldset key={s.id} className="intensity__row">
              <legend className="intensity__label">{s.label}</legend>
              <div className="intensity__segments">
                {INTENSITIES.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    className="segment"
                    aria-pressed={intensity[s.id] === level.id}
                    onClick={() => setLevel(s.id, level.id)}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      <SaveError shown={saveError.failed} />
      <button type="button" className="btn btn--primary" onClick={save}>
        Готово
      </button>
    </BottomSheet>
  );
}
