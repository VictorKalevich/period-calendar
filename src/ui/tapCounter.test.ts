import { describe, expect, it } from 'vitest';
import { INITIAL_TAPS, MAX_GAP_MS, registerTap, TAPS_TO_TOGGLE, type TapState } from './tapCounter';

function tapAt(times: number[]): boolean[] {
  let state: TapState = INITIAL_TAPS;
  return times.map((t) => {
    const r = registerTap(state, t);
    state = r.state;
    return r.toggled;
  });
}

describe('registerTap', () => {
  it('needs 7 taps', () => {
    expect(TAPS_TO_TOGGLE).toBe(7);
    expect(MAX_GAP_MS).toBe(1000);
  });

  it('toggles exactly on the 7th quick tap (SC-001)', () => {
    const res = tapAt([0, 300, 600, 900, 1200, 1500, 1800]);
    expect(res).toEqual([false, false, false, false, false, false, true]);
  });

  it('accepts a gap of exactly 1000 ms', () => {
    expect(tapAt([0, 1000, 2000, 3000, 4000, 5000, 6000]).at(-1)).toBe(true);
  });

  it('restarts counting after a pause longer than 1 s', () => {
    const res = tapAt([0, 200, 400, 600, 1700, 1900, 2100]);
    expect(res.some(Boolean)).toBe(false);
    // 4 нажатия, пауза, затем ещё 7 подряд — переключение на 7-м после паузы
    expect(tapAt([0, 200, 400, 600, 2000, 2200, 2400, 2600, 2800, 3000, 3200]).indexOf(true)).toBe(10);
  });

  it('resets after a toggle so the next 7 taps toggle again', () => {
    const times = Array.from({ length: 14 }, (_, i) => i * 100);
    const res = tapAt(times);
    expect(res.map((t, i) => (t ? i : -1)).filter((i) => i >= 0)).toEqual([6, 13]);
  });
});
