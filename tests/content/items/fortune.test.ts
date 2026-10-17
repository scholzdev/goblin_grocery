import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import fortune from '../../../src/content/items/fortune';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

const crit = (specs: Parameters<typeof full>[0], weapon = 0) => full(specs).weapons[weapon].critChance;

// Legacy: +5% crit chance at ★1 x TIER.mult on EVERY weapon (cart-wide, no touching), added after the Price Gun assigned its own; the best copy counts.
describe('Fortune Cookie: build', () => {
  it('gives every weapon +5% / +7.5% / +10% crit chance at ★1 / ★2 / ★3, anywhere in the cart', () => {
    expect(crit([at('toaster')])).toBe(0);
    [1, 2, 3].forEach((t, i) => expect(crit([at('toaster'), far('fortune', t)])).toBeCloseTo([0.05, 0.075, 0.1][i], 12));
  });

  it('matches the legacy formula 0.05 x TIER.mult', () => {
    for (const t of [1, 2, 3]) expect(crit([at('toaster'), far('fortune', t)])).toBeCloseTo(0.05 * TIER.mult(t), 12);
  });

  it('reaches every weapon in the cart, not just one', () => {
    const b = full([at('toaster'), at('pan', 1, { near: [] }), far('fortune', 2)]);
    expect(b.weapons.map((w) => w.critChance)).toEqual([0.075, 0.075]);
  });

  it('records no buff and changes nothing but the crit chance', () => {
    const plain = full([at('toaster')]).weapons[0], w = full([at('toaster'), far('fortune', 3)]).weapons[0];
    expect(w.buffs).toEqual([]);
    expect({ ...w, critChance: 0 }).toEqual({ ...plain, critChance: 0 });
  });

  it('does not stack: the best copy in the whole cart counts once', () => {
    expect(crit([at('toaster'), far('fortune', 1), far('fortune', 3)])).toBeCloseTo(0.1, 12);
    expect(crit([at('toaster'), far('fortune', 2), at('fortune', 1, { near: [0] })])).toBeCloseTo(0.075, 12);
  });

  it('adds to the Price Gun instead of being overwritten by it (module assigns, then Fortune adds)', () => {
    expect(crit([at('toaster'), at('pricegun', 3)])).toBeCloseTo(0.3, 12);
    expect(crit([at('toaster'), at('pricegun', 3), far('fortune', 3)])).toBeCloseTo(0.3 + 0.1, 12);
    expect(crit([at('toaster'), at('pricegun', 1), far('fortune', 1)])).toBeCloseTo(0.15 + 0.05, 12);
    // a weapon the gun does not touch only gets the Fortune Cookie's share
    const b = full([at('toaster'), at('pricegun', 3), at('pan', 1, { near: [] , apart: [0, 1] }), far('fortune', 2)]);
    expect(b.weapons.map((w) => w.critChance)).toEqual([expect.closeTo(0.3 + 0.075, 12), expect.closeTo(0.075, 12)]);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: +12.5%)', () => {
    expect(0.05 * TIER.mult(4)).toBeCloseTo(0.125, 12);
    expect(crit([at('toaster'), corner('fortune', 3), gilded(1)])).toBeCloseTo(0.125, 12);
    expect(crit([at('toaster'), at('pricegun', 3), corner('fortune', 3), gilded(2)])).toBeCloseTo(0.3 + 0.125, 12);
  });
});

describe('Fortune Cookie: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('fortune')).toBe(fortune);
    expect(ITEMS.fortune).toMatchObject({ id: 'fortune', family: 'snacks', kind: 'passive', price: 8, electrical: false });
    expect(ITEMS.fortune.element).toBeUndefined();
    expect(ITEMS.fortune.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.fortune.legendary).toBeUndefined();
    expect(ITEMS.fortune.buff).toBeUndefined();
  });

  it('keeps its tune in one place', () => {
    expect(contentTune('fortune', 1).crit).toBe(0.05);
    expect(contentTune('fortune', 3).crit).toBe(0.1);
  });

  it('keeps its position in the item order', () => {
    expect(around('fortune', 1, 1)).toEqual(['energy', 'fortune', 'sample']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('fortune', t))).toEqual([
      'Every weapon gains +5% chance to crit for double damage (adds to the Price Gun, does not stack).',
      'Every weapon gains +7.5% chance to crit for double damage (adds to the Price Gun, does not stack).',
      'Every weapon gains +10% chance to crit for double damage (adds to the Price Gun, does not stack).',
    ]);
    setLang('de');
    expect(itemRules('fortune', 2)).toBe('Jede Waffe erhält +7,5% Chance auf einen Krit für doppelten Schaden (addiert sich zum Preisauszeichner, stapelt sich nicht).');
    expect(itemT('fortune')).toMatchObject({ name: 'Glückskeks', blurb: 'Deine Glückszahlen: 2, 2, 2.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('fortune')).toEqual([{ label: 'Crit chance', values: ['+5%', '+7.5%', '+10%'] }]);
    setLang('de');
    expect(tierScaling('fortune')).toEqual([{ label: 'Kritchance', values: ['+5%', '+7,5%', '+10%'] }]);
  });
});
