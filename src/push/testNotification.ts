import { getPushState } from '../storage/repository';
import { clientUrl, isPushConfigured } from './subscribe';
import { syncReminders } from './sync';

// Тестовый push из режима разработчика (002, contracts/push-worker-test-api.md).

export type TestResult = 'sent' | 'rate-limited' | 'no-subscription' | 'offline' | 'failed';

export const TEST_RESULT_TEXT: Record<TestResult, string> = {
  sent: 'Уведомление отправлено — должно прийти через несколько секунд',
  'rate-limited': 'Можно не чаще раза в минуту',
  'no-subscription': 'Подписка не найдена — включите напоминания заново',
  offline: 'Нет связи с сервером',
  failed: 'Сервер не смог отправить уведомление, попробуйте позже',
};

export async function sendTestNotification(): Promise<TestResult> {
  if (!isPushConfigured()) return 'no-subscription';
  // Сначала доотправляем подписку, если она ещё не дошла до сервера.
  await syncReminders();
  const state = await getPushState();
  if (!state?.subscribed) return 'no-subscription';
  let res: Response;
  try {
    res = await fetch(`${clientUrl(state)}/test`, { method: 'POST', headers: { Authorization: `Bearer ${state.token}` } });
  } catch {
    return 'offline';
  }
  if (res.status === 204) return 'sent';
  if (res.status === 429) return 'rate-limited';
  if (res.status === 404 || res.status === 410) return 'no-subscription';
  return 'failed';
}
