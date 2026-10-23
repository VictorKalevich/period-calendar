import type { MoodId, SymptomId } from './types';

// Справочники FR-010, FR-011. В хранилище попадают только идентификаторы.

export const SYMPTOMS: ReadonlyArray<{ id: SymptomId; label: string }> = [
  { id: 'cramps', label: 'Боль внизу живота' },
  { id: 'headache', label: 'Головная боль' },
  { id: 'backache', label: 'Боль в спине' },
  { id: 'bloating', label: 'Вздутие' },
  { id: 'breast_tenderness', label: 'Чувствительность груди' },
  { id: 'acne', label: 'Акне' },
  { id: 'fatigue', label: 'Усталость' },
  { id: 'nausea', label: 'Тошнота' },
  { id: 'cravings', label: 'Тяга к еде' },
  { id: 'insomnia', label: 'Бессонница' },
];

export const MOODS: ReadonlyArray<{ id: MoodId; label: string }> = [
  { id: 'great', label: 'Отличное' },
  { id: 'calm', label: 'Спокойное' },
  { id: 'sensitive', label: 'Чувствительное' },
  { id: 'irritable', label: 'Раздражительность' },
  { id: 'sad', label: 'Грусть' },
  { id: 'anxious', label: 'Тревожность' },
];

const symptomIds = new Set<string>(SYMPTOMS.map((s) => s.id));
const moodIds = new Set<string>(MOODS.map((m) => m.id));

export const isSymptomId = (id: unknown): id is SymptomId => typeof id === 'string' && symptomIds.has(id);
export const isMoodId = (id: unknown): id is MoodId => typeof id === 'string' && moodIds.has(id);

export const symptomLabel = (id: SymptomId) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;
export const moodLabel = (id: MoodId) => MOODS.find((m) => m.id === id)?.label ?? id;
