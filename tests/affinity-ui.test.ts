import { afterEach, describe, expect, it } from 'vitest';
import { CODEX_ENEMIES, ENEMIES } from '../src/data/enemies';
import { setLang } from '../src/i18n';
import { enemyT } from '../src/i18n/data';
import { UI } from '../src/i18n/ui';
import { ITEMS } from '../src/data/items';
import { itemTags, weaponTags } from '../src/engine/hitTags';
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

  it('merges the elements of a weapon with two (Mop: cleaning + frost); an electrical weapon is not electric (Toaster = heat only)', () => {
    expect(alts(strongVsHtml('toaster'))).toEqual(['turkey', 'cereal', 'baguette', 'boss_frozen'].map((id) => enemyT(id as never).name));
    for (const w of ['microwave', 'nailgun', 'vacuum'] as const) expect(alts(strongVsHtml(w)), w).not.toContain(enemyT('soda').name); // soda is weak to electric only
    expect(alts(strongVsHtml('laser'))).toContain(enemyT('soda').name);
    expect(alts(strongVsHtml('blender'))).toEqual(alts(strongVsHtml('laser')));
    expect(alts(strongVsHtml('mop'))).toEqual(['banana', 'gum', 'spitter', 'expired', 'honey', 'boss_bakery', 'boss_electronics'].map((id) => enemyT(id as never).name));
  });

  it('is German in German, with the German enemy names', () => {
    setLang('de');
    const html = strongVsHtml('pan');
    expect(html).toContain('Stark gegen');
    expect(alts(html)).toEqual(['turkey', 'cereal', 'baguette', 'boss_frozen'].map((id) => enemyT(id as never).name));
    expect(alts(html)[0]).toBe('Gefrorener Truthahn');
  });

  it('is empty for an item with no element (Kitchen Sourdough) and covers all five elements through weapons', () => {
    expect(strongVsHtml('sourdough')).toBe('');
    for (const w of ['pan', 'fizz', 'laser', 'nailgun', 'leafblower'] as const) expect(strongVsHtml(w), w).not.toBe('');
  });
});

describe('module card: "Strong vs" from the module\'s own elements', () => {
  const names = (ids: string[]) => ids.map((id) => enemyT(id as never).name);
  it('Fuel Can = heat, Ice Pack = frost, Party Popper = blast (English)', () => {
    for (const id of ['fuel', 'ice', 'popper'] as const) expect(strongVsHtml(id), id).toContain('Strong vs');
    expect(alts(strongVsHtml('fuel'))).toEqual(names(['turkey', 'cereal', 'baguette', 'boss_frozen']));
    expect(alts(strongVsHtml('ice')).length).toBeGreaterThan(0);
    expect(alts(strongVsHtml('ice'))).toEqual(alts(strongVsHtml('fizz'))); // frost, like the Fizz
    expect(alts(strongVsHtml('popper'))).toEqual(alts(strongVsHtml('nailgun'))); // blast, like the Nail Gun
  });

  it('is German in German', () => {
    setLang('de');
    for (const id of ['fuel', 'ice', 'popper'] as const) expect(strongVsHtml(id), id).toContain('Stark gegen');
    expect(alts(strongVsHtml('fuel'))).toEqual(names(['turkey', 'cereal', 'baguette', 'boss_frozen']));
    expect(alts(strongVsHtml('fuel'))[0]).toBe('Gefrorener Truthahn');
  });

  it('passives and modules without an element of their own get no strip (Battery, Hot Sauce, Fan, Multipack, Double Bag)', () => {
    for (const id of ['battery', 'hotsauce', 'fan', 'multipack', 'doublebag', 'sourdough'] as const) expect(strongVsHtml(id), id).toBe('');
  });

  it('the strips come from the data: ItemDef.elements, on weapons and modules, declared on exactly Fuel Can, Ice Pack, Party Popper, Laser and Blender', () => {
    const declared = Object.values(ITEMS).filter((d) => d.elements).map((d) => d.id).sort();
    expect(declared).toEqual(['blender', 'fuel', 'ice', 'laser', 'popper']);
    for (const d of Object.values(ITEMS)) if (d.elements) expect(d.kind, d.id).not.toBe('passive');
    expect(itemTags('laser')).toEqual(['electric']);
    expect(itemTags('fuel')).toEqual(['heat']);
    expect(itemTags('ice')).toEqual(['frost']);
    expect(itemTags('popper')).toEqual(['blast']);
    expect(itemTags('pan')).toBe(weaponTags('pan')); // weapons still use their sets
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
