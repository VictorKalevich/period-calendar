import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { runSchedule, type Env, type StoredRecord } from '../src/index';
import { makeEnv, MemoryKV, subscription, uuid } from './support';

// Фича 018 (шаг 5 рефакторинга): сбой на одной записи подписки не прерывает рассылку остальным; в журнал —
// только шаг и имя ошибки, без ключа записи, адреса подписки, текстов и содержимого записи.

const NOW = Date.parse('2026-10-23T10:00:00.000Z');
const HOUR = 3600 * 1000;
const due = { id: 'ovulation:2026-10-23', sendAt: new Date(NOW - HOUR).toISOString(), title: 'Календарь цикла', body: 'Сегодня Ты КОРОЛЕВА' };
const later = {
  id: 'period:2026-10-30',
  sendAt: new Date(NOW + 7 * 24 * HOUR).toISOString(),
  title: 'Календарь цикла',
  body: 'Ближайшие дни будь аккуратна, скоро начало цикла',
};
const record = (path: string): StoredRecord => ({ tokenHash: 'h', subscription: subscription(path), reminders: [due, later] });

const A = `sub:${uuid(1)}`;
const B = `sub:${uuid(2)}`;
const C = `sub:${uuid(3)}`;
const CORRUPT = '{oops https://web.push.apple.com/secret Сегодня';

/** KV, у которого запись или удаление выбранных ключей отказывает. */
class FailingKV extends MemoryKV {
  failPut = new Set<string>();
  failDelete = new Set<string>();
  override async put(key: string, value: string) {
    if (this.failPut.has(key)) throw new Error('kv put failed');
    return super.put(key, value);
  }
  override async delete(key: string) {
    if (this.failDelete.has(key)) throw new Error('kv delete failed');
    return super.delete(key);
  }
}

let kv: FailingKV;
let env: Env;
let warn: MockInstance<typeof console.warn>;
// Push-сервис: 410 для подписки «gone», иначе 201.
const fetcher = vi.fn(async (url: string, _init: RequestInit) => new Response(null, { status: url.endsWith('/gone') ? 410 : 201 }));

beforeEach(async () => {
  kv = new FailingKV();
  env = await makeEnv(kv);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

const put = (key: string, rec: StoredRecord) => kv.store.set(key, JSON.stringify(rec));
const leftIds = (key: string) => (JSON.parse(kv.store.get(key)!) as StoredRecord).reminders.map((r) => r.id);
const endpoints = () => fetcher.mock.calls.map(([url]) => url);
const lines = () => warn.mock.calls.map((call) => call.join(' '));
const skipped = () => lines().filter((line) => line.startsWith('scheduled record skipped'));

/** Ни одна строка журнала не раскрывает ключ записи, путь подписки, тексты и содержимое записи. */
function expectCleanLog() {
  for (const line of lines()) {
    for (const secret of ['sub:', 'web.push.apple.com/', due.body, later.body, 'oops', 'Сегодня']) {
      expect(line).not.toContain(secret);
    }
  }
}

describe('runSchedule — сбой одной записи не мешает остальным', () => {
  it('запись не JSON — пропускается, остальные получают напоминания', async () => {
    kv.store.set(A, CORRUPT);
    put(B, record('b'));
    put(C, record('c'));
    await expect(runSchedule(env, NOW, fetcher)).resolves.toBeUndefined();
    expect(endpoints()).toEqual([subscription('b').endpoint, subscription('c').endpoint]);
    expect(leftIds(B)).toEqual([later.id]);
    expect(leftIds(C)).toEqual([later.id]);
    expect(kv.store.get(A)).toBe(CORRUPT);
    expect(lines()).toEqual(['scheduled record skipped: step=read reason=SyntaxError']);
    expectCleanLog();
  });

  it('запись не той формы — пропускается, остальные получают напоминания', async () => {
    const broken = JSON.stringify({ tokenHash: 'x' });
    kv.store.set(A, broken);
    put(B, record('b'));
    await runSchedule(env, NOW, fetcher);
    expect(endpoints()).toEqual([subscription('b').endpoint]);
    expect(leftIds(B)).toEqual([later.id]);
    expect(kv.store.get(A)).toBe(broken);
    expect(lines()).toEqual(['scheduled record skipped: step=send reason=TypeError']);
    expectCleanLog();
  });

  it('не удалось сохранить запись — остальные обрабатываются', async () => {
    put(A, record('a'));
    put(B, record('b'));
    put(C, record('c'));
    kv.failPut.add(B);
    await runSchedule(env, NOW, fetcher);
    expect(endpoints()).toHaveLength(3);
    expect(leftIds(A)).toEqual([later.id]);
    expect(leftIds(B)).toEqual([due.id, later.id]);
    expect(leftIds(C)).toEqual([later.id]);
    expect(lines()).toEqual(['scheduled record skipped: step=save reason=Error']);
    expectCleanLog();
  });

  it('не удалось удалить исчезнувшую подписку — остальные обрабатываются', async () => {
    put(A, record('gone'));
    put(B, record('b'));
    kv.failDelete.add(A);
    await runSchedule(env, NOW, fetcher);
    expect(leftIds(B)).toEqual([later.id]);
    expect(kv.store.has(A)).toBe(true);
    expect(skipped()).toEqual(['scheduled record skipped: step=delete reason=Error']);
    expectCleanLog();
  });

  it('отказ списка подписок — рассылка в этот час не выполняется (как раньше)', async () => {
    put(A, record('a'));
    kv.list = async () => {
      throw new Error('kv list failed');
    };
    await expect(runSchedule(env, NOW, fetcher)).rejects.toThrow('kv list failed');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
