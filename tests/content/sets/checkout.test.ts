import { afterEach, describe, expect, it } from 'vitest';
import checkout from '../../../src/content/sets/checkout';
import { contentSet, contentSetTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { t } from '../../../src/i18n';
import { createRun, finishWave, interestPreview, recomputeBuild } from '../../../src/state/run';
import type { RunState } from '../../../src/types';
import { build, type Spec } from '../../golden/carts';
import { at, far, full } from '../helpers';
import { expectSetText } from './helpers';

afterEach(() => setLang('en'));

const PAN = at('pan'); // not a checkout item: the weapon only
// Checkout members that touch nothing: Bell, Sale Flag, a ★2 Tip Jar, a ★2 Coupon Book (passives; a ★2 is 2 points).
const MEMBERS = [far('bell'), far('flag'), far('tipjar', 2), far('coupon', 2)];
const cart = (n: number): Spec[] => [PAN, ...MEMBERS.slice(0, n)];

describe('Checkout set: thresholds', () => {
  it('2 / 4 / 6 set points give L1 / L2 / L3 (the pan does not count; cart(n) holds 0 / 1 / 2 / 4 / 6 points)', () => {
    expect([0, 1, 2, 3, 4].map((n) => full(cart(n)).sets.checkout)).toEqual([0, 0, 1, 2, 3]);
  });

  it('no bonus below the threshold: prices are 1x', () => {
    expect(full(cart(0)).priceMult).toBe(1);
    expect(full(cart(1)).priceMult).toBe(1);
  });

  it('L1 and L2 make new offers 8% cheaper, L3 15% (the numbers replace)', () => {
    expect(full(cart(2)).priceMult).toBe(0.92);
    expect(full(cart(3)).priceMult).toBe(0.92);
    expect(full(cart(4)).priceMult).toBe(0.85);
  });

  it('a double pack counts 2 in its family set: one double Bell is already L1 (and the cheaper prices come with it)', () => {
    const b = full([PAN, { ...far('bell'), double: true }]);
    expect(b.sets.checkout).toBe(1);
    expect(b.priceMult).toBe(0.92);
  });
});

describe('Checkout set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3; L1 keeps the base interest cap)', () => {
    expect(contentSet('checkout')).toBe(checkout);
    expect(contentSetTune('checkout', 1)).toEqual({ priceMult: 0.92, interestCap: 0 });
    expect(contentSetTune('checkout', 2)).toEqual({ priceMult: 0.92, interestCap: 6 });
    expect(contentSetTune('checkout', 3)).toEqual({ priceMult: 0.85, interestCap: 10 });
    expect(checkout.hooks).toBeUndefined();
  });

  it('is a final-phase player hook', () => {
    expect(checkout.build).toMatchObject({ phase: 'final', order: 10 });
    expect(checkout.build?.weapon).toBeUndefined();
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('checkout', {
      en: { name: 'Checkout', bonus: ['Shop prices −8% (new offers)', 'Interest cap raised to 6', 'Shop prices −15%; interest cap raised to 10'] },
      de: { name: 'Kasse', bonus: ['Shop-Preise −8 % (neue Angebote)', 'Zinsobergrenze steigt auf 6', 'Shop-Preise −15 %; Zinsobergrenze steigt auf 10'] },
    });
  });
});

describe('Checkout set: interest at the end of an aisle', () => {
  const run = (specs: Spec[], money: number): RunState => {
    const s = createRun(1);
    s.inventory = build(specs, 8, 6);
    recomputeBuild(s);
    s.money = money;
    return s;
  };
  const paid = (s: RunState): number => s.coinLog.find((c) => c.label === t('coinInterest'))?.amount ?? 0;
  const finish = (specs: Spec[], money: number): number => {
    const s = run(specs, money);
    finishWave(s);
    return paid(s);
  };

  it('every run earns +1 per 10 held after the 12-coin clear bonus, capped at 3 without Checkout', () => {
    expect(finish(cart(0), 0), '0 + 12 held').toBe(1);
    expect(finish(cart(0), 5), '5 + 12 held').toBe(1);
    expect(finish(cart(0), 8), '8 + 12 held').toBe(2);
    expect(finish(cart(0), 35), '35 + 12 held, capped').toBe(3);
    expect(finish(cart(0), 80), '80 + 12 held, capped').toBe(3);
  });

  it('Checkout L1 keeps the base cap of 3; L2 raises it to 6, L3 to 10', () => {
    expect(finish(cart(2), 80), 'L1').toBe(3);
    expect(finish(cart(3), 80), 'L2').toBe(6);
    expect(finish(cart(3), 30), 'L2 below the cap').toBe(4);
    expect(finish(cart(4), 120), 'L3').toBe(10);
    expect(finish(cart(4), 400), 'L3 far above the cap').toBe(10);
  });

  it('interestPreview names what finishWave then pays, and the cap', () => {
    for (const [n, cap] of [[0, 3], [2, 3], [3, 6], [4, 10]] as const) {
      for (const money of [0, 7, 8, 35, 49, 95, 400]) {
        const s = run(cart(n), money);
        const preview = interestPreview(s);
        finishWave(s);
        expect(preview, `${n} checkout items with ${money}`).toEqual({ amount: paid(s), cap });
      }
    }
  });
});
