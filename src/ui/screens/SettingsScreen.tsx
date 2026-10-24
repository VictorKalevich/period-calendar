import { formatShiftRu } from '../../domain/dates';
import { CYCLE_LENGTH_RANGE, OVULATION_SHIFT_RANGE, PERIOD_LENGTH_RANGE, type Settings } from '../../domain/types';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getDevMode, getSettings, updateSettings } from '../../storage/repository';
import { BackupSection } from '../components/BackupSection';
import { DevSection } from '../components/DevSection';
import { ForecastInfo } from '../components/ForecastInfo';
import { RemindersSection } from '../components/RemindersSection';
import { Stepper } from '../components/Stepper';
import { VersionTapper } from '../components/VersionTapper';

export function SettingsScreen() {
  const settings = useLiveQuery(getSettings, []);
  const devMode = useLiveQuery(getDevMode, []);
  if (!settings) return null;
  const update = (patch: Partial<Settings>) => updateSettings(patch);

  return (
    <>
      <h1 className="t-screen-title screen__title">Настройки</h1>

      <section className="card settings-card" aria-labelledby="cycle-title">
        <h2 id="cycle-title" className="t-card-title settings-card__title">
          Цикл
        </h2>
        <p className="t-caption settings-card__text">Используются, пока не накопится история циклов.</p>
        <Stepper
          label="Длина цикла по умолчанию"
          value={settings.defaultCycleLength}
          min={CYCLE_LENGTH_RANGE.min}
          max={CYCLE_LENGTH_RANGE.max}
          unit="дн."
          onChange={(v) => update({ defaultCycleLength: v })}
        />
        <Stepper
          label="Длина месячных по умолчанию"
          value={settings.defaultPeriodLength}
          min={PERIOD_LENGTH_RANGE.min}
          max={PERIOD_LENGTH_RANGE.max}
          unit="дн."
          onChange={(v) => update({ defaultPeriodLength: v })}
        />
        <label className="toggle">
          <span>Учитывать личный сдвиг овуляции</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.ovulationShiftEnabled}
            onChange={(e) => update({ ovulationShiftEnabled: e.target.checked })}
          />
        </label>
        {settings.ovulationShiftEnabled && (
          <>
            <p className="t-caption settings-card__hint">
              Настройте, на сколько дней ваша овуляция обычно раньше или позже расчётной даты.
            </p>
            <Stepper
              label="Сдвиг овуляции"
              value={settings.ovulationShift}
              min={OVULATION_SHIFT_RANGE.min}
              max={OVULATION_SHIFT_RANGE.max}
              format={formatShiftRu}
              widest={formatShiftRu(OVULATION_SHIFT_RANGE.min)}
              onChange={(v) => update({ ovulationShift: v })}
            />
          </>
        )}
        <label className="toggle">
          <span>Считать от следующей менструации</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.ovulationFromNextPeriod}
            aria-describedby="ovulation-mode-hint"
            onChange={(e) => update({ ovulationFromNextPeriod: e.target.checked })}
          />
        </label>
        <p id="ovulation-mode-hint" className="t-caption settings-card__hint">
          Овуляция будет рассчитана примерно за 14 дней до ожидаемого начала месячных
        </p>
      </section>

      <section className="card settings-card" aria-labelledby="entries-title">
        <h2 id="entries-title" className="t-card-title settings-card__title">
          Записи дня
        </h2>
        <p className="t-caption settings-card__text">
          Включите, чтобы отмечать самочувствие и писать заметки в диалоге дня. Выключение ничего не удаляет —
          записи просто скрываются.
        </p>
        <label className="toggle">
          <span>Самочувствие</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.showWellbeing}
            onChange={(e) => update({ showWellbeing: e.target.checked })}
          />
        </label>
        <label className="toggle">
          <span>Заметки</span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.showNotes}
            onChange={(e) => update({ showNotes: e.target.checked })}
          />
        </label>
      </section>

      <RemindersSection settings={settings} />

      <BackupSection />

      {devMode && <DevSection />}

      <ForecastInfo settings={settings} />

      <VersionTapper devMode={devMode === true} />
    </>
  );
}
