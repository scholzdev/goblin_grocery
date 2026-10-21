import { describe, expect, it } from 'vitest';
import { canPlace } from '../src/systems/inventory';
import { computeBuild } from '../src/systems/synergies';
import { rollOffers } from '../src/systems/shop';
import { mulberry32 } from '../src/systems/rng';
import { applyStock } from '../src/systems/stock';
import { STARTING_ITEMS } from '../src/data/unlocks';
import { ITEMS, PLAYER, STARTER_WEAPONS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { createRun } from '../src/state/run';
import type { ItemInstance, ItemTypeId, StarterWeapon } from '../src/types';

const weapons = Object.keys(STARTER_WEAPONS) as StarterWeapon[];
const chars = Object.keys(PLAYER.starters) as (keyof typeof PLAYER.starters)[];

const cellsOf = (i: { type: ItemTypeId; x: number; y: number }): [number, number][] => ITEMS[i.type].cells.map((c) => [i.x + c.x, i.y + c.y]);
const touching = (a: { type: ItemTypeId; x: number; y: number }, b: { type: ItemTypeId; x: number; y: number }): boolean =>
  cellsOf(a).some(([ax, ay]) => cellsOf(b).some(([bx, by]) => Math.abs(ax - bx) + Math.abs(ay - by) === 1));

describe('starter weapons x characters', () => {
  it('offers toaster, pan, nailgun and tomato', () => {
    expect(weapons).toEqual(['toaster', 'pan', 'nailgun', 'tomato']);
  });
  for (const weapon of weapons) {
    for (const ch of chars) {
      it(`${ch} + ${weapon}: valid run, weapon once, shop 1 has the openers`, () => {
        const s = createRun(7, ch, 0, weapon);
        expect(s.weapon).toBe(weapon);
        expect(s.inventory.placed.filter((p) => p.type === weapon)).toHaveLength(1);
        expect(s.inventory.placed).toHaveLength(1);
        const p = s.inventory.placed[0];
        expect(canPlace({ ...s.inventory, placed: [] }, weapon, p.x, p.y, p.rot).ok).toBe(true);
        expect(s.build.weapons).toHaveLength(1);
        expect(s.hp).toBe(s.build.maxHp);
        applyStock(s, STARTING_ITEMS, []);
        const types = rollOffers(s, mulberry32(3), 1).map((o) => o.type);
        // Tomato has no dedicated recipes yet; its first shop rolls freely.
        if (weapon === 'tomato') expect(s.openers).toEqual([]);
        else expect(s.openers!.length).toBeGreaterThanOrEqual(2);
        for (const t of s.openers!) expect(types).toContain(t);
      });
    }
  }
  it('nailgun start deals damage and reaches Nailstorm with both partners adjacent', () => {
    const s = createRun(1, 'toaster', 0, 'nailgun');
    expect(s.build.weapons[0].damage).toBeGreaterThan(0);
    expect(RECIPES.nailstorm.supports).toEqual(['magnet', 'battery']);
    const inv = s.inventory;
    const gun = inv.placed[0];
    let n = 0;
    for (const t of RECIPES.nailstorm.supports) {
      let spot: ItemInstance | null = null;
      for (let y = 0; y < inv.rows && !spot; y++) for (let x = 0; x < inv.cols && !spot; x++) {
        if (canPlace(inv, t, x, y, 0).ok && touching(gun, { type: t, x, y })) spot = { uid: `p${n++}`, type: t, x, y, rot: 0 };
      }
      expect(spot, t).toBeTruthy();
      inv.placed.push(spot!);
    }
    const b = computeBuild(inv, PLAYER.starters.toaster.perk);
    expect(JSON.stringify(b.recipes)).toContain('nailstorm');
  });
});
