import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { LocalDate } from '../domain/types';

// FR-031 / SC-007: обновление приложения (новая сборка открывает ту же базу) не теряет данные.
describe('app update', () => {
  it('keeps data written by the previous build', async () => {
    const v1 = await import('./repository');
    const { db } = await import('./db');
    await db.delete();
    await db.open();
    await v1.savePeriods([{ id: 'a', start: '2026-09-27' as LocalDate, end: '2026-10-01' as LocalDate, endEstimated: false }]);
    await v1.saveDayEntry({ date: '2026-10-12' as LocalDate, symptoms: ['headache'], mood: 'calm', note: 'заметка' });
    await v1.saveSettings({
      defaultCycleLength: 30,
      defaultPeriodLength: 4,
      remindPeriod: false,
      remindOvulation: true,
      showWellbeing: false,
      showNotes: true,
      ovulationShiftEnabled: true,
      ovulationShift: -1,
      ovulationFromNextPeriod: true,
    });
    db.close();

    // «Новая сборка» — модули загружаются заново и открывают существующую базу.
    vi.resetModules();
    const next = await import('./repository');
    const { db: reopened, SCHEMA_VERSION } = await import('./db');
    await reopened.open();
    expect(reopened.verno).toBe(SCHEMA_VERSION);
    expect(await next.getPeriods()).toHaveLength(1);
    expect((await next.getDayEntries())[0]!.note).toBe('заметка');
    expect(await next.getSettings()).toMatchObject({ defaultCycleLength: 30, ovulationFromNextPeriod: true });
    // Повторный импорт модулей после resetModules медленный при параллельном прогоне.
  }, 30_000);
});
