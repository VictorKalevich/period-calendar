// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildForecast } from '../domain/forecast';
import { DEFAULT_SETTINGS, type DayContext, type DayEntry, type LocalDate, type Period, type Settings } from '../domain/types';
import { db } from '../storage/db';
import { DaySheets, type DaySheet } from './components/DaySheets';
import { FirstPeriodHint } from './components/FirstPeriodHint';
import { MoodPicker } from './components/MoodPicker';
import { NoteEditor } from './components/NoteEditor';
import { SymptomPicker } from './components/SymptomPicker';
import { SettingsScreen } from './screens/SettingsScreen';
import { button, click, mount, unmountAll, waitUntil } from './testing';

// Фича 014, FR-017: на обычном пути (без сбоев) разметка изменяемых компонентов прежняя.
// Характеризационный снимок: записан до правок фичи 014 и должен совпадать после них.

vi.mock('../push/subscribe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../push/subscribe')>()),
  isPushConfigured: () => true,
  isPushSupported: () => true,
  isStandalone: () => true,
  notificationPermission: () => 'granted',
  enableReminders: vi.fn(async () => 'granted'),
  disableReminders: vi.fn(async () => {}),
}));
vi.mock('../push/sync', () => ({ syncReminders: vi.fn(async () => {}), startReminderSync: vi.fn() }));

const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-11-14');
const DAY = ld('2026-11-10');
const ALL_ON: Settings = { ...DEFAULT_SETTINGS, showSex: true, showWellbeing: true, showMood: true, showNotes: true, showIntensity: true };

const ctxFor = (periods: Period[], settings: Settings = ALL_ON): DayContext => ({
  forecast: buildForecast({ periods, settings, today: TODAY }),
  periods,
  settings,
  entries: new Set(),
  sexDates: new Set(),
  today: TODAY,
});

const entry = (patch: Partial<DayEntry>): DayEntry => ({
  date: DAY,
  symptoms: [],
  intensity: {},
  moods: [],
  sex: false,
  note: '',
  ...patch,
});

/** Разметка без номера версии — снимок не зависит от версии приложения. */
const html = (el: HTMLElement) => el.innerHTML.replaceAll(__APP_VERSION__, 'X');

const sheets = (which: DaySheet, date: LocalDate, periods: Period[]) =>
  createElement(DaySheets, { which, onChange: () => {}, date, ctx: ctxFor(periods), entry: undefined });

const PERIOD: Period = { id: 'p1', start: ld('2026-11-01'), end: ld('2026-11-05'), endEstimated: false };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  unmountAll();
  vi.clearAllMocks();
});

describe('разметка обычного пути (снимок до фичи 014)', () => {
  it('диалог дня вне месячных', async () => {
    const m = await mount(sheets('day', DAY, []));
    expect(html(m.container)).toMatchSnapshot();
  });

  it('диалог дня в первый день месячных и подтверждение удаления', async () => {
    const m = await mount(sheets('day', PERIOD.start, [PERIOD]));
    expect(html(m.container)).toMatchSnapshot();
    await click(button(m.container, 'Удалить период'));
    expect(html(m.container)).toMatchSnapshot();
  });

  it('лист «Настроение»', async () => {
    const m = await mount(
      createElement(MoodPicker, { open: true, onClose: () => {}, date: DAY, entry: entry({ moods: ['calm'] }) }),
    );
    expect(html(m.container)).toMatchSnapshot();
  });

  it('лист «Самочувствие» с интенсивностью', async () => {
    const m = await mount(
      createElement(SymptomPicker, {
        open: true,
        onClose: () => {},
        date: DAY,
        entry: entry({ symptoms: ['headache'], intensity: { headache: 'severe' } }),
        showIntensity: true,
      }),
    );
    expect(html(m.container)).toMatchSnapshot();
  });

  it('лист «Заметка» и подтверждение удаления', async () => {
    const m = await mount(
      createElement(NoteEditor, { open: true, onClose: () => {}, date: DAY, entry: entry({ note: 'Текст' }) }),
    );
    expect(html(m.container)).toMatchSnapshot();
    await click(m.container.querySelector('[aria-label="Удалить заметку"]'));
    expect(html(m.container)).toMatchSnapshot();
  });

  it('экран «Настройки»', async () => {
    const m = await mount(createElement(SettingsScreen));
    await waitUntil(() => m.container.textContent?.includes('Резервная копия') === true, 'настройки загрузились');
    expect(html(m.container)).toMatchSnapshot();
  });

  it('подсказка «Как получить прогноз»', async () => {
    const m = await mount(createElement(FirstPeriodHint));
    expect(html(m.container)).toMatchSnapshot();
  });
});
