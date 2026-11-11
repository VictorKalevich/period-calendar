import type { Intensity, MoodId, SymptomId } from './types';

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

// Фича 009: 20 настроений, коды постоянны (data-model.md 009). Подписи без эмодзи.
export const MOODS: ReadonlyArray<{ id: MoodId; label: string }> = [
  { id: 'joyful', label: 'Радостная' },
  { id: 'cheerful', label: 'Весёлая' },
  { id: 'content', label: 'Довольная' },
  { id: 'delighted', label: 'В восторге' },
  { id: 'inspired', label: 'Воодушевлённая' },
  { id: 'energetic', label: 'Энергичная' },
  { id: 'playful', label: 'Игривая' },
  { id: 'calm', label: 'Спокойная' },
  { id: 'tender', label: 'Нежная' },
  { id: 'confident', label: 'Уверенная' },
  { id: 'grateful', label: 'Благодарная' },
  { id: 'sensitive', label: 'Чувствительная' },
  { id: 'sad', label: 'Грустная' },
  { id: 'anxious', label: 'Тревожная' },
  { id: 'irritable', label: 'Раздражённая' },
  { id: 'angry', label: 'Злая' },
  { id: 'lonely', label: 'Одинокая' },
  { id: 'overwhelmed', label: 'Перегруженная' },
  { id: 'indifferent', label: 'Безразличная' },
  { id: 'mood_swings', label: 'Настроение меняется' },
];

/** Старые коды настроения (v1–v5), которых нет в справочнике, → новые. Остальные старые коды совпадают. */
export const LEGACY_MOOD_CODES: Readonly<Record<string, MoodId>> = Object.freeze({ great: 'joyful' });

export const INTENSITIES: ReadonlyArray<{ id: Intensity; label: string }> = [
  { id: 'mild', label: 'слабо' },
  { id: 'moderate', label: 'средне' },
  { id: 'severe', label: 'сильно' },
];

const symptomIds = new Set<string>(SYMPTOMS.map((s) => s.id));
const moodIds = new Set<string>(MOODS.map((m) => m.id));
const intensityIds = new Set<string>(INTENSITIES.map((i) => i.id));

export const isSymptomId = (id: unknown): id is SymptomId => typeof id === 'string' && symptomIds.has(id);
export const isMoodId = (id: unknown): id is MoodId => typeof id === 'string' && moodIds.has(id);
export const isIntensity = (id: unknown): id is Intensity => typeof id === 'string' && intensityIds.has(id);

export const symptomLabel = (id: SymptomId) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;
export const moodLabel = (id: MoodId) => MOODS.find((m) => m.id === id)?.label ?? id;
export const intensityLabel = (id: Intensity) => INTENSITIES.find((i) => i.id === id)?.label ?? id;
