import { afterEach, describe, expect, it, vi } from 'vitest';
import { attempt } from './attempt';

// Фича 014: общий приём для записи и экспорта — отказ не теряется молча и не роняет интерфейс.

describe('attempt — выполнить действие, отказ записать в консоль', () => {
  afterEach(() => vi.restoreAllMocks());

  it('успех → true, консоль молчит', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(attempt('save', async () => {})).resolves.toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it('отклонённое действие → false и запись «<что> failed» с ошибкой', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('QuotaExceededError');
    await expect(attempt('save', () => Promise.reject(err))).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('save failed', err);
  });

  it('синхронное исключение внутри действия → false', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('boom');
    await expect(
      attempt('export', () => {
        throw err;
      }),
    ).resolves.toBe(false);
    expect(log).toHaveBeenCalledWith('export failed', err);
  });
});
