import { describe, expect, it } from 'vitest';
import { computeBuild } from '../src/systems/synergies';
import { contentTune } from '../src/engine/registry';
import type { Inventory, ItemTypeId } from '../src/types';

const inv = (items: [ItemTypeId, number, number, number?][]): Inventory => ({
  cols: 4, rows: 4, shelf: [],
  placed: items.map(([type, x, y, tier], i) => ({ uid: `u${i}`, type, x, y, rot: 0, tier: tier ?? 1 })),
});

describe('Fortune Cookie / Free Sample', () => {
  it('fortune cookie gives every weapon crit, anywhere in the cart, and adds to the price gun', () => {
    const far = computeBuild(inv([['toaster', 0, 0], ['fortune', 3, 3]]));
    expect(far.weapons[0].critChance).toBeCloseTo(contentTune('fortune', 1).crit);
    const both = computeBuild(inv([['toaster', 0, 0], ['pricegun', 0, 1], ['fortune', 3, 3]]));
    expect(both.weapons[0].critChance).toBeCloseTo(contentTune('pricegun', 1).crit + contentTune('fortune', 1).crit);
    expect(computeBuild(inv([['toaster', 0, 0], ['fortune', 3, 3, 3]])).weapons[0].critChance).toBeCloseTo(contentTune('fortune', 1).crit * 2);
  });

  it('piggy bank: +15% kill coins, +30% at tier 3', () => {
    expect(computeBuild(inv([['toaster', 0, 0]])).killCoinMult).toBe(1);
    expect(computeBuild(inv([['toaster', 0, 0], ['piggy', 3, 3]])).killCoinMult).toBeCloseTo(1.15);
    expect(computeBuild(inv([['toaster', 0, 0], ['piggy', 3, 3, 3]])).killCoinMult).toBeCloseTo(1.3);
  });
});
