import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { buildCycles } from '../../domain/cycles';
import { parseLD } from '../../domain/dates';
import { cycleStats } from '../../domain/stats';
import type { LocalDate } from '../../domain/types';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getPeriods } from '../../storage/repository';

const fullDate = (d: LocalDate) => format(parseLD(d), 'd MMMM yyyy', { locale: ru });

/** Статистика (US5, FR-027). Макета пока нет — собрано из карточек и типографики design.md. */
export function StatsScreen() {
  const periods = useLiveQuery(getPeriods, []);
  if (!periods) return null;
  const stats = cycleStats(buildCycles(periods));
  const hasCompleted = stats.history.some((c) => c.length !== null);

  return (
    <>
      <h1 className="t-screen-title screen__title">Статистика</h1>

      {!hasCompleted ? (
        <section className="card settings-card">
          <p className="t-body settings-card__text">Статистика появится после первого полного цикла.</p>
        </section>
      ) : (
        <div className="stat-tiles">
          <section className="card stat-tile">
            <p className="t-caption stat-tile__label">Средняя длина цикла</p>
            <p className="t-big stat-tile__value">{stats.avgCycleLength ?? '—'} дн.</p>
            <p className="t-small stat-tile__note">по последним 6 циклам</p>
          </section>
          <section className="card stat-tile">
            <p className="t-caption stat-tile__label">Средняя длина месячных</p>
            <p className="t-big stat-tile__value">{stats.avgPeriodLength ?? '—'} дн.</p>
            <p className="t-small stat-tile__note">по последним 6 циклам</p>
          </section>
        </div>
      )}

      {stats.history.length > 0 && (
        <section className="card history" aria-labelledby="history-title">
          <h2 id="history-title" className="t-card-title history__title">
            История циклов
          </h2>
          <ul className="history__list">
            {stats.history.map((c) => (
              <li key={c.start} className="history__row">
                <span className="history__date">{fullDate(c.start)}</span>
                <span className="t-caption history__meta">
                  {c.length !== null ? `цикл ${c.length} дн.` : 'идёт сейчас'}
                  {c.periodLength !== null && ` · месячные ${c.periodEndEstimated ? '≈ ' : ''}${c.periodLength} дн.`}
                </span>
                {c.isOutlier && <span className="t-small history__outlier">не учитывается в прогнозе</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
