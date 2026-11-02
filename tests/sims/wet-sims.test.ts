import { describe, expect, it } from 'vitest';
import { simRegistry } from '../../src/sims/_registry';
import { simDummies, type SimDef } from '../../src/sims/_sim';
import { createSimRun } from '../../src/state/sim';
import { ENEMIES } from '../../src/data/enemies';
import { contentSetTune, contentTune } from '../../src/engine/registry';

// The Wet sims and the Sanitizer sim (docs/sims.md): each is registered and valid, and the numbers its notes quote are what the real build gives.

const sim = (id: string): SimDef => simRegistry.get(id)!;
const IDS = ['wet-electric', 'wet-frost', 'wet-steam', 'enemy-sanitizer'];

describe('wet sims', () => {
  it('are registered and valid, with notes and dummies', () => {
    for (const id of IDS) {
      expect(sim(id), id).toBeDefined();
      expect(simRegistry.problemsOf(id), id).toEqual([]);
      expect(sim(id).notes, id).toBeTruthy();
      expect(simDummies(sim(id)).length, id).toBeGreaterThan(0);
    }
  });

  it('wet-electric: the Spray Bottle is in the cart, Electric L3 with a 30% / 3 jump chain, a Blender for the electric hits', () => {
    const { build } = createSimRun(sim('wet-electric'));
    expect(build.sets.electric).toBe(3);
    const toaster = build.weapons.find((w) => w.type === 'toaster')!;
    expect([toaster.chainChance, toaster.chainJumps]).toEqual([0.3, 3]);
    expect(build.weapons.map((w) => w.type)).toContain('spray');
    expect(build.weapons.map((w) => w.type)).toContain('blender');
    for (const t of ['3 s', 'x1.2', '3 more enemies, 4']) expect(sim('wet-electric').notes, t).toContain(t);
  });

  it('wet-frost: Frost L2, an Ice Pack slow of 25 + 10 = 35% (45% on a wet enemy), freeze 10% for 0.5 s', () => {
    const s = sim('wet-frost'), { build } = createSimRun(s);
    expect(build.sets.frost).toBe(2);
    const spray = build.weapons.find((w) => w.type === 'spray')!;
    expect(spray.slow?.pct).toBeCloseTo(0.35, 12);
    expect(contentTune('ice', 1).pct).toBe(0.25);
    expect(contentSetTune('frost', 2)).toMatchObject({ slowBonus: 0.1, stunChance: 0.1, stun: 0.5 });
    expect(build.weapons.map((w) => w.type)).toContain('mop');
    for (const t of ['25% + Frost 10 = 35%', '45% on a wet enemy', '10%', '20%', '0.5 s']) expect(s.notes, t).toContain(t);
  });

  it('wet-steam: a Toaster with a Fuel Can burns 4 s (3/s), the Spray Bottle soaks', () => {
    const { build } = createSimRun(sim('wet-steam'));
    const toaster = build.weapons.find((w) => w.type === 'toaster')!;
    expect(toaster.burn).toMatchObject({ dps: 3, duration: 4 });
    expect(build.weapons.map((w) => w.type)).toContain('spray');
    expect(sim('wet-steam').notes).toContain('half as long');
  });

  it('enemy-sanitizer: a cart that burns (Fuel Can), shreds (Can Opener), poisons and soaks (Sour Mist spray); two immortal Sanitizers and a mortal crowd', () => {
    const s = sim('enemy-sanitizer'), { build } = createSimRun(s);
    expect(build.recipes.map((r) => r.id)).toContain('sourMist');
    expect(build.weapons.find((w) => w.type === 'toaster')!.burn).toBeTruthy();
    expect(s.cart.map((c) => c.id)).toContain('canopener');
    expect(s.notes).toContain(`${ENEMIES.sanitizer.hp} HP`);
    const dummies = simDummies(s);
    expect(dummies.filter((d) => d.id === 'sanitizer')).toHaveLength(2);
    expect(dummies.filter((d) => d.id === 'sanitizer').every((d) => d.immortal)).toBe(true);
    expect(dummies.filter((d) => d.id === 'milk')).toHaveLength(6);
  });
});
