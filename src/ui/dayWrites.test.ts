// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayEntry } from '../domain/dayEntry';
import { buildForecast } from '../domain/forecast';
import { DEFAULT_SETTINGS, type DayContext, type DayEntry, type LocalDate, type Settings } from '../domain/types';
import { db } from '../storage/db';
import { getDayEntry, saveDayEntry } from '../storage/repository';
import { DaySheets } from './components/DaySheets';
import { MoodPicker } from './components/MoodPicker';
import { NoteEditor } from './components/NoteEditor';
import { SymptomPicker } from './components/SymptomPicker';
import { button, click, mount, settle, unmountAll } from './testing';

// Фича 015 (шаг 2 рефакторинга): запись дня из листов и отметки секса.

const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-11-14');
const DAY = ld('2026-11-10');
const ALL_ON: Settings = { ...DEFAULT_SETTINGS, showSex: true, showWellbeing: true, showMood: true, showNotes: true, showIntensity: true };

const ctx: DayContext = {
  forecast: buildForecast({ periods: [], settings: ALL_ON, today: TODAY }),
  periods: [],
  settings: ALL_ON,
  entries: new Set(),
  sexDates: new Set(),
  today: TODAY,
};

const day = (date: LocalDate, patch: Partial<DayEntry> = {}): DayEntry => ({ ...emptyDayEntry(date), ...patch });

/** Сохранить запись в базе и вернуть её — как её получает лист с экрана. */
async function stored(patch: Partial<DayEntry>, date = DAY): Promise<DayEntry> {
  const e = day(date, patch);
  await saveDayEntry(e);
  return e;
}

async function typeInto(el: HTMLTextAreaElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const sheets = (entry: DayEntry | undefined, onChange = vi.fn(), date = DAY) =>
  createElement(DaySheets, { which: 'day', onChange, date, ctx, entry });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('запись дня из листов — как раньше (характеризация до фичи 015)', () => {
  it('«Отметить секс»: отметка стоит, заметка на месте, диалог закрыт', async () => {
    const onChange = vi.fn();
    const m = await mount(sheets(await stored({ note: 'n' }), onChange));
    await click(button(m.container, 'Отметить секс'));
    expect(await getDayEntry(DAY)).toEqual(day(DAY, { sex: true, note: 'n' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('«Убрать отметку секса»: отметки нет, настроение на месте, диалог закрыт', async () => {
    const onChange = vi.fn();
    const m = await mount(sheets(await stored({ sex: true, moods: ['calm'] }), onChange));
    await click(button(m.container, 'Убрать отметку секса'));
    expect(await getDayEntry(DAY)).toEqual(day(DAY, { moods: ['calm'] }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('двойное «Отметить секс» до закрытия диалога — отметка стоит, а не снята (research R2)', async () => {
    const m = await mount(sheets(undefined));
    const mark = button(m.container, 'Отметить секс')!;
    await act(async () => {
      mark.click();
      mark.click();
    });
    await settle();
    expect(await getDayEntry(DAY)).toEqual(day(DAY, { sex: true }));
  });

  it('«Настроение»: выбранное сохранено, самочувствие и заметка на месте, лист закрыт', async () => {
    const onClose = vi.fn();
    const entry = await stored({ symptoms: ['headache'], note: 'n' });
    const m = await mount(createElement(MoodPicker, { open: true, onClose, date: DAY, entry }));
    await click(button(m.container, 'Спокойная'));
    await click(button(m.container, 'Готово'));
    expect(await getDayEntry(DAY)).toEqual(day(DAY, { symptoms: ['headache'], moods: ['calm'], note: 'n' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('«Самочувствие» с интенсивностью: новый пункт «средне», настроение и заметка на месте', async () => {
    const onClose = vi.fn();
    const entry = await stored({ moods: ['calm'], note: 'n' });
    const m = await mount(createElement(SymptomPicker, { open: true, onClose, date: DAY, entry, showIntensity: true }));
    await click(button(m.container, 'Головная боль'));
    await click(button(m.container, 'Готово'));
    expect(await getDayEntry(DAY)).toEqual(
      day(DAY, { symptoms: ['headache'], intensity: { headache: 'moderate' }, moods: ['calm'], note: 'n' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('«Самочувствие» без интенсивности: степень прежнего пункта сохранена, у нового её нет', async () => {
    const onClose = vi.fn();
    const entry = await stored({ symptoms: ['headache'], intensity: { headache: 'severe' } });
    const m = await mount(createElement(SymptomPicker, { open: true, onClose, date: DAY, entry, showIntensity: false }));
    await click(button(m.container, 'Тошнота'));
    await click(button(m.container, 'Готово'));
    expect(await getDayEntry(DAY)).toEqual(day(DAY, { symptoms: ['headache', 'nausea'], intensity: { headache: 'severe' } }));
    expect(onClose).toHaveBeenCalled();
  });

  it('«Заметка»: новый текст сохранён, настроение на месте, лист закрыт', async () => {
    const onClose = vi.fn();
    const entry = await stored({ moods: ['calm'], note: 'старая' });
    const m = await mount(createElement(NoteEditor, { open: true, onClose, date: DAY, entry }));
    await typeInto(m.container.querySelector('textarea')!, 'новая');
    await click(button(m.container, 'Сохранить'));
    expect(await getDayEntry(DAY)).toEqual(day(DAY, { moods: ['calm'], note: 'новая' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('удаление единственной заметки — записи дня нет, лист закрыт', async () => {
    const onClose = vi.fn();
    const entry = await stored({ note: 'только' });
    const m = await mount(createElement(NoteEditor, { open: true, onClose, date: DAY, entry }));
    await click(m.container.querySelector('[aria-label="Удалить заметку"]'));
    await click(button(m.container, 'Удалить'));
    expect(await getDayEntry(DAY)).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });
});
