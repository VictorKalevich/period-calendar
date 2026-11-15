// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayDialogFor } from '../domain/dayDialog';
import { buildForecast } from '../domain/forecast';
import type { PeriodAction } from '../domain/periods';
import { DEFAULT_SETTINGS, type DayContext, type DayEntry, type LocalDate, type Period, type Settings } from '../domain/types';
import { db } from '../storage/db';
import { disableReminders, enableReminders } from '../push/subscribe';
import {
  getDayEntry,
  getDevMode,
  getFirstPeriodHintDismissed,
  getPeriods,
  getSettings,
  saveDayEntry,
  savePeriods,
} from '../storage/repository';
import { DayDialog } from './components/DayDialog';
import { DaySheets } from './components/DaySheets';
import { FirstPeriodHint } from './components/FirstPeriodHint';
import { MoodPicker } from './components/MoodPicker';
import { NoteEditor } from './components/NoteEditor';
import { SymptomPicker } from './components/SymptomPicker';
import { VersionTapper } from './components/VersionTapper';
import { SettingsScreen } from './screens/SettingsScreen';
import { button, click, mount, unmountAll, waitUntil } from './testing';

// Фича 014 (FR-010–FR-014, SC-004): отказ записи — сообщение там, где было действие; лист не закрывается,
// выбранное не сбрасывается, данные в базе прежние; повторная удачная попытка — как раньше.

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

const SAVE_FAILED = 'Не удалось сохранить. Попробуйте ещё раз.';
const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-11-14');
const DAY = ld('2026-11-10');
const ALL_ON: Settings = { ...DEFAULT_SETTINGS, showSex: true, showWellbeing: true, showMood: true, showNotes: true, showIntensity: true };
const OLD_PERIOD: Period = { id: 'old', start: ld('2026-09-01'), end: ld('2026-09-05'), endEstimated: false };
const PERIOD: Period = { id: 'p1', start: ld('2026-11-01'), end: ld('2026-11-05'), endEstimated: false };

const entry = (patch: Partial<DayEntry>): DayEntry => ({ date: DAY, symptoms: [], intensity: {}, moods: [], sex: false, note: '', ...patch });

const ctxFor = (periods: Period[]): DayContext => ({
  forecast: buildForecast({ periods, settings: ALL_ON, today: TODAY }),
  periods,
  settings: ALL_ON,
  entries: new Set(),
  sexDates: new Set(),
  today: TODAY,
});

/** Отказ записи: метод таблицы Dexie отклоняется (например, переполнено хранилище). */
function failWrites<T extends object>(table: T, ...methods: Array<keyof T & string>) {
  const err = new Error('QuotaExceededError');
  return methods.map((m) => vi.spyOn(table, m as never).mockImplementation((() => Promise.reject(err)) as never));
}
const restore = (spies: Array<{ mockRestore: () => void }>) => spies.forEach((s) => s.mockRestore());

const notices = (root: ParentNode) => [...root.querySelectorAll('p.notice')];
const saveNotice = (root: ParentNode) => notices(root).find((p) => p.textContent === SAVE_FAILED);
const pressed = (root: ParentNode) =>
  [...root.querySelectorAll('[aria-pressed="true"]')].map((b) => b.textContent);
const dialogOpen = (root: ParentNode) => [...root.querySelectorAll('dialog')].some((d) => d.open);

async function typeInto(el: HTMLTextAreaElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete();
  await db.open();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('листы дня', () => {
  it('«Настроение»: сообщение над «Готово», лист открыт, выбор цел; повтор закрывает лист', async () => {
    const saved = entry({ moods: ['calm'] });
    await saveDayEntry(saved);
    const onClose = vi.fn();
    const m = await mount(createElement(MoodPicker, { open: true, onClose, date: DAY, entry: saved }));
    await click(button(m.container, 'Радостная'));

    const spies = failWrites(db.days, 'put');
    await click(button(m.container, 'Готово'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(button(m.container, 'Готово')!.previousElementSibling).toBe(saveNotice(m.container));
    expect(saveNotice(m.container)!.outerHTML).toBe(`<p class="notice notice--error" role="alert">${SAVE_FAILED}</p>`);
    expect(dialogOpen(m.container)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(pressed(m.container)).toEqual(['Радостная', 'Спокойная']);
    expect((await getDayEntry(DAY))?.moods).toEqual(['calm']);

    restore(spies);
    await click(button(m.container, 'Готово'));
    await waitUntil(() => onClose.mock.calls.length === 1, 'лист закрыт');
    expect(saveNotice(m.container)).toBeUndefined();
    expect((await getDayEntry(DAY))?.moods).toEqual(['joyful', 'calm']);
  });

  it('«Настроение»: после закрытия и повторного открытия сообщения нет', async () => {
    const props = { onClose: () => {}, date: DAY, entry: undefined };
    const m = await mount(createElement(MoodPicker, { open: true, ...props }));
    await click(button(m.container, 'Радостная'));
    failWrites(db.days, 'put');
    await click(button(m.container, 'Готово'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');

    await m.rerender(createElement(MoodPicker, { open: false, ...props }));
    await m.rerender(createElement(MoodPicker, { open: true, ...props }));
    expect(saveNotice(m.container)).toBeUndefined();
  });

  it('«Самочувствие»: сообщение над «Готово», пункты и степени целы', async () => {
    const saved = entry({ symptoms: ['headache'], intensity: { headache: 'severe' } });
    await saveDayEntry(saved);
    const onClose = vi.fn();
    const m = await mount(createElement(SymptomPicker, { open: true, onClose, date: DAY, entry: saved, showIntensity: true }));
    await click(button(m.container, 'Тошнота'));

    failWrites(db.days, 'put');
    await click(button(m.container, 'Готово'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(button(m.container, 'Готово')!.previousElementSibling).toBe(saveNotice(m.container));
    expect(dialogOpen(m.container)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(pressed(m.container)).toEqual(['Головная боль', 'Тошнота', 'сильно', 'средне']);
    expect(await getDayEntry(DAY)).toEqual(saved);
  });

  it('«Заметка»: сообщение над «Сохранить», текст цел', async () => {
    const saved = entry({ note: 'Старая' });
    await saveDayEntry(saved);
    const onClose = vi.fn();
    const m = await mount(createElement(NoteEditor, { open: true, onClose, date: DAY, entry: saved }));
    const area = m.container.querySelector('textarea')!;
    await typeInto(area, 'Новая');

    failWrites(db.days, 'put', 'delete');
    await click(button(m.container, 'Сохранить'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(button(m.container, 'Сохранить')!.previousElementSibling).toBe(saveNotice(m.container));
    expect(area.value).toBe('Новая');
    expect(onClose).not.toHaveBeenCalled();
    expect((await getDayEntry(DAY))?.note).toBe('Старая');
  });

  it('«Удалить заметку?»: сообщение над «Удалить»; «Отмена» убирает его', async () => {
    const saved = entry({ note: 'Старая' });
    await saveDayEntry(saved);
    const onClose = vi.fn();
    const m = await mount(createElement(NoteEditor, { open: true, onClose, date: DAY, entry: saved }));
    await click(m.container.querySelector('[aria-label="Удалить заметку"]'));

    failWrites(db.days, 'put', 'delete');
    await click(button(m.container, 'Удалить'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(button(m.container, 'Удалить')!.previousElementSibling).toBe(saveNotice(m.container));
    expect(m.container.querySelector('.sheet__title')?.textContent).toBe('Удалить заметку?');
    expect(onClose).not.toHaveBeenCalled();
    expect((await getDayEntry(DAY))?.note).toBe('Старая');

    await click(button(m.container, 'Отмена'));
    expect(button(m.container, 'Сохранить')).toBeDefined();
    expect(saveNotice(m.container)).toBeUndefined();
  });

  it('диалог дня, «Начало месячных»: сообщение под кнопками месячных, месячные прежние', async () => {
    await savePeriods([OLD_PERIOD]);
    const onChange = vi.fn();
    const m = await mount(createElement(DaySheets, { which: 'day', onChange, date: DAY, ctx: ctxFor([OLD_PERIOD]), entry: undefined }));
    const start = button(m.container, 'Начало месячных')!;

    failWrites(db.periods, 'bulkPut');
    await click(start);
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    const notice = saveNotice(m.container)!;
    expect(notice.nextElementSibling).toBe(button(m.container, 'Отметить секс'));
    expect(notices(m.container)).toHaveLength(1);
    expect(dialogOpen(m.container)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(await getPeriods()).toEqual([OLD_PERIOD]);
  });

  it('диалог дня, «Отметить секс»: то же место, диалог открыт, запись дня прежняя', async () => {
    const onChange = vi.fn();
    const m = await mount(createElement(DaySheets, { which: 'day', onChange, date: DAY, ctx: ctxFor([]), entry: undefined }));

    failWrites(db.days, 'put');
    await click(button(m.container, 'Отметить секс'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(saveNotice(m.container)!.nextElementSibling).toBe(button(m.container, 'Отметить секс'));
    expect(dialogOpen(m.container)).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(await getDayEntry(DAY)).toBeUndefined();
  });

  it('«Удалить месячные?»: сообщение над «Удалить», месячные на месте', async () => {
    await savePeriods([PERIOD]);
    const onChange = vi.fn();
    const m = await mount(createElement(DaySheets, { which: 'day', onChange, date: PERIOD.start, ctx: ctxFor([PERIOD]), entry: undefined }));
    await click(button(m.container, 'Удалить период'));

    failWrites(db.periods, 'bulkPut');
    await click(button(m.container, 'Удалить'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(button(m.container, 'Удалить')!.previousElementSibling).toBe(saveNotice(m.container));
    expect(m.container.querySelector('.sheet__title')?.textContent).toBe('Удалить месячные?');
    expect(onChange).not.toHaveBeenCalled();
    expect(await getPeriods()).toEqual([PERIOD]);

    await click(button(m.container, 'Отмена'));
    expect(saveNotice(m.container)).toBeUndefined();
  });

  it('доменная ошибка диалога дня — как раньше; затем отказ записи заменяет её, а не добавляется', async () => {
    const base = dayDialogFor(DAY, TODAY, [], 5, ALL_ON);
    const bad: PeriodAction = { kind: 'end-here', label: 'Плохое', apply: () => ({ ok: false, error: 'no-open-period' }) };
    const good: PeriodAction = { kind: 'start', label: 'Хорошее', apply: () => ({ ok: true, value: [PERIOD] }) };
    const onClose = vi.fn();
    const m = await mount(
      createElement(DayDialog, {
        open: true,
        onClose,
        dialog: { ...base, periodActions: [bad, good] },
        onExtra: () => {},
        onToggleSex: async () => {},
      }),
    );

    await click(button(m.container, 'Плохое'));
    expect(notices(m.container).map((p) => p.outerHTML)).toEqual([
      '<p class="notice notice--error" role="alert">Сначала отметьте начало месячных</p>',
    ]);

    failWrites(db.periods, 'bulkPut');
    await click(button(m.container, 'Хорошее'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(notices(m.container).map((p) => p.textContent)).toEqual([SAVE_FAILED]);
    expect(onClose).not.toHaveBeenCalled();
  });
});

/** Переключатель по подписи (первый текстовый узел метки). */
const toggle = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('label.toggle')].find((l) => l.firstElementChild?.firstChild?.textContent?.trim() === label)
    ?.querySelector('input') as HTMLInputElement | undefined;

const card = (root: ParentNode, titleId: string) => root.querySelector(`section[aria-labelledby="${titleId}"]`)!;

async function settingsScreen() {
  const m = await mount(createElement(SettingsScreen));
  await waitUntil(() => m.container.textContent?.includes('Резервная копия') === true, 'настройки загрузились');
  return m;
}

describe('вне листов', () => {
  it('карточка «Цикл»: сообщение последним элементом, значение прежнее; повтор сохраняет', async () => {
    const m = await settingsScreen();
    const more = m.container.querySelector('[aria-label="Длина цикла по умолчанию: больше"]')!;

    const spies = failWrites(db.kv, 'put');
    await click(more);
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(card(m.container, 'cycle-title').lastElementChild).toBe(saveNotice(m.container));
    expect(notices(m.container)).toHaveLength(1);
    expect(card(m.container, 'cycle-title').querySelector('output')?.textContent).toBe('28 дн.');
    expect((await getSettings()).defaultCycleLength).toBe(28);

    restore(spies);
    await click(more);
    await waitUntil(() => card(m.container, 'cycle-title').querySelector('output')?.textContent === '29 дн.', 'новое значение');
    expect(saveNotice(m.container)).toBeUndefined();
  });

  it('карточка «Записи дня»: переключатель не включился, сообщение в карточке', async () => {
    const m = await settingsScreen();
    failWrites(db.kv, 'put');
    await click(toggle(card(m.container, 'entries-title'), 'Самочувствие'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(card(m.container, 'entries-title').lastElementChild).toBe(saveNotice(m.container));
    expect(toggle(card(m.container, 'entries-title'), 'Самочувствие')!.checked).toBe(false);
    expect((await getSettings()).showWellbeing).toBe(false);
  });

  it('карточка «Напоминания»: сообщение последним элементом; подписка не трогается', async () => {
    const m = await settingsScreen();
    const reminders = () => card(m.container, 'reminders-title');

    const spies = failWrites(db.kv, 'put');
    await click(toggle(reminders(), 'За 2 дня до месячных'));
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(reminders().lastElementChild).toBe(saveNotice(m.container));
    expect(toggle(reminders(), 'За 2 дня до месячных')!.checked).toBe(true);
    expect(enableReminders).not.toHaveBeenCalled();
    expect(disableReminders).not.toHaveBeenCalled();

    restore(spies);
    await click(toggle(reminders(), 'За 2 дня до месячных'));
    await waitUntil(() => toggle(reminders(), 'За 2 дня до месячных')!.checked === false, 'выключено');
    expect(saveNotice(m.container)).toBeUndefined();
  });

  it('строка версии: сообщение под ней, тоста нет, режим разработчика прежний', async () => {
    const m = await mount(createElement(VersionTapper, { devMode: false }));
    const version = m.container.querySelector('button.version')!;
    const tap7 = async () => {
      for (let i = 0; i < 7; i++) await click(version);
    };

    const spies = failWrites(db.kv, 'put');
    await tap7();
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(version.nextElementSibling).toBe(saveNotice(m.container));
    expect(m.container.querySelector('p.toast')!.textContent).toBe('');
    expect(await getDevMode()).toBe(false);

    restore(spies);
    await tap7();
    await waitUntil(() => m.container.querySelector('p.toast')!.textContent === 'Режим разработчика включён', 'тост');
    expect(saveNotice(m.container)).toBeUndefined();
    expect(await getDevMode()).toBe(true);
  });

  it('подсказка «Как получить прогноз»: сообщение отдельным блоком под ней, флаг прежний', async () => {
    const m = await mount(createElement(FirstPeriodHint));
    const close = m.container.querySelector('[aria-label="Скрыть подсказку"]')!;

    const spies = failWrites(db.kv, 'put');
    await click(close);
    await waitUntil(() => saveNotice(m.container) !== undefined, 'сообщение');
    expect(m.container.querySelector('section.hint')!.nextElementSibling).toBe(saveNotice(m.container));
    expect(await getFirstPeriodHintDismissed()).toBe(false);

    restore(spies);
    await click(close);
    await waitUntil(() => saveNotice(m.container) === undefined, 'сообщение исчезло');
    expect(await getFirstPeriodHintDismissed()).toBe(true);
  });
});
