// Web Push без зависимостей на WebCrypto (research.md R8):
// шифрование сообщения — RFC 8291 (aes128gcm, RFC 8188), авторизация сервера — VAPID, RFC 8292.

type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Bytes {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', concat(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, concat(data)));
}

const RECORD_SIZE = 4096;
const ONE = new Uint8Array([1]);

export interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

/** Шифрует сообщение для подписки. `opts` — только для тестов на эталонных векторах. */
export async function encryptPayload(
  plaintext: Uint8Array,
  keys: SubscriptionKeys,
  opts: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {},
): Promise<Bytes> {
  const uaPublic = b64urlDecode(keys.p256dh);
  const authSecret = b64urlDecode(keys.auth);
  const serverKeys =
    opts.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(
    // workers-types называют поле `$public`, сам рантайм (как и браузеры/Node) ожидает `public`
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      serverKeys.privateKey,
      256,
    ),
  );

  // RFC 8291 §3.4: IKM из общего секрета ECDH и auth-секрета подписки
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, ONE));

  // RFC 8188 §2.2: ключ содержимого и nonce
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), ONE))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), ONE))).slice(0, 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = concat(plaintext, new Uint8Array([2])); // единственная (последняя) запись
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export interface VapidKeys {
  /** Приватный ключ P-256 в формате JWK (строка JSON). */
  privateJwk: string;
  /** Публичный ключ, base64url, 65 байт. */
  publicKey: string;
  /** `mailto:` или `https:` контакт владельца. */
  subject: string;
}

const VAPID_TTL_SECONDS = 12 * 3600;

/** Заголовок Authorization по RFC 8292: `vapid t=<JWT>, k=<public key>`. */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, nowSeconds: number): Promise<string> {
  const { kty, crv, d, x, y } = JSON.parse(vapid.privateJwk) as JsonWebKey;
  const key = await crypto.subtle.importKey('jwk', { kty, crv, d, x, y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + VAPID_TTL_SECONDS, sub: vapid.subject })),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)),
  );
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${vapid.publicKey}`;
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: SubscriptionKeys;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Отправляет одно уведомление; возвращает HTTP-статус push-сервиса. */
export async function sendPush(
  sub: PushSubscriptionJSON,
  payload: unknown,
  vapid: VapidKeys,
  nowSeconds: number,
  fetcher: Fetcher = fetch,
): Promise<number> {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), sub.keys);
  const res = await fetcher(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'normal',
      Authorization: await vapidAuthorization(sub.endpoint, vapid, nowSeconds),
    },
    body,
  });
  return res.status;
}
