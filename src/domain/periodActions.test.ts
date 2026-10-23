import { describe, expect, it } from 'vitest';
import { periodActionsFor, setPeriodStart, type PeriodAction, type PeriodActionKind } from './periods';
import type { LocalDate, Period, Result } from './types';

// Состав диалога «Месячные» — таблица А/Б/В, ревизия 2 (specs/003-calendar-tap-actions/contracts/period-actions.md).

const ld = (s: string) => s as LocalDate;
const p = (id: string, start: string, end: string | null = null, endEstimated = false): Period => ({
  id,
  start: ld(start),
  end: end === null ? null : ld(end),
  endEstimated,
});
const L = 5;
const kinds = (date: string, today: string, periods: Period[], len = L) =>
  periodActionsFor(ld(date), ld(today), periods, len).map((a) => a.kind);
const action = (date: string, today: string, periods: Period[], kind: PeriodActionKind, len = L): PeriodAction => {
  const a = periodActionsFor(ld(date), ld(today), periods, len).find((x) => x.kind === kind);
  if (!a) throw new Error(`no ${kind}`);
  return a;
};
const ok = (r: Result<Period[]>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('periodActionsFor — состав диалога', () => {
  it('1: будущий день — кнопок нет', () => {
    expect(kinds('2026-10-11', '2026-10-10', [p('a', '2026-10-01', '2026-10-04')])).toEqual([]);
    expect(kinds('2026-10-11', '2026-10-10', [p('a', '2026-10-08')])).toEqual([]); // прогнозная часть идущих
  });

  describe('А: первый день — только «Удалить период»', () => {
    it.each([
      ['закрытые', [p('a', '2026-10-01', '2026-10-04')], 'Удалить месячные 1–4 октября?'],
      ['незакрытые (по длине)', [p('a', '2026-10-01')], 'Удалить месячные 1–5 октября?'],
      ['с оценочным концом', [p('a', '2026-10-01', '2026-10-03', true)], 'Удалить месячные 1–3 октября?'],
      ['через месяц', [p('a', '2026-09-29', '2026-10-02')], 'Удалить месячные 29 сентября – 2 октября?'],
    ])('2: %s', (_name, periods, confirm) => {
      const start = periods[0]!.start;
      expect(kinds(start, '2026-10-20', periods)).toEqual(['delete-period']);
      const a = action(start, '2026-10-20', periods, 'delete-period');
      expect(a.label).toBe('Удалить период');
      expect(a.confirm).toBe(confirm);
      expect(ok(a.apply())).toEqual([]);
    });
  });

  describe('Б: второй и следующие дни — «Отметить конец», «Установить как начало»', () => {
    it.each([
      ['второй день', '2026-10-02', [p('a', '2026-10-01', '2026-10-04')]],
      ['последний день', '2026-10-04', [p('a', '2026-10-01', '2026-10-04')]],
      ['внутри незакрытых', '2026-10-03', [p('a', '2026-10-01')]],
      ['внутри оценочного конца', '2026-10-03', [p('a', '2026-10-01', '2026-10-06', true)]],
    ])('3: %s', (_name, date, periods) => {
      expect(kinds(date, '2026-10-20', periods)).toEqual(['end-here', 'set-start']);
    });
  });

  describe('В: день вне месячных', () => {
    it('4: без соседних месячных — только «Начало месячных»', () => {
      expect(kinds('2026-10-05', '2026-10-10', [])).toEqual(['start']);
      expect(kinds('2026-10-20', '2026-10-25', [p('a', '2026-10-01', '2026-10-04')])).toEqual(['start']);
    });

    it('5: 1–7 дней после конца — «Продлить месячные до»', () => {
      const periods = [p('a', '2026-10-01', '2026-10-04')];
      expect(kinds('2026-10-08', '2026-10-12', periods)).toEqual(['start', 'extend-to']);
      expect(action('2026-10-08', '2026-10-12', periods, 'extend-to').label).toBe('Продлить месячные до 8 октября');
      expect(kinds('2026-10-11', '2026-10-20', periods)).toEqual(['start', 'extend-to']); // 7 дней
      expect(kinds('2026-10-07', '2026-10-20', [p('a', '2026-10-01')])).toEqual(['start', 'extend-to']); // от оценки 1–5
    });

    it('6: 8 дней после конца или итог больше 15 — нет', () => {
      expect(kinds('2026-10-12', '2026-10-20', [p('a', '2026-10-01', '2026-10-04')])).toEqual(['start']);
      expect(kinds('2026-10-10', '2026-10-20', [p('a', '2026-09-25', '2026-10-04')])).toEqual(['start']); // 16 дней
      expect(kinds('2026-10-09', '2026-10-20', [p('a', '2026-09-25', '2026-10-04')])).toEqual(['start', 'extend-to']); // 15
    });

    it('7: 1–3 дня до начала следующих — «Установить как начало месячных»', () => {
      const periods = [p('b', '2026-10-10', '2026-10-14')];
      expect(kinds('2026-10-08', '2026-10-20', periods)).toEqual(['start', 'set-next-start']);
      expect(action('2026-10-08', '2026-10-20', periods, 'set-next-start').label).toBe('Установить как начало месячных');
    });

    it('8: 4 дня до начала или итог больше 15 — нет', () => {
      expect(kinds('2026-10-06', '2026-10-20', [p('b', '2026-10-10', '2026-10-14')])).toEqual(['start']);
      expect(kinds('2026-10-07', '2026-10-25', [p('b', '2026-10-10', '2026-10-22')])).toEqual(['start']); // 7–22 = 16
      expect(kinds('2026-10-08', '2026-10-25', [p('b', '2026-10-10', '2026-10-22')])).toEqual(['start', 'set-next-start']); // 15
    });

    it('9: 3 дня после и 3 дня до — обе кнопки', () => {
      const periods = [p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-10', '2026-10-14')];
      expect(kinds('2026-10-07', '2026-10-20', periods)).toEqual(['start', 'extend-to', 'set-next-start']);
    });

    it('13: слияние после действия длиннее 15 дней — условной кнопки нет', () => {
      // перенос начала 9–16 на 7-е встаёт вплотную к 1–6 → вместе 1–16 = 16 дней
      const periods = [p('a', '2026-10-01', '2026-10-06'), p('b', '2026-10-09', '2026-10-16')];
      expect(kinds('2026-10-07', '2026-10-25', periods)).toEqual(['start', 'extend-to']);
    });
  });
});

describe('apply() — результат действий (10, 12)', () => {
  it('end-here и set-start', () => {
    const periods = [p('a', '2026-10-01', '2026-10-06', true)];
    expect(ok(action('2026-10-03', '2026-10-20', periods, 'end-here').apply())).toEqual([p('a', '2026-10-01', '2026-10-03')]);
    expect(ok(action('2026-10-03', '2026-10-20', [p('a', '2026-10-01', '2026-10-06')], 'set-start').apply())).toEqual([
      p('a', '2026-10-03', '2026-10-06'),
    ]);
  });

  it('start создаёт месячные; вплотную к предыдущим — одни месячные', () => {
    const fresh = periodActionsFor(ld('2026-10-05'), ld('2026-10-10'), [], L, () => 'new').find((x) => x.kind === 'start')!;
    expect(ok(fresh.apply())).toEqual([p('new', '2026-10-05')]);
    const touching = periodActionsFor(ld('2026-10-05'), ld('2026-10-20'), [p('a', '2026-10-01', '2026-10-04')], L, () => 'new');
    expect(ok(touching.find((x) => x.kind === 'start')!.apply())).toEqual([p('a', '2026-10-01', '2026-10-09', true)]);
  });

  it('extend-to: конец на выбранный день; до дня перед следующими — одни месячные', () => {
    expect(ok(action('2026-10-08', '2026-10-12', [p('a', '2026-10-01', '2026-10-04', true)], 'extend-to').apply())).toEqual([
      p('a', '2026-10-01', '2026-10-08', false),
    ]);
    const periods = [p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-10', '2026-10-13')];
    expect(ok(action('2026-10-09', '2026-10-20', periods, 'extend-to').apply())).toEqual([p('a', '2026-10-01', '2026-10-13')]);
  });

  it('set-next-start: начало следующих переносится (через месяц); вплотную к предыдущим — слияние', () => {
    expect(ok(action('2026-10-31', '2026-11-20', [p('b', '2026-11-02', '2026-11-05')], 'set-next-start').apply())).toEqual([
      p('b', '2026-10-31', '2026-11-05'),
    ]);
    const periods = [p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-07', '2026-10-10')];
    expect(ok(action('2026-10-05', '2026-10-20', periods, 'set-next-start').apply())).toEqual([p('a', '2026-10-01', '2026-10-10')]);
  });
});

describe('setPeriodStart — конец незакрытых месячных', () => {
  it('прошедшая оценка сохраняется как оценочный конец', () => {
    expect(setPeriodStart([p('a', '2026-10-01')], 'a', ld('2026-10-03'), ld('2026-10-20'), L)).toEqual([
      p('a', '2026-10-03', '2026-10-05', true),
    ]);
  });

  it('если месячные ещё идут — конец остаётся неотмеченным', () => {
    expect(setPeriodStart([p('a', '2026-10-18')], 'a', ld('2026-10-19'), ld('2026-10-20'), L)).toEqual([p('a', '2026-10-19')]);
  });

  it('отмеченный конец не меняется', () => {
    expect(setPeriodStart([p('a', '2026-10-01', '2026-10-06')], 'a', ld('2026-10-02'), ld('2026-10-20'), L)).toEqual([
      p('a', '2026-10-02', '2026-10-06'),
    ]);
  });
});
