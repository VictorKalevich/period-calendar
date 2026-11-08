import { describe, expect, it } from 'vitest';
import { mergeImportedPeriods, parseCycleText } from './cycleText';
import type { LocalDate, Period } from './types';

// specs/008-text-import: импорт месячных из текстового файла другого приложения.

const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-11-09');

const block = (n: number, start: string, end?: string) =>
  [
    `cycle ${n}`,
    `Period start date: ${start}`,
    ...(end === undefined ? [] : [`Period end date: ${end}`]),
    'Pregnant: False',
    'Period intensity: ',
    'Day 1: intensity: Medium ',
    '---------------',
  ].join('\n');

const ranges = (r: { periods: { start: string; end: string | null }[] }) => r.periods.map((p) => [p.start, p.end]);

describe('parseCycleText', () => {
  it('reads start and end dates and ignores the time of day', () => {
    const text = [block(0, '2017-12-23 20:00:00.0', '2017-12-27 20:00:00.0'), block(1, '2018-02-17 01:00:00.0', '2018-02-22 01:00:00.0')].join('\n');
    const r = parseCycleText(text, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ranges(r.value)).toEqual([
      ['2017-12-23', '2017-12-27'],
      ['2018-02-17', '2018-02-22'],
    ]);
    expect(r.value.skipped).toBe(0);
  });

  it('keeps periods across a year boundary and one-day periods', () => {
    const text = [block(0, '2020-12-31 01:00:00.0', '2021-01-04 01:00:00.0'), block(1, '2023-07-12 00:00:00.0', '2023-07-12 00:00:00.0')].join('\n');
    const r = parseCycleText(text, TODAY);
    expect(r.ok && ranges(r.value)).toEqual([
      ['2020-12-31', '2021-01-04'],
      ['2023-07-12', '2023-07-12'],
    ]);
  });

  it('ignores the manual events section and other fields', () => {
    const text = [
      block(0, '2026-10-21 00:00:00.0', '2026-10-25 00:00:00.0'),
      'manual events ',
      '0 - 2018-01-06 20:00:00 - 2018-01-06 20:00:00 - Symptom - Fatigue - ',
      'Period start date: 2019-01-01 00:00:00.0',
    ].join('\n');
    const r = parseCycleText(text, TODAY);
    expect(r.ok && ranges(r.value)).toEqual([['2026-10-21', '2026-10-25']]);
  });

  it('handles CRLF line endings and extra spaces', () => {
    const text = 'cycle 0\r\n   Period start date:   2025-02-01 00:00:00.0  \r\nPeriod end date:2025-02-05 00:00:00.0\r\n---------------\r\n';
    const r = parseCycleText(text, TODAY);
    expect(r.ok && ranges(r.value)).toEqual([['2025-02-01', '2025-02-05']]);
  });

  it('skips broken blocks and counts them', () => {
    const text = [
      block(0, '2025-03-10 00:00:00.0', '2025-03-05 00:00:00.0'), // конец раньше начала
      block(1, 'garbage', '2025-04-05 00:00:00.0'), // нет начала
      block(2, '2025-05-01 00:00:00.0', '2025-05-30 00:00:00.0'), // длиннее 15 дней
      block(3, '2027-01-01 00:00:00.0', '2027-01-05 00:00:00.0'), // в будущем
      block(4, '2025-06-01 00:00:00.0'), // без конца и не последний
      block(5, '2025-07-01 00:00:00.0', '2025-07-05 00:00:00.0'),
    ].join('\n');
    const r = parseCycleText(text, TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(ranges(r.value)).toEqual([['2025-07-01', '2025-07-05']]);
    expect(r.value.skipped).toBe(5);
  });

  it('imports the last block without an end as ongoing only when it started recently', () => {
    const recent = parseCycleText(block(0, '2026-11-07 00:00:00.0'), TODAY);
    expect(recent.ok && ranges(recent.value)).toEqual([['2026-11-07', null]]);
    const old = parseCycleText([block(0, '2026-10-01 00:00:00.0', '2026-10-05 00:00:00.0'), block(1, '2026-10-01 00:00:00.0')].join('\n'), TODAY);
    expect(old.ok && old.value.skipped).toBe(1);
  });

  it('treats an end date in the future as an ongoing period', () => {
    const r = parseCycleText(block(0, '2026-11-08 00:00:00.0', '2026-11-12 00:00:00.0'), TODAY);
    expect(r.ok && ranges(r.value)).toEqual([['2026-11-08', null]]);
  });

  it('rejects files without period dates', () => {
    expect(parseCycleText('', TODAY)).toEqual({ ok: false, error: 'not-cycle-text' });
    expect(parseCycleText('hello\nworld', TODAY)).toEqual({ ok: false, error: 'not-cycle-text' });
    expect(parseCycleText(block(0, 'garbage', 'garbage'), TODAY)).toEqual({ ok: false, error: 'no-periods' });
  });
});

describe('mergeImportedPeriods', () => {
  let n = 0;
  const newId = () => `new-${++n}`;
  const p = (id: string, start: string, end: string | null, endEstimated = false): Period => ({
    id,
    start: ld(start),
    end: end === null ? null : ld(end),
    endEstimated,
  });
  const r = (start: string, end: string | null) => ({ start: ld(start), end: end === null ? null : ld(end) });
  const spans = (ps: Period[]) => ps.map((x) => [x.start, x.end]);

  it('merges duplicate and overlapping periods inside the file', () => {
    const res = mergeImportedPeriods([], [r('2025-01-05', '2025-01-09'), r('2025-01-05', '2025-01-13')], TODAY, 5, newId);
    expect(spans(res.periods)).toEqual([['2025-01-05', '2025-01-13']]);
    expect(res.added).toBe(1);
  });

  it('file wins over an overlapping existing period', () => {
    const res = mergeImportedPeriods([p('old', '2025-01-03', '2025-01-07')], [r('2025-01-05', '2025-01-13')], TODAY, 5, newId);
    expect(spans(res.periods)).toEqual([['2025-01-05', '2025-01-13']]);
    expect(res.replaced).toBe(1);
  });

  it('removes an existing period that touches a file period, keeping file dates intact', () => {
    const res = mergeImportedPeriods([p('old', '2025-01-14', '2025-01-16')], [r('2025-01-05', '2025-01-13')], TODAY, 5, newId);
    expect(spans(res.periods)).toEqual([['2025-01-05', '2025-01-13']]);
    expect(res.replaced).toBe(1);
  });

  it('keeps existing periods that do not touch the file', () => {
    const keep = p('keep', '2025-03-01', '2025-03-05');
    const res = mergeImportedPeriods([keep], [r('2025-01-05', '2025-01-13')], TODAY, 5, newId);
    expect(res.periods).toContainEqual(keep);
    expect(spans(res.periods)).toEqual([
      ['2025-01-05', '2025-01-13'],
      ['2025-03-01', '2025-03-05'],
    ]);
    expect(res.replaced).toBe(0);
  });

  it('replaces an open existing period that overlaps by its estimated end', () => {
    // 03.01 + длина 5 → оценочно 03–07.01, пересекается с 05–13.01
    const res = mergeImportedPeriods([p('open', '2025-01-03', null)], [r('2025-01-05', '2025-01-13')], TODAY, 5, newId);
    expect(spans(res.periods)).toEqual([['2025-01-05', '2025-01-13']]);
    expect(res.replaced).toBe(1);
  });

  it('re-importing the same file changes nothing', () => {
    const file = [r('2025-01-05', '2025-01-13'), r('2025-02-01', '2025-02-05')];
    const first = mergeImportedPeriods([], file, TODAY, 5, newId);
    const second = mergeImportedPeriods(first.periods, file, TODAY, 5, newId);
    expect(second.periods).toEqual(first.periods);
    expect(second).toMatchObject({ added: 0, replaced: 0, unchanged: 2 });
  });

  it('an identical existing period with an estimated end becomes a marked one', () => {
    const res = mergeImportedPeriods([p('same', '2025-02-01', '2025-02-05', true)], [r('2025-02-01', '2025-02-05')], TODAY, 5, newId);
    expect(res.periods).toEqual([p('same', '2025-02-01', '2025-02-05', false)]);
    expect(res).toMatchObject({ added: 0, replaced: 0, unchanged: 1 });
  });
});
