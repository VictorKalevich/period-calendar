// Генерирует PNG-иконки приложения без зависимостей: фон bg, розовая капля btnBg (docs/design/design.md).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0xfb, 0xf7, 0xf5];
const DROP = [0xdb, 0x1a, 0x72];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Капля: круг + конус из вершины, ограниченный точками касания. scale < 1 оставляет поля для maskable.
function insideDrop(x, y, size, scale) {
  const s = size * scale;
  const cx = size / 2;
  const cy = size / 2 + s * 0.12;
  const r = s * 0.3;
  if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  const top = cy - s * 0.62;
  const d = cy - top;
  const tangentY = top + d - (r * r) / d;
  if (y < top || y > tangentY) return false;
  const tanA = r / Math.sqrt(d * d - r * r);
  return Math.abs(x - cx) <= (y - top) * tanA;
}

function png(size, scale) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      // 2×2 суперсэмплинг для сглаживания краёв
      let hits = 0;
      for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) if (insideDrop(x + dx, y + dy, size, scale)) hits++;
      const a = hits / 4;
      for (let i = 0; i < 3; i++) raw[o++] = Math.round(BG[i] * (1 - a) + DROP[i] * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192, 0.8));
writeFileSync('public/icon-512.png', png(512, 0.8));
writeFileSync('public/icon-maskable-512.png', png(512, 0.6));
writeFileSync('public/apple-touch-icon.png', png(180, 0.8));
console.log('Icons written to public/');
