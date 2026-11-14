import { diffDays, isLocalDate } from './dates';
import { isObject } from './guards';
import { normalizePeriods, periodEnd } from './periods';
import { MAX_PERIOD_DAYS, type LocalDate, type Period, type Result } from './types';

// Строгая проверка месячных из внешнего источника — резервной копии (фича 016,
// specs/016-domain-validation/data-model.md). Текст для пользовательницы строит вызывающий по коду.

export type PeriodValidationError =
  | { code: 'not-a-list' }
  | { code: 'not-an-object' }
  | { code: 'invalid-id'; id: unknown }
  | { code: 'duplicate-id'; id: string }
  | { code: 'invalid-start'; start: unknown }
  | { code: 'invalid-end'; end: unknown }
  | { code: 'invalid-end-estimated' }
  | { code: 'end-before-start'; start: LocalDate }
  | { code: 'too-long'; start: LocalDate; maxDays: number }
  | { code: 'overlap'; first: LocalDate; second: LocalDate };

type Checked = Result<Period[], PeriodValidationError>;

const fail = (error: PeriodValidationError): Checked => ({ ok: false, error });

/** Каждая запись по порядку до первой ошибки; из записи берутся только поля месячных. */
function checkEach(input: unknown): Checked {
  if (!Array.isArray(input)) return fail({ code: 'not-a-list' });
  const out: Period[] = [];
  const ids = new Set<string>();
  for (const raw of input) {
    if (!isObject(raw)) return fail({ code: 'not-an-object' });
    const { id, start, end, endEstimated } = raw;
    if (typeof id !== 'string' || id === '') return fail({ code: 'invalid-id', id });
    if (ids.has(id)) return fail({ code: 'duplicate-id', id });
    if (!isLocalDate(start)) return fail({ code: 'invalid-start', start });
    if (end !== null && !isLocalDate(end)) return fail({ code: 'invalid-end', end });
    if (typeof endEstimated !== 'boolean') return fail({ code: 'invalid-end-estimated' });
    if (end !== null && end < start) return fail({ code: 'end-before-start', start });
    if (end !== null && diffDays(end, start) + 1 > MAX_PERIOD_DAYS) return fail({ code: 'too-long', start, maxDays: MAX_PERIOD_DAYS });
    ids.add(id);
    out.push({ id, start, end, endEstimated });
  }
  return { ok: true, value: out };
}

/**
 * Проверяет список месячных и объединяет пересекающиеся и соседние (003 FR-015); для оценки незакрытых —
 * `periodLength`. Пересечение, которое нельзя объединить (> 15 дней), — ошибка. Вход не меняется.
 */
export function validatePeriods(input: unknown, today: LocalDate, periodLength: number): Checked {
  const checked = checkEach(input);
  if (!checked.ok) return checked;
  const out = normalizePeriods(checked.value, today, periodLength);
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!;
    const next = out[i]!;
    if (periodEnd(prev, periodLength) >= next.start) return fail({ code: 'overlap', first: prev.start, second: next.start });
  }
  return { ok: true, value: out };
}
