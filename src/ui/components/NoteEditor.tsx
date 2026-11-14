import { useEffect, useState } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import { emptyDayEntry } from '../../domain/dayEntry';
import { MAX_NOTE_LENGTH, type DayEntry, type LocalDate } from '../../domain/types';
import { saveDayEntry } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';
import { TrashIcon } from './Icons';
import { SaveError, useSaveError } from './SaveError';

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
  const saveError = useSaveError();

  useEffect(() => {
    if (!open) return;
    setText(entry?.note ?? '');
    setConfirming(false);
    saveError.reset();
  }, [open, entry]);

  const persist = async (note: string) => {
    // Остальные поля записи сохраняются как есть (009). Отказ записи — лист открыт, текст цел (014).
    if (await saveError.save(() => saveDayEntry({ ...(entry ?? emptyDayEntry(date)), note }))) onClose();
  };

  // Переход между редактором и подтверждением убирает сообщение об ошибке (014).
  const confirm = (on: boolean) => {
    saveError.reset();
    setConfirming(on);
  };

  const day = formatDayMonthRu(date);
  const trash = entry?.note && !confirming && (
    <button type="button" className="icon-btn icon-btn--danger sheet__action" aria-label="Удалить заметку" onClick={() => confirm(true)}>
      <TrashIcon size={20} />
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={confirming ? 'Удалить заметку?' : `Заметка · ${day}`} action={trash}>
      {confirming ? (
        <>
          <p className="t-body sheet__note">Заметка за {day} будет удалена.</p>
          <SaveError shown={saveError.failed} />
          <button type="button" className="btn btn--primary" onClick={() => persist('')}>
            Удалить
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => confirm(false)}>
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
          <SaveError shown={saveError.failed} />
          <button type="button" className="btn btn--primary" onClick={() => persist(text)}>
            Сохранить
          </button>
        </>
      )}
    </BottomSheet>
  );
}
