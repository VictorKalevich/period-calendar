import { useEffect, useState } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import { emptyDayEntry } from '../../domain/dayEntry';
import { MAX_NOTE_LENGTH, type DayEntry, type LocalDate } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';
import { TrashIcon } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  entry: DayEntry | undefined;
}

/** Заметка к дню (FR-012): до 1000 символов; удаление — корзиной с подтверждением (012 FR-004). */
export function NoteEditor({ open, onClose, date, entry }: Props) {
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(entry?.note ?? '');
    setConfirming(false);
  }, [open, entry]);

  const persist = async (note: string) => {
    // Остальные поля записи сохраняются как есть (009).
    await saveDayEntry({ ...(entry ?? emptyDayEntry(date)), note });
    onClose();
  };

  const day = formatDayMonthRu(date);
  const trash = entry?.note && !confirming && (
    <button type="button" className="sheet__action" aria-label="Удалить заметку" onClick={() => setConfirming(true)}>
      <TrashIcon size={20} />
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={confirming ? 'Удалить заметку?' : `Заметка · ${day}`} action={trash}>
      {confirming ? (
        <>
          <p className="t-body sheet__note">Заметка за {day} будет удалена.</p>
          <button type="button" className="btn btn--primary" onClick={() => persist('')}>
            Удалить
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
            Отмена
          </button>
        </>
      ) : (
        <>
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
        </>
      )}
    </BottomSheet>
  );
}
