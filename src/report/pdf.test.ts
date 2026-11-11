import { describe, expect, it } from 'vitest';
import { jpegPagesToPdf } from './pdf';

// Фича 011: сборщик PDF из JPEG-страниц — specs/011-doctor-report/contracts/report.md.

const fakeJpeg = (seed: number, size = 300) => {
  const bytes = new Uint8Array(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  for (let i = 2; i < size - 2; i++) bytes[i] = (i * 31 + seed) % 256;
  bytes[size - 2] = 0xff;
  bytes[size - 1] = 0xd9;
  return bytes;
};

const page = (seed: number) => ({ jpeg: fakeJpeg(seed, 300 + seed), width: 1191, height: 1684 });
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

describe('jpegPagesToPdf', () => {
  it.each([1, 3])('%i страниц: заголовок, %%EOF, /Count', (n) => {
    const pages = Array.from({ length: n }, (_, i) => page(i + 1));
    const text = latin1(jpegPagesToPdf(pages, { title: 'Отчёт' }));
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain(`/Type /Pages /Kids [`);
    expect(text).toMatch(new RegExp(`/Count ${n}\\b`));
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(n);
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('изображение на каждую страницу: /DCTDecode, размеры, длина, байты JPEG без изменений', () => {
    const pages = [page(1), { jpeg: fakeJpeg(9, 512), width: 800, height: 1131 }];
    const pdf = jpegPagesToPdf(pages, { title: 'x' });
    const text = latin1(pdf);
    expect(text.match(/\/Filter \/DCTDecode/g)).toHaveLength(2);
    expect(text).toContain('/Width 1191 /Height 1684');
    expect(text).toContain('/Width 800 /Height 1131');
    expect(text).toContain(`/Length ${pages[0]!.jpeg.length}`);
    expect(text).toContain('/Length 512');
    for (const p of pages) expect(indexOfBytes(pdf, p.jpeg)).toBeGreaterThan(0);
  });

  it('xref: каждое смещение указывает на «N 0 obj», startxref — на xref', () => {
    const pdf = jpegPagesToPdf([page(1), page(2)], { title: 'x' });
    const text = latin1(pdf);
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const xref = text.slice(startxref).split('\n');
    const [, count] = xref[1]!.split(' ').map(Number) as [number, number];
    expect(count).toBe(1 + 3 + 2 * 3); // free + Catalog/Pages/Info + (Page, Image, Contents) × 2
    for (let n = 1; n < count; n++) {
      const offset = Number(xref[2 + n]!.slice(0, 10));
      expect(text.slice(offset, offset + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    }
    expect(text).toMatch(new RegExp(`trailer\\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>`));
  });

  it('/Title — UTF-16BE с BOM (кириллица)', () => {
    const text = latin1(jpegPagesToPdf([page(1)], { title: 'Отчёт' }));
    // FEFF + «О» 041E + «т» 0442 + «ч» 0447 + «ё» 0451 + «т» 0442
    expect(text).toContain('/Title <FEFF041E0442044704510442>');
  });

  it('без страниц — ошибка', () => {
    expect(() => jpegPagesToPdf([], { title: 'x' })).toThrow();
  });
});
