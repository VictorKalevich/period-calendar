// Общие проверки значений неизвестной формы (фича 016).

/** Обычный объект: не `null` и не список. */
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
