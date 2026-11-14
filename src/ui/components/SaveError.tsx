import { useCallback, useState } from 'react';
import { attempt } from '../attempt';

/** Текст ошибки сохранения (фича 014, design.md «Аварийный экран и ошибка сохранения»). */
export const SAVE_ERROR_TEXT = 'Не удалось сохранить. Попробуйте ещё раз.';

/**
 * Общий приём для отказа записи (фича 014): `save(write)` выполняет запись и возвращает `true` при успехе —
 * тогда обработчик делает то же, что раньше (например, закрывает лист); при отказе — `false` и `failed`,
 * чтобы показать `<SaveError />`. `reset()` — при открытии/закрытии листа.
 */
export function useSaveError() {
  const [failed, setFailed] = useState(false);

  const save = useCallback(async (write: () => Promise<unknown>) => {
    setFailed(false);
    const ok = await attempt('save', write);
    if (!ok) setFailed(true);
    return ok;
  }, []);

  const reset = useCallback(() => setFailed(false), []);

  return { failed, save, reset };
}

/** Сообщение об отказе записи; без ошибки ничего не рисует — разметка обычного пути прежняя. */
export function SaveError({ shown }: { shown: boolean }) {
  if (!shown) return null;
  return (
    <p className="notice notice--error" role="alert">
      {SAVE_ERROR_TEXT}
    </p>
  );
}
