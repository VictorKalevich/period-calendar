# Contract: `planReminders` (фича 007)

```ts
export const NOTIFICATION_TITLE = 'Календарь цикла';
export const MISSED_PERIOD_REMINDER = {
  daysAfter: 2,
  title: NOTIFICATION_TITLE,
  body: 'Похоже, месячные уже начались — не забудь отметить их в календаре',
} as const;

export interface Reminder {
  id: string;                                   // `${kind-prefix}:${date}`
  kind: 'period' | 'ovulation' | 'missedPeriod';
  sendAt: string;                               // ISO UTC, 12:00 местного
  title: string;
  body: string;
}

planReminders(forecast, settings, now, cyclesAhead = 6): Reminder[]

export type ServerReminder = Omit<Reminder, 'kind'>;
/** То, что уходит на сервер (Конституция I, FR-009): ровно { id, sendAt, title, body }. */
toServerReminders(reminders: Reminder[]): ServerReminder[]
```

Правила:

- Без задержки (`delayDays = 0`): для каждого из `cyclesAhead` ближайших незавершённых циклов —
  `period` (`nextStart − 2`), `ovulation` (`ovulation`), `missedPeriod` (`nextStart + 2`), каждое — если
  включено в настройках.
- При задержке (`delayDays > 0`): только `missedPeriod` текущего цикла на `(nextStart − delayDays) + 2`,
  если `remindMissedPeriod`.
- Все виды: `sendAt > now`, сортировка по `sendAt`, не более 24.
- Заголовок всех видов — `NOTIFICATION_TITLE`, совпадает с `name` манифеста.

## Тест-кейсы (`src/domain/reminders.test.ts`)

| # | Условие (последние месячные 1 марта 2026, цикл 28) | Ожидание |
|---|-----------------------------------------------------|----------|
| M1 | сегодня 2 марта, всё включено | `missed-period:2026-03-31`, `…-04-28`, … — 6 шт.; всего ≤ 24 |
| M2 | `remindMissedPeriod: false` | нет `missedPeriod` |
| M3 | сегодня 30 марта (задержка 1), 09:00 | ровно `[missed-period:2026-03-31]` |
| M4 | сегодня 31 марта (задержка 2), 09:00 / 13:00 | `[missed-period:2026-03-31]` / `[]` |
| M5 | сегодня 1 апреля (задержка 3) | `[]` |
| M6 | начало отмечено 27 марта, сегодня 28 марта | первый `missedPeriod` — новый `current.nextStart + 2`, записи `2026-03-31` нет |
| M7 | переход через год: начало 2026-12-03, цикл 28 | `missed-period:2027-01-02` |
| M8 | заголовки | у всех видов `Календарь цикла`; тела `period`/`ovulation` прежние |
| M9 | `sendAt` при смене летнего времени | 12:00 местного (`TZ=Europe/Berlin`) |
| M10 | `NOTIFICATION_TITLE` | равен `name` в `vite.config.ts` |
| M11 | `toServerReminders` | у каждой записи ровно ключи `id, sendAt, title, body`; `kind` нет |
