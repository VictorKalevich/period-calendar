// Подсказки интерфейса (фича 010) — чистые правила показа.

/**
 * Подсказка «отметьте последние месячные» видна, пока нет ни одной отметки месячных и её не закрыли
 * крестиком на этом устройстве (specs/010-first-period-hint FR-001–FR-004).
 */
export function firstPeriodHintVisible(periodsCount: number, dismissed: boolean): boolean {
  return periodsCount === 0 && !dismissed;
}
