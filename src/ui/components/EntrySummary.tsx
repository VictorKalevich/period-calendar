import { moodLabel, symptomLabel } from '../../domain/catalog';
import { visibleEntryParts } from '../../domain/dayDialog';
import type { DayEntry, Settings } from '../../domain/types';

/** Краткий показ записанного за день в карточке дня — только включённые типы (004 FR-009). */
export function EntrySummary({ entry, settings }: { entry: DayEntry | undefined; settings: Settings }) {
  const parts = visibleEntryParts(entry, settings);
  const tags = [...parts.symptoms.map(symptomLabel), ...(parts.mood ? [moodLabel(parts.mood)] : [])];
  if (tags.length === 0 && !parts.note) return null;
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
      {parts.note && <p className="t-body entry__note">{parts.note}</p>}
    </div>
  );
}
