import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import lunchbox from '../../../src/content/items/lunchbox';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, corner, far, full, gilded } from '../helpers';

/** Expired Milk's curse: max HP x0.9 (a high-order player hook; the total is rounded once afterwards). */
const HP_MULT = 0.9;

afterEach(() => setLang('en'));

const BASE = PLAYER.maxHp; // 40

// Legacy: +15 max HP at ★1, rounded after x TIER.mult (★2: 22.5 -> 23); the cart-wide best copy counts. It adds to the unrounded total, which is rounded
// only after Expired Milk's x0.9. Snacks set L1/L2 add +10 max HP (3 distinct snacks types = L2), L3 +20; a set is 2/3/4 distinct types.
describe('Lunchbox: build', () => {
  it('adds 15 / 23 / 30 max HP at ★1 / ★2 / ★3 (★2 rounds 22.5 up)', () => {
    expect(full([at('toaster')]).maxHp).toBe(BASE);
    expect([1, 2, 3].map((t) => full([at('toaster'), far('lunchbox', t)]).maxHp)).toEqual([BASE + 15, BASE + 23, BASE + 30]);
  });

  it('changes nothing but max HP', () => {
    const plain = full([at('toaster')]), withBox = full([at('toaster'), far('lunchbox', 3)]);
    expect(withBox.weapons).toEqual(plain.weapons);
    expect({ ...withBox, maxHp: 0 }).toEqual({ ...plain, maxHp: 0 });
  });

  it('does not stack: the best copy in the whole cart counts once', () => {
    expect(full([at('toaster'), far('lunchbox', 1), far('lunchbox', 3)]).maxHp).toBe(BASE + 30);
    expect(full([at('toaster'), far('lunchbox', 2), at('lunchbox', 1, { near: [0] })]).maxHp).toBe(BASE + 23);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: round(15 x 2.5) = round(37.5) = 38)', () => {
    expect(15 * TIER.mult(4)).toBe(37.5);
    expect(full([at('toaster'), corner('lunchbox', 3), gilded(1)]).maxHp).toBe(BASE + 38);
    expect(full([at('toaster'), corner('lunchbox', 1), gilded(1)]).maxHp).toBe(BASE + 23); // ★1 -> effective ★2
  });

  it('adds to the perk (Line Cook +5, Coupon Clipper -8)', () => {
    expect(full([at('toaster'), far('lunchbox')], { maxHp: 5 }).maxHp).toBe(BASE + 15 + 5);
    expect(full([at('toaster'), far('lunchbox', 2)], { maxHp: -8 }).maxHp).toBe(BASE + 23 - 8);
  });

  it('adds to the snacks set, Snack Bag and Expired Milk: the total is rounded once, after the x0.9', () => {
    // Snacks L1 (lunchbox + energy): +10.
    expect(full([at('toaster'), far('lunchbox'), far('energy')]).maxHp).toBe(BASE + 10 + 15);
    // Lunchbox ★2 + Snack Bag + Expired Milk = 3 snacks types (L2: +10): (40 + 10 + 23 + 20) x 0.9 = 83.7 -> 84.
    expect(full([at('toaster'), far('lunchbox', 2), far('snackbag'), far('expiredmilk')]).maxHp).toBe(Math.round((BASE + 10 + 23 + 20) * HP_MULT));
    expect(Math.round((BASE + 10 + 23 + 20) * HP_MULT)).toBe(84);
    // Lunchbox ★1 + Expired Milk (L1: +10): (40 + 10 + 15) x 0.9 = 58.5 -> 59 (a ".5" the legacy rounding turns up).
    expect(full([at('toaster'), far('lunchbox'), far('expiredmilk')]).maxHp).toBe(Math.round((BASE + 10 + 15) * HP_MULT));
    expect(Number.isInteger(full([at('toaster'), far('lunchbox', 2), far('expiredmilk')], { maxHp: 5 }).maxHp)).toBe(true);
    // Snacks L3 (lunchbox, snack bag, energy, expired milk): +20 from the set.
    expect(full([at('toaster'), far('lunchbox', 3), far('snackbag'), far('energy'), far('expiredmilk')]).maxHp).toBe(Math.round((BASE + 20 + 30 + 20) * HP_MULT));
  });
});

describe('Lunchbox: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('lunchbox')).toBe(lunchbox);
    expect(ITEMS.lunchbox).toMatchObject({ id: 'lunchbox', family: 'snacks', name: 'Lunchbox', kind: 'passive', price: 9, electrical: false });
    expect(ITEMS.lunchbox.element).toBeUndefined();
    expect(ITEMS.lunchbox.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(ITEMS.lunchbox.blurb).toBe('A packed lunch. +15 max HP.');
    expect(ITEMS.lunchbox.rules).toBe('{0} maximum HP while equipped (does not stack, does not heal). Combo: TV Dinner with Microwave + Battery.');
    expect(ITEMS.lunchbox.legendary).toBeUndefined();
  });

  it('keeps its tune in one place (★2 is the unrounded 22.5)', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('lunchbox', t).hp)).toEqual([15, 22.5, 30, 37.5]);
  });

  it('keeps its position in the item order', () => {
    expect(around('lunchbox', 1, 1)).toEqual(['hotsauce', 'lunchbox', 'bell']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('lunchbox', t))).toEqual([
      '+15 maximum HP while equipped (does not stack, does not heal). Combo: TV Dinner with Microwave + Battery.',
      '+23 maximum HP while equipped (does not stack, does not heal). Combo: TV Dinner with Microwave + Battery.',
      '+30 maximum HP while equipped (does not stack, does not heal). Combo: TV Dinner with Microwave + Battery.',
    ]);
    setLang('de');
    expect(itemRules('lunchbox', 2)).toBe('+23 maximale LP, solange ausgerüstet (stapelt sich nicht, heilt nicht). Combo: Fertiggericht mit Mikrowelle + Batterie.');
    expect(itemT('lunchbox')).toMatchObject({ name: 'Brotdose', blurb: 'Ein Pausenbrot. +15 max. LP.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('lunchbox')).toEqual([{ label: 'Max HP', values: ['+15', '+23', '+30'] }]);
    setLang('de');
    expect(tierScaling('lunchbox')).toEqual([{ label: 'Max. LP', values: ['+15', '+23', '+30'] }]);
  });
});
