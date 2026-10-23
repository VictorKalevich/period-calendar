import { describe, expect, it } from 'vitest';
import { b64urlDecode, b64urlEncode, encryptPayload, vapidAuthorization } from '../src/webpush';

// RFC 8291, Appendix A — эталонный пример шифрования Web Push (aes128gcm).
const V = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function importAsKeyPair(): Promise<CryptoKeyPair> {
  const pub = b64urlDecode(V.asPublic);
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: V.asPrivate,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  };
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKey = await crypto.subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return { privateKey, publicKey };
}

describe('base64url', () => {
  it('round-trips without padding', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 1, 2, 3]);
    const s = b64urlEncode(bytes);
    expect(s).not.toMatch(/[+/=]/);
    expect([...b64urlDecode(s)]).toEqual([...bytes]);
  });
});

describe('encryptPayload (RFC 8291 Appendix A)', () => {
  it('produces the reference body', async () => {
    const body = await encryptPayload(
      new TextEncoder().encode(V.plaintext),
      { p256dh: V.uaPublic, auth: V.authSecret },
      { salt: b64urlDecode(V.salt), serverKeys: await importAsKeyPair() },
    );
    expect(b64urlEncode(body)).toBe(V.body);
  });

  it('uses a fresh salt and key by default', async () => {
    const keys = { p256dh: V.uaPublic, auth: V.authSecret };
    const a = await encryptPayload(new TextEncoder().encode('x'), keys);
    const b = await encryptPayload(new TextEncoder().encode('x'), keys);
    expect(b64urlEncode(a.slice(0, 16))).not.toBe(b64urlEncode(b.slice(0, 16)));
    expect(a[20]).toBe(65); // idlen
  });
});

describe('vapidAuthorization (RFC 8292)', () => {
  it('signs a verifiable ES256 JWT for the endpoint origin', async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const pub = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
    const now = 1_790_000_000;
    const header = await vapidAuthorization(
      'https://web.push.apple.com/QGuQyavXutnMH-iA/abc',
      { privateJwk: JSON.stringify(jwk), publicKey: b64urlEncode(pub), subject: 'mailto:owner@example.com' },
      now,
    );
    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(m).not.toBeNull();
    expect(m[2]).toBe(b64urlEncode(pub));
    const [h, p, s] = m[1]!.split('.') as [string, string, string];
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    expect(claims.aud).toBe('https://web.push.apple.com');
    expect(claims.sub).toBe('mailto:owner@example.com');
    expect(claims.exp).toBeGreaterThan(now);
    expect(claims.exp - now).toBeLessThanOrEqual(24 * 3600);
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.publicKey,
      b64urlDecode(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });
});
