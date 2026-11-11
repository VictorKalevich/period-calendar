// Минимальный сборщик PDF 1.4 из JPEG-страниц (фича 011, research.md R1): по одному изображению на
// страницу A4, JPEG вкладывается как есть (DCTDecode). Без библиотек (Конституция V).

export interface PdfPage {
  /** Байты JPEG-файла страницы. */
  jpeg: Uint8Array;
  /** Размер изображения в пикселях. */
  width: number;
  height: number;
}

const A4 = { width: 595.28, height: 841.89 } as const;

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** Строка PDF в UTF-16BE с BOM — для кириллицы в /Title. */
function utf16Hex(s: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  return `<${hex}>`;
}

export function jpegPagesToPdf(pages: PdfPage[], meta: { title: string }): Uint8Array {
  if (pages.length === 0) throw new Error('PDF needs at least one page');

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const text = (s: string) => push(ascii(s));
  const object = (n: number, body: string) => {
    offsets[n] = length;
    text(`${n} 0 obj\n${body}\nendobj\n`);
  };

  // Номера: 1 Catalog, 2 Pages, 3 Info, затем на страницу i: Page 4+3i, Image 5+3i, Contents 6+3i.
  const pageNo = (i: number) => 4 + 3 * i;
  const objectCount = 3 + 3 * pages.length;

  // Двоичный комментарий — просмотрщики понимают, что файл двоичный.
  text('%PDF-1.4\n');
  push(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a));

  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageNo(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3, `<< /Title ${utf16Hex(meta.title)} /Producer (Calendar cycle) >>`);

  pages.forEach((p, i) => {
    const n = pageNo(i);
    object(
      n,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
        `/Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`,
    );

    offsets[n + 1] = length;
    text(
      `${n + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    push(p.jpeg);
    text('\nendstream\nendobj\n');

    const draw = `q ${A4.width} 0 0 ${A4.height} 0 0 cm /Im0 Do Q`;
    object(n + 2, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });

  const xrefAt = length;
  const size = objectCount + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n <= objectCount; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  text(xref);
  text(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
