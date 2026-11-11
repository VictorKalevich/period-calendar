import { useEffect, useState } from 'react';
import { MOODS, SYMPTOMS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import { emptyDayEntry } from '../../domain/dayEntry';
import type { DayEntry, LocalDate, MoodId, SymptomId } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

const toggleIn = <T,>(list: T[], id: T) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** «Самочувствие»: симптомы и настроения (несколько) — FR-010, FR-011; 004 FR-003; 009. */
export function SymptomPicker({ open, onClose, date, entry }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomId[]>([]);
  const [moods, setMoods] = useState<MoodId[]>([]);

  useEffect(() => {
    if (!open) return;
    setSymptoms(entry?.symptoms ?? []);
    setMoods(entry?.moods ?? []);
  }, [open, entry]);

  const save = async () => {
    // Остальные поля записи (отметка секса, заметка, степени) сохраняются как есть.
    await saveDayEntry({ ...(entry ?? emptyDayEntry(date)), symptoms, moods });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Самочувствие · ${formatDayMonthRu(date)}`}>
      <fieldset className="chips">
        <legend className="t-caption chips__legend">Самочувствие</legend>
        {SYMPTOMS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={symptoms.includes(s.id)}
            onClick={() => setSymptoms((cur) => toggleIn(cur, s.id))}
          >
            {s.label}
          </button>
        ))}
      </fieldset>
      <fieldset className="chips">
        <legend className="t-caption chips__legend">Настроение</legend>
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="chip"
            aria-pressed={moods.includes(m.id)}
            onClick={() => setMoods((cur) => toggleIn(cur, m.id))}
          >
            {m.label}
          </button>
        ))}
      </fieldset>
      <button type="button" className="btn btn--primary" onClick={save}>
        Готово
      </button>
    </BottomSheet>
  );
}
