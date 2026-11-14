/**
 * Общий приём для записи и экспорта (фича 014): выполнить действие; отказ записать в консоль и вернуть
 * `false`, чтобы интерфейс показал сообщение, а не промолчал.
 */
export async function attempt(what: string, action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (e) {
    console.error(`${what} failed`, e);
    return false;
  }
}
