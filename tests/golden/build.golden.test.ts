import { describe, expect, it } from 'vitest';
import { computeBuild } from '../../src/systems/synergies';
import type { SetId } from '../../src/types';
import { cart } from '../cart';
import { build, goldenCarts } from './carts';
import { stable } from './serialize';

/**
 * Golden snapshot of computeBuild over a fixed set of carts (see carts.ts).
 * A diff in __snapshots__/build.json means the build math changed. During the item-hooks refactor it must stay empty.
 */
describe('golden: computeBuild', () => {
  const carts = goldenCarts();

  it('snapshots every cart', async () => {
    const out: Record<string, unknown> = {};
    for (const c of carts) out[c.name] = computeBuild(c.inv, c.perk);
    await expect(stable(out)).toMatchFileSnapshot('./__snapshots__/build.json');
  });

  it('each set cart reaches the level its name names', () => {
    for (const c of carts.filter((x) => x.name.startsWith('set.'))) {
      const [, id, lv] = c.name.split('.');
      expect(computeBuild(c.inv, c.perk).sets[id as SetId], c.name).toBe(Number(lv.slice(1)));
    }
  });

  it('is deterministic (same inputs, same output, twice)', () => {
    for (const c of carts) expect(stable(computeBuild(c.inv, c.perk)), c.name).toBe(stable(computeBuild(c.inv, c.perk)));
  });

  it('fixture placement matches tests/cart.ts for plain carts', () => {
    expect(build([{ type: 'toaster' }, { type: 'fan', near: [0] }, { type: 'fuel', near: [0] }]).placed).toEqual(cart('toaster', ['fan', 'fuel']).placed);
  });

  it('covers a meaningful number of carts with unique names', () => {
    expect(new Set(carts.map((c) => c.name)).size).toBe(carts.length);
    expect(carts.length).toBeGreaterThan(200);
  });
});
