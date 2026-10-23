import type { ReactNode } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import { PHASE_LABELS, type DayInfo, type Phase, type Probability } from '../../domain/types';

const LEVEL: Record<Probability, { label: string; cls: string }> = {
  high: { label: 'Высокая', cls: 'pill pill--violet' },
  medium: { label: 'Средняя', cls: 'pill pill--violet' },
  low: { label: 'Низкая', cls: 'pill pill--sage' },
};

export function explainDay(info: DayInfo): string {
  if (info.period === 'actual') return 'Месячные отмечены.';
  if (info.period === 'predicted') return 'Ожидаются месячные.';
  if (info.ovulation) return 'День овуляции — высокая вероятность зачатия.';
  if (info.probability === 'high') return 'Фертильное окно — высокая вероятность зачатия.';
  if (info.probability === 'medium') return 'Рядом с фертильным окном — средняя вероятность зачатия.';
  if (info.probability === 'low') return 'Низкая вероятность зачатия.';
  return 'Нажмите на день, чтобы отметить начало месячных.';
}

interface Props {
  info: DayInfo;
  /** Фаза цикла для карточки (004 FR-001); null — не показывать (задержка, нет данных). */
  phase: Phase | null;
  children?: ReactNode;
}

/**
 * Карточка выбранного дня под календарём (design.md «Экран „Календарь“», п. 5): дата, день цикла,
 * вероятность и фаза. Действия с днём — в диалоге по нажатию на дату (003, 004).
 */
export function DayCard({ info, phase, children }: Props) {
  const level = info.probability ? LEVEL[info.probability] : null;
  return (
    <section className="card day-card" aria-label="Выбранный день">
      <div className="day-card__head">
        <h2 className="t-card-title day-card__title">
          {formatDayMonthRu(info.date)} · {info.cycleDay !== null ? `${info.cycleDay}-й день` : '—'}
        </h2>
        {level && <span className={level.cls}>{level.label}</span>}
      </div>
      {phase && <p className="t-caption day-card__phase">{PHASE_LABELS[phase]}</p>}
      <p className="t-caption day-card__text">{explainDay(info)}</p>
      {children}
    </section>
  );
}
