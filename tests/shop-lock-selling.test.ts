import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../src/data/waves';
import { ITEMS } from '../src/data/items';
import { buyOffer, createRun, openShop, reroll, sellItem, startNextWave, toggleShopLock } from '../src/state/run';
import { mulberry32 } from '../src/systems/rng';
import { inflation, sellPrice } from '../src/systems/shop';
import { computeBuild } from '../src/systems/synergies';
import type { ItemInstance, ItemTypeId, RunState } from '../src/types';
import { at, far, full } from './content/helpers';

const shopAt = (wave: number): RunState => {
  const s = createRun(1);
  s.wave = wave;
  s.money = 500;
  openShop(s, mulberry32(7));
  return s;
};
const give = (s: RunState, type: ItemTypeId, tier = 1, extra: Partial<ItemInstance> = {}): ItemInstance => {
  const inst: ItemInstance = { uid: `g${s.nextUid++}`, type, x: 0, y: 0, rot: 0, tier, ...extra };
  s.inventory.shelf[s.inventory.shelf.indexOf(null)] = inst;
  return inst;
};
const nextShop = (s: RunState, seed = 99): void => { startNextWave(s); s.phase = 'checkout'; s.wave++; openShop(s, mulberry32(seed)); };

describe('shop lock', () => {
  it('is off by default, free to toggle, and only works in the shop', () => {
    const s = shopAt(2);
    expect(s.shop!.locked).toBe(false);
    const money = s.money;
    expect(toggleShopLock(s).ok).toBe(true);
    expect(s.shop!.locked).toBe(true);
    expect(s.money).toBe(money);
    expect(toggleShopLock(s).ok).toBe(true);
    expect(s.shop!.locked).toBe(false);
    s.phase = 'combat';
    expect(toggleShopLock(s).ok).toBe(false);
  });

  it('refuses reroll while locked, without charging, and rerolls again after unlocking', () => {
    const s = shopAt(2);
    toggleShopLock(s);
    const before = structuredClone(s);
    expect(reroll(s, mulberry32(3)).ok).toBe(false);
    expect(s).toEqual(before);
    toggleShopLock(s);
    expect(reroll(s, mulberry32(3)).ok).toBe(true);
  });

  it('carries unsold offers into the next shop at the price they were locked at (no inflation)', () => {
    const s = shopAt(2);
    toggleShopLock(s);
    const locked = structuredClone(s.shop!.offers);
    nextShop(s);
    expect(inflation(s, 3)).toBeGreaterThan(inflation(s, 2));
    expect(s.shop!.locked).toBe(true);
    expect(s.shop!.offers).toEqual(locked);
    nextShop(s, 5); // and again, for as long as the lock stays on
    expect(s.shop!.offers).toEqual(locked);
  });

  it('refills only the slots that were bought, at the new shop\'s prices', () => {
    const s = shopAt(2);
    toggleShopLock(s);
    const locked = structuredClone(s.shop!.offers);
    expect(buyOffer(s, 1).ok).toBe(true);
    nextShop(s);
    const now = s.shop!.offers;
    expect(now).toHaveLength(ECONOMY.offerCount);
    now.forEach((o, i) => i === 1 ? expect(o).toMatchObject({ slot: 1, sold: false }) : expect(o).toEqual(locked[i]));
    expect(now[1].type).not.toBe(locked[1].type);
    expect(now.filter((o) => o.type === now[1].type)).toHaveLength(1);
  });

  it('drops the carry once unlocked: the next shop is a fresh roll', () => {
    const s = shopAt(2);
    toggleShopLock(s);
    const locked = structuredClone(s.shop!.offers);
    nextShop(s);
    toggleShopLock(s); // off in the second shop
    nextShop(s);
    expect(s.shop!.locked).toBe(false);
    expect(s.shop!.offers.map((o) => o.type)).not.toEqual(locked.map((o) => o.type));
  });

  it('keeps nothing when it was never locked', () => {
    const s = shopAt(2);
    startNextWave(s);
    expect(s.shopLock).toBeUndefined();
  });
});

describe('Barter Stamp', () => {
  it('raises sells to 65% / 75% / 85% of the value by ★', () => {
    const price = ITEMS.pan.price; // 10
    expect(sellPrice('pan', 1)).toBe(Math.floor(price * 0.5));
    [[1, 0.65], [2, 0.75], [3, 0.85]].forEach(([t, r]) => {
      const b = full([at('toaster'), far('barter', t)]);
      expect(b.sellRate).toBeCloseTo(r, 12);
      expect(sellPrice('pan', 1, b)).toBe(Math.floor(price * r));
    });
  });
  it('does not stack: the best copy counts; absent it pays 50%', () => {
    expect(full([at('toaster')]).sellRate).toBe(0.5);
    expect(full([at('toaster'), far('barter', 1), far('barter', 3)]).sellRate).toBeCloseTo(0.85, 12);
  });
  it('is paid by sellItem', () => {
    const s = shopAt(2);
    s.inventory.placed.push({ uid: 'b1', type: 'barter', x: 3, y: 3, rot: 0, tier: 3 });
    s.build = computeBuild(s.inventory);
    const pan = give(s, 'pan');
    const m = s.money;
    sellItem(s, pan.uid);
    expect(s.money - m).toBe(Math.floor(ITEMS.pan.price * 0.85));
  });
});

describe('Collector\'s Binder', () => {
  const family = (t: ItemTypeId) => ITEMS[t].family;
  it('binds on purchase to the family the cart and shelf hold the most of', () => {
    const s = shopAt(2);
    const pair = (Object.keys(ITEMS) as ItemTypeId[]).filter((t) => family(t) === 'cleaning' && t !== 'binder').slice(0, 2);
    pair.forEach((t) => give(s, t));
    s.shop!.offers[0] = { slot: 0, type: 'binder', tier: 1, price: 1, sold: false };
    expect(buyOffer(s, 0).ok).toBe(true);
    const b = s.inventory.shelf.find((i) => i?.type === 'binder')!;
    expect(b.binderFamily).toBe('cleaning');
    expect(b.binderSold).toBe(0);
  });
  it('sells its family at full value, other families at the normal rate', () => {
    const inv = full([at('toaster'), far('binder')], {});
    expect(inv.sellFullFamilies).toEqual([]); // unbound (no family yet)
    const s = shopAt(2);
    s.inventory.placed.push({ uid: 'bd', type: 'binder', x: 3, y: 2, rot: 0, binderFamily: family('pan'), binderSold: 0 });
    s.build = computeBuild(s.inventory);
    expect(s.build.sellFullFamilies).toEqual([family('pan')]);
    expect(sellPrice('pan', 1, s.build)).toBe(ITEMS.pan.price);
    const other = (Object.keys(ITEMS) as ItemTypeId[]).find((t) => family(t) !== family('pan') && ITEMS[t].price >= 8)!;
    expect(sellPrice(other, 1, s.build)).toBe(Math.floor(ITEMS[other].price / 2));
  });
  it('gains +2% damage per sold item of its family, capped at +20%', () => {
    const s = shopAt(2);
    const bd: ItemInstance = { uid: 'bd', type: 'binder', x: 3, y: 2, rot: 0, binderFamily: family('toaster'), binderSold: 0 };
    s.inventory.placed.push(bd);
    s.build = computeBuild(s.inventory);
    const base = s.build.weapons[0].damage;
    for (let i = 1; i <= 12; i++) {
      const sold = give(s, family('toaster') === family('pan') ? 'pan' : 'toaster');
      sellItem(s, sold.uid);
      expect(bd.binderSold).toBe(i);
      expect(s.build.weapons[0].damage / base).toBeCloseTo(1 + Math.min(0.2, i * 0.02), 12);
    }
  });
  it('ignores sales of other families and leaves other families\' weapons alone', () => {
    const s = shopAt(2);
    const bd: ItemInstance = { uid: 'bd', type: 'binder', x: 3, y: 2, rot: 0, binderFamily: 'cleaning', binderSold: 0 };
    s.inventory.placed.push(bd);
    s.build = computeBuild(s.inventory);
    const base = s.build.weapons[0].damage;
    sellItem(s, give(s, 'pan').uid);
    expect(bd.binderSold).toBe(0);
    bd.binderSold = 10;
    s.build = computeBuild(s.inventory);
    expect(s.build.weapons[0].damage).toBe(base); // toaster is not cleaning
  });
});
