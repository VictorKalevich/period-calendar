import { useState } from 'react';
import type { DayEntry, LocalDate, Period, Settings } from '../../domain/types';
import { createReportFile } from '../../report/render';
import { BottomSheet } from './BottomSheet';
import { canShareFile, downloadFile, shareFile } from './share';

interface Props {
  periods: Period[];
  entries: DayEntry[];
  settings: Settings;
  today: LocalDate;
}

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error' } | { kind: 'ready'; file: File; pages: number };

/**
 * «Отчёт для врача» на «Статистике» (specs/011-doctor-report, design.md «Экран „Статистика“»):
 * PDF создаётся на устройстве; затем лист «Поделиться» / «Сохранить на устройство».
 */
export function DoctorReportSection({ periods, entries, settings, today }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  if (periods.length === 0) return null;

  const create = async () => {
    setState({ kind: 'busy' });
    try {
      const { file, pages } = await createReportFile({ periods, entries, settings, today });
      setState({ kind: 'ready', file, pages });
    } catch (e) {
      console.error('report failed', e);
      setState({ kind: 'error' });
    }
  };

  const close = () => setState({ kind: 'idle' });
  const ready = state.kind === 'ready' ? state : null;

  return (
    <section className="card settings-card" aria-labelledby="report-title">
      <h2 id="report-title" className="t-card-title settings-card__title">
        Отчёт для врача
      </h2>
      <p className="t-caption settings-card__text">
        PDF за последние 12 месяцев: длина циклов, график, самочувствие и настроение. Заметки и отметки секса в отчёт
        не входят.
      </p>
      <button type="button" className="btn btn--primary" disabled={state.kind === 'busy'} onClick={create}>
        {state.kind === 'busy' ? 'Создаю отчёт…' : 'Создать отчёт'}
      </button>
      {state.kind === 'error' && (
        <p className="notice notice--error" role="alert">
          Не удалось создать отчёт
        </p>
      )}
      <BottomSheet open={ready !== null} onClose={close} title="Отчёт готов">
        {ready && (
          <>
            <p className="t-body sheet__note">PDF, страниц: {ready.pages}</p>
            {/* Файл готов заранее: «Поделиться» вызывается прямо из нажатия (research.md R2). */}
            {canShareFile(ready.file) && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={async () => {
                  if (!(await shareFile(ready.file))) downloadFile(ready.file);
                }}
              >
                Поделиться
              </button>
            )}
            <button
              type="button"
              className={canShareFile(ready.file) ? 'btn' : 'btn btn--primary'}
              onClick={() => downloadFile(ready.file)}
            >
              Сохранить на устройство
            </button>
            <button type="button" className="btn btn--ghost" onClick={close}>
              Закрыть
            </button>
          </>
        )}
      </BottomSheet>
    </section>
  );
}
