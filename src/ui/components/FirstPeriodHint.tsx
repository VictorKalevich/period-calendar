import { dismissFirstPeriodHint } from '../../storage/repository';
import { CloseIcon } from './Icons';

/**
 * Подсказка вверху «Календаря», пока нет ни одной отметки месячных (specs/010-first-period-hint,
 * design.md «Экран „Календарь“», п. 0). Крестик закрывает её навсегда на этом устройстве.
 */
export function FirstPeriodHint() {
  return (
    <section className="hint" aria-labelledby="first-period-hint-title">
      <h2 id="first-period-hint-title" className="hint__title">
        Как получить прогноз
      </h2>
      <p className="hint__text">
        Отметьте, когда начались последние месячные: нажмите на этот день в календаре — прошедшие дни тоже
        можно — и выберите «Начало месячных».
      </p>
      <p className="hint__text">Историю из другого приложения можно загрузить в Настройках → «Резервная копия».</p>
      <button type="button" className="hint__close" aria-label="Скрыть подсказку" onClick={() => void dismissFirstPeriodHint()}>
        <CloseIcon size={20} />
      </button>
    </section>
  );
}
