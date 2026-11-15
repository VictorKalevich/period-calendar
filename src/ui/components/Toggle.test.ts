// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PERIOD_REMINDER } from '../../domain/reminders';
import { click, mount, unmountAll } from '../testing';
import { Toggle } from './Toggle';

// Фича 019 (FR-009, FR-011; research R2; контракт `Toggle.tsx`): переключатель дизайн-системы одним компонентом.
// Строки — прежняя разметка, снятая с экранов до замены (toggleMarkup.test.ts).

afterEach(() => {
  unmountAll();
  vi.clearAllMocks();
});

const html = (props: Parameters<typeof Toggle>[0]) => renderToStaticMarkup(createElement(Toggle, props));
const onChange = () => {};

describe('Toggle: разметка', () => {
  it('без подсказки, включён', () => {
    expect(html({ label: 'Учитывать личный сдвиг овуляции', checked: true, onChange })).toBe(
      '<label class="toggle"><span>Учитывать личный сдвиг овуляции</span><input type="checkbox" role="switch" checked=""/></label>',
    );
  });

  it('со ссылкой на пояснение, выключен', () => {
    expect(html({ label: 'Считать от следующей менструации', checked: false, describedBy: 'ovulation-mode-hint', onChange })).toBe(
      '<label class="toggle"><span>Считать от следующей менструации</span><input type="checkbox" role="switch" aria-describedby="ovulation-mode-hint"/></label>',
    );
  });

  it('со ссылкой на пояснение, включён — `checked` последним, как раньше', () => {
    expect(html({ label: 'Считать от следующей менструации', checked: true, describedBy: 'ovulation-mode-hint', onChange })).toBe(
      '<label class="toggle"><span>Считать от следующей менструации</span><input type="checkbox" role="switch" aria-describedby="ovulation-mode-hint" checked=""/></label>',
    );
  });

  it('с подсказкой, выключен', () => {
    expect(html({ label: 'Настроение', hint: 'Можно выбрать несколько', checked: false, onChange })).toBe(
      '<label class="toggle"><span>Настроение<span class="t-small toggle__hint">Можно выбрать несколько</span></span><input type="checkbox" role="switch"/></label>',
    );
  });

  it('с подсказкой, недоступен, включён', () => {
    expect(html({ label: 'За 2 дня до месячных', hint: PERIOD_REMINDER.body, checked: true, disabled: true, onChange })).toBe(
      `<label class="toggle"><span>За 2 дня до месячных<span class="t-small toggle__hint">${PERIOD_REMINDER.body}</span></span><input type="checkbox" role="switch" disabled="" checked=""/></label>`,
    );
  });

  it('disabled: false и describedBy: undefined не попадают в разметку', () => {
    expect(html({ label: 'Заметки', checked: false, disabled: false, describedBy: undefined, onChange })).toBe(
      html({ label: 'Заметки', checked: false, onChange }),
    );
  });
});

describe('Toggle: нажатие', () => {
  it('выключенный — onChange(true), включённый — onChange(false)', async () => {
    const changed = vi.fn();
    const off = await mount(createElement(Toggle, { label: 'Заметки', checked: false, onChange: changed }));
    await click(off.container.querySelector('input'));
    const on = await mount(createElement(Toggle, { label: 'Самочувствие', checked: true, onChange: changed }));
    await click(on.container.querySelector('input'));
    expect(changed.mock.calls).toEqual([[true], [false]]);
  });

  it('без подсказки — нет элемента подсказки', async () => {
    const m = await mount(createElement(Toggle, { label: 'Заметки', checked: false, onChange }));
    expect(m.container.querySelector('.toggle__hint')).toBeNull();
  });
});
