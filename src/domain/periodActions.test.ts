import { describe, expect, it } from 'vitest';
import { periodActionsFor, setPeriodStart, type PeriodAction, type PeriodActionKind } from './periods';
import type { LocalDate, Period, Result } from './types';

// Состав диалога «Месячные» — таблица А/Б/В (specs/003-calendar-tap-actions, contracts/period-actions.md).

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
  });

  describe('А: день — начало месячных', () => {
    it('2: незакрытые, конец по длине не позже сегодня — с «Продлить»', () => {
      expect(kinds('2026-10-01', '2026-10-06', [p('a', '2026-10-01')])).toEqual(['extend-by-length', 'end-one-day', 'unmark']);
      expect(action('2026-10-01', '2026-10-06', [p('a', '2026-10-01')], 'extend-by-length').label).toBe(
        'Продлить месячные: 1–5 октября',
      );
    });

    it('3: конец по длине в будущем — без «Продлить»', () => {
      expect(kinds('2026-10-01', '2026-10-03', [p('a', '2026-10-01')])).toEqual(['end-one-day', 'unmark']);
    });

    it('4: конец отмечен вручную — без «Продлить»', () => {
      expect(kinds('2026-10-01', '2026-10-20', [p('a', '2026-10-01', '2026-10-04')])).toEqual(['end-one-day', 'unmark']);
    });

    it('5: оценочный конец раньше конца по длине — «Продлить» есть', () => {
      expect(kinds('2026-10-01', '2026-10-20', [p('a', '2026-10-01', '2026-10-03', true)])).toEqual([
        'extend-by-length',
        'end-one-day',
        'unmark',
      ]);
    });

    it('6: оценочный конец не раньше конца по длине — «Продлить» нет (не сокращает)', () => {
      expect(kinds('2026-10-01', '2026-10-20', [p('a', '2026-10-01', '2026-10-07', true)])).toEqual(['end-one-day', 'unmark']);
      expect(kinds('2026-10-01', '2026-10-20', [p('a', '2026-10-01', '2026-10-05', true)])).toEqual(['end-one-day', 'unmark']);
    });

    it('7: конец по длине упирается в следующие месячные — «Продлить» нет', () => {
      const periods = [p('a', '2026-10-01', '2026-10-02', true), p('b', '2026-10-05', '2026-10-08')];
      expect(kinds('2026-10-01', '2026-10-20', periods)).toEqual(['end-one-day', 'unmark']);
    });
  });

  describe('Б: день внутри месячных, не начало', () => {
    it('8: незакрытые — «Продлить» и действия дня', () => {
      expect(kinds('2026-10-03', '2026-10-06', [p('a', '2026-10-01')])).toEqual([
        'extend-by-length',
        'end-here',
        'set-start',
        'unmark-day',
      ]);
    });

    it('8: конец вручную — без «Продлить»', () => {
      expect(kinds('2026-10-02', '2026-10-20', [p('a', '2026-10-01', '2026-10-04')])).toEqual([
        'end-here',
        'set-start',
        'unmark-day',
      ]);
    });
  });

  describe('В: день вне месячных', () => {
    it('9: без соседних месячных — только «Начало месячных»', () => {
      expect(kinds('2026-10-05', '2026-10-10', [])).toEqual(['start']);
    });

    it('10: через 4 дня после конца — «Продлить месячные до»', () => {
      const periods = [p('a', '2026-10-01', '2026-10-04')];
      expect(kinds('2026-10-08', '2026-10-12', periods)).toEqual(['start', 'extend-to']);
      expect(action('2026-10-08', '2026-10-12', periods, 'extend-to').label).toBe('Продлить месячные до 8 октября');
    });

    it('10: граница — 1 и 7 дней после конца есть, считая от оценочного конца незакрытых', () => {
      expect(kinds('2026-10-05', '2026-10-20', [p('a', '2026-10-01', '2026-10-04')])).toEqual(['start', 'extend-to']);
      expect(kinds('2026-10-11', '2026-10-20', [p('a', '2026-10-01', '2026-10-04')])).toEqual(['start', 'extend-to']);
      expect(kinds('2026-10-07', '2026-10-20', [p('a', '2026-10-01')])).toEqual(['start', 'extend-to']); // оценка 1–5
    });

    it('11: через 8 дней после конца — нет', () => {
      expect(kinds('2026-10-12', '2026-10-20', [p('a', '2026-10-01', '2026-10-04')])).toEqual(['start']);
    });

    it('12: продление длиннее 15 дней — нет', () => {
      expect(kinds('2026-10-10', '2026-10-20', [p('a', '2026-09-25', '2026-10-04')])).toEqual(['start']); // 25.09–10.10 = 16 дней
    });

    it('13: за 2 дня до начала следующих — «Установить как начало месячных»', () => {
      const periods = [p('b', '2026-10-10', '2026-10-14')];
      expect(kinds('2026-10-08', '2026-10-20', periods)).toEqual(['start', 'set-next-start']);
      expect(action('2026-10-08', '2026-10-20', periods, 'set-next-start').label).toBe('Установить как начало месячных');
    });

    it('14: за 4 дня до начала — нет', () => {
      expect(kinds('2026-10-06', '2026-10-20', [p('b', '2026-10-10', '2026-10-14')])).toEqual(['start']);
    });

    it('15: перенос начала даёт больше 15 дней — нет', () => {
      expect(kinds('2026-10-07', '2026-10-25', [p('b', '2026-10-10', '2026-10-22')])).toEqual(['start']); // 7–22 = 16 дней
      expect(kinds('2026-10-08', '2026-10-25', [p('b', '2026-10-10', '2026-10-22')])).toEqual(['start', 'set-next-start']); // 15
    });

    it('16: 3 дня после конца и 3 дня до начала — обе кнопки', () => {
      const periods = [p('a', '2026-10-01', '2026-10-04'), p('b', '2026-10-10', '2026-10-14')];
      expect(kinds('2026-10-07', '2026-10-20', periods)).toEqual(['start', 'extend-to', 'set-next-start']);
    });
  });
});

describe('periodActionsFor — длина 15 дней для «Продлить до»', () => {
  it('ровно 15 дней — есть, 16 — нет', () => {
    expect(kinds('2026-10-09', '2026-10-20', [p('a', '2026-09-25', '2026-10-04')])).toEqual(['start', 'extend-to']); // 15
    expect(kinds('2026-10-10', '2026-10-20', [p('a', '2026-09-26', '2026-10-04')])).toEqual(['start', 'extend-to']); // 15
    expect(kinds('2026-10-10', '2026-10-20', [p('a', '2026-09-25', '2026-10-04')]).includes('extend-to')).toBe(false); // 16
  });
});

describe('apply() — результат действий (17)', () => {
  it('extend-by-length через границу месяца и года', () => {
    const a = action('2026-09-30', '2026-10-10', [p('a', '2026-09-30')], 'extend-by-length');
    expect(a.label).toBe('Продлить месячные: 30 сентября – 4 октября');
    expect(ok(a.apply())).toEqual([p('a', '2026-09-30', '2026-10-04', false)]);
    const y = action('2026-12-30', '2027-01-10', [p('a', '2026-12-30')], 'extend-by-length');
    expect(ok(y.apply())).toEqual([p('a', '2026-12-30', '2027-01-03', false)]);
  });

  it('extend-by-length с оценочным концом делает конец ручным', () => {
    expect(ok(action('2026-10-01', '2026-10-20', [p('a', '2026-10-01', '2026-10-03', true)], 'extend-by-length').apply())).toEqual([
      p('a', '2026-10-01', '2026-10-05', false),
    ]);
  });

  it('end-one-day, unmark', () => {
    const periods = [p('a', '2026-10-01')];
    expect(ok(action('2026-10-01', '2026-10-06', periods, 'end-one-day').apply())).toEqual([p('a', '2026-10-01', '2026-10-01')]);
    expect(ok(action('2026-10-01', '2026-10-06', periods, 'unmark').apply())).toEqual([]);
  });

  it('end-here, unmark-day', () => {
    const periods = [p('a', '2026-10-01', '2026-10-06', true)];
    expect(ok(action('2026-10-03', '2026-10-20', periods, 'end-here').apply())).toEqual([p('a', '2026-10-01', '2026-10-03')]);
    expect(ok(action('2026-10-04', '2026-10-20', periods, 'unmark-day').apply())).toEqual([p('a', '2026-10-01', '2026-10-03')]);
  });

  it('set-start убирает отметки до дня и не меняет конец', () => {
    expect(ok(action('2026-10-03', '2026-10-20', [p('a', '2026-10-01', '2026-10-06')], 'set-start').apply())).toEqual([
      p('a', '2026-10-03', '2026-10-06'),
    ]);
  });

  it('start создаёт месячные', () => {
    const a = periodActionsFor(ld('2026-10-05'), ld('2026-10-10'), [], L, () => 'new').find((x) => x.kind === 'start')!;
    expect(ok(a.apply())).toEqual([p('new', '2026-10-05')]);
  });

  it('extend-to ставит конец предыдущих на выбранный день', () => {
    expect(ok(action('2026-10-08', '2026-10-12', [p('a', '2026-10-01', '2026-10-04', true)], 'extend-to').apply())).toEqual([
      p('a', '2026-10-01', '2026-10-08', false),
    ]);
  });

  it('set-next-start переносит начало следующих, конец тот же (через месяц)', () => {
    const periods = [p('b', '2026-11-02', '2026-11-05')];
    expect(ok(action('2026-10-31', '2026-11-20', periods, 'set-next-start').apply())).toEqual([p('b', '2026-10-31', '2026-11-05')]);
  });
});

describe('setPeriodStart — конец незакрытых месячных (18)', () => {
  it('прошедшая оценка сохраняется как оценочный конец', () => {
    expect(setPeriodStart([p('a', '2026-10-01')], 'a', ld('2026-10-03'), ld('2026-10-20'), L)).toEqual([
      p('a', '2026-10-03', '2026-10-05', true),
    ]);
  });

  it('если месячные ещё идут — конец остаётся неотмеченным', () => {
    expect(setPeriodStart([p('a', '2026-10-18')], 'a', ld('2026-10-19'), ld('2026-10-20'), L)).toEqual([p('a', '2026-10-19')]);
    const periods = [p('b', '2026-10-18')];
    expect(ok(action('2026-10-16', '2026-10-20', periods, 'set-next-start').apply())).toEqual([p('b', '2026-10-16')]);
  });

  it('отмеченный конец не меняется', () => {
    expect(setPeriodStart([p('a', '2026-10-01', '2026-10-06')], 'a', ld('2026-10-02'), ld('2026-10-20'), L)).toEqual([
      p('a', '2026-10-02', '2026-10-06'),
    ]);
  });
});

describe('длина без прогноза (19)', () => {
  it('используется переданная длина по умолчанию', () => {
    expect(action('2026-10-01', '2026-10-20', [p('a', '2026-10-01')], 'extend-by-length', 4).label).toBe(
      'Продлить месячные: 1–4 октября',
    );
  });
});
