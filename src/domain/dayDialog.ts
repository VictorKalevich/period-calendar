import { intensityLabel, symptomLabel } from './catalog';
import { formatDayMonthRu } from './dates';
import { periodActionsFor, type PeriodAction } from './periods';
import type { DayEntry, DayInfo, Forecast, Intensity, LocalDate, MoodId, Period, Phase, Settings, SymptomId } from './types';

// Фича 004: состав диалога по нажатию на дату, видимость записей по переключателям
// «Самочувствие» и «Заметки», фаза в карточке дня (specs/004-day-dialog-wellbeing/data-model.md).
// Фича 009: «Настроение» — отдельный переключатель (specs/009-day-marks/contracts/day-entry.md).

export type DayExtra = 'wellbeing' | 'mood' | 'notes';

export interface DayDialog {
  /** «24 октября» — без слова «Месячные». */
  title: string;
  /** Кнопки месячных по таблице А/Б/В фичи 003; для будущего дня — пусто. */
  periodActions: PeriodAction[];
  /**
   * «Самочувствие», «Настроение» и «Заметки» — только включённые, в этом порядке.
   * Будущий день — только «Заметки» (012 FR-001).
   */
  extras: DayExtra[];
  /** Кнопки из `extras`, по которым у дня уже есть записи, — выделяются в диалоге (012 FR-003). */
  filled: DayExtra[];
  /** Кнопка отметки секса (009): null — выключено или будущий день. */
  sex: 'mark' | 'unmark' | null;
  /** Есть хотя бы одна кнопка, кроме «Отмена». */
  opens: boolean;
}

export function dayDialogFor(
  date: LocalDate,
  today: LocalDate,
  periods: Period[],
  periodLength: number,
  settings: Settings,
  entry?: DayEntry,
): DayDialog {
  const periodActions = periodActionsFor(date, today, periods, periodLength);
  const future = date > today;
  const sex = !settings.showSex || future ? null : entry?.sex ? 'unmark' : 'mark';
  const extras: DayExtra[] = [];
  if (settings.showWellbeing && !future) extras.push('wellbeing');
  if (settings.showMood && !future) extras.push('mood');
  if (settings.showNotes) extras.push('notes');
  const has: Record<DayExtra, (e: DayEntry) => boolean> = { wellbeing: hasWellbeing, mood: hasMood, notes: hasNote };
  const filled = entry ? extras.filter((x) => has[x](entry)) : [];
  return {
    title: formatDayMonthRu(date),
    periodActions,
    extras,
    filled,
    sex,
    opens: periodActions.length > 0 || extras.length > 0 || sex !== null,
  };
}

/** Самочувствие — отмечены симптомы (с 009 настроение — отдельно). */
export const hasWellbeing = (e: DayEntry) => e.symptoms.length > 0;

export const hasMood = (e: DayEntry) => e.moods.length > 0;

export const hasNote = (e: DayEntry) => e.note !== '';

/** Дни с индикатором записи: учитываются только включённые типы (FR-010). */
export function visibleEntryDates(entries: DayEntry[], settings: Settings): Set<LocalDate> {
  return new Set(
    entries
      .filter(
        (e) =>
          (settings.showWellbeing && hasWellbeing(e)) ||
          (settings.showMood && hasMood(e)) ||
          (settings.showNotes && hasNote(e)),
      )
      .map((e) => e.date),
  );
}

/** Дни с сердечком (009 FR-015): только при включённой «Отметке секса». */
export function visibleSexDates(entries: DayEntry[], settings: Settings): Set<LocalDate> {
  if (!settings.showSex) return new Set();
  return new Set(entries.filter((e) => e.sex).map((e) => e.date));
}

export interface VisibleEntryParts {
  symptoms: SymptomId[];
  /** Пусто, если выключено «Самочувствие» или «Интенсивность самочувствия» (009 FR-017). */
  intensity: Partial<Record<SymptomId, Intensity>>;
  moods: MoodId[];
  sex: boolean;
  note: string;
}

/** Сводка записи для карточки дня: выключенные типы скрыты, но не удалены (FR-009). */
export function visibleEntryParts(e: DayEntry | undefined, settings: Settings): VisibleEntryParts {
  return {
    symptoms: e && settings.showWellbeing ? e.symptoms : [],
    intensity: e && settings.showWellbeing && settings.showIntensity ? e.intensity : {},
    moods: e && settings.showMood ? e.moods : [],
    sex: !!e && settings.showSex && e.sex,
    note: e && settings.showNotes ? e.note : '',
  };
}

/** Подписи самочувствия для карточки дня: «Головная боль · сильно» (009 FR-017). */
export function wellbeingTags(parts: VisibleEntryParts): string[] {
  return parts.symptoms.map((id) => {
    const level = parts.intensity[id];
    return level ? `${symptomLabel(id)} · ${intensityLabel(level)}` : symptomLabel(id);
  });
}

/** Фаза для карточки дня: не показывается без прогноза и при задержке (FR-001). */
export function cardPhase(info: DayInfo, forecast: Forecast | null): Phase | null {
  if (!forecast || forecast.delayDays > 0) return null;
  return info.phase;
}
