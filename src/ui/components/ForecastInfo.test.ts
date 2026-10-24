import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../domain/types';
import { ForecastInfo } from './ForecastInfo';

const render = (settings: Settings) => renderToStaticMarkup(createElement(ForecastInfo, { settings }));

describe('ForecastInfo — «Как считается прогноз» в Настройках (001 FR-021)', () => {
  it('кнопка-ссылка «Как считается прогноз»', () => {
    expect(render(DEFAULT_SETTINGS)).toMatch(/<button type="button" class="link-btn">Как считается прогноз<\/button>/);
  });

  it('нет пометки об ориентировочном прогнозе и контрацепции', () => {
    const html = render({ ...DEFAULT_SETTINGS, ovulationShiftEnabled: true, ovulationShift: 2 });
    expect(html).not.toMatch(/ориентировочн/i);
    expect(html).not.toMatch(/контрацепц/i);
    expect(html).not.toMatch(/врач/i);
    expect(html).not.toContain('Подробнее');
  });

  it('лист: длина цикла и овуляция на 14-й день по умолчанию (005 FR-009)', () => {
    const html = render(DEFAULT_SETTINGS);
    expect(html).toContain('aria-label="Как считается прогноз"');
    expect(html).toContain('Длина цикла — среднее по последним 6 циклам');
    expect(html).toContain('Овуляция — на 14-й день цикла');
    expect(html).not.toContain('Учтён ваш личный сдвиг');
  });

  it('лист: режим «от следующей менструации» (006 FR-007)', () => {
    const html = render({ ...DEFAULT_SETTINGS, ovulationFromNextPeriod: true });
    expect(html).toContain('Овуляция — примерно за 14 дней до ожидаемого начала следующих месячных');
  });

  it('лист: строка о личном сдвиге в обоих режимах', () => {
    for (const ovulationFromNextPeriod of [false, true]) {
      const html = render({ ...DEFAULT_SETTINGS, ovulationFromNextPeriod, ovulationShiftEnabled: true, ovulationShift: 2 });
      expect(html).toContain('Учтён ваш личный сдвиг овуляции: +2 дня');
    }
  });
});
