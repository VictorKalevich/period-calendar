import { useEffect, useRef, useState } from 'react';
import { setDevMode } from '../../storage/repository';
import { INITIAL_TAPS, registerTap } from '../tapCounter';

/** «Версия X.Y.Z» внизу настроек; 7 нажатий подряд переключают режим разработчика (002 FR-001, FR-002). */
export function VersionTapper({ devMode }: { devMode: boolean }) {
  const taps = useRef(INITIAL_TAPS);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const onTap = async () => {
    const r = registerTap(taps.current, performance.now());
    taps.current = r.state;
    if (!r.toggled) return;
    await setDevMode(!devMode);
    setToast(devMode ? 'Режим разработчика выключен' : 'Режим разработчика включён');
  };

  return (
    <>
      <button type="button" className="version" onClick={onTap}>
        Версия {__APP_VERSION__} · {__APP_BUILD__}
      </button>
      <p className={toast ? 'toast toast--visible' : 'toast'} role="status" aria-live="polite">
        {toast}
      </p>
    </>
  );
}
