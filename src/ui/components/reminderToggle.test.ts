import { describe, expect, it } from 'vitest';
import { reminderToggleAction } from './reminderToggle';

// Фича 019 (FR-007; research R7; data-model «ReminderToggleAction»): после изменения переключателя напоминаний —
// выключен последний вид → отписаться; включён какой-то, подписки нет и уведомления не запрещены → подписаться
// (007 FR-008); иначе ничего.

type Flags = [remindPeriod: boolean, remindOvulation: boolean, remindMissedPeriod: boolean];
const FLAGS: Flags[] = [false, true].flatMap((a) => [false, true].flatMap((b) => [false, true].map((c) => [a, b, c] as Flags)));
const PERMISSIONS = ['granted', 'default', 'denied', 'unsupported'] as const;

const next = ([remindPeriod, remindOvulation, remindMissedPeriod]: Flags) => ({ remindPeriod, remindOvulation, remindMissedPeriod });
const allOff = (f: Flags) => !f[0] && !f[1] && !f[2];

describe('reminderToggleAction', () => {
  it('8 сочетаний трёх видов', () => {
    expect(FLAGS).toHaveLength(8);
    expect(FLAGS.filter(allOff)).toEqual([[false, false, false]]);
  });

  describe.each([false, true])('подписка: %s', (subscribed) => {
    it.each(PERMISSIONS)('все виды выключены, разрешение %s — отписаться', (permission) => {
      expect(reminderToggleAction(next([false, false, false]), subscribed, permission)).toBe('unsubscribe');
    });
  });

  describe.each(FLAGS.filter((f) => !allOff(f)))('включено [%s, %s, %s]', (...flags) => {
    it.each(['granted', 'default', 'unsupported'] as const)('подписки нет, разрешение %s — подписаться', (permission) => {
      expect(reminderToggleAction(next(flags as Flags), false, permission)).toBe('subscribe');
    });

    it('подписки нет, уведомления запрещены — ничего', () => {
      expect(reminderToggleAction(next(flags as Flags), false, 'denied')).toBe('none');
    });

    it.each(PERMISSIONS)('подписка есть, разрешение %s — ничего', (permission) => {
      expect(reminderToggleAction(next(flags as Flags), true, permission)).toBe('none');
    });
  });
});
