import { describe, expect, it } from 'vitest';
import { shopQuality } from '../src/data/waves';
import { acceptCustomer, createRun, declineCustomer, openShop, recomputeBuild, reroll, upgradeCost } from '../src/state/run';
import { rollOffers } from '../src/systems/shop';
import { mulberry32 } from '../src/systems/rng';

function offer() {
  const s = createRun(4);
  s.money = 100;
  openShop(s, mulberry32(4));
  const item = s.inventory.placed[0];
  s.shop!.customer = { uid: item.uid, type: item.type, tier: item.tier ?? 1, price: upgradeCost(item)!, status: 'offered' };
  return s;
}

describe('automatic shop quality', () => {
  it('improves legendary odds each aisle up to the cap, without a purchase', () => {
    const s = createRun(1);
    for (let aisle = 1; aisle <= 7; aisle++) {
      s.wave = aisle;
      const money = s.money;
      openShop(s, mulberry32(aisle));
      expect(s.money).toBe(money);
      expect(s.shopLevel).toBe(shopQuality(aisle).level);
      if (aisle > 1) expect(shopQuality(aisle).legendary).toBeGreaterThan(shopQuality(aisle - 1).legendary);
    }
    expect(shopQuality(50)).toEqual(shopQuality(7));
  });

  it('normal offer odds ignore a manually raised shop level; lab overrides still work', () => {
    const s = createRun(1);
    const base = rollOffers(s, mulberry32(123), 3);
    s.shopLevel = 4;
    expect(rollOffers(s, mulberry32(123), 3)).toEqual(base);
    s.lab = true;
    expect(rollOffers(s, mulberry32(123), 3)).not.toEqual(base);
  });
});

describe('customer upgrade deals', () => {
  it('visits are optional, seeded, and fixed across rerolls', () => {
    let visits = 0;
    for (let seed = 0; seed < 100; seed++) {
      const a = createRun(seed), b = createRun(seed);
      openShop(a, mulberry32(seed)); openShop(b, mulberry32(seed));
      expect(a.shop!.customer).toEqual(b.shop!.customer);
      if (a.shop!.customer) visits++;
    }
    expect(visits).toBeGreaterThan(0); expect(visits).toBeLessThan(100);
    const s = offer(), deal = structuredClone(s.shop!.customer);
    reroll(s, mulberry32(42));
    expect(s.shop!.customer).toEqual(deal);
  });

  it('acceptance charges exactly the displayed price and raises exactly one star, once', () => {
    const s = offer(), price = s.shop!.customer!.price;
    expect(acceptCustomer(s).ok).toBe(true);
    expect(s.inventory.placed[0].tier).toBe(2);
    expect(s.money).toBe(100 - price);
    expect(s.shop!.customer!.status).toBe('accepted');
    const after = structuredClone(s);
    expect(acceptCustomer(s).ok).toBe(false);
    expect(s).toEqual(after);
  });

  it.each(['poor', 'sold', 'merged', 'not-shop', 'wrong-price'] as const)('refuses %s offers without changing the run', (kind) => {
    const s = offer();
    if (kind === 'poor') s.money = 0;
    if (kind === 'sold') s.inventory.placed = [];
    if (kind === 'merged') s.inventory.placed[0].tier = 2;
    if (kind === 'not-shop') s.phase = 'combat';
    if (kind === 'wrong-price') s.shop!.customer!.price = 1;
    const before = structuredClone(s);
    expect(acceptCustomer(s).ok).toBe(false);
    expect(s).toEqual(before);
  });

  it('declining costs nothing and cannot be undone by buying or rerolling', () => {
    const s = offer();
    expect(declineCustomer(s).ok).toBe(true);
    expect(s.money).toBe(100);
    expect(acceptCustomer(s).ok).toBe(false);
    reroll(s, mulberry32(8));
    expect(s.shop!.customer!.status).toBe('declined');
  });

  it('does not offer legendary or max-tier items', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = createRun(seed);
      s.inventory.placed[0].tier = 3;
      s.inventory.shelf[0] = { uid: 'legend', type: 'insurance', tier: 1, x: 0, y: 0, rot: 0 };
      openShop(s, mulberry32(seed));
      expect(s.shop!.customer).toBeUndefined();
    }
  });

  it('checks a growing item still fits before charging', () => {
    const s = offer();
    s.inventory.placed = [
      { uid: 'bread', type: 'sourdough', tier: 1, x: 0, y: 0, rot: 0 },
      { uid: 'block', type: 'magnet', x: 1, y: 0, rot: 0 },
    ];
    recomputeBuild(s);
    s.shop!.customer = { uid: 'bread', type: 'sourdough', tier: 1, price: 6, status: 'offered' };
    const before = structuredClone(s);
    expect(acceptCustomer(s).ok).toBe(false);
    expect(s).toEqual(before);
  });
});
