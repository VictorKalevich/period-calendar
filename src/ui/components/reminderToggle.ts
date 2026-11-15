import type { Settings } from '../../domain/types';
import type { notificationPermission } from '../../push/subscribe';

/** Что сделать после того, как переключатель напоминаний изменён и настройка сохранилась. */
export type ReminderToggleAction = 'unsubscribe' | 'subscribe' | 'none';

/**
 * Выключен последний вид напоминаний — отписаться; включён какой-то, подписки нет и уведомления не запрещены —
 * подписаться (007 FR-008); иначе ничего. Зависит от разрешения браузера, поэтому лежит рядом с карточкой (019).
 */
export function reminderToggleAction(
  next: Pick<Settings, 'remindPeriod' | 'remindOvulation' | 'remindMissedPeriod'>,
  subscribed: boolean,
  permission: ReturnType<typeof notificationPermission>,
): ReminderToggleAction {
  if (!next.remindPeriod && !next.remindOvulation && !next.remindMissedPeriod) return 'unsubscribe';
  if (!subscribed && permission !== 'denied') return 'subscribe';
  return 'none';
}
