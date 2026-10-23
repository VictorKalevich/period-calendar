import { memo } from 'react';
import { monthGrid } from '../../domain/dates';
import type { DayInfo, LocalDate } from '../../domain/types';
import { DayCell } from './DayCell';

interface Props {
  year: number;
  /** 1…12 */
  month: number;
  getInfo: (date: LocalDate) => DayInfo;
  selected: LocalDate | null;
  onSelect: (info: DayInfo) => void;
}

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Сетка дней месяца (неделя с понедельника, 5–6 строк). */
export const MonthGrid = memo(function MonthGrid({ year, month, getInfo, selected, onSelect }: Props) {
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return (
    <div className="month-grid" role="grid">
      {monthGrid(year, month).map((date) => (
        <DayCell
          key={date}
          info={getInfo(date)}
          inMonth={date.startsWith(prefix)}
          selected={date === selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
});
