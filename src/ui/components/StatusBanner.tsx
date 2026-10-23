import { PROBABILITY_LABELS, type TodaySummary } from '../../domain/types';

export const LOW_CONFIDENCE_TEXT = 'Прогноз по средним значениям, станет точнее после нескольких циклов';

/** Плашка над календарём (FR-004, FR-019a; design.md «Экран „Календарь“», п. 2). */
export function StatusBanner({ summary }: { summary: TodaySummary }) {
  let text: string;
  let cls = 'status-pill';
  if (summary.delayDays > 0) {
    text = `Задержка ${summary.delayDays} дн.`;
    cls += ' status-pill--delay';
  } else if (summary.cycleDay !== null && summary.probability) {
    text = `Сегодня ${summary.cycleDay}-й день · вероятность ${PROBABILITY_LABELS[summary.probability]}`;
  } else {
    text = 'Отметьте начало последних месячных';
  }
  return (
    <div className="status">
      <p className={cls} role="status">
        {text}
      </p>
      {summary.confidence === 'low' && <p className="t-small status__note">{LOW_CONFIDENCE_TEXT}</p>}
    </div>
  );
}
