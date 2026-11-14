import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayEntry } from '../domain/dayEntry';
import type { DayEntry, LocalDate } from '../domain/types';
import { db } from './db';
import { getDayEntry, saveDayEntry, updateDayEntry } from './repository';

// Фича 015 (шаг 2 рефакторинга): изменение записи дня — дата и изменённые поля, применяемые к актуальной
// записи в одной транзакции.

const ld = (s: string) => s as LocalDate;
const D = ld('2026-10-23');
const X = ld('2026-10-24');
const Y = ld('2026-10-25');

const day = (date: LocalDate, patch: Partial<DayEntry> = {}): DayEntry => ({ ...emptyDayEntry(date), ...patch });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('updateDayEntry', () => {
  it('два одновременных изменения разных полей одного дня сохраняются оба (SC-001)', async () => {
    await Promise.all([updateDayEntry(D, { moods: ['calm'] }), updateDayEntry(D, { note: 'n' })]);
    expect(await getDayEntry(D)).toEqual(day(D, { moods: ['calm'], note: 'n' }));
  });

  it('одновременные отметка секса и самочувствие со степенью — тоже оба', async () => {
    await Promise.all([updateDayEntry(D, { sex: true }), updateDayEntry(D, { symptoms: ['acne'], intensity: { acne: 'severe' } })]);
    expect(await getDayEntry(D)).toEqual(day(D, { sex: true, symptoms: ['acne'], intensity: { acne: 'severe' } }));
  });

  it('меняется только переданное поле, остальные — как были', async () => {
    const full = day(D, { symptoms: ['cramps'], intensity: { cramps: 'mild' }, moods: ['sad'], sex: true, note: 'старая' });
    await saveDayEntry(full);
    await updateDayEntry(D, { note: 'новая' });
    expect(await getDayEntry(D)).toEqual({ ...full, note: 'новая' });
  });

  it('изменение дня X не меняет день Y, даже если у вызывающего устаревший снимок Y (SC-002)', async () => {
    const saved = day(Y, { note: 'Y', sex: true });
    await saveDayEntry(saved);
    const staleY = { ...saved, note: 'старый' };
    expect(staleY.date).toBe(Y);
    await updateDayEntry(X, { moods: ['calm'] });
    expect(await getDayEntry(Y)).toEqual(saved);
    expect(await getDayEntry(X)).toEqual(day(X, { moods: ['calm'] }));
  });

  it('запись, ставшая пустой, удаляется (SC-003)', async () => {
    await saveDayEntry(day(D, { note: 'n' }));
    await updateDayEntry(D, { note: '' });
    expect(await getDayEntry(D)).toBeUndefined();

    await saveDayEntry(day(D, { sex: true }));
    await updateDayEntry(D, { sex: false });
    expect(await getDayEntry(D)).toBeUndefined();
    expect(await db.days.count()).toBe(0);
  });

  it('несуществующая запись создаётся из пустой с изменённым полем', async () => {
    await updateDayEntry(D, { moods: ['joyful'] });
    expect(await getDayEntry(D)).toEqual(day(D, { moods: ['joyful'] }));
  });

  it('запись старой формы читается мягко: понятные части сохраняются (009 FR-003)', async () => {
    await db.days.put({ date: D, symptoms: ['acne', 'x'], mood: 'great', note: '  t ' } as unknown as DayEntry);
    await updateDayEntry(D, { sex: true });
    expect(await getDayEntry(D)).toEqual(day(D, { symptoms: ['acne'], moods: ['joyful'], sex: true, note: 't' }));
  });

  it('некорректная дата — ошибка, ничего не пишется', async () => {
    await expect(updateDayEntry(ld('2026-02-30'), { note: 'x' })).rejects.toThrow();
    expect(await db.days.count()).toBe(0);
  });

  it('отказ записи — ошибка, запись прежняя целиком', async () => {
    await saveDayEntry(day(D, { note: 'n' }));
    const put = vi.spyOn(db.days, 'put').mockImplementation((() => Promise.reject(new Error('QuotaExceededError'))) as never);
    await expect(updateDayEntry(D, { moods: ['calm'] })).rejects.toThrow('QuotaExceededError');
    put.mockRestore();
    expect(await getDayEntry(D)).toEqual(day(D, { note: 'n' }));
  });

  it('заметка приводится, как при сохранении: не длиннее 1000 символов', async () => {
    await updateDayEntry(D, { note: 'ю'.repeat(1001) });
    expect((await getDayEntry(D))?.note).toBe('ю'.repeat(1000));
  });
});
