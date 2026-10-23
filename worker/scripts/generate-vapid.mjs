// Генерирует пару VAPID-ключей P-256.
// Публичный ключ → VAPID_PUBLIC_KEY в wrangler.toml и VITE_VAPID_PUBLIC_KEY в GitHub (Actions variables).
// Приватный (JWK) → `npx wrangler secret put VAPID_PRIVATE_KEY`. В репозиторий его не добавлять.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', publicKey));
const b64url = Buffer.from(raw).toString('base64url');
const { kty, crv, d, x, y } = await crypto.subtle.exportKey('jwk', privateKey);

console.log('VAPID public key (base64url):');
console.log(b64url);
console.log('\nVAPID private key (JWK) — paste into `npx wrangler secret put VAPID_PRIVATE_KEY`:');
console.log(JSON.stringify({ kty, crv, d, x, y }));
