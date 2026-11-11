import { useEffect, useState } from 'react';
import { SYMPTOMS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import { emptyDayEntry } from '../../domain/dayEntry';
import type { DayEntry, LocalDate, SymptomId } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

/** «Самочувствие»: несколько пунктов (FR-010; 004 FR-003). С 009 настроение — в отдельном листе. */
export function SymptomPicker({ open, onClose, date, entry }: Props) {
  const [symptoms, setSymptoms] = useState<SymptomId[]>([]);

  useEffect(() => {
    if (open) setSymptoms(entry?.symptoms ?? []);
  }, [open, entry]);

  const toggle = (id: SymptomId) =>
    setSymptoms((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id]));

  const save = async () => {
    // Остальные поля записи сохраняются как есть; степени снятых пунктов отбросит сохранение.
    await saveDayEntry({ ...(entry ?? emptyDayEntry(date)), symptoms });
    onClose();
  };

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
      <button type="button" className="btn btn--primary" onClick={save}>
        Готово
      </button>
    </BottomSheet>
  );
}
