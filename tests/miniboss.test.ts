import { describe, expect, it } from 'vitest';
import { MINI_BOSS, ENEMIES } from '../src/data/enemies';
import { THEMES } from '../src/data/departments';
import { BOSS_WAVE } from '../src/data/waves';
import { ITEMS } from '../src/data/items';
import { createRun } from '../src/state/run';
import { rollMiniCrates } from '../src/systems/shop';
import { mulberry32 } from '../src/systems/rng';

describe('mid-shift boss', () => {
  it('sits before the final boss and has a giant for every theme', () => {
    expect(MINI_BOSS.aisle).toBeGreaterThan(1);
    expect(MINI_BOSS.aisle).toBeLessThan(BOSS_WAVE);
    for (const th of THEMES) {
      const id = MINI_BOSS.byTheme[th];
      expect(id, th).toBeDefined();
      expect(ENEMIES[id!], th).toBeDefined();
      expect(ENEMIES[id!].behavior).not.toBe('boss');
    }
  });

  it('crates: 3 free distinct items, one unowned legendary when unlocked, weapons otherwise', () => {
    const s = createRun(1);
    s.unlocked = undefined; // everything unlocked
    const offers = rollMiniCrates(s, mulberry32(7));
    expect(offers).toHaveLength(MINI_BOSS.crates);
    expect(new Set(offers.map((o) => o.type)).size).toBe(offers.length);
    expect(offers.every((o) => o.price === 0)).toBe(true);
    expect(offers.filter((o) => ITEMS[o.type].legendary)).toHaveLength(1);
    for (const o of offers.filter((o) => !ITEMS[o.type].legendary)) {
      expect(ITEMS[o.type].kind).toBe('weapon');
      expect(o.tier).toBe(MINI_BOSS.weaponTier);
    }
    s.unlocked = ['toaster', 'pan', 'nailgun', 'vacuum'];
    const locked = rollMiniCrates(s, mulberry32(7));
    expect(locked.some((o) => ITEMS[o.type].legendary)).toBe(false);
    expect(locked).toHaveLength(3);
  });
});
