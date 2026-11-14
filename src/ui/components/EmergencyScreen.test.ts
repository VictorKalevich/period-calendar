// @vitest-environment happy-dom
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { button, click, mount, unmountAll } from '../testing';
import { EmergencyPage, EmergencyScreen } from './EmergencyScreen';
import { exportData } from './share';

// Фича 014 (FR-005, FR-006, FR-008; contracts/ui.md): аварийная карточка из компонентов дизайн-системы.

vi.mock('./share', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./share')>()),
  exportData: vi.fn(async () => true),
}));

const TEXT =
  'Экран не удалось показать. Данные хранятся только на этом телефоне — сохраните резервную копию, затем перезагрузите приложение.';

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
  vi.mocked(exportData).mockClear();
});

describe('EmergencyScreen', () => {
  it('карточка: заголовок, текст, «Экспорт данных» (главная), «Перезагрузить»; сообщения нет', async () => {
    const { container } = await mount(createElement(EmergencyScreen));
    const card = container.firstElementChild!;
    expect(card.tagName).toBe('SECTION');
    expect(card.className).toBe('card settings-card');
    expect(card.getAttribute('aria-labelledby')).toBe('emergency-title');
    const [title, text, primary, reload, ...rest] = [...card.children];
    expect(title!.outerHTML).toBe('<h1 id="emergency-title" class="t-card-title settings-card__title">Что-то пошло не так</h1>');
    expect(text!.outerHTML).toBe(`<p class="t-body settings-card__text">${TEXT}</p>`);
    expect(primary!.outerHTML).toBe('<button type="button" class="btn btn--primary">Экспорт данных</button>');
    expect(reload!.outerHTML).toBe('<button type="button" class="btn">Перезагрузить</button>');
    expect(rest).toEqual([]);
  });

  it('«Экспорт данных» — общий экспорт резервной копии', async () => {
    const { container } = await mount(createElement(EmergencyScreen));
    await click(button(container, 'Экспорт данных'));
    expect(exportData).toHaveBeenCalledTimes(1);
  });

  it('«Перезагрузить» перезагружает приложение', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const { container } = await mount(createElement(EmergencyScreen));
    await click(button(container, 'Перезагрузить'));
    vi.unstubAllGlobals();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('EmergencyPage — сбой оболочки приложения', () => {
  it('та же карточка на всю страницу, без навигации', async () => {
    const { container } = await mount(createElement(EmergencyPage));
    const main = container.querySelector(':scope > div.app > main.app__screen');
    expect(main).not.toBeNull();
    expect(main!.children).toHaveLength(1);
    expect(main!.querySelector('#emergency-title')?.textContent).toBe('Что-то пошло не так');
    expect(container.querySelector('nav')).toBeNull();
  });
});
