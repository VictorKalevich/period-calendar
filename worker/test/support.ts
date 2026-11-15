import type { Env } from '../src/index';
import { b64urlEncode } from '../src/webpush';

// Помощники для тестов шага 5 (фича 018): контракт с приложением и рассылка. `api.test.ts` не меняется
// и пользуется своими копиями.

export const ORIGIN = 'https://owner.github.io';
export const TOKEN = 'tok_secret_value_1234567890';

/** UUID клиента с номером `n`. */
export const uuid = (n: number) => `6f1c2b8e-3a4d-4c5e-9f00-${String(n).padStart(12, '0')}`;

/** KV в памяти: `list` отдаёт ключи в порядке вставки, `get(…, 'json')` разбирает JSON (и бросает на мусоре, как KV). */
export class MemoryKV {
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

/** Подписка с ключами из RFC 8291 — настоящие точки P-256, чтобы шифрование работало. */
export const subscription = (path = 'QGuQyavXutnMH-iA') => ({
  endpoint: `https://web.push.apple.com/${path}`,
  keys: {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  },
});

/** Окружение воркера с новой парой VAPID-ключей. */
export async function makeEnv(kv: MemoryKV): Promise<Env> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  return {
    SUBS: kv as unknown as KVNamespace,
    VAPID_PRIVATE_KEY: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
    VAPID_PUBLIC_KEY: b64urlEncode(new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)),
    VAPID_SUBJECT: 'mailto:owner@example.com',
    ALLOWED_ORIGIN: ORIGIN,
  };
}

/** `PUT /v1/clients/:id` от приложения: свой origin, токен, JSON-тело. */
export const putRequest = (id: string, body: unknown) =>
  new Request(`https://cycle-push.example.workers.dev/v1/clients/${id}`, {
    method: 'PUT',
    headers: { Origin: ORIGIN, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
