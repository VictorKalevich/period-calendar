import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup } from './backup';
import { db } from './db';
import { getSettings, updateSettings } from './repository';
import { DEFAULT_SETTINGS } from '../domain/types';

// Фича 016: чтение настроек из базы. Литерал ключа — как в upgrade-v2.test.ts: тест пишет сырую запись.

const putRaw = (value: unknown) => db.kv.put({ key: 'settings', value });
const getRaw = async () => (await db.kv.get('settings'))?.value as Record<string, unknown> | undefined;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('чтение настроек — как раньше', () => {
  it('корректные настройки с неизвестными полями: те же значения и порядок ключей', async () => {
    const raw = { ...DEFAULT_SETTINGS, defaultCycleLength: 30, futureA: 1, futureB: { x: 1 } };
    await putRaw(raw);
    const settings = await getSettings();
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, ...raw });
    expect(Object.keys(settings)).toEqual(Object.keys({ ...DEFAULT_SETTINGS, ...raw }));
  });

  it('неполная запись с другим порядком ключей: умолчания, поверх — сохранённое', async () => {
    const raw = { futureA: 1, showSex: true, defaultCycleLength: 30 };
    await putRaw(raw);
    const settings = await getSettings();
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, ...raw });
    expect(Object.keys(settings)).toEqual(Object.keys({ ...DEFAULT_SETTINGS, ...raw }));
  });

  it.each([
    ['записи нет', undefined],
    ['значение null', null],
  ])('%s → новый незамороженный объект с умолчаниями', async (_name, value) => {
    if (value !== undefined) await putRaw(value);
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings).not.toBe(DEFAULT_SETTINGS);
    expect(Object.isFrozen(settings)).toBe(false);
  });

  it('updateSettings не теряет неизвестные поля', async () => {
    await putRaw({ ...DEFAULT_SETTINGS, futureA: 1 });
    await updateSettings({ showNotes: true });
    expect(await getRaw()).toMatchObject({ futureA: 1, showNotes: true });
  });

  it('экспорт отдаёт неизвестные поля в прежнем порядке', async () => {
    await putRaw({ ...DEFAULT_SETTINGS, futureA: 1 });
    const exported = (await buildBackup(new Date('2026-11-14T10:00:00.000Z'))).data.settings;
    expect(exported).toEqual({ ...DEFAULT_SETTINGS, futureA: 1 });
    expect(Object.keys(exported)).toEqual(Object.keys({ ...DEFAULT_SETTINGS, futureA: 1 }));
  });
});
