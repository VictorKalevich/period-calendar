import { buildDoctorReport, NO_CYCLES_TEXT, reportView, type DoctorReportInput, type ReportTable, type ReportView } from '../domain/report';
import type { LocalDate } from '../domain/types';
import { jpegPagesToPdf, type PdfPage } from './pdf';

// Отрисовка отчёта для врача на холсте A4 (фича 011, research.md R4, design.md «Отчёт для врача»).
// Единицы — пункты PDF; холст в SCALE раз крупнее. Палитра — светлая тема design.md (печать).

const SCALE = 2;
const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 40;
const FOOTER = 24;
const CONTENT_W = PAGE.w - 2 * MARGIN;
const BOTTOM = PAGE.h - MARGIN - FOOTER;

const C = {
  page: '#FFFFFF',
  bg: '#FBF7F5',
  ink: '#2B2330',
  muted: '#6E6072',
  line: '#EFE6E9',
  rose: '#F08DB5',
  roseText: '#B03D72',
  btnBg: '#C8467F',
  violet: '#8572DE',
} as const;

const FONT = 'Nunito, system-ui, sans-serif';

class Pages {
  readonly canvases: HTMLCanvasElement[] = [];
  ctx!: CanvasRenderingContext2D;
  y = MARGIN;

  constructor() {
    this.add();
  }

  add() {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(PAGE.w * SCALE);
    canvas.height = Math.round(PAGE.h * SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, PAGE.w, PAGE.h);
    ctx.textBaseline = 'alphabetic';
    this.canvases.push(canvas);
    this.ctx = ctx;
    this.y = MARGIN;
  }

  /** Новая страница, если блок высотой `h` не помещается. */
  ensure(h: number) {
    if (this.y + h > BOTTOM) this.add();
  }

  font(size: number, weight: number, color: string) {
    this.ctx.font = `${weight} ${size}px ${FONT}`;
    this.ctx.fillStyle = color;
  }

  text(s: string, x: number, y: number, align: CanvasTextAlign = 'left') {
    this.ctx.textAlign = align;
    this.ctx.fillText(s, x, y);
  }

  /** Перенос по словам в пределах ширины; возвращает строки. */
  wrap(s: string, width: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of s.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && this.ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawHeader(p: Pages, v: ReportView) {
  p.font(20, 800, C.ink);
  p.text(v.title, MARGIN, p.y + 20);
  p.font(10, 600, C.muted);
  p.text(v.subtitle, MARGIN, p.y + 38);
  p.y += 54;
}

function drawTiles(p: Pages, v: ReportView) {
  const gap = 10;
  const w = (CONTENT_W - gap) / 2;
  const h = 62;
  v.tiles.forEach((t, i) => {
    const x = MARGIN + (i % 2) * (w + gap);
    const y = p.y + Math.floor(i / 2) * (h + gap);
    p.ctx.fillStyle = C.bg;
    roundRect(p.ctx, x, y, w, h, 12);
    p.font(9, 700, C.muted);
    p.text(t.label, x + 12, y + 17);
    p.font(16, 800, C.ink);
    p.text(t.value, x + 12, y + 38);
    if (t.note) {
      p.font(8.5, 600, C.muted);
      p.text(t.note, x + 12, y + 53);
    }
  });
  p.y += 2 * h + gap + 10;
  if (v.confidenceNote) {
    p.font(9, 600, C.roseText);
    for (const line of p.wrap(v.confidenceNote, CONTENT_W)) {
      p.text(line, MARGIN, p.y + 9);
      p.y += 13;
    }
    p.y += 6;
  }
}

function sectionTitle(p: Pages, title: string, nextBlock: number) {
  p.ensure(22 + nextBlock);
  p.y += 8;
  p.font(12, 800, C.ink);
  p.text(title, MARGIN, p.y + 12);
  p.y += 22;
}

function drawChart(p: Pages, v: ReportView) {
  const height = 170;
  sectionTitle(p, 'Длина циклов, дней', v.chart ? height : 20);
  if (!v.chart) {
    p.font(10, 600, C.muted);
    p.text(NO_CYCLES_TEXT, MARGIN, p.y + 12);
    p.y += 24;
    return;
  }
  const { bars, average } = v.chart;
  const ctx = p.ctx;
  const axisW = 24;
  // Справа — место под подпись средней, чтобы она не наезжала на значения столбцов.
  const legendW = average !== null ? 52 : 0;
  const plot = { x: MARGIN + axisW, y: p.y + 14, w: CONTENT_W - axisW - legendW, h: height - 40 };
  const maxValue = Math.max(...bars.map((b) => b.value), average ?? 0);
  const top = Math.max(10, Math.ceil((maxValue + 3) / 10) * 10);
  const yOf = (value: number) => plot.y + plot.h - (value / top) * plot.h;

  // Шкала: линии через 10 дней.
  ctx.lineWidth = 0.6;
  for (let t = 0; t <= top; t += 10) {
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(plot.x, yOf(t));
    ctx.lineTo(plot.x + plot.w, yOf(t));
    ctx.stroke();
    p.font(7.5, 600, C.muted);
    p.text(String(t), plot.x - 6, yOf(t) + 2.5, 'right');
  }

  const slot = plot.w / bars.length;
  const barW = Math.min(26, slot * 0.6);
  const labelEvery = slot < 26 ? Math.ceil(26 / slot) : 1;
  bars.forEach((b, i) => {
    const cx = plot.x + slot * (i + 0.5);
    ctx.fillStyle = b.outlier ? C.rose : C.btnBg;
    ctx.globalAlpha = b.outlier ? 0.45 : 1;
    roundRect(ctx, cx - barW / 2, yOf(b.value), barW, plot.y + plot.h - yOf(b.value), 3);
    ctx.globalAlpha = 1;
    p.font(8, 700, C.ink);
    p.text(String(b.value), cx, yOf(b.value) - 4, 'center');
    if (i % labelEvery === 0) {
      p.font(7.5, 600, C.muted);
      p.text(b.label, cx, plot.y + plot.h + 12, 'center');
    }
  });

  if (average !== null) {
    ctx.strokeStyle = C.violet;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(plot.x, yOf(average));
    ctx.lineTo(plot.x + plot.w, yOf(average));
    ctx.stroke();
    ctx.setLineDash([]);
    p.font(8, 700, C.violet);
    p.text('среднее', plot.x + plot.w + 6, yOf(average) - 1.5);
    p.text(`${average} дн.`, plot.x + plot.w + 6, yOf(average) + 8.5);
  }
  p.y += height;
}

const ROW = 20;

function drawTable(p: Pages, title: string, table: ReportTable, widths: number[]) {
  const xs = widths.reduce<number[]>((acc, _w, i) => [...acc, i === 0 ? MARGIN : acc[i - 1]! + widths[i - 1]! * CONTENT_W], []);
  const head = () => {
    p.font(9, 800, C.muted);
    table.head.forEach((h, i) => p.text(h, xs[i]!, p.y + 13));
    p.y += ROW;
    rule();
  };
  const rule = () => {
    p.ctx.strokeStyle = C.line;
    p.ctx.lineWidth = 0.8;
    p.ctx.beginPath();
    p.ctx.moveTo(MARGIN, p.y);
    p.ctx.lineTo(MARGIN + CONTENT_W, p.y);
    p.ctx.stroke();
  };

  sectionTitle(p, title, 2 * ROW);
  head();
  for (const row of table.rows) {
    if (p.y + ROW > BOTTOM) {
      p.add();
      head();
    }
    p.font(10, 600, C.ink);
    row.forEach((cell, i) => p.text(cell, xs[i]!, p.y + 13.5));
    p.y += ROW;
    rule();
  }
  p.y += 6;
}

function drawFooters(p: Pages) {
  const total = p.canvases.length;
  p.canvases.forEach((canvas, i) => {
    const ctx = canvas.getContext('2d')!;
    ctx.font = `600 8px ${FONT}`;
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'left';
    ctx.fillText('Календарь цикла', MARGIN, PAGE.h - MARGIN + 6);
    ctx.textAlign = 'right';
    ctx.fillText(`стр. ${i + 1} из ${total}`, PAGE.w - MARGIN, PAGE.h - MARGIN + 6);
  });
}

async function loadFonts() {
  const fonts = (globalThis.document as Document | undefined)?.fonts;
  if (!fonts) return;
  await Promise.all([400, 600, 700, 800].map((w) => fonts.load(`${w} 16px Nunito`, 'Отчёт 0123')));
}

function toJpeg(canvas: HTMLCanvasElement): Promise<PdfPage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('JPEG encoding failed'));
        blob
          .arrayBuffer()
          .then((buf) => resolve({ jpeg: new Uint8Array(buf), width: canvas.width, height: canvas.height }))
          .catch(reject);
      },
      'image/jpeg',
      0.92,
    );
  });
}

/** Страницы отчёта как JPEG (по одной на страницу A4). */
export async function renderReportPages(v: ReportView): Promise<PdfPage[]> {
  await loadFonts();
  const p = new Pages();
  drawHeader(p, v);
  drawTiles(p, v);
  drawChart(p, v);
  drawTable(p, 'Циклы', v.cycleTable, [0.26, 0.2, 0.22, 0.32]);
  if (v.symptomTable) {
    const widths = v.symptomTable.head.length > 2 ? [0.4, 0.15, 0.15, 0.15, 0.15] : [0.7, 0.3];
    drawTable(p, 'Самочувствие', v.symptomTable, widths);
  }
  if (v.moodTable) drawTable(p, 'Настроение', v.moodTable, [0.7, 0.3]);
  drawFooters(p);
  return Promise.all(p.canvases.map(toJpeg));
}

/** PDF-файл отчёта для врача: `cycle-report-ГГГГ-ММ-ДД.pdf`. */
export async function createReportFile(input: DoctorReportInput & { today: LocalDate }): Promise<{ file: File; pages: number }> {
  const view = reportView(buildDoctorReport(input), input.today);
  const pages = await renderReportPages(view);
  const pdf = jpegPagesToPdf(pages, { title: view.title });
  const file = new File([pdf], `cycle-report-${input.today}.pdf`, { type: 'application/pdf' });
  return { file, pages: pages.length };
}
