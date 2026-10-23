import { useState } from 'react';
import type { DayDialog as DayDialogModel, DayExtra } from '../../domain/dayDialog';
import type { PeriodAction } from '../../domain/periods';
import { MAX_PERIOD_DAYS, type PeriodError } from '../../domain/types';
import { savePeriods } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

const ERRORS: Record<PeriodError, string> = {
  'future-date': 'Нельзя отметить месячные в будущем',
  'inside-existing': 'Этот день уже внутри отмеченных месячных',
  'end-before-start': 'Конец не может быть раньше начала',
  'too-long': `Месячные не могут длиться больше ${MAX_PERIOD_DAYS} дней`,
  'no-open-period': 'Сначала отметьте начало месячных',
};

const EXTRA_LABELS: Record<DayExtra, string> = { wellbeing: 'Самочувствие', notes: 'Заметки' };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Состав диалога — dayDialogFor (фича 004); UI только рисует. */
  dialog: DayDialogModel;
  /** Открыть выбор самочувствия или редактор заметки для этого дня. */
  onExtra: (extra: DayExtra) => void;
}

/**
 * Диалог по нажатию на дату: заголовок — дата; кнопки месячных (003) с подтверждением удаления;
 * затем «Самочувствие» и «Заметки», если включены; «Отмена».
 */
export function DayDialog({ open, onClose, dialog, onExtra }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PeriodAction | null>(null);

  const close = () => {
    setError(null);
    setConfirming(null);
    onClose();
  };

  const run = async (action: PeriodAction) => {
    const res = action.apply();
    if (!res.ok) {
      setError(ERRORS[res.error]);
      return;
    }
    await savePeriods(res.value);
    close();
  };

  const title = confirming ? 'Удалить месячные?' : dialog.title;

  return (
    <BottomSheet open={open && dialog.opens} onClose={close} title={title}>
      {confirming ? (
        <>
          <p className="t-body sheet__note">{confirming.confirm}</p>
          <button type="button" className="btn btn--primary" onClick={() => run(confirming)}>
            Удалить
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirming(null)}>
            Отмена
          </button>
        </>
      ) : (
        <>
          {dialog.periodActions.map((a, i) => (
            <button
              key={a.kind}
              type="button"
              className={i === 0 ? 'btn btn--primary' : 'btn'}
              onClick={() => (a.confirm ? setConfirming(a) : run(a))}
            >
              {a.label}
            </button>
          ))}
          {error && (
            <p className="sheet__error" role="alert">
              {error}
            </p>
          )}
          {dialog.extras.map((extra) => (
            <button
              key={extra}
              type="button"
              className="btn"
              onClick={() => {
                setError(null);
                onExtra(extra);
              }}
            >
              {EXTRA_LABELS[extra]}
            </button>
          ))}
          <button type="button" className="btn btn--ghost" onClick={close}>
            Отмена
          </button>
        </>
      )}
    </BottomSheet>
  );
}
