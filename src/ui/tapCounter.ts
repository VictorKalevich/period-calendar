// Переключатель скрытого режима разработчика: 7 нажатий подряд с паузами не больше 1 с (FR-002).

export const TAPS_TO_TOGGLE = 7;
export const MAX_GAP_MS = 1000;

export interface TapState {
  count: number;
  last: number | null;
}

export const INITIAL_TAPS: TapState = { count: 0, last: null };

export function registerTap(state: TapState, now: number): { state: TapState; toggled: boolean } {
  const continues = state.last !== null && now - state.last <= MAX_GAP_MS;
  const count = continues ? state.count + 1 : 1;
  if (count >= TAPS_TO_TOGGLE) return { state: INITIAL_TAPS, toggled: true };
  return { state: { count, last: now }, toggled: false };
}
