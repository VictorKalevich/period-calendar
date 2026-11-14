import { useState } from 'react';
import { EXPORT_FAILED_TEXT, exportData } from './share';

/**
 * Аварийный экран (фича 014, design.md «Аварийный экран и ошибка сохранения»): при сбое отрисовки или
 * чтения данных — вместо пустого экрана путь к резервной копии и перезагрузке.
 */
export function EmergencyScreen() {
  const [exportFailed, setExportFailed] = useState(false);

  const exportCopy = async () => {
    setExportFailed(false);
    setExportFailed(!(await exportData()));
  };

  return (
    <section className="card settings-card" aria-labelledby="emergency-title">
      <h1 id="emergency-title" className="t-card-title settings-card__title">
        Что-то пошло не так
      </h1>
      <p className="t-body settings-card__text">
        Экран не удалось показать. Данные хранятся только на этом телефоне — сохраните резервную копию, затем
        перезагрузите приложение.
      </p>
      <button type="button" className="btn btn--primary" onClick={() => void exportCopy()}>
        Экспорт данных
      </button>
      <button type="button" className="btn" onClick={() => location.reload()}>
        Перезагрузить
      </button>
      {exportFailed && (
        <p className="notice notice--error" role="alert">
          {EXPORT_FAILED_TEXT}
        </p>
      )}
    </section>
  );
}

/** Аварийный экран на всю страницу — при сбое оболочки приложения, без навигации. */
export function EmergencyPage() {
  return (
    <div className="app">
      <main className="app__screen">
        <EmergencyScreen />
      </main>
    </div>
  );
}
