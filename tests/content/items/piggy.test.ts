import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import piggy from '../../../src/content/items/piggy';
import { contentItem, contentSetTune, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: kill coins x(1 + 15%) at ★1, the bonus scaled by TIER.mult; the cart-wide best copy counts.
describe('Piggy Bank: build', () => {
  it('multiplies kill coins by 1.15 / 1.225 / 1.3 at ★1 / ★2 / ★3', () => {
    expect(full([at('toaster')]).killCoinMult).toBe(1);
    [1, 2, 3].forEach((t, i) => expect(full([at('toaster'), far('piggy', t)]).killCoinMult).toBeCloseTo([1.15, 1.225, 1.3][i], 12));
  });

  it('matches the legacy formula 1 + 0.15 x TIER.mult', () => {
    for (const t of [1, 2, 3]) expect(full([at('toaster'), far('piggy', t)]).killCoinMult).toBeCloseTo(1 + 0.15 * TIER.mult(t), 12);
  });

  it('changes nothing but the kill coin multiplier, besides the Checkout L1 its 3 set points reach', () => {
    const plain = full([at('toaster')]), withPig = full([at('toaster'), far('piggy', 3)]);
    expect(withPig.weapons).toEqual(plain.weapons);
    expect(withPig.sets).toEqual({ ...plain.sets, checkout: 1 });
    expect(withPig.priceMult).toBe(contentSetTune('checkout', 1).priceMult);
    expect({ ...withPig, killCoinMult: 0, sets: plain.sets, priceMult: plain.priceMult }).toEqual({ ...plain, killCoinMult: 0 });
  });

  it('does not stack: the best copy in the whole cart counts once', () => {
    expect(full([at('toaster'), far('piggy', 1), far('piggy', 3)]).killCoinMult).toBeCloseTo(1.3, 12);
    expect(full([at('toaster'), far('piggy', 2), at('piggy', 1, { near: [0] })]).killCoinMult).toBeCloseTo(1.225, 12);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: x1.375)', () => {
    expect(1 + 0.15 * TIER.mult(4)).toBeCloseTo(1.375, 12);
    expect(full([at('toaster'), corner('piggy', 3), gilded(1)]).killCoinMult).toBeCloseTo(1.375, 12);
    expect(full([at('toaster'), corner('piggy', 1), gilded(1)]).killCoinMult).toBeCloseTo(1.225, 12); // ★1 -> effective ★2
  });
});

describe('Piggy Bank: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('piggy')).toBe(piggy);
    expect(ITEMS.piggy).toMatchObject({ id: 'piggy', family: 'checkout', kind: 'passive', price: 10, electrical: false });
    expect(ITEMS.piggy.element).toBeUndefined();
    expect(ITEMS.piggy.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.piggy.legendary).toBeUndefined();
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('piggy', t).coins)).toEqual([0.15, 0.225, 0.3, 0.375]);
  });

  it('keeps its position in the item order', () => {
    expect(around('piggy', 1, 1)).toEqual(['sample', 'piggy', 'expiredmilk']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('piggy', t))).toEqual([
      'Groceries drop +15% coins (does not stack).',
      'Groceries drop +22.5% coins (does not stack).',
      'Groceries drop +30% coins (does not stack).',
    ]);
    setLang('de');
    expect(itemRules('piggy', 2)).toBe('Gegner lassen +22,5% Münzen fallen (stapelt sich nicht).');
    expect(itemT('piggy')).toMatchObject({ name: 'Sparschwein', blurb: 'Oink. Jeder Gegner zahlt ein.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('piggy')).toEqual([{ label: 'Kill coins', values: ['+15%', '+22.5%', '+30%'] }]);
    setLang('de');
    expect(tierScaling('piggy')).toEqual([{ label: 'Münzen pro Kill', values: ['+15%', '+22,5%', '+30%'] }]);
  });
});
