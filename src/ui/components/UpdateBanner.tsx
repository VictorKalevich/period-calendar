import { useEffect, useState } from 'react';
import { applyUpdate, onUpdateBanner } from '../../pwa/registerUpdates';

/** Плашка «Доступна новая версия — Обновить», если перезагрузка была отложена из-за ввода. */
export function UpdateBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => onUpdateBanner(setVisible), []);
  if (!visible) return null;
  return (
    <div className="update-banner" role="status">
      <span>Доступна новая версия</span>
      <button type="button" className="update-banner__btn" onClick={applyUpdate}>
        Обновить
      </button>
    </div>
  );
}
