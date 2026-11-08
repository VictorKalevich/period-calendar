import { addDaysLD, diffDays, isLocalDate } from './dates';
import { normalizePeriods, periodEnd } from './periods';
import { MAX_PERIOD_DAYS, type LocalDate, type Period } from './types';

// Импорт месячных из текстового файла другого приложения (specs/008-text-import).
// Из файла берутся только пары «Period start date:» / «Period end date:» в блоках «cycle N»;
// время суток отбрасывается, часовые пояса не пересчитываются. Блок «manual events» и прочие
// поля (Pregnant, intensity) пропускаются.

export interface ImportedRange {
  start: LocalDate;
  /** `null` — месячные ещё идут (конец не указан или в будущем). */
  end: LocalDate | null;
}

export interface CycleText {
  periods: ImportedRange[];
  /** Сколько блоков пропущено из-за некорректных данных. */
  skipped: number;
}

export type CycleTextError = 'not-cycle-text' | 'no-periods';

const CYCLE_RE = /^cycle\s+\d+$/i;
const SEPARATOR_RE = /^-{3,}$/;
const MANUAL_RE = /^manual events\b/i;
const START_RE = /^period start date:(.*)$/i;
const END_RE = /^period end date:(.*)$/i;

interface RawBlock {
  start: string | null;
  end: string | null;
}

/** «2017-12-23 20:00:00.0» → «2017-12-23»; некорректное значение → null. */
function dateOf(value: string): LocalDate | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/.exec(value.trim());
  return m && isLocalDate(m[1]) ? (m[1] as LocalDate) : null;
}

function readBlocks(text: string): { blocks: RawBlock[]; sawKey: boolean } {
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  let sawKey = false;
  const close = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (MANUAL_RE.test(line)) break;
    if (CYCLE_RE.test(line) || SEPARATOR_RE.test(line)) {
      close();
      if (CYCLE_RE.test(line)) current = { start: null, end: null };
      continue;
    }
    const start = START_RE.exec(line);
    if (start) {
      sawKey = true;
      // Начало без заголовка «cycle N» или второе начало в блоке — новый блок.
      if (!current || current.start !== null) {
        close();
        current = { start: null, end: null };
      }
      current!.start = start[1]!;
      continue;
    }
    const end = END_RE.exec(line);
    if (end) {
      sawKey = true;
      if (!current) current = { start: null, end: null };
      current.end = end[1]!;
    }
  }
  close();
  return { blocks, sawKey };
}

/** Разбирает текст; блоки с некорректными датами пропускаются и считаются в `skipped`. */
export function parseCycleText(
  text: string,
  today: LocalDate,
): { ok: true; value: CycleText } | { ok: false; error: CycleTextError } {
  const { blocks, sawKey } = readBlocks(text);
  if (!sawKey) return { ok: false, error: 'not-cycle-text' };

  const periods: ImportedRange[] = [];
  let skipped = 0;
  blocks.forEach((b, i) => {
    const isLast = i === blocks.length - 1;
    const start = b.start === null ? null : dateOf(b.start);
    const hasEnd = b.end !== null && b.end.trim() !== '';
    const end = hasEnd ? dateOf(b.end!) : null;
    if (!start || start > today || (hasEnd && !end)) {
      skipped++;
      return;
    }
    if (end === null) {
      // Без конца — только последние и недавно начавшиеся месячные.
      if (isLast && diffDays(today, start) < MAX_PERIOD_DAYS) periods.push({ start, end: null });
      else skipped++;
      return;
    }
    if (end < start || diffDays(end, start) + 1 > MAX_PERIOD_DAYS) {
      skipped++;
      return;
    }
    // Отмеченный конец не может быть в будущем: такие месячные ещё идут.
    periods.push({ start, end: end > today ? null : end });
  });

  if (periods.length === 0) return { ok: false, error: 'no-periods' };
  return { ok: true, value: { periods, skipped } };
}

export interface MergeImportResult {
  periods: Period[];
  /** Новые периоды из файла. */
  added: number;
  /** Существующие периоды, удалённые из-за пересечения с файлом. */
  replaced: number;
  /** Периоды файла, которые уже были отмечены с теми же датами. */
  unchanged: number;
  /** Периоды файла, которые не удалось объединить между собой (> 15 дней). */
  conflicts: number;
}

const touches = (a: Period, b: Period, periodLength: number) =>
  a.start <= addDaysLD(periodEnd(b, periodLength), 1) && b.start <= addDaysLD(periodEnd(a, periodLength), 1);

/**
 * Добавляет месячные из файла к существующим; при конфликте побеждает файл: существующие месячные,
 * которые пересекаются с периодом файла или идут вплотную к нему, удаляются целиком.
 * Совпадающие по датам существующие месячные сохраняются (с ручным концом), поэтому повторный
 * импорт того же файла ничего не меняет.
 */
export function mergeImportedPeriods(
  existing: Period[],
  imported: ImportedRange[],
  today: LocalDate,
  periodLength: number,
  newId: () => string = () => crypto.randomUUID(),
): MergeImportResult {
  const normalized = normalizePeriods(
    imported.map((r) => ({ id: newId(), start: r.start, end: r.end, endEstimated: false })),
    today,
    periodLength,
  );
  // Периоды файла, которые не объединились из-за лимита 15 дней, отбрасываются.
  const file: Period[] = [];
  let conflicts = 0;
  for (const f of normalized) {
    const prev = file.at(-1);
    if (prev && touches(prev, f, periodLength)) conflicts++;
    else file.push(f);
  }

  const result: Period[] = [];
  let replaced = 0;
  let unchanged = 0;
  const reused = new Set<Period>();
  for (const e of existing) {
    const same = file.find((f) => !reused.has(f) && f.start === e.start && f.end === e.end);
    if (same) {
      reused.add(same);
      unchanged++;
      result.push({ ...e, endEstimated: e.end === null ? e.endEstimated : false });
      continue;
    }
    if (file.some((f) => touches(f, e, periodLength))) replaced++;
    else result.push(e);
  }
  const added = file.filter((f) => !reused.has(f));
  return {
    periods: normalizePeriods([...result, ...added], today, periodLength),
    added: added.length,
    replaced,
    unchanged,
    conflicts,
  };
}
