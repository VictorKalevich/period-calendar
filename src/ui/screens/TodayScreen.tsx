import { useState } from 'react';
import { startOfWeek } from 'date-fns';
import { addDaysLD, diffDays, formatDayMonthRu, formatWeekdayRu, parseLD, toLocalDate } from '../../domain/dates';
import { dayInfo } from '../../domain/forecast';
import { PHASE_LABELS, PROBABILITY_LABELS, type DayContext, type DayInfo } from '../../domain/types';
import { useForecast } from '../../hooks/useForecast';
import { explainDay } from '../components/DayCard';
import { Disclaimer } from '../components/Disclaimer';
import { Crown, DropIcon } from '../components/Icons';
import { PeriodSheet } from '../components/PeriodSheet';
import { LOW_CONFIDENCE_TEXT } from '../components/StatusBanner';

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function relative(days: number): string {
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  return `через ${days} дн.`;
}

function dotClass(info: DayInfo): string {
  if (info.period) return 'week-tile__dot--period';
  if (info.probability === 'high') return 'week-tile__dot--high';
  if (info.probability === 'medium') return 'week-tile__dot--medium';
  if (info.probability === 'low') return 'week-tile__dot--low';
  return '';
}

function WeekStrip({ ctx }: { ctx: DayContext }) {
  const monday = toLocalDate(startOfWeek(parseLD(ctx.today), { weekStartsOn: 1 }));
  return (
    <ol className="week" aria-label="Эта неделя">
      {WEEKDAYS_SHORT.map((wd, i) => {
        const date = addDaysLD(monday, i);
        const info = dayInfo(date, ctx);
        const dot = dotClass(info);
        return (
          <li key={date} className={info.isToday ? 'week-tile week-tile--today' : 'week-tile'} aria-current={info.isToday ? 'date' : undefined}>
            <span className="week-tile__wd">{wd}</span>
            <span className="week-tile__num">{Number(date.slice(8))}</span>
            <span className={`week-tile__dot ${dot}`} aria-hidden="true" />
          </li>
        );
      })}
    </ol>
  );
}

/** Вкладка «Сегодня» — макет C (FR-008a, FR-019b). */
export function TodayScreen() {
  const state = useForecast();
  const [sheet, setSheet] = useState(false);
  if (!state) return null;
  const { ctx, summary } = state;
  const today = ctx.today;
  const info = dayInfo(today, ctx);
  const periodLength = ctx.forecast?.periodLength ?? ctx.settings.defaultPeriodLength;
  const fertileNow = summary.nextFertile && summary.nextFertile.from <= today;

  return (
    <>
      <header>
        <p className="t-caption today-head__wd">{formatWeekdayRu(today)}</p>
        <h1 className="t-screen-title screen__title">{formatDayMonthRu(today)}</h1>
      </header>

      <section className="card hero" aria-label="Сегодня">
        {summary.cycleDay === null ? (
          <p className="t-body hero__empty">Отметьте начало последних месячных, чтобы увидеть день цикла и прогноз.</p>
        ) : (
          <>
            {summary.phase && <p className="t-caption hero__phase">{PHASE_LABELS[summary.phase]}</p>}
            <div className="hero__row">
              <p className="t-big hero__day">{summary.cycleDay}-й день цикла</p>
              {ctx.forecast && <span className="pill pill--rose">из {ctx.forecast.cycleLength}</span>}
            </div>
            {summary.delayDays > 0 && <p className="pill pill--rose hero__delay">Задержка {summary.delayDays} дн.</p>}
            {summary.probability && (
              <div className="hero__chance">
                <p className="t-body hero__chance-title">Вероятность зачатия</p>
                <p className="hero__level">{PROBABILITY_LABELS[summary.probability]}</p>
                <p className="t-caption hero__explain">{explainDay(info)}</p>
              </div>
            )}
            {summary.confidence === 'low' && <p className="t-small">{LOW_CONFIDENCE_TEXT}</p>}
          </>
        )}
        <Disclaimer />
      </section>

      <WeekStrip ctx={ctx} />

      {ctx.forecast && (
        <section className="card upcoming" aria-label="Ближайшие даты">
          <h2 className="t-card-title upcoming__title">Ближайшие даты</h2>
          <ul className="upcoming__list">
            {summary.nextFertile && (
              <li className="upcoming__row">
                <span className="upcoming__dot upcoming__dot--fertile" aria-hidden="true" />
                <span className="upcoming__name">Фертильное окно</span>
                <span className="upcoming__when">
                  {formatDayMonthRu(summary.nextFertile.from)} – {formatDayMonthRu(summary.nextFertile.to)}
                  <br />
                  <span className="t-caption">{fertileNow ? 'идёт сейчас' : relative(diffDays(summary.nextFertile.from, today))}</span>
                </span>
              </li>
            )}
            {summary.nextOvulation && (
              <li className="upcoming__row">
                <Crown size={16} />
                <span className="upcoming__name">Овуляция</span>
                <span className="upcoming__when">
                  {formatDayMonthRu(summary.nextOvulation)}
                  <br />
                  <span className="t-caption">{relative(summary.daysToOvulation!)}</span>
                </span>
              </li>
            )}
            <li className="upcoming__row">
              <span className="upcoming__dot upcoming__dot--period" aria-hidden="true" />
              <span className="upcoming__name">Месячные</span>
              <span className="upcoming__when">
                {summary.delayDays > 0 ? (
                  `Задержка ${summary.delayDays} дн.`
                ) : summary.nextPeriod ? (
                  <>
                    ≈ {formatDayMonthRu(summary.nextPeriod)}
                    <br />
                    <span className="t-caption">{relative(summary.daysToPeriod!)}</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </li>
          </ul>
        </section>
      )}

      <div className="today-actions">
        <button type="button" className="pill-btn pill-btn--main pill-btn--filled" onClick={() => setSheet(true)}>
          <DropIcon /> Месячные
        </button>
        <button type="button" className="pill-btn pill-btn--main" disabled>
          Симптомы
        </button>
        <button type="button" className="pill-btn pill-btn--main" disabled>
          Заметка
        </button>
      </div>

      <PeriodSheet
        open={sheet}
        onClose={() => setSheet(false)}
        date={today}
        today={today}
        periods={ctx.periods}
        periodLength={periodLength}
      />
    </>
  );
}
