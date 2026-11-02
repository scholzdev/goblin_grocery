import { describe, expect, it } from 'vitest';
import { buyOffer, createRun, leaveShop, mergeItems, moveItem, openShop, previewMove, takeStockroomItem } from '../src/state/run';
import { ownedWeapons } from '../src/systems/weaponLoadout';
import { rollOffers } from '../src/systems/shop';
import { ITEMS, ITEM_IDS } from '../src/data/items';
import { mulberry32 } from '../src/systems/rng';
import type { ItemTypeId, RunState } from '../src/types';

const shop = () => { const s = createRun(1); openShop(s, mulberry32(1)); s.money = 1000; return s; };
const offer = (s: RunState, type: ItemTypeId) => { s.shop!.offers = [{ type, slot: 0, tier: 1, sold: false, price: 10 }]; return buyOffer(s, 0); };

describe('two-weapon loadout', () => {
  it('the opening shop offers a partner from another family while keeping merge pulls on later rolls', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = createRun(seed); s.pool = [...ITEM_IDS];
      const offers = rollOffers(s, mulberry32(seed), 1);
      expect(offers.some((o) => ITEMS[o.type].weaponFamily && ITEMS[o.type].weaponFamily !== ITEMS.toaster.weaponFamily)).toBe(true);
    }
  });
  it('counts shelf weapons, rejects a third type without spending, and allows duplicates for merging', () => {
    const s = shop(); expect(offer(s, 'fizz').ok).toBe(true);
    const money = s.money, inv = structuredClone(s.inventory);
    expect(offer(s, 'tomato').ok).toBe(false); expect(s.money).toBe(money); expect(s.inventory).toEqual(inv);
    expect(offer(s, 'toaster').ok).toBe(true); expect(ownedWeapons(s.inventory)).toEqual(['toaster', 'fizz']);
    const dup = s.inventory.shelf.find((i) => i?.type === 'toaster')!;
    expect(mergeItems(s, dup.uid, s.inventory.placed[0].uid).ok).toBe(true);
  });

  it('requires the second type to have another family; selling permits switching', () => {
    const s = shop(); expect(offer(s, 'nailgun').ok).toBe(false);
    expect(offer(s, 'pan').ok).toBe(true);
  });

  it('placement and preview reject a third equipped instance, while shelf reorganization remains possible', () => {
    const s = shop(); s.inventory.cols = 10; s.inventory.rows = 10;
    s.inventory.placed.push({ uid: 'pan', type: 'pan', x: 5, y: 0, rot: 0 });
    s.inventory.shelf[0] = { uid: 'copy', type: 'toaster', x: 0, y: 0, rot: 0 };
    const target = { where: 'grid' as const, x: 5, y: 5, rot: 0 as const };
    const before = structuredClone(s.inventory);
    expect(previewMove(s, 'copy', target).result.ok).toBe(false);
    expect(moveItem(s, 'copy', target).ok).toBe(false); expect(s.inventory).toEqual(before);
    expect(moveItem(s, 'pan', { where: 'shelf', slot: 1 }).ok).toBe(true);
    expect(moveItem(s, 'copy', target).ok).toBe(true);
  });

  it('free rewards convert to coins when blocked, and legacy invalid carts cannot start combat', () => {
    const s = shop(); expect(offer(s, 'fizz').ok).toBe(true);
    const money = s.money;
    expect(takeStockroomItem(s, { type: 'tomato', tier: 1 })).toBe(false); expect(s.money).toBeGreaterThan(money);
    s.inventory.shelf[1] = { uid: 'old', type: 'tomato', x: 0, y: 0, rot: 0 };
    expect(leaveShop(s, mulberry32(2)).ok).toBe(false); expect(s.phase).toBe('shop');
  });

  it('keeps lab experiments unrestricted', () => {
    const s = shop(); s.lab = true;
    expect(offer(s, 'nailgun').ok).toBe(true); expect(offer(s, 'fizz').ok).toBe(true);
  });
});
