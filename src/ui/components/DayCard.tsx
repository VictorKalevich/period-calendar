import type { ReactNode } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import { PHASE_LABELS, type DayInfo, type Phase } from '../../domain/types';

interface Props {
  info: DayInfo;
  /** Фаза цикла для карточки (004 FR-001); null — не показывать (задержка, нет данных). */
  phase: Phase | null;
  children?: ReactNode;
}

/**
 * Карточка выбранного дня под календарём (design.md «Экран „Календарь“», п. 5): дата, день цикла
 * и фаза (005: без пилюли вероятности и пояснения). Действия с днём — в диалоге по нажатию на дату.
 */
export function DayCard({ info, phase, children }: Props) {
  return (
    <section className="card day-card" aria-label="Выбранный день">
      <h2 className="t-card-title day-card__title">
        {formatDayMonthRu(info.date)} · {info.cycleDay !== null ? `${info.cycleDay}-й день` : '—'}
      </h2>
      {phase && <p className="t-caption day-card__phase">{PHASE_LABELS[phase]}</p>}
      {children}
    </section>
  );
}
