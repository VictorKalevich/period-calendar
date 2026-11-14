// @vitest-environment happy-dom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { button, click, mount, unmountAll } from './testing';

// Фича 014 (FR-001, FR-002, SC-003): упавший экран вкладки заменяется аварийной карточкой,
// нижняя навигация работает, другие вкладки открываются, возврат — новая попытка отрисовки.

const stats = vi.hoisted(() => ({ renders: 0 }));

vi.mock('./screens/CalendarScreen', async () => {
  const { createElement: h } = await import('react');
  return { CalendarScreen: () => h('p', null, 'calendar') };
});
vi.mock('./screens/SettingsScreen', async () => {
  const { createElement: h } = await import('react');
  return { SettingsScreen: () => h('p', null, 'settings') };
});
vi.mock('./screens/StatsScreen', () => ({
  StatsScreen: () => {
    stats.renders++;
    throw new Error('stats crashed');
  },
}));
vi.mock('./components/UpdateBanner', () => ({ UpdateBanner: () => null }));

const tab = (root: ParentNode, label: string) =>
  [...root.querySelectorAll('nav.tabbar button')].find((b) => b.textContent === label) as HTMLButtonElement | undefined;

beforeEach(() => {
  history.replaceState(null, '', '#');
  stats.renders = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('App — граница ошибок вокруг экрана вкладки', () => {
  it('обычный путь: в main ровно экран вкладки', async () => {
    const { container } = await mount(createElement(App));
    expect(container.querySelector('main.app__screen')!.innerHTML).toBe('<p>calendar</p>');
  });

  it('упавшая вкладка — аварийная карточка и рабочая навигация; другие вкладки открываются', async () => {
    const { container } = await mount(createElement(App));
    const main = () => container.querySelector('main.app__screen')!;

    await click(tab(container, 'Статистика'));
    expect(main().querySelector('#emergency-title')?.textContent).toBe('Что-то пошло не так');
    expect(button(main(), 'Экспорт данных')).toBeDefined();
    expect(button(main(), 'Перезагрузить')).toBeDefined();
    expect(container.querySelectorAll('nav.tabbar button')).toHaveLength(3);
    expect(tab(container, 'Статистика')!.getAttribute('aria-current')).toBe('page');

    await click(tab(container, 'Календарь'));
    expect(main().innerHTML).toBe('<p>calendar</p>');

    await click(tab(container, 'Настройки'));
    expect(main().innerHTML).toBe('<p>settings</p>');
  });

  it('возврат на упавшую вкладку — новая попытка отрисовки', async () => {
    const { container } = await mount(createElement(App));
    await click(tab(container, 'Статистика'));
    const first = stats.renders;
    expect(first).toBeGreaterThan(0);

    await click(tab(container, 'Календарь'));
    await click(tab(container, 'Статистика'));
    expect(stats.renders).toBeGreaterThan(first);
    expect(container.querySelector('#emergency-title')).not.toBeNull();
  });
});
