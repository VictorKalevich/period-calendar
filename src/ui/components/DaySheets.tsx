import type { DayContext, DayEntry, LocalDate } from '../../domain/types';
import { NoteEditor } from './NoteEditor';
import { PeriodSheet } from './PeriodSheet';
import { SymptomPicker } from './SymptomPicker';

export type DaySheet = 'period' | 'symptoms' | 'note' | null;

interface Props {
  which: DaySheet;
  onClose: () => void;
  date: LocalDate;
  ctx: DayContext;
  entry: DayEntry | undefined;
}

/** Листы действий для дня: «Месячные», «Симптомы», «Заметка». */
export function DaySheets({ which, onClose, date, ctx, entry }: Props) {
  return (
    <>
      <PeriodSheet
        open={which === 'period'}
        onClose={onClose}
        date={date}
        today={ctx.today}
        periods={ctx.periods}
        periodLength={ctx.forecast?.periodLength ?? ctx.settings.defaultPeriodLength}
      />
      <SymptomPicker open={which === 'symptoms'} onClose={onClose} date={date} entry={entry} />
      <NoteEditor open={which === 'note'} onClose={onClose} date={date} entry={entry} />
    </>
  );
}
