import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER } from '../../../src/data/items';
import snackbag from '../../../src/content/items/snackbag';
import { setCfg } from '../../../src/data/sets';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, far, full } from '../helpers';

/** Expired Milk's curse: max HP x0.9 (a high-order player hook; the total is rounded once afterwards). */
const HP_MULT = 0.9;

afterEach(() => setLang('en'));

const BASE = PLAYER.maxHp; // 40

// Legacy: a legendary (★1 only, no Gold Star): +20 max HP and 0.25 HP/s regen (1 HP every 4 s). It adds to the Lunchbox and the snacks set
// (L1/L2 +10 max HP, L2+ regen 0.3, L3 +20 and 0.6; a set is 2/3/4 distinct snacks types), and the total max HP is rounded after Expired Milk's x0.9.
describe('Family-Size Snack Bag: build', () => {
  it('adds 20 max HP and 0.25 HP/s regen, anywhere in the cart', () => {
    const plain = full([at('toaster')]), b = full([at('toaster'), far('snackbag')]);
    expect(plain.regen).toBe(0);
    expect(b.maxHp).toBe(BASE + 20);
    expect(b.regen).toBe(0.25);
  });

  it('changes nothing but max HP and regen', () => {
    const plain = full([at('toaster')]), b = full([at('toaster'), far('snackbag')]);
    expect(b.weapons).toEqual(plain.weapons);
    expect({ ...b, maxHp: 0, regen: 0 }).toEqual({ ...plain, maxHp: 0, regen: 0 });
  });

  it('does not stack: two bags give the same as one', () => {
    const b = full([at('toaster'), far('snackbag'), at('snackbag', 1, { near: [], apart: [0, 1] })]);
    expect(b.maxHp).toBe(BASE + 20);
    expect(b.regen).toBe(0.25);
  });

  it('ignores a Gold Star (legendaries are never lifted)', () => {
    const b = full([at('toaster'), at('snackbag', 1, { near: [], apart: [0] }), { type: 'goldstar', near: [1], apart: [0] }]);
    expect(b.maxHp).toBe(BASE + 20);
    expect(b.regen).toBe(0.25);
  });

  it('adds to the perk and to Lunchbox', () => {
    expect(full([at('toaster'), far('snackbag')], { maxHp: 5 }).maxHp).toBe(BASE + 20 + 5);
    expect(full([at('toaster'), far('snackbag'), far('lunchbox', 2)]).maxHp).toBe(BASE + 10 + 20 + 23); // + Snacks L1 (2 types)
  });

  it('adds its regen to the snacks set regen (L2 from 3 types, L3 from 4)', () => {
    const l2 = full([at('toaster'), far('snackbag'), far('lunchbox'), far('energy')]);
    expect(l2.sets.snacks).toBe(2);
    expect(l2.regen).toBeCloseTo(0.25 + setCfg('snacks', 2).regen, 12);
    expect(l2.regen).toBeCloseTo(0.55, 12);
    const l3 = full([at('toaster'), far('snackbag'), far('lunchbox'), far('energy'), far('fortune')]);
    expect(l3.sets.snacks).toBe(3);
    expect(l3.regen).toBeCloseTo(0.25 + setCfg('snacks', 3).regen, 12);
    expect(l3.maxHp).toBe(BASE + 20 + 15 + setCfg('snacks', 3).maxHp);
    // the set alone (no bag) is unchanged
    expect(full([at('toaster'), far('lunchbox'), far('energy'), far('fortune')]).regen).toBeCloseTo(0.3, 12);
  });

  it('is rounded together with the rest after Expired Milk (x0.9)', () => {
    expect(full([at('toaster'), far('snackbag'), far('expiredmilk')]).maxHp).toBe(Math.round((BASE + 10 + 20) * HP_MULT)); // Snacks L1: 2 types
    expect(Math.round((BASE + 10 + 20) * HP_MULT)).toBe(63);
    // Snack Bag + Lunchbox ★2 + Expired Milk = 3 snacks types (L2): (40 + 10 + 20 + 23) x 0.9 = 83.7 -> 84
    expect(full([at('toaster'), far('snackbag'), far('lunchbox', 2), far('expiredmilk')]).maxHp).toBe(84);
    expect(full([at('toaster'), far('snackbag'), far('expiredmilk')], { maxHp: -8 }).regen).toBe(0.25); // Expired Milk leaves regen alone
  });
});

describe('Family-Size Snack Bag: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('snackbag')).toBe(snackbag);
    expect(ITEMS.snackbag).toMatchObject({ id: 'snackbag', family: 'snacks', name: 'Family-Size Snack Bag', kind: 'passive', price: 30, electrical: false, legendary: true });
    expect(ITEMS.snackbag.element).toBeUndefined();
    expect(ITEMS.snackbag.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    expect(ITEMS.snackbag.rules).toBe('+20 max HP and regenerate 1 HP every 4 s during combat (does not stack).');
  });

  it('keeps its tune in one place (scalars: legendaries have one tier)', () => {
    expect(contentTune('snackbag', 1)).toEqual({ hp: 20, regenHp: 1, interval: 4 });
    expect(contentTune('snackbag', 1).regenHp / contentTune('snackbag', 1).interval).toBe(0.25);
  });

  it('keeps its position in the item order', () => {
    expect(around('snackbag', 1, 1)).toEqual(['laser', 'snackbag', 'cooker']);
  });

  it('renders its text, EN and DE (the same at every level)', () => {
    expect([1, 2, 3].map((t) => itemRules('snackbag', t))).toEqual(Array(3).fill('+20 max HP and regenerate 1 HP every 4 s during combat (does not stack).'));
    setLang('de');
    expect(itemRules('snackbag', 1)).toBe('+20 max. LP und 1 LP Regeneration alle 4 s im Kampf (stapelt sich nicht).');
    expect(itemT('snackbag')).toMatchObject({ name: 'Familienpackung Snacks', blurb: 'Bodenlos. Vermutlich.' });
  });

  it('has no scaling rows (legendary)', () => {
    expect(tierScaling('snackbag')).toEqual([]);
  });
});
