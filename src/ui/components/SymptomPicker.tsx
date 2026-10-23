import { useEffect, useState } from 'react';
import { MOODS, SYMPTOMS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import type { DayEntry, LocalDate, MoodId, SymptomId } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

/** «Самочувствие»: симптомы (несколько) и настроение (одно) — FR-010, FR-011; 004 FR-003. */
export function SymptomPicker({ open, onClose, date, entry }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomId[]>([]);
  const [mood, setMood] = useState<MoodId | null>(null);

  useEffect(() => {
    if (!open) return;
    setSymptoms(entry?.symptoms ?? []);
    setMood(entry?.mood ?? null);
  }, [open, entry]);

  const toggle = (id: SymptomId) =>
    setSymptoms((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));

  const save = async () => {
    await saveDayEntry({ date, symptoms, mood, note: entry?.note ?? '' });
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
            onClick={() => toggle(s.id)}
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
            aria-pressed={mood === m.id}
            onClick={() => setMood((cur) => (cur === m.id ? null : m.id))}
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
