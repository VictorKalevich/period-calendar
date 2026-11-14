// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDayEntry } from '../../domain/dayEntry';
import type { DayEntry, DayInfo, LocalDate } from '../../domain/types';
import { db } from '../../storage/db';
import { saveDayEntry } from '../../storage/repository';
import { mount, unmountAll, waitUntil } from '../testing';
import { CalendarScreen } from './CalendarScreen';

// Фича 015 (FR-010, SC-004): после смены выбранного дня карточка дня, диалог и листы не получают запись
// прежнего дня. Хук чтения держит прежнее значение до прихода нового (useLiveQuery.test.ts) — экран
// не должен использовать его с новой датой (research R3).

interface Seen {
  date: LocalDate;
  entry: DayEntry | undefined;
}

const rec = vi.hoisted(() => ({
  card: [] as Seen[],
  sheets: [] as Seen[],
  pager: null as null | { onSelect: (info: DayInfo) => void; getInfo: (date: LocalDate) => DayInfo },
}));

vi.mock('../../hooks/useToday', () => ({ useToday: () => '2026-11-14' }));
// Календарь с прокруткой и IntersectionObserver не нужен: день выбирается его onSelect, как ячейкой.
vi.mock('../components/MonthPager', () => ({
  MonthPager: (props: NonNullable<typeof rec.pager>) => {
    rec.pager = props;
    return null;
  },
}));
// Карточка дня: что получает сводка записей (EntrySummary) вместе с датой карточки.
vi.mock('../components/DayCard', () => ({
  DayCard: ({ info, children }: { info: DayInfo; children: ReactElement<{ entry: DayEntry | undefined }> }) => {
    rec.card.push({ date: info.date, entry: children.props.entry });
    return null;
  },
}));
// Диалог и листы дня получают запись через DaySheets.
vi.mock('../components/DaySheets', () => ({
  DaySheets: ({ date, entry }: Seen) => {
    rec.sheets.push({ date, entry });
    return null;
  },
}));

const ld = (s: string) => s as LocalDate;
const A = ld('2026-11-10');
const B = ld('2026-11-11');

const select = (date: LocalDate) =>
  act(async () => {
    rec.pager!.onSelect(rec.pager!.getInfo(date));
  });

/** Отрисовки, в которых запись относится не к дате карточки или листа. */
const foreign = (seen: Seen[]) => seen.filter((s) => s.entry !== undefined && s.entry.date !== s.date);

beforeEach(async () => {
  await db.delete();
  await db.open();
  rec.card.length = 0;
  rec.sheets.length = 0;
  rec.pager = null;
});

afterEach(() => {
  unmountAll();
  vi.restoreAllMocks();
});

describe('экран «Календарь»: запись выбранного дня (фича 015)', () => {
  it('после смены дня карточка, диалог и листы не получают запись прежнего дня', async () => {
    await saveDayEntry({ ...emptyDayEntry(A), note: 'A' });
    await saveDayEntry({ ...emptyDayEntry(B), note: 'B' });
    await mount(createElement(CalendarScreen));
    await waitUntil(() => rec.pager !== null, 'календарь');

    await select(A);
    await waitUntil(() => rec.sheets.some((s) => s.date === A && s.entry?.note === 'A'), 'запись A');
    await select(B);
    await waitUntil(() => rec.sheets.some((s) => s.date === B && s.entry?.note === 'B'), 'запись B');

    expect(foreign(rec.card)).toEqual([]);
    expect(foreign(rec.sheets)).toEqual([]);
    // Как раньше: пришедшая запись выбранного дня показывается.
    expect(rec.card.at(-1)).toEqual({ date: B, entry: { ...emptyDayEntry(B), note: 'B' } });
    expect(rec.sheets.at(-1)).toEqual({ date: B, entry: { ...emptyDayEntry(B), note: 'B' } });
  });
});
