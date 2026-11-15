import { formatShiftRu } from '../../domain/dates';
import { CYCLE_LENGTH_RANGE, OVULATION_SHIFT_RANGE, PERIOD_LENGTH_RANGE, type Settings } from '../../domain/types';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { getDevMode, getSettings, updateSettings } from '../../storage/repository';
import { BackupSection } from '../components/BackupSection';
import { DevSection } from '../components/DevSection';
import { ForecastInfo } from '../components/ForecastInfo';
import { RemindersSection } from '../components/RemindersSection';
import { SaveError, useSaveError } from '../components/SaveError';
import { Stepper } from '../components/Stepper';
import { Toggle } from '../components/Toggle';
import { VersionTapper } from '../components/VersionTapper';

export function SettingsScreen() {
  const settings = useLiveQuery(getSettings, []);
  const devMode = useLiveQuery(getDevMode, []);
  // Отказ записи — сообщение в карточке, где было действие (014).
  const cycleSave = useSaveError();
  const entriesSave = useSaveError();
  if (!settings) return null;
  const update = (patch: Partial<Settings>) => void cycleSave.save(() => updateSettings(patch));
  const updateEntries = (patch: Partial<Settings>) => void entriesSave.save(() => updateSettings(patch));

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
        <Toggle
          label="Учитывать личный сдвиг овуляции"
          checked={settings.ovulationShiftEnabled}
          onChange={(v) => update({ ovulationShiftEnabled: v })}
        />
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
        <Toggle
          label="Считать от следующей менструации"
          checked={settings.ovulationFromNextPeriod}
          describedBy="ovulation-mode-hint"
          onChange={(v) => update({ ovulationFromNextPeriod: v })}
        />
        <p id="ovulation-mode-hint" className="t-caption settings-card__hint">
          Овуляция будет рассчитана примерно за 14 дней до ожидаемого начала месячных
        </p>
        <SaveError shown={cycleSave.failed} />
      </section>

      <section className="card settings-card" aria-labelledby="entries-title">
        <h2 id="entries-title" className="t-card-title settings-card__title">
          Записи дня
        </h2>
        <p className="t-caption settings-card__text">
          Включите то, что хотите отмечать в диалоге дня. Выключение ничего не удаляет — записи просто скрываются.
        </p>
        <Toggle
          label="Самочувствие"
          checked={settings.showWellbeing}
          onChange={(v) => updateEntries({ showWellbeing: v })}
        />
        {settings.showWellbeing && (
          <Toggle
            label="Интенсивность самочувствия"
            hint="Слабо, средне или сильно — для каждой отметки самочувствия"
            checked={settings.showIntensity}
            onChange={(v) => updateEntries({ showIntensity: v })}
          />
        )}
        <Toggle
          label="Настроение"
          hint="Можно выбрать несколько"
          checked={settings.showMood}
          onChange={(v) => updateEntries({ showMood: v })}
        />
        <Toggle
          label="Отметка секса"
          hint="Сердечко в календаре"
          checked={settings.showSex}
          onChange={(v) => updateEntries({ showSex: v })}
        />
        <Toggle label="Заметки" checked={settings.showNotes} onChange={(v) => updateEntries({ showNotes: v })} />
        <SaveError shown={entriesSave.failed} />
      </section>

      <RemindersSection settings={settings} />

      <BackupSection />

      {devMode && <DevSection />}

      <ForecastInfo settings={settings} />

      <VersionTapper devMode={devMode === true} />
    </>
  );
}
