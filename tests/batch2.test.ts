import { describe, expect, it } from 'vitest';
import { computeBuild } from '../src/systems/synergies';
import { createRun, labAddItem, openShop } from '../src/state/run';
import { mulberry32 } from '../src/systems/rng';
import { contentComboTune } from '../src/engine/registry';
import { cart } from './cart';
import type { Inventory, ItemInstance, ItemTypeId, ElementTag } from '../src/types';

const inv = (items: [ItemTypeId, number, number, Partial<ItemInstance>?][]): Inventory => ({
  cols: 5, rows: 4, shelf: [],
  placed: items.map(([type, x, y, extra], i) => ({ uid: `u${i}`, type, x, y, rot: 0, ...extra })),
});

describe('batch 2 weapon combos', () => {
  it.each([
    ['sparksFly', 'microwave', ['tinfoilhat', 'battery']],
    ['rayGun', 'nailgun', ['battery', 'tinfoilhat', 'magnet']],
  ] as const)('%s activates with all parts and not without one', (id, weapon, sup) => {
    expect(computeBuild(cart(weapon, [...sup])).weapons[0].recipes).toContain(id);
    for (let i = 0; i < sup.length; i++) expect(computeBuild(cart(weapon, sup.filter((_, j) => j !== i))).weapons[0].recipes).not.toContain(id);
  });

  it('Ray Gun replaces Nailstorm: no nailstorm recipe or pierce (control keeps them)', () => {
    const ray = computeBuild(cart('nailgun', ['battery', 'tinfoilhat', 'magnet']));
    expect(ray.weapons[0].recipes).not.toContain('nailstorm');
    expect(ray.recipes.map((r) => r.id)).not.toContain('nailstorm');
    expect(ray.weapons[0].pierce).toBe(0);
    const storm = computeBuild(cart('nailgun', ['battery', 'magnet'])).weapons[0];
    expect(storm.recipes).toContain('nailstorm');
    expect(storm.pierce).toBe(contentComboTune('nailstorm').extraPierce);
  });

  it('Sparks Fly adds 2 chain jumps, 3 together with TV Dinner', () => {
    expect(computeBuild(cart('microwave', [])).weapons[0].chain).toBe(0);
    expect(computeBuild(cart('microwave', ['tinfoilhat', 'battery'])).weapons[0].chain).toBe(2);
    const both = computeBuild(cart('microwave', ['tinfoilhat', 'battery', 'lunchbox'])).weapons[0];
    expect(both.recipes).toEqual(expect.arrayContaining(['sparksFly', 'tvDinner']));
    expect(both.chain).toBe(3);
  });
});

describe('Jelly Beans', () => {
  const setsFor = (other: ItemTypeId, flavor: ElementTag) => computeBuild(inv([[other, 0, 0], ['jellybeans', 3, 3, { flavor }]])).sets;
  it('count toward their current flavor set', () => {
    expect(setsFor('fuel', 'heat').heat).toBeGreaterThanOrEqual(1);
    expect(setsFor('fuel', 'frost').heat).toBe(0);
    expect(setsFor('ice', 'frost').frost).toBeGreaterThanOrEqual(1);
    expect(setsFor('ice', 'heat').frost).toBe(0);
    expect(setsFor('popper', 'blast').blast).toBeGreaterThanOrEqual(1);
    expect(setsFor('popper', 'frost').blast).toBe(0);
  });
  it('have a flavor when created and change across shop visits', () => {
    const s = createRun(7);
    s.phase = 'shop';
    expect(labAddItem(s, 'jellybeans', 1).ok).toBe(true);
    const beans = s.inventory.shelf.find((i) => i?.type === 'jellybeans')!;
    expect(['heat', 'frost', 'blast']).toContain(beans.flavor);
    const rng = mulberry32(99), seen = new Set<string>();
    for (let i = 0; i < 40; i++) { openShop(s, rng); seen.add(beans.flavor!); }
    expect(seen.size).toBeGreaterThan(1);
  });
});
