// Блокировка прокрутки страницы под открытыми шитами (фича 005, US6).
// iOS Safari игнорирует overflow: hidden на body, поэтому body фиксируется на месте
// (position: fixed; top: −scrollY), а после закрытия последнего шита позиция восстанавливается.

type LockedProp = 'position' | 'top' | 'width' | 'overflow';

export interface ScrollLockWindow {
  scrollY: number;
  document: { body: { style: Record<LockedProp, string> } };
  scrollTo(x: number, y: number): void;
}

export interface ScrollLock {
  lock(): void;
  unlock(): void;
}

export function createScrollLock(win: ScrollLockWindow): ScrollLock {
  let count = 0;
  let savedY = 0;
  let saved: Record<LockedProp, string> | null = null;

  return {
    lock() {
      count += 1;
      if (count > 1) return;
      const style = win.document.body.style;
      savedY = win.scrollY;
      saved = { position: style.position, top: style.top, width: style.width, overflow: style.overflow };
      style.position = 'fixed';
      style.top = `-${savedY}px`;
      style.width = '100%';
      style.overflow = 'hidden';
    },
    unlock() {
      if (count === 0) return;
      count -= 1;
      if (count > 0 || !saved) return;
      Object.assign(win.document.body.style, saved);
      saved = null;
      win.scrollTo(0, savedY);
    },
  };
}

/** Общая блокировка для всех шитов приложения (вложенные открытия считаются). */
export const pageScrollLock: ScrollLock =
  typeof window === 'undefined'
    ? { lock() {}, unlock() {} }
    : createScrollLock(window as unknown as ScrollLockWindow);
