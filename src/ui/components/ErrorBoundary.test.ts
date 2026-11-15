// @vitest-environment happy-dom
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '../testing';
import { ErrorBoundary } from './ErrorBoundary';

// Фича 014 (FR-001, FR-009): исключение при отрисовке — запасной вид вместо пустой страницы;
// без сбоя граница ничего не добавляет в разметку; ошибка по-прежнему пишется в консоль.

const fallback = createElement('p', { className: 'fallback' }, 'запасной вид');

function Boom(): never {
  throw new Error('boom');
}

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('без сбоя — ровно разметка детей', async () => {
    const m = await mount(createElement(ErrorBoundary, { fallback, children: createElement('p', null, 'ok') }));
    expect(m.container.innerHTML).toBe('<p>ok</p>');
  });

  it('ребёнок бросает при отрисовке — показан запасной вид', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const m = await mount(createElement(ErrorBoundary, { fallback, children: createElement(Boom) }));
    expect(m.container.innerHTML).toBe('<p class="fallback">запасной вид</p>');
  });

  it('ошибка не скрыта от консоли', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount(createElement(ErrorBoundary, { fallback, children: createElement(Boom) }));
    const logged = log.mock.calls.flat().some((arg) => arg instanceof Error && arg.message === 'boom');
    expect(logged).toBe(true);
  });
});
