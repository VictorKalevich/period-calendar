import { useState } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { sendTestNotification, TEST_RESULT_TEXT, type TestResult } from '../../push/testNotification';
import { getPushState } from '../../storage/repository';

/** Раздел «Для разработчика» — виден только в скрытом режиме (002 FR-004). */
export function DevSection() {
  const push = useLiveQuery(getPushState, []);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const subscribed = push?.subscribed === true;

  const test = async () => {
    setBusy(true);
    try {
      setResult(await sendTestNotification());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card settings-card" aria-labelledby="dev-title">
      <h2 id="dev-title" className="t-card-title settings-card__title">
        Для разработчика
      </h2>
      <button type="button" className="btn" onClick={test} disabled={!subscribed || busy}>
        Проверить уведомление
      </button>
      {!subscribed && <p className="t-caption settings-card__text">Сначала включите напоминания.</p>}
      {result && (
        <p className={result === 'sent' ? 'settings-card__ok' : 'sheet__error'} role={result === 'sent' ? 'status' : 'alert'}>
          {TEST_RESULT_TEXT[result]}
        </p>
      )}
    </section>
  );
}
