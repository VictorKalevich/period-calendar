import { describe, expect, it } from 'vitest';
import { notificationFromPush } from './pushNotification';

// Фича 018: разбор данных push-события вынесен из src/sw.ts без изменений поведения — заголовок, текст и
// метка уведомления берутся из payload воркера { title, body, id }.

const data = (json: () => unknown, text = '') => ({ json, text: () => text });
const DEFAULT = { title: 'Календарь цикла', body: '', tag: undefined };

describe('notificationFromPush', () => {
  it('payload воркера — заголовок, текст и метка = id', () => {
    expect(notificationFromPush(data(() => ({ title: 'T', body: 'B', id: 'x' })))).toStrictEqual({ title: 'T', body: 'B', tag: 'x' });
  });

  it('пустой объект — заголовок по умолчанию, пустой текст, без метки', () => {
    expect(notificationFromPush(data(() => ({})))).toStrictEqual(DEFAULT);
  });

  it('json() → null — как пустой объект', () => {
    expect(notificationFromPush(data(() => null))).toStrictEqual(DEFAULT);
  });

  it('не JSON — текст сообщения становится текстом уведомления', () => {
    const notJson = data(() => {
      throw new SyntaxError('Unexpected token');
    }, 'plain');
    expect(notificationFromPush(notJson)).toStrictEqual({ title: 'Календарь цикла', body: 'plain', tag: undefined });
  });

  it.each([null, undefined])('нет данных (%s) — как пустой объект', (none) => {
    expect(notificationFromPush(none)).toStrictEqual(DEFAULT);
  });

  it('лишние поля payload в уведомление не попадают', () => {
    const extra = data(() => ({ title: 'T', body: 'B', id: 'x', kind: 'period', sendAt: '2026-11-05T09:00:00.000Z' }));
    expect(notificationFromPush(extra)).toStrictEqual({ title: 'T', body: 'B', tag: 'x' });
  });

  it('пустой заголовок остаётся пустым (??, а не ||)', () => {
    expect(notificationFromPush(data(() => ({ title: '', body: 'B' })))).toStrictEqual({ title: '', body: 'B', tag: undefined });
  });
});
