import { describe, expect, it } from 'vitest';
import { coerceDayEntry, emptyDayEntry, isEmptyDayEntry } from './dayEntry';
import type { DayEntry, LocalDate } from './types';

// Фича 009: мягкий разбор записи дня — specs/009-day-marks/contracts/day-entry.md.

const date = '2026-10-12' as LocalDate;
const full = (over: Partial<DayEntry> = {}): DayEntry => ({ ...emptyDayEntry(date), ...over });

describe('coerceDayEntry — запись без даты', () => {
  it.each([undefined, null, 5, 'строка', [], [date], { date: 1 }, { date: '2026-02-30' }, { date: '12.10.2026' }, {}])(
    '%j → null, без исключения',
    (raw) => {
      expect(coerceDayEntry(raw)).toBeNull();
    },
  );
});

describe('coerceDayEntry — запись v6', () => {
  it('корректная запись не меняется', () => {
    const e = full({ symptoms: ['cramps', 'fatigue'], intensity: { cramps: 'severe' }, moods: ['calm', 'sad'], sex: true, note: 'устала' });
    expect(coerceDayEntry(e)).toEqual(e);
  });

  it('только дата → пустая запись', () => {
    expect(coerceDayEntry({ date })).toEqual(emptyDayEntry(date));
  });

  it('symptoms: не массив → [], неизвестные и не строки отброшены, повторы схлопнуты, порядок справочника', () => {
    expect(coerceDayEntry({ date, symptoms: 'cramps' })!.symptoms).toEqual([]);
    expect(coerceDayEntry({ date, symptoms: ['fatigue', 'sneezing', 7, 'cramps', 'fatigue', null] })!.symptoms).toEqual([
      'cramps',
      'fatigue',
    ]);
  });

  it('intensity: не объект → {}; степень неотмеченного пункта и неверное значение отброшены', () => {
    expect(coerceDayEntry({ date, symptoms: ['cramps'], intensity: 'severe' })!.intensity).toEqual({});
    expect(coerceDayEntry({ date, symptoms: ['cramps'], intensity: ['severe'] })!.intensity).toEqual({});
    expect(
      coerceDayEntry({
        date,
        symptoms: ['cramps', 'acne', 'headache'],
        intensity: { cramps: 'mild', acne: 'strong', headache: 3, fatigue: 'severe', sneezing: 'mild' },
      })!.intensity,
    ).toEqual({ cramps: 'mild' });
  });

  it('moods: известные коды, старые переведены, прочие отброшены, повторы схлопнуты, порядок справочника', () => {
    expect(coerceDayEntry({ date, moods: ['sad', 'nope', 5, 'great', 'calm', 'sad'] })!.moods).toEqual(['joyful', 'calm', 'sad']);
    expect(coerceDayEntry({ date, moods: 'calm' })!.moods).toEqual([]);
  });

  it('sex: true только для true', () => {
    expect(coerceDayEntry({ date, sex: true })!.sex).toBe(true);
    for (const v of ['yes', 1, 'true', null, undefined, {}]) expect(coerceDayEntry({ date, sex: v })!.sex).toBe(false);
  });

  it('note: не строка → ""; trim; длиннее 1000 — обрезается до 1000', () => {
    expect(coerceDayEntry({ date, note: 7 })!.note).toBe('');
    expect(coerceDayEntry({ date, note: null })!.note).toBe('');
    expect(coerceDayEntry({ date, note: '  текст  ' })!.note).toBe('текст');
    expect(coerceDayEntry({ date, note: 'я'.repeat(1001) })!.note).toBe('я'.repeat(1000));
  });

  it('лишние поля отбрасываются', () => {
    expect(Object.keys(coerceDayEntry({ date, extra: 1, mood: 'calm', moods: [] })!).sort()).toEqual(
      ['date', 'intensity', 'moods', 'note', 'sex', 'symptoms'],
    );
  });
});

describe('coerceDayEntry — запись v1–v5 (одно настроение)', () => {
  it.each([
    ['great', ['joyful']],
    ['calm', ['calm']],
    ['sensitive', ['sensitive']],
    ['irritable', ['irritable']],
    ['sad', ['sad']],
    ['anxious', ['anxious']],
    ['nope', []],
    [5, []],
    [null, []],
  ])('mood %j → moods %j', (mood, moods) => {
    expect(coerceDayEntry({ date, symptoms: ['acne'], mood, note: 'x' })).toEqual(
      full({ symptoms: ['acne'], moods: moods as DayEntry['moods'], note: 'x' }),
    );
  });

  it('если есть массив moods, старое поле mood не используется', () => {
    expect(coerceDayEntry({ date, mood: 'sad', moods: ['calm'] })!.moods).toEqual(['calm']);
  });
});

describe('isEmptyDayEntry', () => {
  it('пустая запись', () => {
    expect(isEmptyDayEntry(emptyDayEntry(date))).toBe(true);
  });

  it('только отметка секса — не пустая', () => {
    expect(isEmptyDayEntry(full({ sex: true }))).toBe(false);
  });

  it('только настроение / самочувствие / заметка — не пустая', () => {
    expect(isEmptyDayEntry(full({ moods: ['calm'] }))).toBe(false);
    expect(isEmptyDayEntry(full({ symptoms: ['acne'] }))).toBe(false);
    expect(isEmptyDayEntry(full({ note: 'x' }))).toBe(false);
  });

  it('степень без пункта не делает запись непустой', () => {
    expect(isEmptyDayEntry(full({ intensity: { acne: 'mild' } }))).toBe(true);
  });
});
