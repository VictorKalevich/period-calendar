// Разбор данных push-события service worker: payload воркера { title, body, id }
// (specs/001-cycle-calendar/contracts/push-worker-api.md). Без импортов — проверяется и тестами приложения,
// и контрактным тестом воркера (фича 018).

/** То, что нужно от `PushMessageData`. */
export interface PushData {
  json(): unknown;
  text(): string;
}

export interface NotificationContent {
  title: string;
  body: string;
  /** Метка уведомления — `id` напоминания: повторная доставка заменяет уведомление, а не дублирует. */
  tag: string | undefined;
}

export function notificationFromPush(data: PushData | null | undefined): NotificationContent {
  let payload: { title?: string; body?: string; id?: string } = {};
  try {
    payload = (data?.json() as typeof payload | null | undefined) ?? {};
  } catch {
    payload = { body: data?.text() };
  }
  return { title: payload.title ?? 'Календарь цикла', body: payload.body ?? '', tag: payload.id };
}
