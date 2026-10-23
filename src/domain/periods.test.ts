import { describe, expect, it } from 'vitest';
import { markPeriodEnd, markPeriodStart, unmarkPeriodDay } from './periods';
import type { LocalDate, Period, Result } from './types';

const ld = (s: string) => s as LocalDate;
const TODAY = ld('2026-10-23');
const PL = 5;

let n = 0;
const newId = () => `id${++n}`;

function p(start: string, end: string | null, endEstimated = false): Omit<Period, 'id'> {
  return { start: ld(start), end: end === null ? null : ld(end), endEstimated };
}

function ok<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`);
  return r.value;
}

const strip = (ps: Period[]) => ps.map(({ id: _id, ...rest }) => rest);

function assertNoOverlap(ps: Period[]) {
  for (let i = 1; i < ps.length; i++) {
    const prev = ps[i - 1]!;
    expect((prev.end ?? prev.start) < ps[i]!.start).toBe(true);
  }
}

describe('markPeriodStart', () => {
  it('creates an open period', () => {
    const res = ok(markPeriodStart([], ld('2026-10-20'), TODAY, PL, newId));
    expect(strip(res)).toEqual([p('2026-10-20', null)]);
    expect(res[0]!.id).toMatch(/^id\d+$/);
  });

  it('allows today', () => {
    expect(markPeriodStart([], TODAY, TODAY, PL, newId).ok).toBe(true);
  });

  it('rejects future dates (case 11)', () => {
    expect(markPeriodStart([], ld('2026-10-24'), TODAY, PL, newId)).toEqual({ ok: false, error: 'future-date' });
  });

  it('rejects a start inside an existing closed period (case 12)', () => {
    const existing = [{ id: 'a', ...p('2026-10-01', '2026-10-05') }];
    expect(markPeriodStart(existing, ld('2026-10-03'), TODAY, PL, newId)).toEqual({ ok: false, error: 'inside-existing' });
    expect(markPeriodStart(existing, ld('2026-10-01'), TODAY, PL, newId)).toEqual({ ok: false, error: 'inside-existing' });
  });

  it('rejects a start inside the estimated extent of an open period', () => {
    const existing = [{ id: 'a', ...p('2026-10-20', null) }];
    expect(markPeriodStart(existing, ld('2026-10-22'), TODAY, PL, newId)).toEqual({ ok: false, error: 'inside-existing' });
  });

  it('closes the previous open period with an estimated end (case 10)', () => {
    const existing = [{ id: 'a', ...p('2026-09-20', null) }];
    const res = ok(markPeriodStart(existing, ld('2026-10-18'), TODAY, PL, newId));
    expect(strip(res)).toEqual([p('2026-09-20', '2026-09-24', true), p('2026-10-18', null)]);
  });

  it('an inserted period that ends right before the next one merges with it (003 rev. 2)', () => {
    const existing = [{ id: 'a', ...p('2026-10-08', '2026-10-11') }];
    const res = ok(markPeriodStart(existing, ld('2026-10-05'), TODAY, PL, newId));
    expect(strip(res)).toEqual([p('2026-10-05', '2026-10-11')]);
  });

  it('a start right after the previous period merges into one', () => {
    const res = ok(markPeriodStart([{ id: 'a', ...p('2026-10-01', '2026-10-04') }], ld('2026-10-05'), TODAY, PL, newId));
    expect(strip(res)).toEqual([p('2026-10-01', '2026-10-09', true)]);
  });

  it('rejects a start whose merge would exceed 15 days', () => {
    const existing = [{ id: 'a', ...p('2026-10-01', '2026-10-12') }];
    expect(markPeriodStart(existing, ld('2026-10-13'), TODAY, PL, newId)).toEqual({ ok: false, error: 'too-long' });
  });

  it('inserts a past period between existing ones and closes it with an estimate', () => {
    const existing = [{ id: 'a', ...p('2026-08-01', '2026-08-05') }, { id: 'b', ...p('2026-10-01', '2026-10-04') }];
    const res = ok(markPeriodStart(existing, ld('2026-09-01'), TODAY, PL, newId));
    expect(strip(res)).toEqual([
      p('2026-08-01', '2026-08-05'),
      p('2026-09-01', '2026-09-05', true),
      p('2026-10-01', '2026-10-04'),
    ]);
    assertNoOverlap(res);
  });

  it('crosses the year boundary', () => {
    const existing = [{ id: 'a', ...p('2026-12-29', null) }];
    const res = ok(markPeriodStart(existing, ld('2027-01-26'), ld('2027-01-26'), PL, newId));
    expect(strip(res)[0]).toEqual(p('2026-12-29', '2027-01-02', true));
  });
});

describe('markPeriodEnd', () => {
  it('closes an open period with a manual end', () => {
    const res = ok(markPeriodEnd([{ id: 'a', ...p('2026-10-18', null) }], ld('2026-10-22'), TODAY, PL));
    expect(strip(res)).toEqual([p('2026-10-18', '2026-10-22', false)]);
  });

  it('changes the end of a closed period and clears the estimated flag', () => {
    const res = ok(markPeriodEnd([{ id: 'a', ...p('2026-10-01', '2026-10-05', true) }], ld('2026-10-03'), TODAY, PL));
    expect(strip(res)).toEqual([p('2026-10-01', '2026-10-03', false)]);
  });

  it('allows a one-day period', () => {
    const res = ok(markPeriodEnd([{ id: 'a', ...p('2026-10-18', null) }], ld('2026-10-18'), TODAY, PL));
    expect(strip(res)).toEqual([p('2026-10-18', '2026-10-18')]);
  });

  it('rejects future dates', () => {
    expect(markPeriodEnd([{ id: 'a', ...p('2026-10-20', null) }], ld('2026-10-24'), TODAY, PL)).toEqual({
      ok: false,
      error: 'future-date',
    });
  });

  it('rejects an end before the start', () => {
    expect(markPeriodEnd([{ id: 'a', ...p('2026-10-20', null) }], ld('2026-10-19'), TODAY, PL)).toEqual({
      ok: false,
      error: 'end-before-start',
    });
  });

  it('rejects periods longer than 15 days (case 21)', () => {
    const existing = [{ id: 'a', ...p('2026-10-01', null) }];
    expect(markPeriodEnd(existing, ld('2026-10-15'), TODAY, PL).ok).toBe(true);
    expect(markPeriodEnd(existing, ld('2026-10-16'), TODAY, PL)).toEqual({ ok: false, error: 'too-long' });
  });

  it('reports no-open-period without any periods', () => {
    expect(markPeriodEnd([], ld('2026-10-20'), TODAY, PL)).toEqual({ ok: false, error: 'no-open-period' });
  });

  it('an end right before the next period merges them', () => {
    const existing = [
      { id: 'a', ...p('2026-10-01', '2026-10-03') },
      { id: 'b', ...p('2026-10-07', '2026-10-09') },
    ];
    expect(strip(ok(markPeriodEnd(existing, ld('2026-10-06'), TODAY, PL)))).toEqual([p('2026-10-01', '2026-10-09')]);
  });
});

describe('unmarkPeriodDay', () => {
  it('removes the period when unmarking its start', () => {
    expect(unmarkPeriodDay([{ id: 'a', ...p('2026-10-01', '2026-10-05') }], ld('2026-10-01'))).toEqual([]);
  });

  it('shortens the period when unmarking an inner day', () => {
    const res = unmarkPeriodDay([{ id: 'a', ...p('2026-10-01', '2026-10-05', true) }], ld('2026-10-04'));
    expect(strip(res)).toEqual([p('2026-10-01', '2026-10-03', false)]);
  });

  it('shortens an open period', () => {
    const res = unmarkPeriodDay([{ id: 'a', ...p('2026-10-18', null) }], ld('2026-10-21'));
    expect(strip(res)).toEqual([p('2026-10-18', '2026-10-20', false)]);
  });

  it('leaves periods unchanged for unrelated days', () => {
    const existing = [{ id: 'a', ...p('2026-10-01', '2026-10-05') }];
    expect(unmarkPeriodDay(existing, ld('2026-10-10'))).toEqual(existing);
  });
});
