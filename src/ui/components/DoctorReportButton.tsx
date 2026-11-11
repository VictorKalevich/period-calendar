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
 * Кнопка «Отчёт» в шапке «Статистики» (specs/011-doctor-report, 013): PDF создаётся на устройстве,
 * затем лист «Поделиться» / «Сохранить на устройство». Без отметок месячных кнопки нет.
 */
export function DoctorReportButton({ periods, entries, settings, today }: Props) {
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
    <>
      <button type="button" className="btn btn--compact btn--raised" disabled={state.kind === 'busy'} onClick={create}>
        {state.kind === 'busy' ? 'Создаю…' : 'Отчёт'}
      </button>
      <BottomSheet
        open={ready !== null || state.kind === 'error'}
        onClose={close}
        title={state.kind === 'error' ? 'Отчёт не создан' : 'Отчёт готов'}
      >
        {state.kind === 'error' && (
          <p className="notice notice--error" role="alert">
            Не удалось создать отчёт
          </p>
        )}
        {ready && (
          <>
            <p className="t-body sheet__note">
              PDF за последние 12 месяцев, страниц: {ready.pages}. Заметки и отметки секса в отчёт не входят.
            </p>
            {/* Файл готов заранее: «Поделиться» вызывается прямо из нажатия (011 research.md R2). */}
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
          </>
        )}
        <button type="button" className="btn btn--ghost" onClick={close}>
          Закрыть
        </button>
      </BottomSheet>
    </>
  );
}
