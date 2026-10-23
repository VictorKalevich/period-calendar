import { isUuid, MAX_BODY_BYTES, validatePutBody, type ReminderJSON } from './validate';
import {
  sendPush,
  vapidKeyPairMatches,
  type Fetcher,
  type PushResult,
  type PushSubscriptionJSON,
  type VapidKeys,
} from './webpush';

// Push-воркер (contracts/push-worker-api.md). Хранит только подписку, напоминания и технические
// идентификаторы авторизации — clientId и SHA-256 токена (Конституция I, v1.0.1).
// В логи не пишутся тела запросов, endpoint подписок и тексты напоминаний.

export interface Env {
  SUBS: KVNamespace;
  VAPID_PRIVATE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
  ALLOWED_ORIGIN: string;
}

export interface StoredRecord {
  tokenHash: string;
  subscription: PushSubscriptionJSON;
  reminders: ReminderJSON[];
  /** Последняя попытка тестовой отправки (002), для ограничения частоты. */
  lastTestAt?: string;
}

/** Тексты тестового уведомления задаёт сервер, клиент их не передаёт (002 FR-005). */
export const TEST_NOTIFICATION = { title: 'Календарь цикла', body: 'Уведомления работают', id: 'test' } as const;

const STALE_MS = 24 * 3600 * 1000;
const TEST_INTERVAL_MS = 60 * 1000;
const PATH_RE = /^\/v1\/clients\/([^/]+)(\/test)?$/;

async function sha256Hex(s: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'PUT, DELETE, POST',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const bearer = (request: Request) => /^Bearer (.{16,200})$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? null;

export async function handleRequest(
  request: Request,
  env: Env,
  now: number = Date.now(),
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const cors = corsHeaders(request, env);
  const reply = (status: number, extra: Record<string, string> = {}) =>
    new Response(null, { status, headers: { ...cors, ...extra } });

  const match = PATH_RE.exec(new URL(request.url).pathname);
  if (request.method === 'OPTIONS') return reply(match ? 204 : 404);
  if (!match) return reply(404);
  const clientId = match[1]!;
  const isTest = match[2] !== undefined;
  if (!isUuid(clientId)) return reply(400);
  const allowed = isTest ? ['POST'] : ['PUT', 'DELETE'];
  if (!allowed.includes(request.method)) return reply(405);

  const token = bearer(request);
  if (!token) return reply(401);
  const key = `sub:${clientId.toLowerCase()}`;
  const existing = await env.SUBS.get<StoredRecord>(key, 'json');
  const tokenHash = await sha256Hex(token);
  if (existing && existing.tokenHash !== tokenHash) return reply(401);

  if (isTest) {
    if (!existing) return reply(404);
    return sendTest(key, existing, env, now, fetcher, reply);
  }

  if (request.method === 'DELETE') {
    if (!existing) return reply(404);
    await env.SUBS.delete(key);
    return reply(204);
  }

  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return reply(413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return reply(413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return reply(400);
  }
  const body = validatePutBody(json, now);
  if (!body) return reply(400);

  const record: StoredRecord = {
    tokenHash,
    subscription: body.subscription,
    reminders: body.reminders,
    ...(existing?.lastTestAt ? { lastTestAt: existing.lastTestAt } : {}),
  };
  await env.SUBS.put(key, JSON.stringify(record));
  return reply(204);
}

/** Тестовый push на подписку этого клиента, не чаще раза в минуту (002, contracts/push-worker-test-api.md). */
async function sendTest(
  key: string,
  rec: StoredRecord,
  env: Env,
  now: number,
  fetcher: Fetcher,
  reply: (status: number, extra?: Record<string, string>) => Response,
): Promise<Response> {
  const last = rec.lastTestAt ? Date.parse(rec.lastTestAt) : NaN;
  if (now - last < TEST_INTERVAL_MS) {
    return reply(429, { 'Retry-After': String(Math.ceil((last + TEST_INTERVAL_MS - now) / 1000)) });
  }
  // Попытка засчитывается до отправки — ограничение действует и при неудачах push-сервиса.
  await env.SUBS.put(key, JSON.stringify({ ...rec, lastTestAt: new Date(now).toISOString() }));

  const { status } = await attemptPush(rec.subscription, TEST_NOTIFICATION, env, now, fetcher, 'test');
  if (status >= 200 && status < 300) return reply(204);
  if (status === 404 || status === 410) {
    await env.SUBS.delete(key);
    return reply(410);
  }
  return reply(502);
}

const vapidOf = (env: Env): VapidKeys => ({
  privateJwk: env.VAPID_PRIVATE_KEY,
  publicKey: env.VAPID_PUBLIC_KEY,
  subject: env.VAPID_SUBJECT,
});

/**
 * Отправка с диагностикой: при отказе в лог пишутся статус, причина от push-сервиса, его хост
 * (без пути подписки) и самопроверка пары VAPID-ключей. Тексты и endpoint в лог не попадают.
 */
async function attemptPush(
  sub: PushSubscriptionJSON,
  payload: unknown,
  env: Env,
  now: number,
  fetcher: Fetcher,
  kind: string,
): Promise<PushResult> {
  const vapid = vapidOf(env);
  let result: PushResult;
  try {
    result = await sendPush(sub, payload, vapid, Math.floor(now / 1000), fetcher);
  } catch (e) {
    result = { status: 0, detail: (e as Error).message.slice(0, 200) };
  }
  if (result.status < 200 || result.status >= 300) {
    const host = (() => {
      try {
        return new URL(sub.endpoint).host;
      } catch {
        return '?';
      }
    })();
    const keysMatch = await vapidKeyPairMatches(vapid);
    console.warn(
      `${kind} push failed: status=${result.status} host=${host} detail=${result.detail || '-'} ` +
        `vapidPairOk=${keysMatch} subject=${vapid.subject.split(':')[0]}:`,
    );
  }
  return result;
}

/** Cron: отправляет наступившие напоминания всем подпискам. */
export async function runSchedule(env: Env, now: number = Date.now(), fetcher: Fetcher = fetch): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const { name } of page.keys) {
      const rec = await env.SUBS.get<StoredRecord>(name, 'json');
      if (!rec) continue;
      const keep: ReminderJSON[] = [];
      let gone = false;
      for (const r of rec.reminders) {
        const at = Date.parse(r.sendAt);
        if (gone || at > now) {
          keep.push(r);
          continue;
        }
        const { status } = await attemptPush(rec.subscription, { title: r.title, body: r.body, id: r.id }, env, now, fetcher, 'scheduled');
        if (status === 404 || status === 410) {
          gone = true;
          continue;
        }
        const delivered = status >= 200 && status < 300;
        if (!delivered && now - at < STALE_MS) keep.push(r);
      }
      if (gone) await env.SUBS.delete(name);
      else if (keep.length !== rec.reminders.length) await env.SUBS.put(name, JSON.stringify({ ...rec, reminders: keep }));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
  scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(runSchedule(env));
  },
} satisfies ExportedHandler<Env>;
