import { useEffect, useState } from 'react';
import { INTENSITIES, SYMPTOMS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import { emptyDayEntry } from '../../domain/dayEntry';
import type { DayEntry, Intensity, LocalDate, SymptomId } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
  /** «Интенсивность самочувствия» включена (009 FR-016). */
  showIntensity: boolean;
}

type Levels = Partial<Record<SymptomId, Intensity>>;

/**
 * «Самочувствие»: несколько пунктов (FR-010; 004 FR-003). С 009 настроение — в отдельном листе;
 * при включённой интенсивности у каждого отмеченного пункта — «слабо / средне / сильно».
 */
export function SymptomPicker({ open, onClose, date, entry, showIntensity }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomId[]>([]);
  const [levels, setLevels] = useState<Levels>({});

  useEffect(() => {
    if (!open) return;
    setSymptoms(entry?.symptoms ?? []);
    setLevels(entry?.intensity ?? {});
  }, [open, entry]);

  const toggle = (id: SymptomId) => {
    if (symptoms.includes(id)) {
      setSymptoms(symptoms.filter((s) => s !== id));
      // Снятый пункт теряет и свою степень (009 US4, сценарий 3).
      const { [id]: _dropped, ...rest } = levels;
      setLevels(rest);
    } else {
      setSymptoms([...symptoms, id]);
    }
  };

  // Повторное нажатие на выбранную степень снимает её (009 FR-016).
  const setLevel = (id: SymptomId, level: Intensity) =>
    setLevels((cur) => {
      const { [id]: current, ...rest } = cur;
      return current === level ? rest : { ...rest, [id]: level };
    });

  const save = async () => {
    // Остальные поля записи сохраняются как есть. При выключенной интенсивности степени не меняются.
    await saveDayEntry({ ...(entry ?? emptyDayEntry(date)), symptoms, intensity: levels });
    onClose();
  };

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
                    aria-pressed={levels[s.id] === level.id}
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
      <button type="button" className="btn btn--primary" onClick={save}>
        Готово
      </button>
    </BottomSheet>
  );
}
