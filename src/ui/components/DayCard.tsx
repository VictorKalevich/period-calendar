import type { ReactNode } from 'react';
import { formatDayMonthRu } from '../../domain/dates';
import type { DayInfo, Probability } from '../../domain/types';

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
  return 'Отметьте начало месячных, чтобы увидеть прогноз.';
}

interface Props {
  info: DayInfo;
  onPeriod: () => void;
  onSymptoms?: () => void;
  onNote?: () => void;
  children?: ReactNode;
}

/** Карточка выбранного дня под календарём (design.md «Экран „Календарь“», п. 5). */
export function DayCard({ info, onPeriod, onSymptoms, onNote, children }: Props) {
  const level = info.probability ? LEVEL[info.probability] : null;
  return (
    <section className="card day-card" aria-label="Выбранный день">
      <div className="day-card__head">
        <h2 className="t-card-title day-card__title">
          {formatDayMonthRu(info.date)} · {info.cycleDay !== null ? `${info.cycleDay}-й день` : '—'}
        </h2>
        {level && <span className={level.cls}>{level.label}</span>}
      </div>
      <p className="t-caption day-card__text">{explainDay(info)}</p>
      {children}
      <div className="day-card__actions">
        <button type="button" className="pill-btn pill-btn--rose" onClick={onPeriod}>
          Месячные
        </button>
        <button type="button" className="pill-btn" onClick={onSymptoms} disabled={!onSymptoms}>
          Симптомы
        </button>
        <button type="button" className="pill-btn" onClick={onNote} disabled={!onNote}>
          Заметка
        </button>
      </div>
    </section>
  );
}
