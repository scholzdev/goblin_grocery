import { afterEach, describe, expect, it } from 'vitest';
import { UI } from '../src/i18n/ui';
import { fmtNum, setLang, t } from '../src/i18n';

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('ui strings', () => {
  afterEach(() => setLang('en'));

  it('every English key has a German string', () => {
    for (const k of Object.keys(UI.en)) expect(UI.de[k as keyof typeof UI.en], k).toBeTruthy();
    expect(Object.keys(UI.de).sort()).toEqual(Object.keys(UI.en).sort());
  });

  it('exposes Simplified Chinese as a complete fallback locale', () => {
    expect(Object.keys(UI.zh).sort()).toEqual(Object.keys(UI.en).sort());
    setLang('zh');
    expect(t('language')).toBe(UI.en.language);
  });

  it('placeholders match between languages', () => {
    for (const k of Object.keys(UI.en) as (keyof typeof UI.en)[]) expect(vars(UI.de[k]), k).toBe(vars(UI.en[k]));
  });

  it('t() interpolates and follows the language', () => {
    expect(t('needCoins', { n: 5 })).toBe('Need 5 more coins');
    setLang('de');
    expect(t('needCoins', { n: 5 })).toBe('Noch 5 Münzen nötig');
  });

  it('fmtNum uses a decimal comma in German only', () => {
    expect(fmtNum('0.9')).toBe('0.9');
    setLang('de');
    expect(fmtNum(0.9)).toBe('0,9');
  });
});
