import { formatDayMonthRu } from './dates';
import { periodActionsFor, type PeriodAction } from './periods';
import type { DayEntry, DayInfo, Forecast, LocalDate, MoodId, Period, Phase, Settings, SymptomId } from './types';

// Фича 004: состав диалога по нажатию на дату, видимость записей по переключателям
// «Самочувствие» и «Заметки», фаза в карточке дня (specs/004-day-dialog-wellbeing/data-model.md).
// Фича 009: «Настроение» — отдельный переключатель (specs/009-day-marks/contracts/day-entry.md).

export type DayExtra = 'wellbeing' | 'mood' | 'notes';

export interface DayDialog {
  /** «24 октября» — без слова «Месячные». */
  title: string;
  /** Кнопки месячных по таблице А/Б/В фичи 003; для будущего дня — пусто. */
  periodActions: PeriodAction[];
  /** «Самочувствие», «Настроение» и «Заметки» — только включённые, в этом порядке. */
  extras: DayExtra[];
  /** Есть хотя бы одна кнопка, кроме «Отмена». */
  opens: boolean;
}

export function dayDialogFor(
  date: LocalDate,
  today: LocalDate,
  periods: Period[],
  periodLength: number,
  settings: Settings,
): DayDialog {
  const periodActions = periodActionsFor(date, today, periods, periodLength);
  const extras: DayExtra[] = [];
  if (settings.showWellbeing) extras.push('wellbeing');
  if (settings.showMood) extras.push('mood');
  if (settings.showNotes) extras.push('notes');
  return {
    title: formatDayMonthRu(date),
    periodActions,
    extras,
    opens: periodActions.length > 0 || extras.length > 0,
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

/** Сводка записи для карточки дня: выключенные типы скрыты, но не удалены (FR-009). */
export function visibleEntryParts(
  e: DayEntry | undefined,
  settings: Settings,
): { symptoms: SymptomId[]; moods: MoodId[]; note: string } {
  return {
    symptoms: e && settings.showWellbeing ? e.symptoms : [],
    moods: e && settings.showMood ? e.moods : [],
    note: e && settings.showNotes ? e.note : '',
  };
}

/** Фаза для карточки дня: не показывается без прогноза и при задержке (FR-001). */
export function cardPhase(info: DayInfo, forecast: Forecast | null): Phase | null {
  if (!forecast || forecast.delayDays > 0) return null;
  return info.phase;
}
