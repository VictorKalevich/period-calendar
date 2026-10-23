import { useEffect, useState } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import { MAX_NOTE_LENGTH, type DayEntry, type LocalDate } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

/** Заметка к дню (FR-012): до 1000 символов. */
export function NoteEditor({ open, onClose, date, entry }: Props) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText(entry?.note ?? '');
  }, [open, entry]);

  const persist = async (note: string) => {
    await saveDayEntry({ date, symptoms: entry?.symptoms ?? [], mood: entry?.mood ?? null, note });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Заметка · ${formatDayMonthRu(date)}`}>
      <label className="note">
        <span className="visually-hidden">Текст заметки</span>
        <textarea
          className="note__input"
          value={text}
          maxLength={MAX_NOTE_LENGTH}
          rows={6}
          onChange={(e) => setText(e.target.value)}
          placeholder="Как прошёл день?"
        />
        <span className="t-small note__counter">
          {text.length} / {MAX_NOTE_LENGTH}
        </span>
      </label>
      <button type="button" className="btn btn--primary" onClick={() => persist(text)}>
        Сохранить
      </button>
      {entry?.note && (
        <button type="button" className="btn btn--ghost" onClick={() => persist('')}>
          Удалить заметку
        </button>
      )}
    </BottomSheet>
  );
}
