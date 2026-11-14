// Обвязка UI-тестов в happy-dom (фича 014, research R1). В приложение не входит — импортируют только тесты.
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  rerender: (el: ReactElement) => Promise<void>;
  unmount: () => void;
}

const mounted = new Set<Mounted>();

/** Отрисовать элемент в новом контейнере внутри `document.body`. */
export async function mount(el: ReactElement): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(el));
  const m: Mounted = {
    container,
    rerender: (next) => act(async () => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      mounted.delete(m);
    },
  };
  mounted.add(m);
  return m;
}

/** Размонтировать всё, что отрисовано через `mount` (для `afterEach`). */
export function unmountAll() {
  for (const m of [...mounted]) m.unmount();
}

/** Нажатие внутри `act`, с ожиданием асинхронных обработчиков. */
export async function click(el: Element | null | undefined) {
  if (!el) throw new Error('click: элемент не найден');
  await act(async () => {
    (el as HTMLElement).click();
  });
  await settle();
}

/** Дать отработать IndexedDB и liveQuery. */
export const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

/** Ждать, пока условие не станет истинным (IndexedDB и liveQuery асинхронны). */
export async function waitUntil(check: () => boolean, what = 'условие') {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await settle();
  }
  throw new Error(`waitUntil: не дождались — ${what}`);
}

/** Кнопка по видимому тексту. */
export function button(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
}
