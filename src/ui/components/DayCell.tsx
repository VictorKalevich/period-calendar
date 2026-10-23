import { memo } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import type { DayInfo } from '../../domain/types';
import { Crown } from './Icons';

interface Props {
  info: DayInfo;
  inMonth: boolean;
  selected: boolean;
  onSelect: (info: DayInfo) => void;
}

function describe(info: DayInfo): string {
  const parts = [formatDayMonthRu(info.date)];
  if (info.isToday) parts.push('сегодня');
  if (info.period === 'actual') parts.push('месячные');
  if (info.period === 'predicted') parts.push('прогноз месячных');
  if (info.ovulation) parts.push('овуляция');
  else if (info.fertile) parts.push('фертильное окно');
  if (info.hasEntry) parts.push('есть записи');
  return parts.join(', ');
}

/** Ячейка дня — состояния из design.md «Состояния дня в календаре». */
export const DayCell = memo(function DayCell({ info, inMonth, selected, onSelect }: Props) {
  const cls = ['day'];
  if (!inMonth) cls.push('day--outside');
  if (info.period === 'actual') cls.push('day--period');
  else if (info.period === 'predicted') cls.push('day--period-predicted');
  else if (info.ovulation) cls.push('day--ovulation');
  else if (info.fertile === 'predicted') cls.push('day--fertile');
  else if (info.fertile === 'past') cls.push('day--fertile-past');
  if (info.ovulation && info.period) cls.push('day--ovulation-overlap');
  if (info.isToday) cls.push('day--today');
  if (selected) cls.push('day--selected');

  return (
    <button
      type="button"
      className="day-cell"
      aria-label={describe(info)}
      aria-pressed={selected}
      onClick={() => onSelect(info)}
    >
      <span className={cls.join(' ')}>
        {Number(info.date.slice(8))}
        {info.ovulation && <Crown className="day__crown" />}
        {info.hasEntry && <span className="day__dot" aria-hidden="true" />}
      </span>
    </button>
  );
});
