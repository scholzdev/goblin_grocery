import { describe, expect, it } from 'vitest';
import { simRegistry } from '../../src/sims/_registry';
import { simDummies, type SimDef } from '../../src/sims/_sim';
import { createSimRun } from '../../src/state/sim';
import { ENEMIES, affixArmor } from '../../src/data/enemies';
import { affinityMult } from '../../src/engine/affinity';
import { weaponTags } from '../../src/engine/hitTags';
import { SHRED } from '../../src/engine/define';
import { contentSetTune } from '../../src/engine/registry';
import { shreddedArmorDamage } from '../../src/systems/combat';

// The Shred sims (docs/sims.md): each is registered, valid, and the numbers its notes quote are what the real build and armor rule give.

const sim = (id: string): SimDef => simRegistry.get(id)!;
const one = (n: number) => n.toFixed(1);

describe('shred sims', () => {
  it('are registered and valid', () => {
    for (const id of ['shred-basic', 'shred-blast', 'shred-tools-dash', 'combo-crack-open', 'elite-plated']) {
      expect(sim(id), id).toBeDefined();
      expect(simRegistry.problemsOf(id), id).toEqual([]);
      expect(sim(id).notes, id).toBeTruthy();
      expect(simDummies(sim(id)).length, id).toBeGreaterThan(0);
    }
  });

  it('shred-basic: the notes\' toast, beans and milk numbers come from the build and the armor rule', () => {
    const s = sim('shred-basic'), run = createSimRun(s);
    expect(s.cart.map((c) => [c.id, c.tier])).toEqual([['toaster', 1], ['canopener', 3]]);
    const w = run.build.weapons[0], dmg = w.damage; // 9 plus the bundle bonus of the touching Can Opener
    expect(w.type).toBe('toaster');
    expect(one(dmg)).toBe('9.5');
    expect([0, 1, 2, 3].map((k) => one(shreddedArmorDamage(dmg, ENEMIES.beans.armor!, k)))).toEqual(['6.5', '7.5', '8.5', '9.5']);
    expect([1, 2, 3].map((k) => one(shreddedArmorDamage(dmg, 0, k)))).toEqual(['10.5', '11.5', '12.5']);
    for (const id of ['beans', 'milk'] as const) expect(affinityMult(ENEMIES[id], weaponTags('toaster')), id).toBe(1); // no element swings the numbers
    for (const n of ['6.5', '7.5', '8.5', '9.5', '10.5', '11.5', '12.5']) expect(s.notes).toContain(n);
    expect(simDummies(s).map((d) => d.id).sort()).toEqual(['beans', 'beans', 'beans', 'beans', 'milk', 'milk', 'milk', 'milk']);
  });

  it('shred-blast: a Pressure Cooker blast (16) on beans and on a banana, one stack per blast', () => {
    const s = sim('shred-blast'), w = createSimRun(s).build.weapons[0];
    expect(w.pattern).toBe('mortar');
    expect(w.damage).toBe(16);
    const tags = [...weaponTags('cooker'), 'blast'] as never;
    for (const id of ['beans', 'banana'] as const) expect(affinityMult(ENEMIES[id], tags), id).toBe(1);
    expect([0, 1, 2, 3].map((k) => shreddedArmorDamage(16, 3, k))).toEqual([13, 14, 15, 16]);
    expect([0, 1, 2, 3].map((k) => shreddedArmorDamage(16, 0, k))).toEqual([16, 17, 18, 19]);
    expect(s.notes).toContain('13, then 14, 15, 16');
    expect(s.notes).toContain('16, 17, 18, 19');
    expect(simDummies(s).every((d) => d.still)).toBe(true);
  });

  it('shred-tools-dash: Tools L3, whose dash leaves the cap', () => {
    const run = createSimRun(sim('shred-tools-dash'));
    expect(run.build.sets.tools).toBe(3);
    expect(contentSetTune('tools', 3).shredStacks).toBe(SHRED.cap);
    expect(simDummies(sim('shred-tools-dash')).every((d) => d.id === 'beans')).toBe(true);
  });

  it('combo-crack-open: the nail gun touches the Can Opener, so the combo is active, on armored beans', () => {
    const run = createSimRun(sim('combo-crack-open'));
    expect(run.build.recipes.map((r) => r.id)).toEqual(['crackOpen']);
    expect(simDummies(sim('combo-crack-open')).every((d) => d.id === 'beans')).toBe(true);
  });

  it('elite-plated: plated milk (armor 3) and plated beans (armor 6) next to plain beans, as the notes say', () => {
    const s = sim('elite-plated'), dmg = createSimRun(s).build.weapons[0].damage;
    expect(dmg).toBe(9);
    expect(affixArmor(ENEMIES.milk.armor, 'plated')).toBe(3);
    expect(affixArmor(ENEMIES.beans.armor, 'plated')).toBe(6);
    expect([3, 6, 3].map((a) => shreddedArmorDamage(dmg, a, 0))).toEqual([6, 3, 6]); // plated milk, plated beans, plain beans
    expect(simDummies(s).map((d) => `${d.id}:${d.affix ?? 'plain'}`).sort()).toEqual(['beans:plain', 'beans:plain', 'beans:plated', 'beans:plated', 'milk:plated', 'milk:plated']);
    for (const t of ['armor 3', 'so 6 per toast', 'so 3 per toast', 'Plain beans: 6']) expect(s.notes).toContain(t);
  });
});
