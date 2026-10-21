import { describe, expect, it } from 'vitest';
import { setCount, setLevels } from '../src/data/sets';
import { computeBuild } from '../src/systems/synergies';
import type { ItemInstance, ItemTypeId } from '../src/types';
import { build } from './golden/carts';

let n = 0;
const copy = (type: ItemTypeId, tier = 1, double = false): ItemInstance => ({ uid: `p${n++}`, type, x: 3 * n, y: 0, rot: 0, tier, ...(double ? { double } : {}) });

describe('set points: each item type adds its tier (+1 double pack)', () => {
  it('a ★2 and a ★2 Kitchen item make 4 points (level 2); a ★2 and a ★1 make 3, both at ★1 make 2 (level 1)', () => {
    const two = [copy('sample', 2), copy('hotsauce', 2)];
    expect(setCount(two, 'kitchen'), '★2 sample + ★2 hot sauce').toBe(4);
    expect(setLevels(two).kitchen).toBe(2);
    const mixed = [copy('sample', 2), copy('hotsauce', 1)];
    expect(setCount(mixed, 'kitchen'), '★2 sample + ★1 hot sauce').toBe(3);
    expect(setLevels(mixed).kitchen).toBe(1);
    const plain = [copy('sample', 1), copy('hotsauce', 1)];
    expect(setCount(plain, 'kitchen'), '★1 sample + ★1 hot sauce').toBe(2);
    expect(setLevels(plain).kitchen).toBe(1);
  });

  it('copies of one type count once, at the largest weight', () => {
    expect(setCount([copy('sample', 1), copy('sample', 3)], 'kitchen')).toBe(3);
    expect(setCount([copy('sample', 2), copy('sample', 1, true)], 'kitchen'), '★2 beats a ★1 double pack (2)').toBe(2);
    expect(setCount([copy('sample', 2, true), copy('sample', 3)], 'kitchen'), '★2 double pack (3) ties ★3').toBe(3);
  });

  it('a double pack adds one point to every set of the item', () => {
    expect(setCount([copy('sample', 1, true)], 'kitchen'), '★1 double').toBe(2);
    expect(setCount([copy('sample', 2, true)], 'kitchen'), '★2 double').toBe(3);
    const ice = [copy('ice', 1, true)];
    expect([setCount(ice, 'kitchen'), setCount(ice, 'frost')], 'ice is kitchen + frost').toEqual([2, 2]);
  });

  it('a ★3 module lifted to ★4 by a Gold Star counts 4; the star itself and weapons are not lifted', () => {
    const inv = build([{ type: 'fan', tier: 3 }, { type: 'goldstar' }]);
    expect(setCount(inv.placed, 'cleaning'), 'fan ★3 touching a Gold Star').toBe(4);
    expect(setCount(inv.placed, 'checkout'), 'the Gold Star is a legendary ★1').toBe(1);
    expect(computeBuild(inv).sets.cleaning, 'the build reads the same count: 4 points').toBe(2);
    expect(setCount(build([{ type: 'toaster', tier: 3 }, { type: 'goldstar' }]).placed, 'kitchen'), 'weapons are never lifted').toBe(3);
  });
});
