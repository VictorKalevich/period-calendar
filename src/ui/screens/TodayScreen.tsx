import { useState } from 'react';
import { startOfWeek } from 'date-fns';
import { addDaysLD, diffDays, formatDayMonthRu, formatWeekdayRu, parseLD, toLocalDate } from '../../domain/dates';
import { dayInfo } from '../../domain/forecast';
import { PHASE_LABELS, PROBABILITY_LABELS, type DayContext, type DayInfo, type LocalDate } from '../../domain/types';
import { useForecast } from '../../hooks/useForecast';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getDayEntry } from '../../storage/repository';
import { explainDay } from '../components/DayCard';
import { DaySheets, type DaySheet } from '../components/DaySheets';
import { Disclaimer } from '../components/Disclaimer';
import { EntrySummary } from '../components/EntrySummary';
import { Crown } from '../components/Icons';
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

/** Полоска недели: сегодня и прошедшие дни открывают «Месячные», будущие не нажимаются (003 FR-005). */
function WeekStrip({ ctx, onPeriod }: { ctx: DayContext; onPeriod: (date: LocalDate) => void }) {
  const monday = toLocalDate(startOfWeek(parseLD(ctx.today), { weekStartsOn: 1 }));
  return (
    <ol className="week" aria-label="Эта неделя">
      {WEEKDAYS_SHORT.map((wd, i) => {
        const date = addDaysLD(monday, i);
        const info = dayInfo(date, ctx);
        const content = (
          <>
            <span className="week-tile__wd">{wd}</span>
            <span className="week-tile__num">{Number(date.slice(8))}</span>
            <span className={`week-tile__dot ${dotClass(info)}`} aria-hidden="true" />
          </>
        );
        const cls = info.isToday ? 'week-tile week-tile--today' : 'week-tile';
        return (
          <li key={date} aria-current={info.isToday ? 'date' : undefined}>
            {date <= ctx.today ? (
              <button
                type="button"
                className={cls}
                aria-label={`${formatDayMonthRu(date)} — месячные`}
                onClick={() => onPeriod(date)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {content}
              </button>
            ) : (
              <div className={cls}>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Вкладка «Сегодня» — макет C (FR-008a, FR-019b). */
export function TodayScreen() {
  const state = useForecast();
  const [sheet, setSheet] = useState<DaySheet>(null);
  const [sheetDate, setSheetDate] = useState<LocalDate | null>(null);
  const todayDate = state?.ctx.today;
  const entry = useLiveQuery(() => (todayDate ? getDayEntry(todayDate) : undefined), [todayDate]);
  if (!state) return null;
  const { ctx, summary } = state;
  const today = ctx.today;
  const info = dayInfo(today, ctx);
  const fertileNow = summary.nextFertile && summary.nextFertile.from <= today;

  return (
    <>
      <header>
        <p className="t-caption today-head__wd">{formatWeekdayRu(today)}</p>
        <h1 className="t-screen-title screen__title">{formatDayMonthRu(today)}</h1>
      </header>

      <section className="card hero" aria-label="Сегодня">
        {summary.cycleDay === null ? (
          <p className="t-body hero__empty">Нажмите на день начала последних месячных в полоске недели или в календаре, чтобы увидеть день цикла и прогноз.</p>
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

      <WeekStrip
        ctx={ctx}
        onPeriod={(date) => {
          setSheetDate(date);
          setSheet('period');
        }}
      />

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
        <button type="button" className="pill-btn pill-btn--main" onClick={() => setSheet('symptoms')}>
          Симптомы
        </button>
        <button type="button" className="pill-btn pill-btn--main" onClick={() => setSheet('note')}>
          Заметка
        </button>
      </div>

      {entry && (
        <section className="card today-entry" aria-label="Записи за сегодня">
          <EntrySummary entry={entry} />
        </section>
      )}

      <DaySheets
        which={sheet}
        onClose={() => {
          setSheet(null);
          setSheetDate(null);
        }}
        date={sheet === 'period' && sheetDate ? sheetDate : today}
        ctx={ctx}
        entry={entry}
      />
    </>
  );
}
