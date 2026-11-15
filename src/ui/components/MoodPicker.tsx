import { useEffect, useState } from 'react';
import { MOODS } from '../../domain/catalog';
import { formatDayMonthRu } from '../../domain/dates';
import type { DayEntry, LocalDate, MoodId } from '../../domain/types';
import { updateDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';
import { SaveError, useSaveError } from './SaveError';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

/** Лист «Настроение» (009 FR-010–FR-012): несколько настроений или ни одного, без эмодзи. */
export function MoodPicker({ open, onClose, date, entry }: Props) {
  const [moods, setMoods] = useState<MoodId[]>([]);
  const saveError = useSaveError();

  useEffect(() => {
    if (!open) return;
    setMoods(entry?.moods ?? []);
    saveError.reset();
  }, [open, entry]);

  const toggle = (id: MoodId) => setMoods((cur) => (cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id]));

  const save = async () => {
    // Меняются только настроения, поверх записи в базе (015); остальные поля — как есть.
    // Отказ записи — лист открыт, выбор цел (014).
    if (await saveError.save(() => updateDayEntry(date, { moods }))) onClose();
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
      <SaveError shown={saveError.failed} />
      <button type="button" className="btn btn--primary" onClick={save}>
        Готово
      </button>
    </BottomSheet>
  );
}
