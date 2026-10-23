import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { formatMonthRu } from '../../domain/dates';
import type { DayInfo, LocalDate } from '../../domain/types';
import { ChevronLeft, ChevronRight } from './Icons';
import { MonthGrid, WEEKDAYS } from './MonthGrid';

// Пейджер месяцев на нативном scroll-snap (research.md R2): соседний месяц тянется за пальцем,
// привязка к странице. Сетка рисуется только для активного и соседних месяцев.

/** Месяц как число: year * 12 + (month − 1). */
type MonthIndex = number;
const toIndex = (date: LocalDate): MonthIndex => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const yearOf = (i: MonthIndex) => Math.floor(i / 12);
const monthOf = (i: MonthIndex) => (i % 12) + 1;

const EXTEND_BACK = 12;
const AHEAD = 12;

interface Props {
  today: LocalDate;
  /** Самая ранняя отметка — диапазон начинается за 12 месяцев до неё. */
  earliest: LocalDate | null;
  getInfo: (date: LocalDate) => DayInfo;
  selected: LocalDate | null;
  onSelect: (info: DayInfo) => void;
  /** Блок между шапкой и карточкой календаря (плашка «Сегодня …»). */
  banner?: ReactNode;
}

export function MonthPager({ today, earliest, getInfo, selected, onSelect, banner }: Props) {
  const current = toIndex(today);
  const [first, setFirst] = useState<MonthIndex>(() =>
    Math.min(earliest ? toIndex(earliest) : current, current) - EXTEND_BACK,
  );
  const last = current + AHEAD;
  const [active, setActive] = useState<MonthIndex>(current);
  const scroller = useRef<HTMLDivElement>(null);
  const prevFirst = useRef(first);
  const initialised = useRef(false);

  const width = () => scroller.current?.clientWidth ?? 0;

  // Начальная позиция — текущий месяц, без анимации.
  useLayoutEffect(() => {
    if (initialised.current || !scroller.current) return;
    scroller.current.scrollLeft = (current - first) * width();
    initialised.current = true;
  }, [current, first]);

  // При расширении диапазона назад сохраняем видимый месяц на месте.
  useLayoutEffect(() => {
    const delta = prevFirst.current - first;
    prevFirst.current = first;
    if (delta > 0 && scroller.current) scroller.current.scrollLeft += delta * width();
  }, [first]);

  // Активный месяц — страница, видимая больше чем на 60 %.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.month));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-month]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [first, last]);

  // Дошли до левой границы — добавляем ещё 12 месяцев назад (L1).
  useEffect(() => {
    if (initialised.current && active === first) setFirst((f) => f - EXTEND_BACK);
  }, [active, first]);

  const goTo = useCallback(
    (index: MonthIndex) => {
      scroller.current?.scrollTo({ left: (index - first) * width(), behavior: 'smooth' });
    },
    [first],
  );

  const pages: MonthIndex[] = [];
  for (let i = first; i <= last; i++) pages.push(i);

  return (
    <>
      <header className="month-header">
        <button
          type="button"
          className="round-btn"
          aria-label="Предыдущий месяц"
          onClick={() => goTo(active - 1)}
          disabled={active <= first}
        >
          <ChevronLeft />
        </button>
        <h1 className="t-screen-title month-header__title" aria-live="polite">
          {formatMonthRu(yearOf(active), monthOf(active))}
        </h1>
        <button
          type="button"
          className="round-btn"
          aria-label="Следующий месяц"
          onClick={() => goTo(active + 1)}
          disabled={active >= last}
        >
          <ChevronRight />
        </button>
      </header>
      {banner}
      <section className="card calendar-card" aria-label="Календарь месяца">
        <div className="weekdays" aria-hidden="true">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="pager" ref={scroller}>
          {pages.map((i) => (
            <div key={i} className="pager__page" data-month={i}>
              {Math.abs(i - active) <= 1 && (
                <MonthGrid year={yearOf(i)} month={monthOf(i)} getInfo={getInfo} selected={selected} onSelect={onSelect} />
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
