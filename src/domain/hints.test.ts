import { describe, expect, it } from 'vitest';
import { firstPeriodHintVisible } from './hints';

// Фича 010: подсказка «отметьте последние месячные» (specs/010-first-period-hint FR-001–FR-004).

describe('firstPeriodHintVisible', () => {
  it('нет отметок и подсказку не закрывали — видна', () => {
    expect(firstPeriodHintVisible(0, false)).toBe(true);
  });

  it.each([
    [1, false],
    [5, false],
  ])('есть отметки (%i) — не видна', (count, dismissed) => {
    expect(firstPeriodHintVisible(count, dismissed)).toBe(false);
  });

  it.each([0, 3])('закрыта крестиком — не видна при %i отметках', (count) => {
    expect(firstPeriodHintVisible(count, true)).toBe(false);
  });
});
