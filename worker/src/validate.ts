import type { PushSubscriptionJSON } from './webpush';

// Ограничения из contracts/push-worker-api.md.

export const MAX_BODY_BYTES = 16 * 1024;
const MAX_REMINDERS = 24;
const MAX_TITLE = 100;
const MAX_BODY = 200;
const MAX_ID = 64;
const MAX_ENDPOINT = 1024;
const MAX_AHEAD_MS = 400 * 24 * 3600 * 1000;

export interface ReminderJSON {
  id: string;
  sendAt: string;
  title: string;
  body: string;
}

export interface PutBody {
  subscription: PushSubscriptionJSON;
  reminders: ReminderJSON[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const isUuid = (s: string) => UUID_RE.test(s);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export function validatePutBody(input: unknown, now: number): PutBody | null {
  if (!isObject(input)) return null;
  const { subscription, reminders } = input;
  if (!isObject(subscription) || !isObject(subscription.keys)) return null;
  const { endpoint } = subscription;
  const { p256dh, auth } = subscription.keys;
  if (!isStr(endpoint, MAX_ENDPOINT) || !endpoint.startsWith('https://')) return null;
  try {
    new URL(endpoint);
  } catch {
    return null;
  }
  if (!isStr(p256dh, 200) || !B64URL_RE.test(p256dh) || !isStr(auth, 100) || !B64URL_RE.test(auth)) return null;

  if (!Array.isArray(reminders) || reminders.length > MAX_REMINDERS) return null;
  const out: ReminderJSON[] = [];
  for (const r of reminders) {
    if (!isObject(r)) return null;
    const { id, sendAt, title, body } = r;
    if (!isStr(id, MAX_ID) || !isStr(title, MAX_TITLE) || !isStr(body, MAX_BODY)) return null;
    if (!isStr(sendAt, 40) || !ISO_RE.test(sendAt)) return null;
    const t = Date.parse(sendAt);
    if (Number.isNaN(t) || t - now > MAX_AHEAD_MS) return null;
    out.push({ id, sendAt: new Date(t).toISOString(), title, body });
  }
  return { subscription: { endpoint, keys: { p256dh, auth } }, reminders: out };
}
