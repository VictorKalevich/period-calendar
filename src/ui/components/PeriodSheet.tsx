import { useState } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import { periodActionsFor, type PeriodAction } from '../../domain/periods';
import { MAX_PERIOD_DAYS, type LocalDate, type Period, type PeriodError } from '../../domain/types';
import { savePeriods } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

const ERRORS: Record<PeriodError, string> = {
  'future-date': 'Нельзя отметить месячные в будущем',
  'inside-existing': 'Этот день уже внутри отмеченных месячных',
  'end-before-start': 'Конец не может быть раньше начала',
  'too-long': `Месячные не могут длиться больше ${MAX_PERIOD_DAYS} дней`,
  'no-open-period': 'Сначала отметьте начало месячных',
};

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  today: LocalDate;
  periods: Period[];
  /** Прогнозируемая длина месячных (без прогноза — по умолчанию). */
  periodLength: number;
}

/** Диалог «Месячные»: кнопки строго из periodActionsFor (003 FR-006), UI только рисует. */
export function PeriodSheet({ open, onClose, date, today, periods, periodLength }: Props) {
  const [error, setError] = useState<string | null>(null);
  const actions = periodActionsFor(date, today, periods, periodLength);

  const close = () => {
    setError(null);
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

  return (
    <BottomSheet open={open && actions.length > 0} onClose={close} title={`Месячные · ${formatDayMonthRu(date)}`}>
      {actions.map((a, i) => (
        <button key={a.kind} type="button" className={i === 0 ? 'btn btn--primary' : 'btn'} onClick={() => run(a)}>
          {a.label}
        </button>
      ))}
      {error && (
        <p className="sheet__error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn--ghost" onClick={close}>
        Отмена
      </button>
    </BottomSheet>
  );
}
