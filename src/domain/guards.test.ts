import { describe, expect, it } from 'vitest';
import { isObject } from './guards';

describe('isObject (фича 016)', () => {
  it.each([{}, { a: 1 }, Object.create(null)])('обычный объект %# → true', (value) => {
    expect(isObject(value)).toBe(true);
  });

  it.each([null, undefined, [], [1], 'x', 1, true, () => {}])('%j → false', (value) => {
    expect(isObject(value)).toBe(false);
  });
});
