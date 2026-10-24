import { describe, expect, it } from 'vitest';
import { createScrollLock, type ScrollLockWindow } from './scrollLock';

function fakeWindow(scrollY: number) {
  const style: Record<string, string> = { position: '', top: '', width: '', overflow: '' };
  const scrolls: Array<[number, number]> = [];
  const win: ScrollLockWindow = {
    scrollY,
    document: { body: { style } },
    scrollTo: (x: number, y: number) => {
      scrolls.push([x, y]);
    },
  };
  return { win, style, scrolls };
}

describe('createScrollLock (US6)', () => {
  it('fixes the body at −scrollY on the first lock', () => {
    const { win, style } = fakeWindow(420);
    createScrollLock(win).lock();
    expect(style).toEqual({ position: 'fixed', top: '-420px', width: '100%', overflow: 'hidden' });
  });

  it('restores styles and scroll position on the last unlock', () => {
    const { win, style, scrolls } = fakeWindow(420);
    const lock = createScrollLock(win);
    lock.lock();
    lock.unlock();
    expect(style).toEqual({ position: '', top: '', width: '', overflow: '' });
    expect(scrolls).toEqual([[0, 420]]);
  });

  it('keeps an existing inline style of the body', () => {
    const { win, style } = fakeWindow(0);
    style.overflow = 'auto';
    const lock = createScrollLock(win);
    lock.lock();
    lock.unlock();
    expect(style.overflow).toBe('auto');
  });

  it('nested locks are counted: only the last unlock releases the page', () => {
    const { win, style, scrolls } = fakeWindow(100);
    const lock = createScrollLock(win);
    lock.lock();
    win.scrollY = 0; // при position: fixed браузер сообщает 0
    lock.lock();
    expect(style.top).toBe('-100px');
    lock.unlock();
    expect(style.position).toBe('fixed');
    expect(scrolls).toEqual([]);
    lock.unlock();
    expect(style.position).toBe('');
    expect(scrolls).toEqual([[0, 100]]);
  });

  it('extra unlock without a lock does nothing', () => {
    const { win, style, scrolls } = fakeWindow(50);
    createScrollLock(win).unlock();
    expect(style.position).toBe('');
    expect(scrolls).toEqual([]);
  });
});
