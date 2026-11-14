import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { getDevMode, getPushState, getSettings, savePushState, setDevMode, updatePushState, updateSettings, type PushState } from './repository';

// Фича 018 (шаг 5 рефакторинга): состояние push меняется только изменёнными полями поверх актуально
// сохранённого, в одной транзакции (по образцу updateSettings). Форма записи прежняя.

const S: PushState = { clientId: 'c-0', token: 't-0', subscribed: true, pendingSync: false, lastSyncedHash: 'h-0' };
const ENABLE = { subscribed: true, pendingSync: true, lastSyncedHash: null };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('updatePushState', () => {
  it('записи нет и идентичность не передана — ничего не пишется', async () => {
    await updatePushState({ subscribed: true });
    expect(await getPushState()).toBeUndefined();
  });

  it('записи нет — создаётся из идентичности и изменения', async () => {
    await updatePushState(ENABLE, { clientId: 'id-1', token: 't-1' });
    expect(await getPushState()).toStrictEqual({ clientId: 'id-1', token: 't-1', subscribed: true, pendingSync: true, lastSyncedHash: null });
  });

  it('записи нет, изменение пустое — остальные поля по умолчанию', async () => {
    await updatePushState({}, { clientId: 'id-1', token: 't-1' });
    expect(await getPushState()).toStrictEqual({ clientId: 'id-1', token: 't-1', subscribed: false, pendingSync: false, lastSyncedHash: null });
  });

  it('запись есть — меняются только поля изменения; clientId и токен прежние', async () => {
    await savePushState(S);
    await updatePushState({ pendingSync: true }, { clientId: 'id-2', token: 't-2' });
    expect(await getPushState()).toStrictEqual({ ...S, pendingSync: true });
  });

  it('два одновременных создания — одна идентичность, первая', async () => {
    await Promise.all([
      updatePushState(ENABLE, { clientId: 'id-1', token: 't-1' }),
      updatePushState(ENABLE, { clientId: 'id-2', token: 't-2' }),
    ]);
    expect(await getPushState()).toStrictEqual({ clientId: 'id-1', token: 't-1', ...ENABLE });
  });

  it('одновременные изменения разных полей — применены оба', async () => {
    await savePushState(S);
    await Promise.all([updatePushState({ subscribed: false }), updatePushState({ pendingSync: true, lastSyncedHash: 'h-1' })]);
    expect(await getPushState()).toStrictEqual({ ...S, subscribed: false, pendingSync: true, lastSyncedHash: 'h-1' });
  });

  it('изменение по устаревшему снимку не возвращает выключенные напоминания', async () => {
    await savePushState(S);
    const stale = await getPushState();
    expect(stale?.subscribed).toBe(true);
    await updatePushState({ subscribed: false, pendingSync: false, lastSyncedHash: null });
    await updatePushState({ pendingSync: false, lastSyncedHash: 'h-1' });
    expect(await getPushState()).toStrictEqual({ ...S, subscribed: false, lastSyncedHash: 'h-1' });
  });

  it('другие записи kv не меняются', async () => {
    await updateSettings({ remindPeriod: false });
    await setDevMode(true);
    const settings = await getSettings();
    await updatePushState(ENABLE, { clientId: 'id-1', token: 't-1' });
    await updatePushState({ pendingSync: false });
    expect(await getSettings()).toStrictEqual(settings);
    expect(await getDevMode()).toBe(true);
  });
});
