// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayEntry } from '../../domain/dayEntry';
import type { LocalDate } from '../../domain/types';
import { db } from '../../storage/db';
import { saveDayEntry, savePeriods, updateSettings } from '../../storage/repository';
import { button, click, mount, settle, unmountAll, waitUntil } from '../testing';
import { BackupSection } from './BackupSection';
import { EmergencyScreen } from './EmergencyScreen';

// Фича 014 (FR-006, FR-007, SC-002): «Экспорт данных» с аварийного экрана отдаёт тот же файл, что «Экспорт»
// в Настройках; если копию создать нельзя — сообщение, а не молчание.

const ld = (s: string) => s as LocalDate;
const EXPORT_FAILED = 'Не удалось создать резервную копию';

/** Файлы, отданные на скачивание (`navigator.canShare` нет → путь `downloadFile`). */
let downloaded: File[] = [];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await savePeriods([{ id: 'p1', start: ld('2026-10-20'), end: ld('2026-10-24'), endEstimated: false }]);
  await saveDayEntry({ ...emptyDayEntry(ld('2026-10-21')), note: 'заметка' });
  await updateSettings({ defaultCycleLength: 30 });

  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0));
  downloaded = [];
  expect(navigator.canShare).toBeUndefined();
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    downloaded.push(blob as File);
    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const failReads = () =>
  vi.spyOn(db.periods, 'orderBy').mockImplementation(() => {
    throw new Error('DatabaseClosedError');
  });

const notices = (root: ParentNode) => [...root.querySelectorAll('p.notice')].map((p) => [p.className, p.getAttribute('role'), p.textContent]);

describe('экспорт с аварийного экрана', () => {
  it('тот же файл (имя, тип, содержимое), что «Экспорт» в Настройках', async () => {
    const settings = await mount(createElement(BackupSection));
    await click(button(settings.container, 'Экспорт'));
    await waitUntil(() => downloaded.length === 1, 'файл из Настроек');

    const emergency = await mount(createElement(EmergencyScreen));
    await click(button(emergency.container, 'Экспорт данных'));
    await waitUntil(() => downloaded.length === 2, 'файл с аварийного экрана');

    const [fromSettings, fromEmergency] = downloaded as [File, File];
    expect(fromEmergency.name).toBe('cycle-calendar-2026-11-14.json');
    expect(fromEmergency.name).toBe(fromSettings.name);
    expect(fromEmergency.type).toBe(fromSettings.type);
    const text = await fromEmergency.text();
    expect(text).toBe(await fromSettings.text());
    expect(JSON.parse(text).data.days[0].note).toBe('заметка');
  });

  it('база недоступна — сообщение после кнопок; повторная удачная попытка его убирает', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const read = failReads();
    const { container } = await mount(createElement(EmergencyScreen));
    await click(button(container, 'Экспорт данных'));
    await waitUntil(() => container.querySelector('p.notice') !== null, 'сообщение');
    const card = container.firstElementChild!;
    expect(card.lastElementChild!.outerHTML).toBe(`<p class="notice notice--error" role="alert">${EXPORT_FAILED}</p>`);
    expect(downloaded).toEqual([]);

    read.mockRestore();
    await click(button(container, 'Экспорт данных'));
    await waitUntil(() => downloaded.length === 1, 'файл');
    expect(container.querySelector('p.notice')).toBeNull();
  });
});

describe('«Экспорт» в «Резервной копии»', () => {
  it('база недоступна — сообщение в месте сообщений карточки', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failReads();
    const { container } = await mount(createElement(BackupSection));
    await click(button(container, 'Экспорт'));
    await waitUntil(() => container.querySelector('p.notice') !== null, 'сообщение');
    expect(notices(container)).toEqual([['notice notice--error', 'alert', EXPORT_FAILED]]);
    expect(downloaded).toEqual([]);
  });

  it('удачный экспорт не стирает другие сообщения карточки (как раньше)', async () => {
    const { container } = await mount(createElement(BackupSection));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['привет'], 'note.txt', { type: 'text/plain' })], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await waitUntil(() => container.querySelector('p.notice') !== null, 'сообщение импорта');
    const before = notices(container);
    expect(before).toEqual([['notice notice--error', 'alert', 'Файл не распознан']]);

    await click(button(container, 'Экспорт'));
    await waitUntil(() => downloaded.length === 1, 'файл');
    await settle();
    expect(notices(container)).toEqual(before);
  });
});
