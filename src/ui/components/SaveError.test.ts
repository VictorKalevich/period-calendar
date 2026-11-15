// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '../testing';
import { SaveError, useSaveError } from './SaveError';

// Фича 014 (FR-010–FR-013): один общий приём для отказа записи — состояние и сообщение.

const NOTICE = '<p class="notice notice--error" role="alert">Не удалось сохранить. Попробуйте ещё раз.</p>';

let api: ReturnType<typeof useSaveError>;
function Probe() {
  api = useSaveError();
  return createElement(SaveError, { shown: api.failed });
}

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('SaveError', () => {
  it('без ошибки ничего не рисует', async () => {
    const { container } = await mount(createElement(SaveError, { shown: false }));
    expect(container.innerHTML).toBe('');
  });

  it('с ошибкой — сообщение для экранного диктора', async () => {
    const { container } = await mount(createElement(SaveError, { shown: true }));
    expect(container.innerHTML).toBe(NOTICE);
  });
});

describe('useSaveError', () => {
  it('отказ записи → false, сообщение, запись в консоль', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('QuotaExceededError');
    const { container } = await mount(createElement(Probe));
    let ok: boolean | undefined;
    await act(async () => {
      ok = await api.save(() => Promise.reject(err));
    });
    expect(ok).toBe(false);
    expect(api.failed).toBe(true);
    expect(container.innerHTML).toBe(NOTICE);
    expect(log).toHaveBeenCalledWith('save failed', err);
  });

  it('новая удачная попытка → true, сообщение исчезает', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = await mount(createElement(Probe));
    await act(async () => {
      await api.save(() => Promise.reject(new Error('x')));
    });
    let ok: boolean | undefined;
    await act(async () => {
      ok = await api.save(async () => {});
    });
    expect(ok).toBe(true);
    expect(api.failed).toBe(false);
    expect(container.innerHTML).toBe('');
  });

  it('reset() убирает сообщение', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = await mount(createElement(Probe));
    await act(async () => {
      await api.save(() => Promise.reject(new Error('x')));
    });
    await act(async () => api.reset());
    expect(api.failed).toBe(false);
    expect(container.innerHTML).toBe('');
  });
});
