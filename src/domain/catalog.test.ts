import { describe, expect, it } from 'vitest';
import { INTENSITIES, intensityLabel, isIntensity, isMoodId, LEGACY_MOOD_CODES, MOODS, moodLabel } from './catalog';

// Фича 009: справочник настроений с постоянными кодами (data-model.md «Справочник настроений»).

describe('MOODS', () => {
  it('20 настроений в порядке показа, коды постоянны', () => {
    expect(MOODS.map((m) => [m.id, m.label])).toEqual([
      ['joyful', 'Радостная'],
      ['cheerful', 'Весёлая'],
      ['content', 'Довольная'],
      ['delighted', 'В восторге'],
      ['inspired', 'Воодушевлённая'],
      ['energetic', 'Энергичная'],
      ['playful', 'Игривая'],
      ['calm', 'Спокойная'],
      ['tender', 'Нежная'],
      ['confident', 'Уверенная'],
      ['grateful', 'Благодарная'],
      ['sensitive', 'Чувствительная'],
      ['sad', 'Грустная'],
      ['anxious', 'Тревожная'],
      ['irritable', 'Раздражённая'],
      ['angry', 'Злая'],
      ['lonely', 'Одинокая'],
      ['overwhelmed', 'Перегруженная'],
      ['indifferent', 'Безразличная'],
      ['mood_swings', 'Настроение меняется'],
    ]);
  });

  it('коды уникальны', () => {
    expect(new Set(MOODS.map((m) => m.id)).size).toBe(MOODS.length);
  });

  it('пять старых кодов v1–v5 остаются кодами нового справочника', () => {
    for (const id of ['calm', 'sensitive', 'sad', 'anxious', 'irritable']) expect(isMoodId(id), id).toBe(true);
  });

  it('старое «Отличное» (great) — не код нового справочника, переводится в «Радостная»', () => {
    expect(isMoodId('great')).toBe(false);
    expect(LEGACY_MOOD_CODES).toEqual({ great: 'joyful' });
    expect(moodLabel(LEGACY_MOOD_CODES.great!)).toBe('Радостная');
  });

  it('isMoodId отвергает не строки и неизвестные коды', () => {
    for (const v of [undefined, null, 5, {}, 'nope', '']) expect(isMoodId(v)).toBe(false);
  });
});

describe('INTENSITIES', () => {
  it('три степени с подписями', () => {
    expect(INTENSITIES.map((i) => [i.id, i.label])).toEqual([
      ['mild', 'слабо'],
      ['moderate', 'средне'],
      ['severe', 'сильно'],
    ]);
    expect(intensityLabel('severe')).toBe('сильно');
  });

  it('isIntensity', () => {
    expect(isIntensity('mild')).toBe(true);
    for (const v of ['strong', 1, null, undefined]) expect(isIntensity(v)).toBe(false);
  });
});
