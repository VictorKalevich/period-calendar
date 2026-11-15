// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OVULATION_REMINDER, PERIOD_REMINDER } from '../domain/reminders';
import { DEFAULT_SETTINGS, type Settings } from '../domain/types';
import { enableReminders } from '../push/subscribe';
import { RemindersSection } from './components/RemindersSection';
import { SettingsScreen } from './screens/SettingsScreen';
import { button, click, mount, settle, unmountAll } from './testing';

// Фича 019 (FR-011, SC-004; research R1): прежняя разметка всех 10 переключателей «Настроек» и «Напоминаний».
// Характеризационный тест: записан до компонента Toggle и должен совпадать после замены.
// Серверная отрисовка настоящих экранов — при подмене useLiveQuery (данные отдаются синхронно);
// недоступный вариант (`disabled`, пока идёт включение напоминаний) — в DOM.

const live = vi.hoisted(() => ({ settings: undefined as unknown, push: undefined as unknown }));

vi.mock('../hooks/useLiveQuery', async () => {
  const repo = await import('../storage/repository');
  return {
    useLiveQuery: (query: unknown) =>
      query === repo.getSettings
        ? live.settings
        : query === repo.getDevMode
          ? false
          : query === repo.getPushState
            ? live.push
            : undefined,
  };
});
vi.mock('../push/subscribe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../push/subscribe')>()),
  isPushConfigured: () => true,
  isPushSupported: () => true,
  isStandalone: () => true,
  notificationPermission: () => 'granted',
  enableReminders: vi.fn(),
  disableReminders: vi.fn(async () => {}),
}));
vi.mock('../push/sync', () => ({ syncReminders: vi.fn(async () => {}), startReminderSync: vi.fn() }));

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
const ALL_OFF: Settings = { ...DEFAULT_SETTINGS, remindPeriod: false, remindOvulation: false, remindMissedPeriod: false };

const MISSED_HINT = 'Придёт на 3-й день после ожидаемого начала месячных, если оно не отмечено';

const toggles = (html: string) => html.match(/<label class="toggle">.*?<\/label>/g) ?? [];

afterEach(() => {
  unmountAll();
  vi.clearAllMocks();
});

describe('разметка переключателей (снята до компонента Toggle)', () => {
  it('«Настройки», всё включено: 10 переключателей в порядке экрана', () => {
    live.settings = ALL_ON;
    live.push = { subscribed: false };
    const html = renderToStaticMarkup(createElement(SettingsScreen));
    expect(toggles(html)).toEqual([
      '<label class="toggle"><span>Учитывать личный сдвиг овуляции</span><input type="checkbox" role="switch" checked=""/></label>',
      '<label class="toggle"><span>Считать от следующей менструации</span><input type="checkbox" role="switch" aria-describedby="ovulation-mode-hint" checked=""/></label>',
      '<label class="toggle"><span>Самочувствие</span><input type="checkbox" role="switch" checked=""/></label>',
      '<label class="toggle"><span>Интенсивность самочувствия<span class="t-small toggle__hint">Слабо, средне или сильно — для каждой отметки самочувствия</span></span><input type="checkbox" role="switch" checked=""/></label>',
      '<label class="toggle"><span>Настроение<span class="t-small toggle__hint">Можно выбрать несколько</span></span><input type="checkbox" role="switch" checked=""/></label>',
      '<label class="toggle"><span>Отметка секса<span class="t-small toggle__hint">Сердечко в календаре</span></span><input type="checkbox" role="switch" checked=""/></label>',
      '<label class="toggle"><span>Заметки</span><input type="checkbox" role="switch" checked=""/></label>',
      `<label class="toggle"><span>За 2 дня до месячных<span class="t-small toggle__hint">${PERIOD_REMINDER.body}</span></span><input type="checkbox" role="switch" checked=""/></label>`,
      `<label class="toggle"><span>В день овуляции<span class="t-small toggle__hint">${OVULATION_REMINDER.body}</span></span><input type="checkbox" role="switch" checked=""/></label>`,
      `<label class="toggle"><span>Напоминать, если забыла отметить начало месячных<span class="t-small toggle__hint">${MISSED_HINT}</span></span><input type="checkbox" role="switch" checked=""/></label>`,
    ]);
    // Пояснение, на которое ссылается «Считать от следующей менструации», на месте.
    expect(html).toContain('<p id="ovulation-mode-hint" class="t-caption settings-card__hint">');
  });

  it('«Настройки», всё выключено: 9 переключателей, «Интенсивность» скрыта', () => {
    live.settings = ALL_OFF;
    live.push = { subscribed: false };
    const html = renderToStaticMarkup(createElement(SettingsScreen));
    expect(toggles(html)).toEqual([
      '<label class="toggle"><span>Учитывать личный сдвиг овуляции</span><input type="checkbox" role="switch"/></label>',
      '<label class="toggle"><span>Считать от следующей менструации</span><input type="checkbox" role="switch" aria-describedby="ovulation-mode-hint"/></label>',
      '<label class="toggle"><span>Самочувствие</span><input type="checkbox" role="switch"/></label>',
      '<label class="toggle"><span>Настроение<span class="t-small toggle__hint">Можно выбрать несколько</span></span><input type="checkbox" role="switch"/></label>',
      '<label class="toggle"><span>Отметка секса<span class="t-small toggle__hint">Сердечко в календаре</span></span><input type="checkbox" role="switch"/></label>',
      '<label class="toggle"><span>Заметки</span><input type="checkbox" role="switch"/></label>',
      `<label class="toggle"><span>За 2 дня до месячных<span class="t-small toggle__hint">${PERIOD_REMINDER.body}</span></span><input type="checkbox" role="switch"/></label>`,
      `<label class="toggle"><span>В день овуляции<span class="t-small toggle__hint">${OVULATION_REMINDER.body}</span></span><input type="checkbox" role="switch"/></label>`,
      `<label class="toggle"><span>Напоминать, если забыла отметить начало месячных<span class="t-small toggle__hint">${MISSED_HINT}</span></span><input type="checkbox" role="switch"/></label>`,
    ]);
    expect(html).not.toContain('Настройте, на сколько дней');
  });

  it('«Напоминания»: пока идёт включение, переключатели недоступны; после — снова доступны', async () => {
    live.settings = ALL_ON;
    live.push = { subscribed: false };
    let resolve: (p: NotificationPermission) => void = () => {};
    vi.mocked(enableReminders).mockReturnValue(new Promise((r) => (resolve = r)));

    const m = await mount(createElement(RemindersSection, { settings: ALL_ON }));
    const inputs = () => [...m.container.querySelectorAll<HTMLInputElement>('input[role="switch"]')];
    const labels = () => [...m.container.querySelectorAll('label.toggle')].map((l) => l.outerHTML);
    expect(inputs()).toHaveLength(3);

    await click(button(m.container, 'Включить напоминания'));
    expect(inputs().map((i) => i.disabled)).toEqual([true, true, true]);
    expect(labels()).toMatchInlineSnapshot(`
      [
        "<label class="toggle"><span>За 2 дня до месячных<span class="t-small toggle__hint">Ближайшие дни будь аккуратна, скоро начало цикла</span></span><input role="switch" type="checkbox" checked="" disabled=""></label>",
        "<label class="toggle"><span>В день овуляции<span class="t-small toggle__hint">Сегодня Ты КОРОЛЕВА</span></span><input role="switch" type="checkbox" checked="" disabled=""></label>",
        "<label class="toggle"><span>Напоминать, если забыла отметить начало месячных<span class="t-small toggle__hint">Придёт на 3-й день после ожидаемого начала месячных, если оно не отмечено</span></span><input role="switch" type="checkbox" checked="" disabled=""></label>",
      ]
    `);

    await act(async () => resolve('granted'));
    await settle();
    expect(inputs().map((i) => i.disabled)).toEqual([false, false, false]);
    expect(labels()).toMatchInlineSnapshot(`
      [
        "<label class="toggle"><span>За 2 дня до месячных<span class="t-small toggle__hint">Ближайшие дни будь аккуратна, скоро начало цикла</span></span><input role="switch" type="checkbox" checked=""></label>",
        "<label class="toggle"><span>В день овуляции<span class="t-small toggle__hint">Сегодня Ты КОРОЛЕВА</span></span><input role="switch" type="checkbox" checked=""></label>",
        "<label class="toggle"><span>Напоминать, если забыла отметить начало месячных<span class="t-small toggle__hint">Придёт на 3-й день после ожидаемого начала месячных, если оно не отмечено</span></span><input role="switch" type="checkbox" checked=""></label>",
      ]
    `);
  });
});
