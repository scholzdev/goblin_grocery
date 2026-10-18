import { describe, expect, it } from 'vitest';
import { layoutBossBuild } from '../src/ui/bossBuild';
import { createRun } from '../src/state/run';
import { canPlace } from '../src/systems/inventory';
import { ECONOMY } from '../src/data/waves';
import { PLAYER, STARTER_WEAPONS } from '../src/data/items';
import type { Inventory, ItemInstance, StarterId, StarterWeapon } from '../src/types';

describe('jumpToBoss layout', () => {
  for (const [cols, rows] of [[4, 4], ...ECONOMY.cartSizes]) {
    it(`every placed item passes canPlace in a ${cols}x${rows} cart`, () => {
      let n = 0;
      const { placed } = layoutBossBuild(cols, rows, () => `u${n++}`);
      expect(placed.length).toBeGreaterThan(0);
      const inv: Inventory = { cols, rows, placed: [], shelf: [] };
      for (const it of placed) {
        expect(canPlace(inv, it.type, it.x, it.y, it.rot).ok).toBe(true);
        inv.placed.push(it);
      }
    });
  }
});

describe('starter weapon placement', () => {
  for (const starter of Object.keys(PLAYER.starters) as StarterId[]) for (const weapon of Object.keys(STARTER_WEAPONS) as StarterWeapon[]) {
    it(`${starter} + ${weapon} sits inside the starting cart`, () => {
      const run = createRun(1, starter, 0, weapon);
      const w = run.inventory.placed[0] as ItemInstance;
      const empty: Inventory = { ...run.inventory, placed: [] };
      expect(canPlace(empty, w.type, w.x, w.y, w.rot).ok).toBe(true);
    });
  }
});
