import { describe, expect, it } from 'vitest';
import { simRegistry } from '../../src/sims/_registry';
import { simDummies, type SimDef } from '../../src/sims/_sim';
import { createSimRun } from '../../src/state/sim';
import { REACTIONS } from '../../src/engine/define';
import { FakeCtx } from '../../src/engine/fakeCtx';
import { buildHooks } from '../../src/engine/hooks';
import { FakeArsenal } from '../../src/engine/patterns/fakeHost';
import type { EnemyId } from '../../src/types';

// The reaction sims (docs/sims.md): each is registered and valid, its notes quote the real constants, and its cart really sets its reaction off against its enemies.

const sim = (id: string): SimDef => simRegistry.get(id)!;
const IDS = ['reaction-shatter', 'reaction-fumes', 'reaction-conduct', 'reaction-crack'];

/**
 * The sim's cart run headless for `seconds` against `n` still enemies of `enemy` in a bunch in front of the goblin. The FakeArsenal does not fly the Toaster's
 * toasts (sprites never move), so `volley` lands one toast of the cart's first `volley` weapon on every enemy each half second instead.
 */
function play(id: string, enemy: EnemyId, n: number, seconds: number, volley?: 'toaster') {
  const run = createSimRun(sim(id));
  const fake = new FakeCtx({ build: run.build });
  fake.attach(buildHooks(run.inventory, run.build.recipes, run.build.sets, fake));
  const a = new FakeArsenal(fake, run.build);
  a.applyLooks();
  for (let i = 0; i < n; i++) fake.spawnReal(enemy, { hp: 4000, x: 120 + (i % 3) * 36, y: -36 + Math.floor(i / 3) * 36 });
  const toast = run.build.weapons.find((w) => w.type === volley);
  for (let i = 0; i < Math.round(seconds / 0.05); i++) {
    a.step(0.05);
    if (toast && i % 10 === 0) for (const e of [...fake.enemies]) fake.hit(e, toast.damage, toast);
  }
  return { fake, run };
}

describe('reaction sims', () => {
  it('are registered and valid, with notes and dummies', () => {
    for (const id of IDS) {
      expect(sim(id), id).toBeDefined();
      expect(simRegistry.problemsOf(id), id).toEqual([]);
      expect(sim(id).notes, id).toBeTruthy();
      expect(simDummies(sim(id)).length, id).toBeGreaterThan(0);
    }
  });

  it('the notes quote the constants', () => {
    expect(sim('reaction-shatter').notes).toContain(`${REACTIONS.shatter.flat} + half`);
    expect(sim('reaction-fumes').notes).toContain(`radius ${REACTIONS.fumes.radius}, ${REACTIONS.fumes.duration} s`);
    expect(sim('reaction-conduct').notes).toContain(`${REACTIONS.conduct.hops} nearest baguettes (${REACTIONS.conduct.share * 100}%`);
    expect(sim('reaction-conduct').notes).toContain('x1.2');
    expect(sim('reaction-crack').notes).toContain(`${REACTIONS.crack.targets} nearest others within ${REACTIONS.crack.radius} px`);
    for (const id of ['reaction-shatter', 'reaction-conduct', 'reaction-crack']) expect(sim(id).notes, id).toContain('teal');
    expect(sim('reaction-fumes').notes).toContain('green cloud');
  });

  it('reaction-shatter: the Toaster burns and slows, and shatters the milk', () => {
    const { run, fake } = play('reaction-shatter', 'milk', 6, 4, 'toaster');
    const toaster = run.build.weapons.find((w) => w.type === 'toaster')!;
    expect(toaster.burn).toBeTruthy();
    expect(toaster.slow).toBeTruthy();
    expect(fake.dmgLog.damage.reactions.shatter).toBeGreaterThan(0);
    expect(fake.dmgLog.damage.byType.reaction).toBeGreaterThan(0);
  });

  it('reaction-fumes: the Toaster burns, the Expired Milk aura poisons, the cloud spreads it', () => {
    const run = createSimRun(sim('reaction-fumes'));
    expect(run.build.weapons.find((w) => w.type === 'toaster')!.burn).toBeTruthy();
    expect(run.inventory.placed.map((i) => i.type)).toContain('expiredmilk');
    const { fake } = play('reaction-fumes', 'milk', 8, 5, 'toaster');
    expect(fake.dmgLog.damage.reactions.fumes).toBeGreaterThan(0);
  });

  it('reaction-conduct: the Spray soaks, the Laser beam is electric', () => {
    const { run, fake } = play('reaction-conduct', 'baguette', 9, 5);
    expect(run.build.weapons.map((w) => w.type)).toEqual(expect.arrayContaining(['spray', 'laser']));
    expect(fake.dmgLog.damage.reactions.conduct).toBeGreaterThan(0);
  });

  it('reaction-crack: the Cooker\'s blasts and the Can Opener stack the Shred, then crack', () => {
    const run = createSimRun(sim('reaction-crack'));
    expect(run.inventory.placed.map((i) => i.type)).toEqual(expect.arrayContaining(['cooker', 'canopener', 'popper']));
    expect(simDummies(sim('reaction-crack')).every((d) => !d.immortal)).toBe(true);
    const { fake } = play('reaction-crack', 'beans', 9, 8);
    expect(fake.dmgLog.damage.reactions.crack).toBeGreaterThan(0);
  });
});
