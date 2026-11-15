import { describe, expect, it } from 'vitest';
import { validatePeriods } from './periodValidation';
import type { LocalDate } from './types';

// Фича 016: строгая проверка месячных из резервной копии (data-model.md, «Ошибка проверки»).

const TODAY = '2026-11-14' as LocalDate;
const LEN = 5;
const v = (input: unknown, periodLength = LEN) => validatePeriods(input, TODAY, periodLength);
const fail = (input: unknown) => {
  const r = v(input);
  return r.ok ? null : r.error;
};

type Raw = Record<string, unknown>;
const rec = (patch: Raw = {}, drop: string[] = []): Raw => {
  const p: Raw = { id: 'x', start: '2026-08-01', end: '2026-08-05', endEstimated: false, ...patch };
  for (const key of drop) delete p[key];
  return p;
};
const period = (id: string, start: string, end: string | null, endEstimated = false) => ({ id, start, end, endEstimated });

describe('validatePeriods — коды ошибок', () => {
  it.each(['x', undefined, null, {}, 5])('not-a-list: %j', (input) => {
    expect(fail(input)).toEqual({ code: 'not-a-list' });
  });

  it.each([null, [1], 's', 5])('not-an-object: запись %j', (record) => {
    expect(fail([record])).toEqual({ code: 'not-an-object' });
  });

  it.each([5, '', null])('invalid-id: id %j', (id) => {
    expect(fail([rec({ id })])).toEqual({ code: 'invalid-id', id });
  });

  it('invalid-id: поля id нет', () => {
    expect(fail([rec({}, ['id'])])).toEqual({ code: 'invalid-id', id: undefined });
  });

  it('duplicate-id', () => {
    expect(fail([period('a', '2026-08-01', null), period('a', '2026-09-01', null)])).toEqual({ code: 'duplicate-id', id: 'a' });
  });

  it.each(['2026-02-30', '2026-8-1', 20260801])('invalid-start: %j', (start) => {
    expect(fail([rec({ start })])).toEqual({ code: 'invalid-start', start });
  });

  it('invalid-start: поля start нет', () => {
    expect(fail([rec({}, ['start'])])).toEqual({ code: 'invalid-start', start: undefined });
  });

  it.each(['2026-13-01', ''])('invalid-end: %j', (end) => {
    expect(fail([rec({ end })])).toEqual({ code: 'invalid-end', end });
  });

  it('invalid-end: поля end нет; end: null — корректно', () => {
    expect(fail([rec({}, ['end'])])).toEqual({ code: 'invalid-end', end: undefined });
    expect(v([rec({ end: null })]).ok).toBe(true);
  });

  it.each(['no', 0, null])('invalid-end-estimated: %j', (endEstimated) => {
    expect(fail([rec({ endEstimated })])).toEqual({ code: 'invalid-end-estimated' });
  });

  it('invalid-end-estimated: поля нет', () => {
    expect(fail([rec({}, ['endEstimated'])])).toEqual({ code: 'invalid-end-estimated' });
  });

  it('end-before-start', () => {
    expect(fail([rec({ end: '2026-07-31' })])).toEqual({ code: 'end-before-start', start: '2026-08-01' });
  });

  it('too-long: 16 дней — ошибка, 15 — можно', () => {
    expect(fail([rec({ end: '2026-08-16' })])).toEqual({ code: 'too-long', start: '2026-08-01', maxDays: 15 });
    expect(v([rec({ end: '2026-08-15' })]).ok).toBe(true);
  });

  it('overlap: пересечение, которое нельзя объединить', () => {
    expect(fail([period('x', '2026-08-01', '2026-08-10'), period('y', '2026-08-08', '2026-08-17')])).toEqual({
      code: 'overlap',
      first: '2026-08-01',
      second: '2026-08-08',
    });
  });
});

describe('validatePeriods — порядок проверок', () => {
  it('первая ошибка — по порядку записей', () => {
    expect(fail([rec({ start: '2026-02-30' }), rec({ id: 5 })])).toEqual({ code: 'invalid-start', start: '2026-02-30' });
  });

  it('id проверяется раньше даты начала', () => {
    expect(fail([rec({ id: 5, start: 'плохо' })])).toEqual({ code: 'invalid-id', id: 5 });
  });

  it('признак endEstimated проверяется раньше порядка дат', () => {
    expect(fail([rec({ end: '2026-07-30', endEstimated: 'no' })])).toEqual({ code: 'invalid-end-estimated' });
  });

  it('проверки записей — раньше пересечений', () => {
    const input = [period('x', '2026-08-01', '2026-08-10'), period('y', '2026-08-08', '2026-08-17'), period('z', '2026-02-30', null)];
    expect(fail(input)).toEqual({ code: 'invalid-start', start: '2026-02-30' });
  });
});

describe('validatePeriods — корректный список', () => {
  it('сортирует по началу и отбрасывает лишние поля', () => {
    const r = v([{ ...period('b', '2026-09-01', null), color: 'red' }, period('a', '2026-08-01', '2026-08-05', true)]);
    expect(r).toEqual({ ok: true, value: [period('a', '2026-08-01', '2026-08-05', true), period('b', '2026-09-01', null)] });
  });

  it('объединяет соседние месячные', () => {
    const r = v([period('a', '2026-08-01', '2026-08-05'), period('b', '2026-08-06', '2026-08-08')]);
    expect(r).toEqual({ ok: true, value: [period('a', '2026-08-01', '2026-08-08')] });
  });

  it('соприкосновение без объединения (больше 15 дней) — две записи', () => {
    const r = v([period('a', '2026-08-01', '2026-08-10'), period('b', '2026-08-11', '2026-08-20')]);
    expect(r).toEqual({ ok: true, value: [period('a', '2026-08-01', '2026-08-10'), period('b', '2026-08-11', '2026-08-20')] });
  });

  it('пустой список', () => {
    expect(v([])).toEqual({ ok: true, value: [] });
  });

  it('длина месячных — для оценки незакрытых', () => {
    const input = [period('a', '2026-08-01', null), period('b', '2026-08-06', '2026-08-07')];
    expect(v(input, 5)).toEqual({ ok: true, value: [period('a', '2026-08-01', '2026-08-07')] });
    expect(v(input, 3)).toEqual({ ok: true, value: [period('a', '2026-08-01', null), period('b', '2026-08-06', '2026-08-07')] });
  });

  it('не меняет вход и не бросает на смешанном входе', () => {
    const input = [period('b', '2026-09-01', null), period('a', '2026-08-01', '2026-08-05')];
    const before = structuredClone(input);
    v(input);
    expect(input).toEqual(before);
    expect(() => v([period('a', '2026-08-01', null), 'x'])).not.toThrow();
    expect(fail([period('a', '2026-08-01', null), 'x'])).toEqual({ code: 'not-an-object' });
  });
});
