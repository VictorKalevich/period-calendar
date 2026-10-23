import { CYCLE_LENGTH_RANGE, PERIOD_LENGTH_RANGE, type Settings } from '../../domain/types';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getSettings, saveSettings } from '../../storage/repository';
import { BackupSection } from '../components/BackupSection';
import { Stepper } from '../components/Stepper';

export function SettingsScreen() {
  const settings = useLiveQuery(getSettings, []);
  if (!settings) return null;
  const update = (patch: Partial<Settings>) => saveSettings({ ...settings, ...patch });

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
      </section>

      <BackupSection />
    </>
  );
}
