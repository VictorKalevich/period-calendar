import { useEffect, useState } from 'react';
import { MOODS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import { emptyDayEntry } from '../../domain/dayEntry';
import type { DayEntry, LocalDate, MoodId } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

/** Лист «Настроение» (009 FR-010–FR-012): несколько настроений или ни одного, без эмодзи. */
export function MoodPicker({ open, onClose, date, entry }: Props) {
  const [moods, setMoods] = useState<MoodId[]>([]);

  useEffect(() => {
    if (open) setMoods(entry?.moods ?? []);
  }, [open, entry]);

  const toggle = (id: MoodId) => setMoods((cur) => (cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id]));

  const save = async () => {
    // Остальные поля записи сохраняются как есть.
    await saveDayEntry({ ...(entry ?? emptyDayEntry(date)), moods });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Настроение · ${formatDayMonthRu(date)}`}>
      <fieldset className="chips">
        <legend className="visually-hidden">Настроение</legend>
        {MOODS.map((m) => (
          <button key={m.id} type="button" className="chip" aria-pressed={moods.includes(m.id)} onClick={() => toggle(m.id)}>
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
