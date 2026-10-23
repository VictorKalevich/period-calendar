import { Crown } from './Icons';

// Легенда из 6 пунктов (FR-005, design.md «Экран „Календарь“», п. 4). Прошедшие дни окна —
// вариант пункта «Фертильное окно», отдельного пункта нет.
const ITEMS = [
  { key: 'period', label: 'Месячные' },
  { key: 'period-predicted', label: 'Месячные (прогноз)' },
  { key: 'fertile', label: 'Фертильное окно' },
  { key: 'ovulation', label: 'Овуляция' },
  { key: 'today', label: 'Сегодня' },
  { key: 'entry', label: 'Есть записи' },
] as const;

export function Legend() {
  return (
    <ul className="legend" aria-label="Обозначения">
      {ITEMS.map(({ key, label }) => (
        <li key={key} className="legend__item">
          {key === 'ovulation' ? (
            <Crown size={14} />
          ) : (
            <span className={`legend__swatch legend__swatch--${key}`} aria-hidden="true" />
          )}
          {label}
        </li>
      ))}
    </ul>
  );
}
