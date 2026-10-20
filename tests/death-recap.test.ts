import { afterEach, describe, expect, it } from 'vitest';
import { recordHit } from '../src/systems/damageStats';
import { damageTakenHtml } from '../src/ui/damageBreakdown';
import { setLang } from '../src/i18n/lang';
import type { HitSource, RunStats } from '../src/types';

// The run-end receipt's damage-taken block: what ended the run (defeat only) and the three sources that took the most HP.

const killer: HitSource = { how: 'swipe', by: 'baguette', affix: 'swift' };
const run = (): Pick<RunStats, 'taken' | 'lastHit'> => {
  const s: Pick<RunStats, 'taken' | 'lastHit'> = { taken: {} };
  recordHit(s, { how: 'contact', by: 'milk' }, 4);
  recordHit(s, { how: 'hazard', by: 'vents' }, 12);
  recordHit(s, { how: 'event', by: 'powerSurge' }, 7);
  recordHit(s, { how: 'self', by: 'ghostpepper' }, 1.5);
  recordHit(s, killer, 9);
  return s;
};
const rows = (html: string, header: string): string[][] =>
  [...html.slice(html.indexOf(header)).matchAll(/<div class="line"><span>(.*?)<\/span><span>(.*?)<\/span><\/div>/g)].map((m) => [m[1], m[2]]);

afterEach(() => setLang('en'));

describe('the damage-taken receipt', () => {
  it('a defeat names the killing hit with its Elite affix, then the top 3 sources by HP taken', () => {
    const html = damageTakenHtml(run(), false);
    expect(html).toContain('<span>Wiped out by</span><span>Baguette Bruiser (swipe, Elite, Swift)</span>');
    expect(rows(html, 'Damage taken')).toEqual([
      ['Oven vent (hazard)', '12'],
      ['Baguette Bruiser (swipe)', '9'],
      ['Power Surge (aisle event)', '7'],
    ]);
    expect(html).not.toContain('Sour Milk');
    expect(html).not.toContain('Ghost Pepper');
  });

  it('a victory lists the top 3 without the "wiped out" line', () => {
    const html = damageTakenHtml(run(), true);
    expect(html).not.toContain('Wiped out by');
    expect(rows(html, 'Damage taken').map((r) => r[0])).toEqual(['Oven vent (hazard)', 'Baguette Bruiser (swipe)', 'Power Surge (aisle event)']);
  });

  it('a killer without an affix shows only how it hit; self-damage and boss specials have their own labels', () => {
    const s: Pick<RunStats, 'taken' | 'lastHit'> = { taken: {} };
    recordHit(s, { how: 'self', by: 'ghostpepper' }, 2);
    recordHit(s, { how: 'boss', by: 'boss' }, 20);
    const html = damageTakenHtml(s, false);
    expect(html).toContain('<span>Wiped out by</span><span>The Store Manager (special attack)</span>');
    expect(rows(html, 'Damage taken')).toEqual([['The Store Manager (special attack)', '20'], ['Ghost Pepper (self-inflicted)', '2']]);
  });

  it('rounds fractional totals (burn ticks)', () => {
    const s: Pick<RunStats, 'taken' | 'lastHit'> = { taken: {} };
    for (let i = 0; i < 3; i++) recordHit(s, { how: 'self', by: 'ghostpepper' }, 0.75);
    expect(rows(damageTakenHtml(s, true), 'Damage taken')).toEqual([['Ghost Pepper (self-inflicted)', '2']]);
  });

  it('a run with no recorded hits renders nothing, on a defeat or a victory', () => {
    expect(damageTakenHtml({ taken: {} }, false)).toBe('');
    expect(damageTakenHtml({ taken: {} }, true)).toBe('');
  });

  it('speaks German', () => {
    setLang('de');
    const html = damageTakenHtml(run(), false);
    expect(html).toContain('<span>Plattgemacht von</span><span>Baguette-Rabauke (Hieb, Elite, Flink)</span>');
    expect(rows(html, 'Erlittener Schaden').map((r) => r[0])).toEqual(['Ofenschacht (Gefahr)', 'Baguette-Rabauke (Hieb)', 'Stromstoß (Gang-Ereignis)']);
  });
});
