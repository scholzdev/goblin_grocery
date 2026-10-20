import { afterEach, describe, expect, it } from 'vitest';
import checkout from '../../../src/content/sets/checkout';
import { contentSet, contentSetTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { t } from '../../../src/i18n';
import { createRun, finishWave, recomputeBuild } from '../../../src/state/run';
import { build, type Spec } from '../../golden/carts';
import { at, far, full } from '../helpers';
import { expectSetText } from './helpers';

afterEach(() => setLang('en'));

const PAN = at('pan'); // not a checkout item: the weapon only
// Checkout members that touch nothing: Bell, Sale Flag, Tip Jar, Coupon Book (passives).
const MEMBERS = [far('bell'), far('flag'), far('tipjar'), far('coupon')];
const cart = (n: number): Spec[] => [PAN, ...MEMBERS.slice(0, n)];

describe('Checkout set: thresholds', () => {
  it('2 / 3 / 4 set points (one per ★1 checkout type) give L1 / L2 / L3 (the pan does not count)', () => {
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
  it('is registered with its tune (arrays are L1/L2/L3; the interest step is the same everywhere)', () => {
    expect(contentSet('checkout')).toBe(checkout);
    expect(contentSetTune('checkout', 1)).toEqual({ priceMult: 0.92, interestPer: 10, interestCap: 5 });
    expect(contentSetTune('checkout', 2)).toEqual(contentSetTune('checkout', 1));
    expect(contentSetTune('checkout', 3)).toEqual({ priceMult: 0.85, interestPer: 10, interestCap: 8 });
    expect(checkout.hooks).toBeUndefined();
  });

  it('is a final-phase player hook', () => {
    expect(checkout.build).toMatchObject({ phase: 'final', order: 10 });
    expect(checkout.build?.weapon).toBeUndefined();
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('checkout', {
      en: { name: 'Checkout', bonus: ['Shop prices −8% (new offers)', 'Interest +1 coin per 10 held (max 5)', 'Shop prices −15%; interest +1 coin per 10 held (max 8)'] },
      de: { name: 'Kasse', bonus: ['Shop-Preise −8 % (neue Angebote)', 'Zinsen +1 Münze pro 10 gehalten (max. 5)', 'Shop-Preise −15 %; Zinsen +1 Münze pro 10 gehalten (max. 8)'] },
    });
  });
});

// The interest is paid by state/run.ts `finishWave`, which reads this set's tune: +1 coin per 10 held, capped (L2+), after the clear bonus.
describe('Checkout set: interest at the end of an aisle', () => {
  const finish = (specs: Spec[], money: number): { gained: number; interest: number } => {
    const s = createRun(1);
    s.inventory = build(specs, 8, 6);
    recomputeBuild(s);
    s.money = money;
    finishWave(s);
    const interest = s.coinLog.find((c) => c.label === t('coinInterest'))?.amount ?? 0;
    return { gained: s.money - money - interest, interest };
  };

  it('pays nothing below L2', () => {
    expect(finish(cart(0), 95).interest).toBe(0);
    expect(finish(cart(2), 95).interest).toBe(0); // L1: cheaper offers only
  });

  it('pays 1 coin per 10 held (after the clear bonus), capped at 5 (L2) / 8 (L3)', () => {
    const bonus = finish(cart(0), 0).gained;
    for (const [n, cap] of [[3, 5], [4, 8]] as const) {
      for (const money of [0, 7, 35, 95, 400]) {
        expect(finish(cart(n), money).interest, `L${n - 1} with ${money}`).toBe(Math.min(cap, Math.floor((money + bonus) / 10)));
      }
    }
    expect(finish(cart(3), 400).interest).toBe(5);
    expect(finish(cart(4), 400).interest).toBe(8);
  });
});
