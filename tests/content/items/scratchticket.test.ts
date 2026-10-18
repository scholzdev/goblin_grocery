import { describe, expect, it } from 'vitest';
import { combatRng } from '../../../src/systems/rng';
import { arena, at, far } from '../helpers';

const start = (seed: number, aisle = 1, tier = 1, hp = 40) => {
  const a = arena([at('toaster'), far('scratchticket', tier)], { seed, aisle, hp, maxHp: 40 });
  a.fake.hooks.emit('onAisleStart', { aisle, boss: false, department: 'main', modifier: 'none' });
  return a.fake;
};
const wins = (seed: number, aisle = 1) => start(seed, aisle).run.money > 0;

describe('Scratch Ticket', () => {
  it('rolls one draw of the seeded combat rng: below 0.2 wins 30 coins, otherwise loses 4 HP', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const win = combatRng(seed, 1)() < 0.2, fake = start(seed);
      if (win) expect([fake.run.money, fake.run.hp]).toEqual([30, 40]);
      else expect([fake.run.money, fake.run.hp]).toEqual([0, 36]);
    }
  });

  it('is deterministic for a seed and aisle', () => {
    expect(wins(7, 3)).toBe(wins(7, 3));
  });

  it('wins about 1 in 5 over many seeds (expected +6 coins, -3.2 HP)', () => {
    let w = 0, coins = 0, hp = 0;
    const n = 3000;
    for (let seed = 1; seed <= n; seed++) { const f = start(seed); if (f.run.money > 0) w++; coins += f.run.money; hp += 40 - f.run.hp; }
    expect(w / n).toBeGreaterThan(0.17);
    expect(w / n).toBeLessThan(0.23);
    expect(coins / n).toBeGreaterThan(5);
    expect(coins / n).toBeLessThan(7);
    expect(hp / n).toBeGreaterThan(3);
    expect(hp / n).toBeLessThan(3.5);
  });

  it('scales the win with the ★ (30 / 45 / 60) but not the odds or the loss', () => {
    const seed = [...Array(200).keys()].map((i) => i + 1).find((s) => combatRng(s, 1)() < 0.2)!;
    expect([1, 2, 3].map((t) => start(seed, 1, t).run.money)).toEqual([30, 45, 60]);
  });

  it('the loss is 10% of max HP and can never kill', () => {
    const lose = [...Array(200).keys()].map((i) => i + 1).find((s) => combatRng(s, 1)() >= 0.2)!;
    expect(start(lose, 1, 1, 3).run.hp).toBe(1);
    expect(start(lose, 1, 1, 1).run.hp).toBe(1);
    expect(start(lose, 1, 1, 1).player.dead).toBe(false);
  });

  it('does nothing without the item', () => {
    const a = arena([at('toaster')], { seed: 1, aisle: 1, hp: 40, maxHp: 40 });
    a.fake.hooks.emit('onAisleStart', { aisle: 1, boss: false, department: 'main', modifier: 'none' });
    expect([a.fake.run.money, a.fake.run.hp]).toEqual([0, 40]);
  });
});
