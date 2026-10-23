import { useState } from 'react';
import { BottomSheet } from './BottomSheet';

/** Постоянная пометка о неточности прогноза (FR-021, Конституция VII). */
export function Disclaimer() {
  const [open, setOpen] = useState(false);
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
          <p>Овуляция — за 14 дней до следующих месячных. Фертильное окно — 5 дней до овуляции и день овуляции.</p>
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
