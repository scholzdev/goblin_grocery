import { afterEach, describe, expect, it } from 'vitest';
import { CODEX_ENEMIES, ENEMIES } from '../src/data/enemies';
import { setLang } from '../src/i18n';
import { enemyT } from '../src/i18n/data';
import { UI } from '../src/i18n/ui';
import { affinityName, affinityRowsHtml, strongVsHtml } from '../src/ui/affinity';

// The codex's weak / resist rows and the shop card's "Strong vs" strip: derived from the enemy files and the item's sets, in both languages.

afterEach(() => setLang('en'));
const alts = (html: string): string[] => [...html.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]);

describe('codex: weak / resist rows', () => {
  it('lists the weak and the resisted elements of an enemy (English)', () => {
    const turkey = affinityRowsHtml('turkey');
    expect(turkey).toContain('Weak to');
    expect(turkey).toContain('Resists');
    expect(turkey).toMatch(/aff-row weak.*set-heat[^>]*>.*Heat/s);
    expect(turkey).toMatch(/aff-row resist.*set-frost[^>]*>.*Frost/s);
    expect(affinityRowsHtml('milk')).toMatch(/set-blast[^>]*>.*Blast/s);
    expect(affinityRowsHtml('milk')).not.toContain('Resists');
  });

  it('is German in German, with the poison and mark tags from the UI table', () => {
    setLang('de');
    const spitter = affinityRowsHtml('spitter');
    expect(spitter).toContain('Schwach gegen');
    expect(spitter).toContain('Widersteht');
    expect(spitter).toContain('Gift');
    expect(spitter).toContain('Frost');
    expect(affinityRowsHtml('boss')).toContain('Preismarken');
    expect(affinityName('electric')).toBe('Elektrisch');
  });

  it('shows the Manager\'s mark weakness and nothing for the Melon Slice', () => {
    expect(affinityRowsHtml('boss')).toContain('Price marks');
    expect(affinityRowsHtml('slice')).toBe('');
  });

  it('every enemy with an affinity in the data shows a row for each of its tags', () => {
    for (const id of CODEX_ENEMIES) {
      const html = affinityRowsHtml(id), d = ENEMIES[id];
      expect(html.includes('aff-row weak'), id).toBe(Object.keys(d.weak ?? {}).length > 0);
      expect(html.includes('aff-row resist'), id).toBe(Object.keys(d.resist ?? {}).length > 0);
      expect((html.match(/class="chip /g) ?? []).length, id).toBe(Object.keys(d.weak ?? {}).length + Object.keys(d.resist ?? {}).length);
    }
  });
});

describe('shop card: "Strong vs"', () => {
  it('lists the enemies weak to the weapon\'s elements, groceries first then bosses, derived from data (Skillet = heat)', () => {
    const html = strongVsHtml('pan');
    expect(html).toContain('Strong vs');
    expect(alts(html)).toEqual([enemyT('turkey').name, enemyT('cereal').name, enemyT('baguette').name, enemyT('boss_frozen').name]);
    expect(html.match(/class="boss"/g)).toHaveLength(1); // only the boss is ringed
  });

  it('merges the elements of a weapon with two (Toaster: heat + electric; Mop: cleaning + frost)', () => {
    expect(alts(strongVsHtml('toaster'))).toEqual(['giftcard', 'soda', 'beans', 'turkey', 'cereal', 'baguette', 'boss_frozen', 'boss_checkout'].map((id) => enemyT(id as never).name));
    expect(alts(strongVsHtml('mop'))).toEqual(['banana', 'gum', 'spitter', 'expired', 'honey', 'boss_bakery', 'boss_electronics'].map((id) => enemyT(id as never).name));
  });

  it('is German in German, with the German enemy names', () => {
    setLang('de');
    const html = strongVsHtml('pan');
    expect(html).toContain('Stark gegen');
    expect(alts(html)).toEqual(['turkey', 'cereal', 'baguette', 'boss_frozen'].map((id) => enemyT(id as never).name));
    expect(alts(html)[0]).toBe('Gefrorener Truthahn');
  });

  it('is empty for an item with no element (Kitchen Sourdough...) and covers all five elements through weapons', () => {
    expect(strongVsHtml('sourdough')).toBe('');
    for (const w of ['pan', 'fizz', 'toaster', 'nailgun', 'leafblower'] as const) expect(strongVsHtml(w), w).not.toBe('');
  });
});

describe('affinity strings', () => {
  it('exist in English and German', () => {
    for (const k of ['weakFlash', 'weakTo', 'resistsLabel', 'strongVs', 'affPoison', 'affMark'] as const) {
      expect(UI.en[k], k).toBeTruthy();
      expect(UI.de[k], k).toBeTruthy();
    }
    expect([UI.en.weakFlash, UI.de.weakFlash]).toEqual(['WEAK!', 'SCHWACH!']);
  });
});
