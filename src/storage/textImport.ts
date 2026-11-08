import { mergeImportedPeriods, parseCycleText, type CycleTextError } from '../domain/cycleText';
import { buildForecast } from '../domain/forecast';
import type { LocalDate, Period } from '../domain/types';
import { getPeriods, getSettings, savePeriods } from './repository';

// Импорт месячных из текстового файла другого приложения (specs/008-text-import).
// Меняются только месячные; записи дней, настройки и push не трогаются.

export interface TextImportPlan {
  periods: Period[];
  /** Сколько периодов месячных найдено в файле. */
  found: number;
  first: LocalDate;
  last: LocalDate;
  skipped: number;
  added: number;
  replaced: number;
  unchanged: number;
}

const ERRORS: Record<CycleTextError, string> = {
  'not-cycle-text': 'Файл не распознан',
  'no-periods': 'В файле нет корректных дат месячных',
};

/** Похоже ли содержимое на текстовую выгрузку месячных. */
export const looksLikeCycleText = (text: string) => /period start date:/i.test(text);

/** Готовит импорт: разбирает файл и считает итог относительно текущих данных, ничего не сохраняя. */
export async function planTextImport(
  text: string,
  today: LocalDate,
): Promise<{ ok: true; value: TextImportPlan } | { ok: false; error: string }> {
  const parsed = parseCycleText(text, today);
  if (!parsed.ok) return { ok: false, error: ERRORS[parsed.error] };
  const [existing, settings] = await Promise.all([getPeriods(), getSettings()]);
  const periodLength = buildForecast({ periods: existing, settings, today })?.periodLength ?? settings.defaultPeriodLength;
  const merged = mergeImportedPeriods(existing, parsed.value.periods, today, periodLength);
  const starts = parsed.value.periods.map((p) => p.start).sort();
  return {
    ok: true,
    value: {
      periods: merged.periods,
      found: parsed.value.periods.length,
      first: starts[0]!,
      last: parsed.value.periods.reduce<LocalDate>((max, p) => {
        const end = p.end ?? p.start;
        return end > max ? end : max;
      }, starts[0]!),
      skipped: parsed.value.skipped + merged.conflicts,
      added: merged.added,
      replaced: merged.replaced,
      unchanged: merged.unchanged,
    },
  };
}

export async function applyTextImport(plan: TextImportPlan): Promise<void> {
  await savePeriods(plan.periods);
}
