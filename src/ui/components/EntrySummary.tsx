import { moodLabel, symptomLabel } from '../../domain/catalog';
import type { DayEntry } from '../../domain/types';

/** Краткий показ записанного за день в карточке дня. */
export function EntrySummary({ entry }: { entry: DayEntry | undefined }) {
  if (!entry) return null;
  const tags = [...entry.symptoms.map(symptomLabel), ...(entry.mood ? [moodLabel(entry.mood)] : [])];
  return (
    <div className="entry">
      {tags.length > 0 && (
        <ul className="entry__tags" aria-label="Самочувствие">
          {tags.map((t) => (
            <li key={t} className="pill pill--violet">
              {t}
            </li>
          ))}
        </ul>
      )}
      {entry.note && <p className="t-body entry__note">{entry.note}</p>}
    </div>
  );
}
