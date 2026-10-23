import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, runSchedule, type Env, type StoredRecord } from '../src/index';
import { b64urlEncode } from '../src/webpush';

const ORIGIN = 'https://owner.github.io';
const ID = '6f1c2b8e-3a4d-4c5e-9f00-0123456789ab';
const TOKEN = 'tok_secret_value_1234567890';
const NOW = Date.parse('2026-10-23T10:00:00.000Z');

class MemoryKV {
  store = new Map<string, string>();
  async get(key: string, type?: 'json' | 'text') {
    const v = this.store.get(key);
    if (v === undefined) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
  async list({ prefix = '' }: { prefix?: string; cursor?: string } = {}) {
    return { keys: [...this.store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true, cursor: '' };
  }
}

let kv: MemoryKV;
let env: Env;

beforeEach(async () => {
  kv = new MemoryKV();
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  env = {
    SUBS: kv as unknown as KVNamespace,
    VAPID_PRIVATE_KEY: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
    VAPID_PUBLIC_KEY: b64urlEncode(new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)),
    VAPID_SUBJECT: 'mailto:owner@example.com',
    ALLOWED_ORIGIN: ORIGIN,
  };
});

// Ключи подписки из RFC 8291 — настоящие точки P-256, чтобы шифрование в cron работало.
const subscription = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-iA',
  keys: {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  },
};

const reminder = (id: string, sendAt: string) => ({ id, sendAt, title: 'Овуляция', body: 'Сегодня Ты КОРОЛЕВА' });

function req(method: string, body?: unknown, opts: { token?: string | null; id?: string; origin?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { Origin: opts.origin ?? ORIGIN, 'Content-Type': 'application/json' };
  if (opts.token !== null) headers.Authorization = `Bearer ${opts.token ?? TOKEN}`;
  return new Request(`https://cycle-push.example.workers.dev/v1/clients/${opts.id ?? ID}`, {
    method,
    headers,
    body: opts.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

const put = (body: unknown, opts?: Parameters<typeof req>[2]) => handleRequest(req('PUT', body, opts), env, NOW);
const validBody = () => ({ subscription, reminders: [reminder('ovulation:2026-11-05', '2026-11-05T09:00:00.000Z')] });

describe('PUT /v1/clients/:id', () => {
  it('stores the record with a token hash and returns 204', async () => {
    const res = await put(validBody());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const rec = JSON.parse(kv.store.get(`sub:${ID}`)!) as StoredRecord;
    expect(rec.subscription).toEqual(subscription);
    expect(rec.reminders).toHaveLength(1);
    expect(rec.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(kv.store.get(`sub:${ID}`)).not.toContain(TOKEN);
  });

  it('replaces the schedule on the next PUT with the same token', async () => {
    await put(validBody());
    expect((await put({ subscription, reminders: [] })).status).toBe(204);
    expect((JSON.parse(kv.store.get(`sub:${ID}`)!) as StoredRecord).reminders).toEqual([]);
  });

  it('rejects a different token with 401', async () => {
    await put(validBody());
    expect((await put(validBody(), { token: 'other_token_value_0000000' })).status).toBe(401);
    expect((await put(validBody(), { token: null })).status).toBe(401);
  });

  const invalid: Array<[string, unknown]> = [
    ['no subscription', { reminders: [] }],
    ['http endpoint', { subscription: { ...subscription, endpoint: 'http://x.example' }, reminders: [] }],
    ['long endpoint', { subscription: { ...subscription, endpoint: `https://x.example/${'a'.repeat(1024)}` }, reminders: [] }],
    ['missing keys', { subscription: { endpoint: subscription.endpoint }, reminders: [] }],
    ['too many reminders', { subscription, reminders: Array.from({ length: 25 }, (_, i) => reminder(`r${i}`, '2026-11-05T09:00:00.000Z')) }],
    ['bad sendAt', { subscription, reminders: [reminder('r', 'tomorrow')] }],
    ['sendAt beyond 400 days', { subscription, reminders: [reminder('r', '2028-01-01T09:00:00.000Z')] }],
    ['long title', { subscription, reminders: [{ ...reminder('r', '2026-11-05T09:00:00.000Z'), title: 'x'.repeat(101) }] }],
    ['long body', { subscription, reminders: [{ ...reminder('r', '2026-11-05T09:00:00.000Z'), body: 'x'.repeat(201) }] }],
  ];

  it.each(invalid)('rejects %s with 400', async (_name, body) => {
    expect((await put(body)).status).toBe(400);
    expect(kv.store.size).toBe(0);
  });

  it('rejects invalid JSON and a non-UUID id with 400', async () => {
    expect((await put(undefined, { raw: '{oops' })).status).toBe(400);
    expect((await put(validBody(), { id: 'not-a-uuid' })).status).toBe(400);
  });

  it('rejects bodies over 16 KB with 413', async () => {
    expect((await put(undefined, { raw: JSON.stringify({ subscription, pad: 'x'.repeat(17 * 1024) }) })).status).toBe(413);
  });
});

describe('contract with the app', () => {
  it('accepts the reminders the app plans', async () => {
    const { buildForecast } = await import('../../src/domain/forecast');
    const { planReminders } = await import('../../src/domain/reminders');
    const { DEFAULT_SETTINGS } = await import('../../src/domain/types');
    type LD = Parameters<typeof buildForecast>[0]['today'];
    const forecast = buildForecast({
      periods: [{ id: 'a', start: '2026-10-10' as LD, end: null, endEstimated: false }],
      settings: DEFAULT_SETTINGS,
      today: '2026-10-23' as LD,
    })!;
    const reminders = planReminders(forecast, DEFAULT_SETTINGS, new Date(NOW)).map(({ kind: _k, ...r }) => r);
    expect(reminders.length).toBe(12);
    expect((await put({ subscription: { ...subscription, expirationTime: null }, reminders })).status).toBe(204);
  });
});

describe('DELETE /v1/clients/:id', () => {
  it('deletes with the right token, 401 with a wrong one, 404 when missing', async () => {
    expect((await handleRequest(req('DELETE'), env, NOW)).status).toBe(404);
    await put(validBody());
    expect((await handleRequest(req('DELETE', undefined, { token: 'wrong_token_value_000000' }), env, NOW)).status).toBe(401);
    expect((await handleRequest(req('DELETE'), env, NOW)).status).toBe(204);
    expect(kv.store.size).toBe(0);
  });
});

describe('CORS', () => {
  it('answers preflight only for the allowed origin', async () => {
    const ok = await handleRequest(req('OPTIONS', undefined, { token: null }), env, NOW);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    const other = await handleRequest(req('OPTIONS', undefined, { token: null, origin: 'https://evil.example' }), env, NOW);
    expect(other.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('returns 404 for unknown paths', async () => {
    const res = await handleRequest(new Request('https://cycle-push.example.workers.dev/other'), env, NOW);
    expect(res.status).toBe(404);
  });
});

describe('scheduled', () => {
  const due = reminder('ovulation:2026-10-23', '2026-10-23T09:00:00.000Z');
  const later = reminder('period:2026-11-01', '2026-11-01T09:00:00.000Z');
  const stale = reminder('period:2026-10-20', '2026-10-20T09:00:00.000Z');

  it('sends due reminders, keeps future ones, drops stale failures', async () => {
    await put({ subscription, reminders: [due, later] });
    const rec = JSON.parse(kv.store.get(`sub:${ID}`)!) as StoredRecord;
    rec.reminders.push(stale);
    kv.store.set(`sub:${ID}`, JSON.stringify(rec));

    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Encoding']).toBe('aes128gcm');
      expect(headers.TTL).toBe('86400');
      expect(headers.Urgency).toBe('normal');
      expect(headers.Authorization).toMatch(/^vapid t=.+, k=.+$/);
      return new Response(null, { status: 201 });
    });
    await runSchedule(env, NOW, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]![0]).toBe(subscription.endpoint);
    const left = (JSON.parse(kv.store.get(`sub:${ID}`)!) as StoredRecord).reminders.map((r) => r.id);
    expect(left).toEqual(['period:2026-11-01']);
  });

  it('keeps a recent reminder when the push service fails temporarily', async () => {
    await put({ subscription, reminders: [due] });
    await runSchedule(env, NOW, vi.fn(async () => new Response(null, { status: 503 })));
    expect((JSON.parse(kv.store.get(`sub:${ID}`)!) as StoredRecord).reminders).toHaveLength(1);
  });

  it('deletes the whole record when the subscription is gone (404/410)', async () => {
    for (const status of [404, 410]) {
      await put({ subscription, reminders: [due] });
      await runSchedule(env, NOW, vi.fn(async () => new Response(null, { status })));
      expect(kv.store.has(`sub:${ID}`)).toBe(false);
    }
  });

  it('does nothing when nothing is due', async () => {
    await put({ subscription, reminders: [later] });
    const fetcher = vi.fn();
    await runSchedule(env, NOW, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
