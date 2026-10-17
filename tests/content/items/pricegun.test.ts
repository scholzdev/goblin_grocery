import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import pricegun from '../../../src/content/items/pricegun';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: 15% crit chance at ★1 x TIER.mult. Pan (kitchen / heat) shares no set with the gun (checkout) and has no combo with it.
describe('Price Gun: build', () => {
  it('gives 15% / 22.5% / 30% crit chance at ★1 / ★2 / ★3', () => {
    expect(stats([at('pan'), at('pricegun')]).critChance).toBeCloseTo(0.15);
    expect(stats([at('pan'), at('pricegun', 2)]).critChance).toBeCloseTo(0.225);
    expect(stats([at('pan'), at('pricegun', 3)]).critChance).toBeCloseTo(0.3);
  });

  it('records the buff, and nothing else changes', () => {
    const [w] = computeBuild(cart('pan', ['pricegun'])).weapons;
    const [plain] = computeBuild(cart('pan', [])).weapons;
    expect(w.buffs).toEqual(['pricegun']);
    expect(w.cooldown).toBe(plain.cooldown);
    expect(w.range).toBe(plain.range);
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([at('pan'), at('pricegun', 3, { near: [], apart: [0] })]);
    expect(w.critChance).toBe(0);
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once (it assigns, it does not add)', () => {
    expect(stats([at('pan'), at('pricegun', 1), at('pricegun', 3, { near: [0] })]).critChance).toBeCloseTo(0.3);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4 = 37.5%)', () => {
    expect(stats([at('pan'), at('pricegun', 3), gilded(1)]).critChance).toBeCloseTo(0.15 * TIER.mult(4));
    expect(0.15 * TIER.mult(4)).toBe(0.375);
  });

  it('is the base that Fortune Cookie adds its cart-wide +5% to afterwards', () => {
    expect(stats([at('pan'), at('pricegun', 3), at('fortune', 1, { near: [] })]).critChance).toBeCloseTo(0.3 + 0.05);
  });
});

describe('Price Gun: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('pricegun')).toBe(pricegun);
    const def = ITEMS.pricegun;
    expect(def).toMatchObject({ id: 'pricegun', family: 'checkout', kind: 'module', price: 12, electrical: false, buff: 'pricegun' });
    expect(def.element).toBeUndefined();
    expect(def.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('pricegun', 1, 1)).toEqual(['mop', 'pricegun', 'tape']);
  });

  it('renders its text for every level, EN and DE (★2 shows 22%: the legacy rounding of 0.15 x 1.5)', () => {
    expect([1, 2, 3].map((t) => itemRules('pricegun', t))).toEqual([
      'Adjacent weapons gain a 15% chance to crit for double damage (not burn). Combo: Clearance Sale with Fizz Cannon + Coupon Book.',
      'Adjacent weapons gain a 22% chance to crit for double damage (not burn). Combo: Clearance Sale with Fizz Cannon + Coupon Book.',
      'Adjacent weapons gain a 30% chance to crit for double damage (not burn). Combo: Clearance Sale with Fizz Cannon + Coupon Book.',
    ]);
    setLang('de');
    expect(itemRules('pricegun', 3)).toBe('Angrenzende Waffen erhalten 30% Chance auf einen kritischen Treffer mit doppeltem Schaden (nicht Brand). Combo: Räumungsverkauf mit Sprudelkanone + Couponheft.');
    expect(itemT('pricegun').name).toBe('Preisauszeichner');
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('pricegun')).toEqual([{ label: 'Crit chance', values: ['15%', '22%', '30%'] }]);
    setLang('de');
    expect(tierScaling('pricegun')).toEqual([{ label: 'Kritchance', values: ['15%', '22%', '30%'] }]);
  });

  it('shows its buff line with the right percentage per tier', () => {
    const line = (tier: number) => {
      const inv = cart('pan', ['pricegun']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line(1)).toBe('15% crit chance (Price Gun)');
    expect(line(3)).toBe('30% crit chance (Price Gun ★3)');
  });
});
