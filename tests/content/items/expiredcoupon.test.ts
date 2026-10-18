import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import expiredcoupon from '../../../src/content/items/expiredcoupon';
import { contentItem } from '../../../src/engine/registry';
import { itemRules } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { at, far, full } from '../helpers';

afterEach(() => setLang('en'));

const PAN = at('pan');
const COUPON = far('expiredcoupon');
const CHECKOUT = [far('bell'), far('flag')]; // two more distinct checkout types: Checkout L1 (x0.92) with or without the coupon in the count

describe('Expired Coupon', () => {
  it('is the registered legendary content file', () => {
    expect(contentItem('expiredcoupon')).toBe(expiredcoupon);
    expect(ITEMS.expiredcoupon).toMatchObject({ id: 'expiredcoupon', legendary: true });
  });

  it('makes new offers 25% cheaper', () => {
    expect(full([PAN]).priceMult).toBe(1);
    expect(full([PAN, COUPON]).priceMult).toBe(0.75);
  });

  it('stacks with the Checkout set instead of being overwritten by it', () => {
    const checkout = full([PAN, ...CHECKOUT]).priceMult;
    expect(checkout).toBe(0.92);
    expect(full([PAN, ...CHECKOUT, COUPON]).priceMult).toBeCloseTo(checkout * 0.75);
  });

  it('renders its rules, EN and DE', () => {
    expect(itemRules('expiredcoupon', 1)).toContain('Shop prices −25% (new offers)');
    setLang('de');
    expect(itemRules('expiredcoupon', 1)).toContain('Shop-Preise −25 % (neue Angebote)');
  });
});
