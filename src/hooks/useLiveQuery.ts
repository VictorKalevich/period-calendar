import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

type State<T> = { failed: false; value: T | undefined } | { failed: true; error: unknown };

/**
 * Реактивный запрос к IndexedDB: перезапускается при изменении затронутых таблиц.
 * Своя обёртка вместо dexie-react-hooks (Конституция V).
 * Ошибка запроса бросается при отрисовке — её ловит граница ошибок и показывает аварийный экран,
 * а не вечно пустой (фича 014).
 */
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: readonly unknown[]): T | undefined {
  const [state, setState] = useState<State<T>>({ failed: false, value: undefined });

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setState({ failed: false, value }),
      error: (err: unknown) => {
        console.error('liveQuery failed', err);
        setState({ failed: true, error: err });
      },
    });
    return () => subscription.unsubscribe();
  }, deps);

  if (state.failed) throw state.error;
  return state.value;
}
