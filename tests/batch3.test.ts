import { describe, expect, it } from 'vitest';
import { computeBuild, tierScaling } from '../src/systems/synergies';
import { tailwindFeedsSugar } from '../src/systems/combat';
import { createRun, mergeItems, moveItem, openShop, upgradeItem } from '../src/state/run';
import { footprint } from '../src/systems/inventory';
import { mulberry32 } from '../src/systems/rng';
import { ITEMS, SOURDOUGH, cellsFor } from '../src/data/items';
import { RECIPES, RECIPE_TUNING } from '../src/data/recipes';
import { cart } from './cart';
import type { Inventory, ItemInstance, ItemTypeId, RunState } from '../src/types';

const inv = (items: [ItemTypeId, number, number, Partial<ItemInstance>?][]): Inventory => ({
  cols: 5, rows: 4, shelf: [],
  placed: items.map(([type, x, y, extra], i) => ({ uid: `u${i}`, type, x, y, rot: 0, ...extra })),
});

describe('Leaf Blower', () => {
  it('is a cone weapon with a heavy knockback and the specified stats', () => {
    const d = ITEMS.leafblower;
    expect(d.kind).toBe('weapon');
    expect(d.electrical).toBe(false);
    expect(d.element).toBeUndefined();
    expect(d.tags).toEqual(['area']);
    expect(d.price).toBe(14);
    expect(d.weapon).toMatchObject({ pattern: 'cone', damage: 3, cooldown: 0.9, range: 220, arcDeg: 50 });
    expect(d.weapon!.knockback!).toBeGreaterThan(5 * 40); // spray uses the default 40
    expect(ITEMS.spray.weapon!.knockback).toBeUndefined();
    const w = computeBuild(cart('leafblower', [])).weapons[0];
    expect(w).toMatchObject({ pattern: 'cone', arcDeg: 50, range: 220 });
  });
});

describe('Tailwind', () => {
  it('needs the blower, a fan AND boots', () => {
    const sup = ['fan', 'boot'] as const;
    expect(computeBuild(cart('leafblower', [...sup])).weapons[0].recipes).toContain('tailwind');
    for (let i = 0; i < sup.length; i++) expect(computeBuild(cart('leafblower', sup.filter((_, j) => j !== i))).weapons[0].recipes).not.toContain('tailwind');
    expect(computeBuild(cart('spray', [...sup])).weapons[0].recipes).not.toContain('tailwind');
    expect(RECIPES.tailwind.weapon).toBe('leafblower');
  });
  it('tuning matches the spec', () => {
    expect(RECIPE_TUNING.tailwind).toEqual({ boost: 0.3, boostTime: 0.4, sugarIcd: 1.5 });
  });
  it('never adds Sugar Rush stacks without Sugar Rush; with it, only past the 1.5 s cooldown', () => {
    const icd = RECIPE_TUNING.tailwind.sugarIcd;
    for (const now of [0, 1, 10, 1000]) expect(tailwindFeedsSugar(false, now, -Infinity, icd)).toBe(false);
    expect(tailwindFeedsSugar(true, 0, -Infinity, icd)).toBe(true);
    expect(tailwindFeedsSugar(true, 1.4, 0, icd)).toBe(false);
    expect(tailwindFeedsSugar(true, 1.5, 0, icd)).toBe(true);
  });
});

/** Fresh run parked in the shop; the toaster sits at (1,1)-(2,1) in the 4x4 cart. */
const shopRun = (): RunState => { const s = createRun(3); s.phase = 'shop'; return s; };
const dough = (s: RunState, x: number, y: number, extra: Partial<ItemInstance> = {}): ItemInstance => {
  const i: ItemInstance = { uid: `d${s.nextUid++}`, type: 'sourdough', x, y, rot: 0, ...extra };
  s.inventory.placed.push(i);
  return i;
};

describe('Sourdough Starter', () => {
  it('has a footprint per tier: 1 cell, 2 in a row, then an L of 3', () => {
    expect(cellsFor('sourdough', 1)).toEqual([{ x: 0, y: 0 }]);
    expect(cellsFor('sourdough', 2)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(cellsFor('sourdough', 3)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(cellsFor('toaster', 3)).toBe(ITEMS.toaster.cells);
    const d: ItemInstance = { uid: 'x', type: 'sourdough', x: 2, y: 2, rot: 0, tier: 3 };
    expect(footprint(d).map((c) => `${c.x},${c.y}`).sort()).toEqual(['2,2', '2,3', '3,2']);
  });

  it('grows a star every 2 aisles when there is room', () => {
    const s = shopRun(), rng = mulberry32(1), d = dough(s, 0, 2);
    openShop(s, rng);
    expect(d.tier ?? 1).toBe(1);
    openShop(s, rng);
    expect(d.tier).toBe(2);
    expect(s.shop!.riseWait).toBe(false);
    openShop(s, rng); openShop(s, rng);
    expect(d.tier).toBe(3);
    for (let i = 0; i < 6; i++) openShop(s, rng);
    expect(d.tier).toBe(3); // capped
  });

  it('stays pending (counter kept, toast flag set) while blocked, then rises once there is room', () => {
    const s = shopRun(), rng = mulberry32(1), d = dough(s, 0, 2);
    s.inventory.placed.push({ uid: 'wall', type: 'battery', x: 1, y: 2, rot: 0 });
    openShop(s, rng); openShop(s, rng);
    expect(d.tier ?? 1).toBe(1);
    expect(d.rise).toBe(SOURDOUGH.every);
    expect(s.shop!.riseWait).toBe(true);
    openShop(s, rng);
    expect(d.tier ?? 1).toBe(1);
    expect(s.shop!.riseWait).toBe(true);
    s.inventory.placed = s.inventory.placed.filter((p) => p.uid !== 'wall');
    openShop(s, rng);
    expect(d.tier).toBe(2);
    expect(s.shop!.riseWait).toBe(false);
  });

  it('always grows on the shelf', () => {
    const s = shopRun(), rng = mulberry32(1);
    const d: ItemInstance = { uid: 'sh', type: 'sourdough', x: 0, y: 0, rot: 0 };
    s.inventory.shelf[0] = d;
    openShop(s, rng); openShop(s, rng);
    expect(d.tier).toBe(2);
  });

  it('merges like any item and the shape follows the tier (blocked merges are refused)', () => {
    const s = shopRun();
    const a = dough(s, 0, 2), b = dough(s, 0, 3);
    expect(mergeItems(s, b.uid, a.uid).ok).toBe(true);
    expect(a.tier).toBe(2);
    expect(s.inventory.placed.includes(b)).toBe(false);
    expect(footprint(a)).toHaveLength(2);

    const s2 = shopRun();
    const c = dough(s2, 0, 2, { tier: 2 }), e = dough(s2, 2, 2, { tier: 2 });
    s2.inventory.placed.push({ uid: 'blk', type: 'battery', x: 0, y: 3, rot: 0 }); // the L's third cell
    expect(mergeItems(s2, e.uid, c.uid).ok).toBe(false);
    expect(c.tier).toBe(2);
    expect(s2.inventory.placed.includes(e)).toBe(true);
    // Coin upgrade has the same room rule.
    s2.money = 99;
    expect(upgradeItem(s2, c.uid).ok).toBe(false);
    expect(s2.money).toBe(99);
  });

  it('placing uses the tier shape', () => {
    const s = shopRun();
    const d: ItemInstance = { uid: 'sh', type: 'sourdough', x: 0, y: 0, rot: 0, tier: 3 };
    s.inventory.shelf[0] = d;
    expect(moveItem(s, 'sh', { where: 'grid', x: 3, y: 3, rot: 0 }).ok).toBe(false); // L sticks out of the 4x4 cart
    expect(moveItem(s, 'sh', { where: 'grid', x: 0, y: 2, rot: 0 }).ok).toBe(true);
  });

  it('gives touching weapons +6% damage per star (and nothing to far ones)', () => {
    const dmg = (extra: [ItemTypeId, number, number, Partial<ItemInstance>?][]) => computeBuild(inv([['vacuum', 1, 1], ...extra])).weapons[0].damage;
    const ctrl = dmg([['magnet', 3, 1]]); // same bundle count, no damage effect
    for (const tier of [1, 2, 3]) {
      expect(dmg([['sourdough', 3, 1, { tier }]]) / ctrl).toBeCloseTo(1 + 0.06 * tier);
    }
    expect(dmg([['sourdough', 4, 3]])).toBeCloseTo(dmg([]));
    expect(tierScaling('sourdough')[0].values).toEqual(['+6%', '+12%', '+18%']);
  });
});
