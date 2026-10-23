import { useState, type ReactNode } from 'react';
import { OVULATION_REMINDER, PERIOD_REMINDER } from '../../domain/reminders';
import type { Settings } from '../../domain/types';
import {
  disableReminders,
  enableReminders,
  isPushConfigured,
  isPushSupported,
  isStandalone,
  notificationPermission,
} from '../../push/subscribe';
import { syncReminders } from '../../push/sync';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getPushState, saveSettings } from '../../storage/repository';

/** Push-напоминания (US4, FR-022–FR-025). */
export function RemindersSection({ settings }: { settings: Settings }) {
  const push = useLiveQuery(getPushState, []);
  const [permission, setPermission] = useState(notificationPermission);
  const [busy, setBusy] = useState(false);
  const subscribed = push?.subscribed === true;

  const enable = async () => {
    setBusy(true);
    try {
      setPermission(await enableReminders());
      await syncReminders();
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    await saveSettings(next);
    if (!next.remindPeriod && !next.remindOvulation) await disableReminders();
    else if (!subscribed && permission !== 'denied') await enable();
  };

  let body: ReactNode;
  if (!isPushConfigured()) {
    body = <p className="t-caption settings-card__text">Напоминания не настроены в этой сборке приложения.</p>;
  } else if (!isPushSupported() || !isStandalone()) {
    body = (
      <p className="t-caption settings-card__text">
        Чтобы получать напоминания, добавьте приложение на экран «Домой»: в Safari нажмите «Поделиться» → «На экран
        „Домой“» и откройте приложение с иконки.
      </p>
    );
  } else if (permission === 'denied') {
    body = (
      <p className="sheet__error" role="alert">
        Уведомления запрещены. Разрешите их в Настройки iPhone → Уведомления → Цикл.
      </p>
    );
  } else {
    body = (
      <>
        {subscribed ? (
          <p className="settings-card__ok" role="status">
            Напоминания включены{push?.pendingSync ? ' · расписание отправится при подключении к интернету' : ''}
          </p>
        ) : (
          <button type="button" className="btn btn--primary" onClick={enable} disabled={busy}>
            Включить напоминания
          </button>
        )}
        <label className="toggle">
          <span>
            За 2 дня до месячных
            <span className="t-small toggle__hint">{PERIOD_REMINDER.body}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.remindPeriod}
            disabled={busy}
            onChange={(e) => toggle({ remindPeriod: e.target.checked })}
          />
        </label>
        <label className="toggle">
          <span>
            В день овуляции
            <span className="t-small toggle__hint">{OVULATION_REMINDER.body}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.remindOvulation}
            disabled={busy}
            onChange={(e) => toggle({ remindOvulation: e.target.checked })}
          />
        </label>
      </>
    );
  }

  return (
    <section className="card settings-card" aria-labelledby="reminders-title">
      <h2 id="reminders-title" className="t-card-title settings-card__title">
        Напоминания
      </h2>
      <p className="t-caption settings-card__text">Приходят в 12:00. На сервер уходят только даты и тексты напоминаний.</p>
      {body}
    </section>
  );
}
