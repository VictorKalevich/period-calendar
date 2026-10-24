import { addDaysLD } from './dates';
import type { Forecast, LocalDate, Settings } from './types';

// Расписание push-напоминаний (FR-022–FR-025). На сервер уходят только эти поля (Конституция I).

export interface Reminder {
  /** Детерминированный: `${kind}:${date}`. */
  id: string;
  kind: 'period' | 'ovulation' | 'missedPeriod';
  /** ISO-8601 UTC; 12:00 местного времени в дату напоминания. */
  sendAt: string;
  title: string;
  body: string;
}

/** Заголовок всех уведомлений — название приложения (= `name` манифеста), фича 007. */
export const NOTIFICATION_TITLE = 'Календарь цикла';

export const PERIOD_REMINDER = {
  daysBefore: 2,
  title: 'Календарь цикла',
  body: 'Ближайшие дни будь аккуратна, скоро начало цикла',
} as const;

export const OVULATION_REMINDER = { title: 'Овуляция', body: 'Сегодня Ты КОРОЛЕВА' } as const;

/** Фича 007: начало месячных не отмечено — 3-й день после прогнозного начала (прогноз + 2). */
export const MISSED_PERIOD_REMINDER = {
  daysAfter: 2,
  title: NOTIFICATION_TITLE,
  body: 'Похоже, месячные уже начались — не забудь отметить их в календаре',
} as const;

const SEND_HOUR = 12;
export const MAX_REMINDERS = 24;

/** Момент «12:00 местного времени» в указанную дату, в UTC. */
function localNoonISO(d: LocalDate): string {
  return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), SEND_HOUR).toISOString();
}

function missedPeriodReminder(predictedStart: LocalDate): Reminder {
  const date = addDaysLD(predictedStart, MISSED_PERIOD_REMINDER.daysAfter);
  return {
    id: `missed-period:${date}`,
    kind: 'missedPeriod',
    sendAt: localNoonISO(date),
    title: MISSED_PERIOD_REMINDER.title,
    body: MISSED_PERIOD_REMINDER.body,
  };
}

export function planReminders(forecast: Forecast, settings: Settings, now: Date, cyclesAhead = 6): Reminder[] {
  const upcoming = forecast.cycles.filter((c) => c.kind !== 'completed').slice(0, cyclesAhead);
  const out: Reminder[] = [];
  // Пока идёт задержка, напоминания на следующие циклы не планируются (L3) — кроме напоминания
  // о неотмеченном начале текущего цикла (007). При задержке nextStart = сегодня, поэтому
  // исходный прогноз — nextStart − delayDays.
  const delayed = forecast.delayDays > 0;
  const current = upcoming.find((c) => c.kind === 'current');
  if (delayed && current && settings.remindMissedPeriod) {
    out.push(missedPeriodReminder(addDaysLD(current.nextStart, -forecast.delayDays)));
  }
  for (const c of delayed ? [] : upcoming) {
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
    if (settings.remindMissedPeriod) out.push(missedPeriodReminder(c.nextStart));
  }
  const nowISO = now.toISOString();
  return out
    .filter((r) => r.sendAt > nowISO)
    .sort((a, b) => (a.sendAt < b.sendAt ? -1 : a.sendAt > b.sendAt ? 1 : 0))
    .slice(0, MAX_REMINDERS);
}

/** Запись расписания для сервера — без `kind` (Конституция I, 007 FR-009). */
export type ServerReminder = Omit<Reminder, 'kind'>;

/** То, что уходит на сервер: ровно `{ id, sendAt, title, body }`, поля перечислены явно. */
export function toServerReminders(reminders: Reminder[]): ServerReminder[] {
  return reminders.map(({ id, sendAt, title, body }) => ({ id, sendAt, title, body }));
}
