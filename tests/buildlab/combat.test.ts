import { describe, expect, it } from 'vitest';
import { PROXY, playAisle } from '../../src/buildlab/combat';
import { Enemy, Item } from '../../src/engine/ids';
import { mulberry32 } from '../../src/systems/rng';
import { bareToaster, stateWith, strongCart } from './helpers';

// The combat proxy: a stronger cart clears a fixed aisle faster, a cart with no weapon takes damage and dies, Weaken lowers the damage taken.

const flow = () => mulberry32(1);
const MILK = [{ id: Enemy.milk, count: 14 }];

describe('combat proxy', () => {
  it('a stronger build clears a fixed aisle faster than the bare starter', () => {
    const bare = playAisle(stateWith(bareToaster()), flow(), { mode: 'clear', only: MILK });
    const strong = playAisle(stateWith(strongCart()), flow(), { mode: 'clear', only: MILK });
    expect(strong.cleared).toBe(true);
    expect(strong.dps).toBeGreaterThan(bare.dps * 2);
    expect(bare.cleared ? bare.clearTime! : Infinity).toBeGreaterThan(strong.clearTime!);
  });

  it('a cart with no weapon deals nothing, takes damage and dies', () => {
    const s = stateWith([{ type: Item.bell }], { aisle: 6 }); // a passive: no weapon in the cart
    expect(s.build.weapons).toHaveLength(0);
    const r = playAisle(s, flow(), { mode: 'clear', only: [{ id: Enemy.soda, count: 16 }] });
    expect(r.dealt).toBe(0);
    expect(r.damageTaken).toBeGreaterThan(0);
    expect(r.died).toBe(true);
    expect(s.hp).toBe(0);
    expect(s.phase).toBe('defeat');
  });

  it('Weaken lowers the damage the enemies deal', () => {
    let plain = 0, weak = 0;
    for (const seed of [1, 2, 3, 4]) {
      for (const [w, add] of [[0, (n: number) => (plain += n)], [0.5, (n: number) => (weak += n)]] as const) {
        const s = stateWith([{ type: Item.bell }], { aisle: 5, seed, hp: 5000 }); // huge HP: both runs see the same hits
        add(playAisle(s, flow(), { only: [{ id: Enemy.soda, count: 12 }], weaken: w || undefined, mode: 'clear' }).damageTaken);
      }
    }
    expect(plain).toBeGreaterThan(0);
    expect(weak).toBeLessThan(plain);
  });

  it('is deterministic and records coins, kills and the damage breakdown', () => {
    const a = playAisle(stateWith(strongCart()), flow(), { mode: 'clear', only: MILK });
    const b = playAisle(stateWith(strongCart()), flow(), { mode: 'clear', only: MILK });
    expect(b).toEqual(a);
    expect(a.kills).toBe(14);
    expect(a.coins).toBeGreaterThan(0);
    expect(Object.keys(a.damage.bySource)).toContain('toaster');
    expect(a.damage.byType).toBeDefined();
  });

  it('plays the real plan: aisle 4 has the mini-boss, aisle 8 the Manager', () => {
    const mini = playAisle(stateWith(strongCart(), { aisle: 4 }), flow());
    expect(mini.kind).toBe('mini');
    expect(mini.miniDefeated).toBe(true);
    const boss = playAisle(stateWith(strongCart(), { aisle: 8 }), flow());
    expect(boss.kind).toBe('boss');
    expect(boss.seconds).toBeLessThanOrEqual(PROXY.bossCap);
  });
});
