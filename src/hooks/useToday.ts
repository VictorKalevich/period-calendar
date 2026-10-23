import { useEffect, useState } from 'react';
import { toLocalDate } from '../domain/dates';
import type { LocalDate } from '../domain/types';

/** Сегодняшняя дата; обновляется в полночь и при возвращении в приложение. */
export function useToday(): LocalDate {
  const [today, setToday] = useState(() => toLocalDate(new Date()));

  useEffect(() => {
    const refresh = () => setToday(toLocalDate(new Date()));
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return today;
}
