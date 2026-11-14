import { dayDialogFor } from '../../domain/dayDialog';
import { effectivePeriodLength } from '../../domain/forecast';
import { updateDayEntry } from '../../storage/repository';
import type { DayContext, DayEntry, LocalDate } from '../../domain/types';
import { DayDialog } from './DayDialog';
import { MoodPicker } from './MoodPicker';
import { NoteEditor } from './NoteEditor';
import { SymptomPicker } from './SymptomPicker';

export type DaySheet = 'day' | 'symptoms' | 'mood' | 'note' | null;

const SHEET_FOR_EXTRA = { wellbeing: 'symptoms', mood: 'mood', notes: 'note' } as const;

interface Props {
  which: DaySheet;
  onChange: (which: DaySheet) => void;
  date: LocalDate;
  ctx: DayContext;
  entry: DayEntry | undefined;
}

/** Листы дня: диалог по нажатию на дату и открываемые из него «Самочувствие», «Настроение» и «Заметки». */
export function DaySheets({ which, onChange, date, ctx, entry }: Props) {
  const periodLength = effectivePeriodLength(ctx.periods, ctx.settings);
  const dialog = dayDialogFor(date, ctx.today, ctx.periods, periodLength, ctx.settings, entry);
  // Отметка секса — сразу в записи дня (009 FR-014): значение — как на нажатой кнопке, остальные поля
  // берутся из базы в той же транзакции (фича 015, research R2).
  const toggleSex = () => updateDayEntry(date, { sex: !entry?.sex });
  const close = () => onChange(null);
  return (
    <>
      <DayDialog
        open={which === 'day'}
        // Переход «диалог дня → Самочувствие/Заметки» закрывает <dialog>; его событие close
        // не должно сбрасывать уже открытый следующий лист.
        onClose={() => {
          if (which === 'day') close();
        }}
        dialog={dialog}
        onExtra={(extra) => onChange(SHEET_FOR_EXTRA[extra])}
        onToggleSex={toggleSex}
      />
      <SymptomPicker
        open={which === 'symptoms'}
        onClose={close}
        date={date}
        entry={entry}
        showIntensity={ctx.settings.showIntensity}
      />
      <MoodPicker open={which === 'mood'} onClose={close} date={date} entry={entry} />
      <NoteEditor open={which === 'note'} onClose={close} date={date} entry={entry} />
    </>
  );
}
