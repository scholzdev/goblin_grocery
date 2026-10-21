import { describe, expect, it } from 'vitest';
import { PROXY, playAisle } from '../../src/buildlab/combat';
import { Combo, Enemy, Item } from '../../src/engine/ids';
import { mulberry32 } from '../../src/systems/rng';
import { rollPunchCard } from '../../src/systems/contracts';
import { waveSpawnPlan } from '../../src/systems/shop';
import { t } from '../../src/i18n';
import type { RecipeId } from '../../src/types';
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

describe('combat proxy: effects that combo hooks spawn', () => {
  // Neither side can die within the aisle, so a run with the combo and one without it last equally long and differ only by the combo's damage.
  const ENDLESS = [{ id: Enemy.milk, count: 14, hpScale: 1000 }];
  const cart = (specs: Parameters<typeof stateWith>[0], combo: RecipeId, keep = true) => {
    const s = stateWith(specs, { hp: 5000 });
    expect(s.build.recipes.map((r) => r.id), `the cart forms ${combo}`).toContain(combo);
    if (!keep) s.build.recipes = s.build.recipes.filter((r) => r.id !== combo);
    return s;
  };

  it('Ray Gun: the bolts that replace the nails fly and hit', () => {
    const s = cart([{ type: Item.nailgun }, { type: Item.battery }, { type: Item.tinfoilhat }, { type: Item.magnet }], Combo.rayGun);
    const r = playAisle(s, flow(), { mode: 'clear', only: MILK });
    expect(r.damage.bySource.nailgun ?? 0, 'Nail Gun damage').toBeGreaterThan(0);
  });

  it('Reheat: the fire pools a zap leaves burn the enemies in them', () => {
    const burn = (keep: boolean) => playAisle(cart([{ type: Item.microwave }, { type: Item.fuel }], Combo.reheat, keep), flow(), { mode: 'clear', only: ENDLESS }).damage.bySource.burn ?? 0;
    expect(burn(true), 'burn damage with Reheat vs the same cart without it').toBeGreaterThan(burn(false));
  });

  it('Shrapnel: the fragments of an explosion hit enemies', () => {
    const cooker = (keep: boolean) => playAisle(cart([{ type: Item.cooker }, { type: Item.tape }], Combo.shrapnel, keep), flow(), { mode: 'clear', only: ENDLESS }).damage.bySource.cooker ?? 0;
    expect(cooker(true), 'Pressure Cooker damage with Shrapnel vs the same cart without it').toBeGreaterThan(cooker(false));
  });
});

describe('combat proxy: Punch Card', () => {
  it('rolls the aisle goal, counts the credited kills and pays a met goal', () => {
    let paid = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = stateWith([...strongCart(), { type: Item.punchcard, near: [] }], { seed, aisle: 2 });
      const card = rollPunchCard(s.seed, s.inventory, { aisle: 2, boss: false, total: waveSpawnPlan(s).total, fight: true })!;
      const r = playAisle(s, mulberry32(seed));
      expect(s.punch, `seed ${seed}: the aisle's card`).toMatchObject({ goal: card.goal, target: card.target });
      if (card.goal === 'any') expect(s.punch!.progress, `seed ${seed}: every credited kill counts`).toBe(Math.min(card.target, r.kills));
      const coins = s.coinLog.find((c) => c.label === t('coinPunchCard'))?.amount ?? 0;
      expect(coins, `seed ${seed}: paid exactly for a met goal`).toBe(s.punch!.status === 'done' ? card.coins : 0);
      if (coins) paid++;
    }
    expect(paid, 'some seed meets its goal').toBeGreaterThan(0);
  });
});
