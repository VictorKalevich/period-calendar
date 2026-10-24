import { useState } from 'react';
import { formatShiftRu } from '../../domain/dates';
import { ovulationShiftOf } from '../../domain/forecast';
import type { Settings } from '../../domain/types';
import { BottomSheet } from './BottomSheet';

/** Кнопка «Как считается прогноз» в Настройках и её лист (001 FR-021, 005 FR-009, 006 FR-007). */
export function ForecastInfo({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false);
  const shift = ovulationShiftOf(settings);
  return (
    <>
      <p className="t-small forecast-info">
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>
          Как считается прогноз
        </button>
      </p>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Как считается прогноз">
        <div className="t-body prose">
          <p>
            Длина цикла — среднее по последним 6 циклам (циклы короче 15 и длиннее 60 дней не учитываются).
            Пока истории нет, используется длина из настроек.
          </p>
          <p>
            {settings.ovulationFromNextPeriod
              ? 'Овуляция — примерно за 14 дней до ожидаемого начала следующих месячных, но не раньше дня после месячных и не позже дня перед следующими. Способ расчёта меняется в Настройках.'
              : 'Овуляция — на 14-й день цикла, то есть через 13 дней после начала месячных, но не позже дня перед следующими месячными.'}{' '}
            Фертильное окно — 5 дней до овуляции и день овуляции. В дни отмеченных месячных окно не показывается.
          </p>
          {shift !== 0 && (
            <p>
              Учтён ваш личный сдвиг овуляции: {formatShiftRu(shift)} (настраивается в Настройках).
            </p>
          )}
          <p>
            Вероятность зачатия: высокая — в фертильное окно; средняя — 2 дня перед окном и день после овуляции;
            низкая — в остальные дни.
          </p>
          <p>
            Если завершённых циклов меньше трёх или их длина различается больше чем на 7 дней, прогноз строится по
            средним значениям и может заметно ошибаться.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Понятно
        </button>
      </BottomSheet>
    </>
  );
}
