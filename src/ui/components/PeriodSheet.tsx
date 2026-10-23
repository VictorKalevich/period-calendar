import { useState } from 'react';
import { diffDays, formatDayMonthRu } from '../../domain/dates';
import { markPeriodEnd, markPeriodStart, movePeriodStart, periodEnd, unmarkPeriodDay } from '../../domain/periods';
import { MAX_PERIOD_DAYS, type LocalDate, type Period, type PeriodError, type Result } from '../../domain/types';
import { savePeriods } from '../../storage/repository';
import { BottomSheet } from './BottomSheet';

const ERRORS: Record<PeriodError, string> = {
  'future-date': 'Нельзя отметить месячные в будущем',
  'inside-existing': 'Этот день уже внутри отмеченных месячных',
  'end-before-start': 'Конец не может быть раньше начала',
  'too-long': `Месячные не могут длиться больше ${MAX_PERIOD_DAYS} дней`,
  'no-open-period': 'Сначала отметьте начало месячных',
};

interface Action {
  label: string;
  run: () => Result<Period[]>;
  primary?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  date: LocalDate;
  today: LocalDate;
  periods: Period[];
  /** Прогнозируемая длина месячных (без прогноза — по умолчанию). */
  periodLength: number;
}

function actionsFor(date: LocalDate, today: LocalDate, periods: Period[], periodLength: number): Action[] {
  const containing = periods.find((p) => p.start <= date && date <= periodEnd(p, periodLength));
  if (containing) {
    const actions: Action[] = [];
    if (containing.start !== date) {
      actions.push({ label: 'Отметить конец в этот день', run: () => markPeriodEnd(periods, date, today), primary: true });
      // U3: при пересечении — сдвинуть начало
      actions.push({ label: 'Сдвинуть начало на этот день', run: () => movePeriodStart(periods, date) });
      actions.push({ label: 'Убрать отметку с этого дня', run: () => ({ ok: true, value: unmarkPeriodDay(periods, date) }) });
    } else {
      actions.push({ label: 'Конец месячных (один день)', run: () => markPeriodEnd(periods, date, today) });
      actions.push({ label: 'Убрать отметку', run: () => ({ ok: true, value: unmarkPeriodDay(periods, date) }) });
    }
    return actions;
  }
  const actions: Action[] = [
    { label: 'Начало месячных', run: () => markPeriodStart(periods, date, today, periodLength), primary: true },
  ];
  const before = periods.filter((p) => p.start < date).at(-1);
  if (before && diffDays(date, before.start) < MAX_PERIOD_DAYS) {
    actions.push({
      label: `Конец месячных (начались ${formatDayMonthRu(before.start)})`,
      run: () => markPeriodEnd(periods, date, today),
    });
  }
  return actions;
}

/** Действия «Месячные» для выбранного дня (FR-009, U3). */
export function PeriodSheet({ open, onClose, date, today, periods, periodLength }: Props) {
  const [error, setError] = useState<string | null>(null);
  const future = date > today;
  const actions = future ? [] : actionsFor(date, today, periods, periodLength);

  const close = () => {
    setError(null);
    onClose();
  };

  const run = async (action: Action) => {
    const res = action.run();
    if (!res.ok) {
      setError(ERRORS[res.error]);
      return;
    }
    await savePeriods(res.value);
    close();
  };

  return (
    <BottomSheet open={open} onClose={close} title={`Месячные · ${formatDayMonthRu(date)}`}>
      {future && <p className="t-caption sheet__note">{ERRORS['future-date']}</p>}
      {actions.map((a) => (
        <button key={a.label} type="button" className={a.primary ? 'btn btn--primary' : 'btn'} onClick={() => run(a)}>
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
