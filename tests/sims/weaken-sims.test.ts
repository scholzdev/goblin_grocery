import { describe, expect, it } from 'vitest';
import { simRegistry } from '../../src/sims/_registry';
import { simDummies, type SimDef } from '../../src/sims/_sim';
import { createSimRun } from '../../src/state/sim';
import { ENEMIES } from '../../src/data/enemies';
import { affinityMult } from '../../src/engine/affinity';
import { weaponTags } from '../../src/engine/hitTags';
import { contentTune } from '../../src/engine/registry';
import { applyWeaken, armorDamage, newStatus, weakenedDamage } from '../../src/systems/combat';

// The Weaken sims and the armor sim (docs/sims.md): each is registered, valid, and the numbers its notes quote are what the real build and the rules give.

const sim = (id: string): SimDef => simRegistry.get(id)!;
const weakened = (id: 'milk' | 'baguette' | 'spitter', pct: number, field: 'contactDamage' | 'attackDamage') => {
  const e = { status: newStatus() };
  applyWeaken(e.status, pct, 3, 0);
  return weakenedDamage(e, ENEMIES[id][field], 0);
};

describe('weaken and armor sims', () => {
  it('are registered and valid, with notes and dummies', () => {
    for (const id of ['weaken-decaf', 'weaken-cleaning', 'armor-turkey']) {
      expect(sim(id), id).toBeDefined();
      expect(simRegistry.problemsOf(id), id).toEqual([]);
      expect(sim(id).notes, id).toBeTruthy();
      expect(simDummies(sim(id)).length, id).toBeGreaterThan(0);
    }
  });

  it('weaken-decaf: Decaf ★3 touches the toaster; you can be hurt; the notes\' contact, swipe and bubble numbers are the weakened ones', () => {
    const s = sim('weaken-decaf'), run = createSimRun(s);
    expect(s.cart.map((c) => [c.id, c.tier])).toEqual([['toaster', 1], ['decaf', 3]]);
    expect(run.build.weapons[0].bundle).toBe(1); // the Decaf touches the toaster
    expect(s.god).toBe(false);
    const pct = contentTune('decaf', 3).pct;
    expect(pct).toBe(0.25);
    expect(weakened('milk', pct, 'contactDamage')).toBe(3); // 4
    expect(weakened('baguette', pct, 'contactDamage')).toBe(4); // 5
    expect(weakened('baguette', pct, 'attackDamage')).toBe(5); // the swipe, 7
    expect(weakened('spitter', pct, 'attackDamage')).toBe(4); // a bubble, 5
    expect([ENEMIES.milk.contactDamage, ENEMIES.baguette.contactDamage, ENEMIES.baguette.attackDamage, ENEMIES.spitter.attackDamage]).toEqual([4, 5, 7, 5]);
    for (const t of ['Sour Milk 4 becomes 3', 'Baguette 5 becomes 4', '7 becomes 5', '5 becomes 4', '25%', '3 s']) expect(s.notes, t).toContain(t);
    expect(simDummies(s).map((d) => d.id).sort()).toEqual(['baguette', 'milk', 'milk', 'milk', 'spitter']);
    expect(simDummies(s).every((d) => d.immortal)).toBe(true); // they keep attacking
  });

  it('weaken-cleaning: three cleaning types (4 points with the ★2 fan) make Cleaning L2, 20% for 2 s; the cones fire inside the 2 s the notes name', () => {
    const s = sim('weaken-cleaning'), run = createSimRun(s);
    expect(run.build.sets.cleaning).toBe(2);
    expect(s.god).toBe(false);
    const [spray, leaf] = ['spray', 'leafblower'].map((id) => run.build.weapons.find((w) => w.type === id)!);
    expect(spray.cooldown).toBeCloseTo(0.55, 9);
    expect(leaf.cooldown).toBeCloseTo(0.9, 9);
    expect(Math.max(spray.cooldown, leaf.cooldown)).toBeLessThan(2); // each hit refreshes before the weaken ends
    expect(weakened('milk', 0.2, 'contactDamage')).toBe(3);
    expect(weakened('baguette', 0.2, 'contactDamage')).toBe(4);
    for (const t of ['20% for 2 s', '0.55 s', '0.9 s', 'Sour Milk 4 becomes 3', 'Baguette 5 becomes 4']) expect(s.notes, t).toContain(t);
  });

  it('armor-turkey: a Nail Gun ★3 nail is 6 on a banana and 4 on the armored turkey (no element swings either)', () => {
    const s = sim('armor-turkey'), w = createSimRun(s).build.weapons[0];
    expect(w.type).toBe('nailgun');
    expect(w.damage).toBe(6);
    for (const id of ['turkey', 'banana'] as const) expect(affinityMult(ENEMIES[id], weaponTags('nailgun')), id).toBe(1);
    expect(ENEMIES.turkey.armor).toBe(2);
    expect(armorDamage(w.damage, ENEMIES.turkey.armor!)).toBe(4);
    expect(ENEMIES.banana.armor).toBeUndefined();
    for (const t of ['6 per nail', 'Banana Bandit', 'Frozen Turkey (150 HP, armor 2): 4 per nail']) expect(s.notes, t).toContain(t);
    expect(s.notes).toContain(`${ENEMIES.turkey.hp} HP`);
    expect(simDummies(s).every((d) => d.still)).toBe(true);
  });

  it('the enemy and boss sims name the new armor next to their HP', () => {
    expect(sim('enemy-turkey').notes).toContain('Armor 2');
    expect(sim('boss-frozen').notes).toContain('Armor 2');
    expect(sim('boss-checkout').notes).toContain('Armor 3');
    expect(sim('boss-frozen').notes).toContain(`${ENEMIES.boss_frozen.hp} HP`);
    expect(sim('boss-checkout').notes).toContain(`${ENEMIES.boss_checkout.hp} HP`);
  });
});
