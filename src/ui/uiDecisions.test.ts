// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDaysLD } from '../domain/dates';
import { emptyDayEntry } from '../domain/dayEntry';
import { DEFAULT_SETTINGS, type DayEntry, type LocalDate, type Settings } from '../domain/types';
import { disableReminders, enableReminders } from '../push/subscribe';
import { buildBackup, parseBackup } from '../storage/backup';
import { db } from '../storage/db';
import {
  getDayEntry,
  getSettings,
  saveDayEntry,
  savePeriods,
  savePushState,
  updateSettings,
} from '../storage/repository';
import { BackupSection } from './components/BackupSection';
import { RemindersSection } from './components/RemindersSection';
import { SymptomPicker } from './components/SymptomPicker';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { button, click, mount, settle, unmountAll, waitUntil } from './testing';

// Фича 019 (research R10): поведение «Резервной копии», «Самочувствия», «Напоминаний», переключателей
// «Настроек» и «Статистики» на экране. Характеризационный тест: записан до переноса решений в чистые
// функции и до компонента Toggle, должен оставаться зелёным после.

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
const DAY = ld('2026-11-10');
const SAVE_FAILED = 'Не удалось сохранить. Попробуйте ещё раз.';
const ALL_ON: Settings = {
  ...DEFAULT_SETTINGS,
  ovulationShiftEnabled: true,
  ovulationFromNextPeriod: true,
  showWellbeing: true,
  showIntensity: true,
  showMood: true,
  showSex: true,
  showNotes: true,
};

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0));
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const notices = (root: ParentNode) => [...root.querySelectorAll('p.notice')].map((p) => [p.className, p.textContent]);
const sheetNotes = (root: ParentNode, title: string) =>
  [...root.querySelectorAll(`dialog[aria-label="${title}"] .sheet__note`)].map((p) => p.textContent);

/** Переключатель по подписи (первый текстовый узел метки), как в saveFailures.test.ts. */
const toggle = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('label.toggle')].find((l) => l.firstElementChild?.firstChild?.textContent?.trim() === label)
    ?.querySelector('input') as HTMLInputElement | undefined;
const card = (root: ParentNode, titleId: string) => root.querySelector(`section[aria-labelledby="${titleId}"]`)!;

async function chooseFile(root: ParentNode, content: string, name = 'file.txt') {
  const input = root.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [new File([content], name)], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settle();
}

/** Текстовая выгрузка другого приложения: блок `cycle N` на каждые месячные (по образцу textImport.test.ts). */
const cycleFile = (starts: string[], broken = 0) =>
  [
    ...starts.flatMap((s, i) => [
      `cycle ${i}`,
      `Period start date: ${s} 20:00:00.0`,
      `Period end date: ${addDaysLD(ld(s), 4)} 20:00:00.0`,
      '---------------',
    ]),
    ...Array.from({ length: broken }, (_, i) => [`cycle ${starts.length + i}`, 'Period start date: oops', '---------------']).flat(),
  ].join('\n');

const STARTS = ['2017-12-23', '2018-01-20', '2018-02-17', '2018-03-17', '2018-04-14'];

describe('«Резервная копия»: вид файла, склонение и даты', () => {
  it.each([
    // Вторая дата — самый поздний конец месячных в файле (textImport.ts, `last`).
    [1, 'Найдено: 1 период месячных (23.12.2017 – 27.12.2017). Добавить в календарь?', 'Добавлено: 1 период месячных'],
    [2, 'Найдено: 2 периода месячных (23.12.2017 – 24.01.2018). Добавить в календарь?', 'Добавлено: 2 периода месячных'],
    [5, 'Найдено: 5 периодов месячных (23.12.2017 – 18.04.2018). Добавить в календарь?', 'Добавлено: 5 периодов месячных'],
  ])('текстовая выгрузка, %i месячных: лист и итог', async (n, found, added) => {
    const m = await mount(createElement(BackupSection));
    const file = cycleFile(STARTS.slice(0, n));
    await chooseFile(m.container, file);
    await waitUntil(() => sheetNotes(m.container, 'Добавить месячные?').length > 0, 'лист импорта');
    expect(sheetNotes(m.container, 'Добавить месячные?')).toEqual([found, 'Заметки, самочувствие и настройки не изменятся.']);

    await click(button(m.container, 'Добавить'));
    await waitUntil(() => notices(m.container).length > 0, 'итог');
    expect(notices(m.container)).toEqual([['notice notice--ok', added]]);

    // Тот же файл ещё раз — добавлять нечего.
    await chooseFile(m.container, file);
    await waitUntil(() => sheetNotes(m.container, 'Добавить месячные?').length > 0, 'лист повторного импорта');
    await click(button(m.container, 'Добавить'));
    await waitUntil(() => notices(m.container)[0]?.[1] !== added, 'итог повторного импорта');
    expect(notices(m.container)).toEqual([['notice notice--ok', 'Все месячные из файла уже были отмечены']]);
  });

  it('текстовая выгрузка: пропущенные и заменяемые месячные', async () => {
    await savePeriods([{ id: 'x', start: ld('2017-12-24'), end: ld('2017-12-26'), endEstimated: false }]);
    const m = await mount(createElement(BackupSection));
    await chooseFile(m.container, cycleFile(STARTS.slice(0, 2), 1));
    await waitUntil(() => sheetNotes(m.container, 'Добавить месячные?').length > 0, 'лист импорта');
    expect(sheetNotes(m.container, 'Добавить месячные?')).toEqual([
      'Найдено: 2 периода месячных (23.12.2017 – 24.01.2018). Добавить в календарь?',
      'Будут заменены уже отмеченные месячные: 1 период.',
      'Пропущено из-за ошибок в файле: 1 период.',
      'Заметки, самочувствие и настройки не изменятся.',
    ]);
  });

  it.each([
    [1, '1 запись дня'],
    [3, '3 записи дней'],
    [12, '12 записей дней'],
  ])('резервная копия с %i записями дней: лист восстановления', async (n, days) => {
    await savePeriods([{ id: 'p', start: ld('2026-10-01'), end: ld('2026-10-05'), endEstimated: false }]);
    for (let i = 0; i < n; i++) await saveDayEntry({ ...emptyDayEntry(addDaysLD(ld('2026-10-01'), i)), note: 'n' });
    const json = JSON.stringify(await buildBackup());
    await db.delete();
    await db.open();

    const expected = [`Будет восстановлено: 1 месячных, ${days}. Текущие данные будут заменены.`];
    for (const content of [json, '\n  \t' + json]) {
      const m = await mount(createElement(BackupSection));
      await chooseFile(m.container, content, 'backup.json');
      await waitUntil(() => sheetNotes(m.container, 'Восстановить данные?').length > 0, 'лист восстановления');
      expect(sheetNotes(m.container, 'Восстановить данные?')).toEqual(expected);
      expect(sheetNotes(m.container, 'Добавить месячные?')).toEqual([]);
      m.unmount();
    }
  });

  it('текст на «{» со строкой «Period start date:» — разбирается как резервная копия', async () => {
    const text = '{ "x": "Period start date: 2017-12-23" }';
    const parsed = parseBackup(text, await getSettings());
    expect(parsed.ok).toBe(false);
    const m = await mount(createElement(BackupSection));
    await chooseFile(m.container, text);
    await waitUntil(() => notices(m.container).length > 0, 'сообщение');
    expect(notices(m.container)).toEqual([['notice notice--error', parsed.ok ? '' : parsed.error]]);
    expect(sheetNotes(m.container, 'Добавить месячные?')).toEqual([]);
  });

  it.each([[''], ['hello']])('файл %j — «Файл не распознан»', async (content) => {
    const m = await mount(createElement(BackupSection));
    await chooseFile(m.container, content);
    await waitUntil(() => notices(m.container).length > 0, 'сообщение');
    expect(notices(m.container)).toEqual([['notice notice--error', 'Файл не распознан']]);
  });
});

describe('«Самочувствие»: отметка, снятие, степень', () => {
  const stored = async (patch: Partial<DayEntry>) => {
    await saveDayEntry({ ...emptyDayEntry(DAY), ...patch });
    return getDayEntry(DAY);
  };
  const picker = (entry: DayEntry | undefined, showIntensity: boolean, open = true) =>
    createElement(SymptomPicker, { open, onClose: () => {}, date: DAY, entry, showIntensity });
  const segment = (root: ParentNode, symptom: string, level: string) =>
    [...[...root.querySelectorAll('fieldset.intensity__row')].find((f) => f.querySelector('legend')?.textContent === symptom)!
      .querySelectorAll('button')].find((b) => b.textContent === level)!;
  const chip = (root: ParentNode, label: string) =>
    [...root.querySelectorAll('button.chip')].find((b) => b.textContent === label)!;

  it('снятый пункт теряет свою степень, степени остальных целы', async () => {
    const entry = await stored({ symptoms: ['headache', 'nausea'], intensity: { headache: 'severe', nausea: 'mild' } });
    const m = await mount(picker(entry, true));
    await click(chip(m.container, 'Головная боль'));
    await click(button(m.container, 'Готово'));
    expect(await getDayEntry(DAY)).toEqual({ ...emptyDayEntry(DAY), symptoms: ['nausea'], intensity: { nausea: 'mild' } });
  });

  it('снова отмеченный пункт получает «средне», прежняя степень не возвращается', async () => {
    const entry = await stored({ symptoms: ['headache', 'nausea'], intensity: { headache: 'severe', nausea: 'mild' } });
    const m = await mount(picker(entry, true));
    await click(chip(m.container, 'Головная боль'));
    await click(chip(m.container, 'Головная боль'));
    await click(button(m.container, 'Готово'));
    // Хранилище держит пункты в порядке справочника, поэтому порядок отметки здесь не виден.
    expect(await getDayEntry(DAY)).toEqual({
      ...emptyDayEntry(DAY),
      symptoms: ['headache', 'nausea'],
      intensity: { nausea: 'mild', headache: 'moderate' },
    });
  });

  it('степень — одна; повторное нажатие её не снимает', async () => {
    const entry = await stored({ symptoms: ['headache', 'nausea'], intensity: { headache: 'severe', nausea: 'mild' } });
    const m = await mount(picker(entry, true));
    await click(segment(m.container, 'Тошнота', 'сильно'));
    await click(segment(m.container, 'Тошнота', 'сильно'));
    expect(segment(m.container, 'Тошнота', 'сильно').getAttribute('aria-pressed')).toBe('true');
    expect(segment(m.container, 'Тошнота', 'слабо').getAttribute('aria-pressed')).toBe('false');
    await click(button(m.container, 'Готово'));
    expect(await getDayEntry(DAY)).toEqual({
      ...emptyDayEntry(DAY),
      symptoms: ['headache', 'nausea'],
      intensity: { headache: 'severe', nausea: 'severe' },
    });
  });

  it('повторное открытие листа сбрасывает несохранённое', async () => {
    const entry = await stored({ symptoms: ['headache'], intensity: { headache: 'severe' } });
    const m = await mount(picker(entry, true));
    await click(chip(m.container, 'Головная боль'));
    expect(chip(m.container, 'Головная боль').getAttribute('aria-pressed')).toBe('false');
    await m.rerender(picker(entry, true, false));
    await m.rerender(picker(entry, true, true));
    expect(chip(m.container, 'Головная боль').getAttribute('aria-pressed')).toBe('true');
    expect(segment(m.container, 'Головная боль', 'сильно').getAttribute('aria-pressed')).toBe('true');
  });

  it('без интенсивности: снятый пункт тоже теряет степень', async () => {
    const entry = await stored({ symptoms: ['headache'], intensity: { headache: 'severe' }, note: 'n' });
    const m = await mount(picker(entry, false));
    await click(chip(m.container, 'Головная боль'));
    await click(button(m.container, 'Готово'));
    expect(await getDayEntry(DAY)).toEqual({ ...emptyDayEntry(DAY), symptoms: [], intensity: {}, note: 'n' });
  });
});

describe('«Напоминания»: подписаться, отписаться или ничего', () => {
  const SUBSCRIBED = { clientId: 'c', token: 't', subscribed: true, pendingSync: false, lastSyncedHash: null };
  const reminders = async (settings: Settings, subscribed: boolean) => {
    if (subscribed) await savePushState(SUBSCRIBED);
    await updateSettings(settings);
    const m = await mount(createElement(RemindersSection, { settings }));
    if (subscribed) await waitUntil(() => m.container.textContent?.includes('Напоминания включены') === true, 'подписка');
    return m;
  };
  const ONLY = (key: 'remindPeriod' | 'remindOvulation'): Settings => ({
    ...DEFAULT_SETTINGS,
    remindPeriod: key === 'remindPeriod',
    remindOvulation: key === 'remindOvulation',
    remindMissedPeriod: false,
  });

  it('подписки нет, другие виды включены — выключение одного подписывает', async () => {
    const m = await reminders(DEFAULT_SETTINGS, false);
    await click(toggle(m.container, 'За 2 дня до месячных'));
    await waitUntil(() => vi.mocked(enableReminders).mock.calls.length === 1, 'подписка');
    expect(disableReminders).not.toHaveBeenCalled();
  });

  it('подписки нет, выключен последний вид — отписка', async () => {
    const m = await reminders(ONLY('remindPeriod'), false);
    await click(toggle(m.container, 'За 2 дня до месячных'));
    await waitUntil(() => vi.mocked(disableReminders).mock.calls.length === 1, 'отписка');
    expect(enableReminders).not.toHaveBeenCalled();
  });

  it('подписка есть, другие виды включены — ничего', async () => {
    const m = await reminders(DEFAULT_SETTINGS, true);
    await click(toggle(m.container, 'В день овуляции'));
    await settle();
    await settle();
    expect((await getSettings()).remindOvulation).toBe(false);
    expect(enableReminders).not.toHaveBeenCalled();
    expect(disableReminders).not.toHaveBeenCalled();
  });

  it('подписка есть, выключен последний вид — отписка', async () => {
    const m = await reminders(ONLY('remindOvulation'), true);
    await click(toggle(m.container, 'В день овуляции'));
    await waitUntil(() => vi.mocked(disableReminders).mock.calls.length === 1, 'отписка');
    expect(enableReminders).not.toHaveBeenCalled();
  });
});

describe('переключатели «Настроек»: своя настройка и своя карточка', () => {
  const TOGGLES: Array<[string, keyof Settings, string]> = [
    ['Учитывать личный сдвиг овуляции', 'ovulationShiftEnabled', 'cycle-title'],
    ['Считать от следующей менструации', 'ovulationFromNextPeriod', 'cycle-title'],
    ['Самочувствие', 'showWellbeing', 'entries-title'],
    ['Интенсивность самочувствия', 'showIntensity', 'entries-title'],
    ['Настроение', 'showMood', 'entries-title'],
    ['Отметка секса', 'showSex', 'entries-title'],
    ['Заметки', 'showNotes', 'entries-title'],
    ['За 2 дня до месячных', 'remindPeriod', 'reminders-title'],
    ['В день овуляции', 'remindOvulation', 'reminders-title'],
    ['Напоминать, если забыла отметить начало месячных', 'remindMissedPeriod', 'reminders-title'],
  ];
  const CARDS = ['cycle-title', 'entries-title', 'reminders-title'];

  async function settingsScreen() {
    await updateSettings(ALL_ON);
    const m = await mount(createElement(SettingsScreen));
    await waitUntil(() => m.container.textContent?.includes('Резервная копия') === true, 'настройки загрузились');
    return m;
  }

  async function settingsWhen(check: (s: Settings) => boolean) {
    for (let i = 0; i < 50; i++) {
      const s = await getSettings();
      if (check(s)) return s;
      await settle();
    }
    throw new Error('настройки не изменились');
  }

  it.each(TOGGLES)('«%s» выключает %s и только её', async (label, key) => {
    const m = await settingsScreen();
    await click(toggle(m.container, label));
    expect(await settingsWhen((s) => s[key] === false)).toEqual({ ...ALL_ON, [key]: false });
  });

  it.each(TOGGLES)('«%s»: при отказе записи сообщение — в своей карточке', async (label, _key, cardId) => {
    const m = await settingsScreen();
    vi.spyOn(db.kv, 'put').mockImplementation((() => Promise.reject(new Error('QuotaExceededError'))) as never);
    await click(toggle(m.container, label));
    await waitUntil(() => m.container.textContent?.includes(SAVE_FAILED) === true, 'сообщение');
    for (const id of CARDS) {
      const failed = [...card(m.container, id).querySelectorAll('p.notice')].filter((p) => p.textContent === SAVE_FAILED);
      expect(failed).toHaveLength(id === cardId ? 1 : 0);
    }
    expect(card(m.container, cardId).lastElementChild?.textContent).toBe(SAVE_FAILED);
    expect(enableReminders).not.toHaveBeenCalled();
    expect(disableReminders).not.toHaveBeenCalled();
  });
});

describe('«Статистика»: даты истории циклов', () => {
  it('полная дата «8 ноября 2026», новые сверху', async () => {
    await savePeriods(
      ['2026-01-01', '2026-01-29', '2026-02-26'].map((s, i) => ({
        id: `p${i}`,
        start: ld(s),
        end: addDaysLD(ld(s), 4),
        endEstimated: false,
      })),
    );
    const m = await mount(createElement(StatsScreen));
    await waitUntil(() => m.container.textContent?.includes('История циклов') === true, 'статистика загрузилась');
    expect([...m.container.querySelectorAll('.history__date')].map((e) => e.textContent)).toEqual([
      '26 февраля 2026',
      '29 января 2026',
      '1 января 2026',
    ]);
  });
});
