import { getPushState, savePushState, type PushState } from '../storage/repository';

// Подписка на Web Push (research.md R5, R9). Запросы к воркеру — только подписка и расписание.

export const PUSH_API_URL = (import.meta.env.VITE_PUSH_API_URL ?? '').replace(/\/$/, '');
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

export const isPushConfigured = () => PUSH_API_URL !== '' && VAPID_PUBLIC_KEY !== '';

export const isPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Запущено с экрана «Домой» — на iOS Web Push работает только так. */
export const isStandalone = () =>
  navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;

export const notificationPermission = (): NotificationPermission | 'unsupported' =>
  'Notification' in window ? Notification.permission : 'unsupported';

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function clientUrl(state: PushState): string {
  return `${PUSH_API_URL}/v1/clients/${state.clientId}`;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Вызывается только по нажатию пользовательницы. Возвращает итоговое разрешение. */
export async function enableReminders(): Promise<NotificationPermission | 'unsupported'> {
  if (!isPushSupported() || !isPushConfigured()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (!existing) {
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
  }
  const prev = await getPushState();
  await savePushState({
    clientId: prev?.clientId ?? crypto.randomUUID(),
    token: prev?.token ?? randomToken(),
    subscribed: true,
    pendingSync: true,
    lastSyncedHash: null,
  });
  return permission;
}

/** Удаляет подписку на воркере и в браузере. */
export async function disableReminders(): Promise<void> {
  const state = await getPushState();
  if (state) {
    try {
      await fetch(clientUrl(state), { method: 'DELETE', headers: { Authorization: `Bearer ${state.token}` } });
    } catch {
      // офлайн — подписка на воркере удалится сама при ответе 404/410 от push-сервиса
    }
    await savePushState({ ...state, subscribed: false, pendingSync: false, lastSyncedHash: null });
  }
  const sub = await currentSubscription();
  await sub?.unsubscribe();
}
