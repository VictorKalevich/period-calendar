import { addDaysLD } from './dates';
import type { Forecast, LocalDate, Settings } from './types';

// Расписание push-напоминаний (FR-022–FR-025). На сервер уходят только эти поля (Конституция I).

export interface Reminder {
  /** Детерминированный: `${kind}:${date}`. */
  id: string;
  kind: 'period' | 'ovulation';
  /** ISO-8601 UTC; 12:00 местного времени в дату напоминания. */
  sendAt: string;
  title: string;
  body: string;
}

export const PERIOD_REMINDER = {
  daysBefore: 2,
  title: 'Календарь цикла',
  body: 'Ближайшие дни будь аккуратна, скоро начало цикла',
} as const;

export const OVULATION_REMINDER = { title: 'Овуляция', body: 'Сегодня Ты КОРОЛЕВА' } as const;

const SEND_HOUR = 12;
export const MAX_REMINDERS = 24;

/** Момент «12:00 местного времени» в указанную дату, в UTC. */
function localNoonISO(d: LocalDate): string {
  return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), SEND_HOUR).toISOString();
}

export function planReminders(forecast: Forecast, settings: Settings, now: Date, cyclesAhead = 6): Reminder[] {
  // Пока идёт задержка, напоминания на следующие циклы не планируются (L3).
  if (forecast.delayDays > 0) return [];

  const upcoming = forecast.cycles.filter((c) => c.kind !== 'completed').slice(0, cyclesAhead);
  const out: Reminder[] = [];
  for (const c of upcoming) {
    if (settings.remindPeriod) {
      const date = addDaysLD(c.nextStart, -PERIOD_REMINDER.daysBefore);
      out.push({ id: `period:${date}`, kind: 'period', sendAt: localNoonISO(date), title: PERIOD_REMINDER.title, body: PERIOD_REMINDER.body });
    }
    if (settings.remindOvulation) {
      out.push({
        id: `ovulation:${c.ovulation}`,
        kind: 'ovulation',
        sendAt: localNoonISO(c.ovulation),
        title: OVULATION_REMINDER.title,
        body: OVULATION_REMINDER.body,
      });
    }
  }
  const nowISO = now.toISOString();
  return out
    .filter((r) => r.sendAt > nowISO)
    .sort((a, b) => (a.sendAt < b.sendAt ? -1 : a.sendAt > b.sendAt ? 1 : 0))
    .slice(0, MAX_REMINDERS);
}
