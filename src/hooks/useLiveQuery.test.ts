// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayEntry } from '../domain/dayEntry';
import type { LocalDate } from '../domain/types';
import { db } from '../storage/db';
import { getDayEntry, getSettings, saveDayEntry, updateSettings } from '../storage/repository';
import { EmergencyScreen } from '../ui/components/EmergencyScreen';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { mount, unmountAll, waitUntil } from '../ui/testing';
import { useLiveQuery } from './useLiveQuery';

// Фича 014 (FR-004, FR-009): обычный путь хука прежний (характеризация), ошибка запроса — аварийный экран.

const ld = (s: string) => s as LocalDate;

interface ProbeProps {
  query: () => Promise<unknown>;
  deps: readonly unknown[];
  seen: unknown[];
}

/** Пробный компонент: запоминает каждое возвращённое хуком значение и рисует его. */
function Probe({ query, deps, seen }: ProbeProps) {
  const value = useLiveQuery(query, deps);
  seen.push(value);
  return value === undefined ? null : createElement('p', null, JSON.stringify(value));
}

const probe = (query: () => Promise<unknown>, deps: readonly unknown[], seen: unknown[]) =>
  createElement(Probe, { query, deps, seen });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('useLiveQuery — обычный путь (как до фичи 014)', () => {
  it('сначала undefined (экран ничего не рисует), затем значение', async () => {
    const seen: unknown[] = [];
    const m = await mount(probe(getSettings, [], seen));
    await waitUntil(() => m.container.textContent !== '', 'значение пришло');
    expect(seen[0]).toBeUndefined();
    expect(JSON.parse(m.container.textContent!)).toEqual(await getSettings());
  });

  it('изменение данных — новое значение', async () => {
    const m = await mount(probe(getSettings, [], []));
    await waitUntil(() => m.container.textContent !== '', 'значение пришло');
    await updateSettings({ defaultCycleLength: 30 });
    await waitUntil(() => m.container.textContent?.includes('"defaultCycleLength":30') === true, 'обновление');
  });

  it('смена deps — прежнее значение держится до прихода нового', async () => {
    const [a, b] = [ld('2026-11-01'), ld('2026-11-02')];
    await saveDayEntry({ ...emptyDayEntry(a), note: 'A' });
    await saveDayEntry({ ...emptyDayEntry(b), note: 'B' });
    const seen: unknown[] = [];
    const m = await mount(probe(() => getDayEntry(a), [a], seen));
    await waitUntil(() => m.container.textContent?.includes('"note":"A"') === true, 'запись A');

    const before = seen.length;
    await m.rerender(probe(() => getDayEntry(b), [b], seen));
    await waitUntil(() => m.container.textContent?.includes('"note":"B"') === true, 'запись B');
    const after = seen.slice(before) as Array<{ note: string } | undefined>;
    expect(after[0]?.note).toBe('A');
    expect(after.every((v) => v !== undefined)).toBe(true);
  });
});

describe('useLiveQuery — ошибка запроса (фича 014)', () => {
  it('отклонённый запрос — аварийный экран через границу; ошибка в консоли', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('DatabaseClosedError');
    const m = await mount(
      createElement(ErrorBoundary, {
        fallback: createElement(EmergencyScreen),
        children: probe(() => Promise.reject(err), [], []),
      }),
    );
    await waitUntil(() => m.container.querySelector('#emergency-title') !== null, 'аварийный экран');
    expect(m.container.querySelector('#emergency-title')!.textContent).toBe('Что-то пошло не так');
    expect(log).toHaveBeenCalledWith('liveQuery failed', err);
  });
});
