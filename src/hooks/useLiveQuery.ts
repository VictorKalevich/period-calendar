import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

/**
 * Реактивный запрос к IndexedDB: перезапускается при изменении затронутых таблиц.
 * Своя обёртка вместо dexie-react-hooks (Конституция V).
 */
export function useLiveQuery<T>(query: () => Promise<T> | T, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (err: unknown) => console.error('liveQuery failed', err),
    });
    return () => subscription.unsubscribe();
  }, deps);

  return value;
}
