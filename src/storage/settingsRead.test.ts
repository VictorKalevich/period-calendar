import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup } from './backup';
import { db } from './db';
import { getPeriods, getSettings, savePeriods, SETTINGS_KEY, updateSettings } from './repository';
import { buildForecast } from '../domain/forecast';
import { DEFAULT_SETTINGS, type LocalDate, type Settings } from '../domain/types';

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

describe('чтение настроек по правилам', () => {
  /** Корректные и отличные от умолчаний: видно, что сохранённое берётся из базы. */
  const STORED = { ...DEFAULT_SETTINGS, defaultCycleLength: 30, showNotes: true };

  it.each([
    ['defaultCycleLength', 'abc'],
    ['defaultCycleLength', 50],
    ['defaultCycleLength', 30.5],
    ['defaultCycleLength', null],
    ['defaultCycleLength', undefined],
    ['defaultPeriodLength', '5'],
    ['ovulationShift', 9],
    ['remindPeriod', 'yes'],
    ['showSex', 1],
  ] as Array<[keyof Settings, unknown]>)('%s = %j в базе → значение по умолчанию', async (key, value) => {
    await putRaw({ ...STORED, [key]: value });
    expect(await getSettings()).toEqual({ ...STORED, [key]: DEFAULT_SETTINGS[key] });
  });

  it.each(['abc', [1, 2], 5, true])('в базе %j вместо объекта → умолчания', async (value) => {
    await putRaw(value);
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('updateSettings пишет приведённое значение вместо некорректного и не теряет неизвестные поля', async () => {
    await putRaw({ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc', futureA: 1 });
    await updateSettings({ showNotes: true });
    expect(await getRaw()).toEqual({ ...DEFAULT_SETTINGS, showNotes: true, futureA: 1 });
  });

  it('испорченная длина цикла не доходит до прогноза', async () => {
    await putRaw({ ...DEFAULT_SETTINGS, defaultCycleLength: 'abc' });
    await savePeriods([{ id: 'a', start: '2026-10-01' as LocalDate, end: '2026-10-05' as LocalDate, endEstimated: false }]);
    const forecast = buildForecast({ periods: await getPeriods(), settings: await getSettings(), today: '2026-11-14' as LocalDate });
    expect(forecast?.cycleLength).toBe(28);
  });

  it('ключ настроек — одна экспортируемая константа', () => {
    expect(SETTINGS_KEY).toBe('settings');
  });
});
