import { useState } from 'react';
import { formatShiftRu } from '../../domain/dates';
import { ovulationShiftOf } from '../../domain/forecast';
import type { Settings } from '../../domain/types';
import { BottomSheet } from './BottomSheet';

/** Постоянная пометка о неточности прогноза (FR-021, Конституция VII); «Подробнее» — 005 FR-009. */
export function Disclaimer({ settings }: { settings: Settings }) {
  const [open, setOpen] = useState(false);
  const shift = ovulationShiftOf(settings);
  return (
    <>
      <p className="t-small disclaimer">
        Прогноз ориентировочный и не заменяет контрацепцию.{' '}
        <button type="button" className="link-btn" onClick={() => setOpen(true)}>
          Подробнее
        </button>
      </p>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Как считается прогноз">
        <div className="t-body prose">
          <p>
            Длина цикла — среднее по последним 6 циклам (циклы короче 15 и длиннее 60 дней не учитываются).
            Пока истории нет, используется длина из настроек.
          </p>
          <p>
            Овуляция — на 14-й день цикла, то есть через 13 дней после начала месячных. Фертильное окно — 5 дней
            до овуляции и день овуляции. В дни отмеченных месячных окно не показывается.
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
          <p>
            <strong>Прогноз ориентировочный и не заменяет контрацепцию и консультацию врача.</strong>
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Понятно
        </button>
      </BottomSheet>
    </>
  );
}
