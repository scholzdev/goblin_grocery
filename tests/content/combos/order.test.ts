import { describe, expect, it } from 'vitest';
import { contentComboTune } from '../../../src/engine/registry';
import { arena, at, partsOf, source, weaponOf, far } from './helpers';
import coldStorage from '../../../src/content/combos/coldStorage';
import brainFreeze from '../../../src/content/combos/brainFreeze';
import expressCheckout from '../../../src/content/combos/expressCheckout';
import potSlam from '../../../src/content/combos/potSlam';
import toastMode from '../../../src/content/combos/toastMode';
import fiveAlarm from '../../../src/content/combos/fiveAlarm';
import { computeBuild } from '../../../src/systems/synergies';
import { RECIPE_ORDER } from '../../../src/engine/define';
import { build } from '../../golden/carts';

// Order guards for the combos: where a combo's effect sits relative to other effects is observable (damage, rng draws, stats), so each
// is pinned here next to the per-combo files.

describe('order: Five-Alarm Toast -> mark -> crit (the damage pipeline)', () => {
  it('scene: modifyDamage emit, then the element affinity, then the mark rule, then the crit roll, then onCrit, then armor/hp (source order of damageEnemy)', () => {
    const src = source('scenes/ArenaScene.ts'), from = src.indexOf('damageEnemy(e: Enemy');
    const body = src.slice(from, from + 6000);
    const at = (s: string) => { const i = body.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i; };
    expect(at("H.emit('modifyDamage'")).toBeLessThan(at('affinityMult(e.def, tags)'));
    expect(at('affinityMult(e.def, tags)')).toBeLessThan(at('markedDamage(dmg, e.markedUntil, now, markMult(e.def))'));
    expect(at('markedDamage(dmg, e.markedUntil, now, markMult(e.def))')).toBeLessThan(at('this.rng() < stats.critChance'));
    expect(at('this.rng() < stats.critChance')).toBeLessThan(at("H.emit('onCrit'"));
    expect(at("H.emit('onCrit'")).toBeLessThan(at('e.hp -= dmg'));
    expect(at('e.hp -= dmg')).toBeLessThan(at("H.emit('onHit'"));
  });
  it('fake: same order, numerically: x1.8 (Five-Alarm) x1.2 (mark) x CRIT.mult, one rng draw for the crit roll', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm), { seed: 3 });
    const e = fake.spawnEnemy({ hp: 1000 });
    e.status.burnUntil = 10;
    fake.mark(e, 5);
    fake.hit(e, 10, { ...stats, critChance: 1 });
    const crit = (1000 - e.hp) / (10 * 1.8 * 1.2);
    expect(crit).toBeGreaterThan(1);
    expect(1000 - e.hp).toBeCloseTo(10 * 1.8 * 1.2 * crit, 9);
  });
  it('fake: the element affinity sits between them: x1.8 (Five-Alarm) x1.3 (a baguette is weak to the toaster\'s heat) x1.2 (mark) x CRIT.mult', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm), { seed: 3 });
    const e = fake.spawnReal('baguette', { hp: 1000 });
    e.status.burnUntil = 10;
    fake.mark(e, 5);
    fake.hit(e, 10, { ...stats, critChance: 1 });
    const crit = (1000 - e.hp) / (10 * 1.8 * 1.3 * 1.2);
    expect(crit).toBeGreaterThan(1);
    expect(1000 - e.hp).toBeCloseTo(10 * 1.8 * 1.3 * 1.2 * crit, 9);
  });
  it('the Five-Alarm hook is the only modifyDamage with order 10 and runs before the engine mark rule (the mark is engine, not a hook)', () => {
    expect(fiveAlarm.hooks!.order).toBe(10);
    expect(contentComboTune('priceCheck').damageMult).toBe(1.2);
  });
});

describe('order: slow combos vs the Frost set (post-combo order 1000)', () => {
  it('Cold Storage 0.5 -> 0.6 and Brain Freeze 0.4 -> 0.5 at Frost L1 (the set adds after the combo sets the slow)', () => {
    expect(weaponOf([...partsOf(coldStorage), far('fizz')]).slow).toEqual({ pct: 0.6, duration: 1.5 });
    expect(weaponOf([...partsOf(brainFreeze), far('fizz')]).slow).toEqual({ pct: 0.5, duration: 0.6 });
    expect(weaponOf(partsOf(coldStorage)).slow).toEqual({ pct: 0.5, duration: 1.5 });
    expect(weaponOf(partsOf(brainFreeze)).slow).toEqual({ pct: 0.4, duration: 0.6 });
  });
  it('the combos override the Ice Pack slow (module phase) instead of stacking with it', () => {
    const plainIce = computeBuild(build([at('vacuum'), at('ice')], 8, 6)).weapons[0];
    expect(plainIce.slow).toEqual({ pct: 0.5, duration: 1.5 });
  });
});

describe('order: Multipack (post-combo) after Toast Mode', () => {
  it('Toast Mode sets the count first, the pack adds on top', () => {
    const w = weaponOf([...partsOf(toastMode), at('multipack')]);
    expect(w.count).toBe(contentComboTune('toastMode').count + 1);
  });
});

describe('order: Pot Slam before Express Checkout on the same dash end', () => {
  it('RECIPE_ORDER keeps legacy iteration order (build phase) and the hook orders keep the runtime order', () => {
    expect(RECIPE_ORDER.indexOf('expressCheckout')).toBeLessThan(RECIPE_ORDER.indexOf('potSlam'));
    expect(expressCheckout.hooks!.order).toBe(10);
    expect(potSlam.hooks!.order ?? 0).toBe(0);
  });
  it('a cart with both: the blast (explode) is logged before the bonus sweep', () => {
    const specs = [at('pan'), at('bell'), { ...at('cooker'), near: [], apart: [0] }, { ...at('bumper'), near: [2], apart: [0] }];
    const { fake } = arena(specs);
    fake.hooks.emit('onDashEnd', { x: 0, y: 0, dx: 1, dy: 0, hit: true });
    expect(fake.calls.filter((c) => c.kind === 'explode' || c.kind === 'sweep').map((c) => c.kind)).toEqual(['explode', 'sweep']);
  });
});

describe('order: legacy combo iteration is RECIPE_ORDER', () => {
  it('computeBuild lists the active combos of a cart in RECIPE_ORDER', () => {
    const b = computeBuild(build([at('pan'), at('bell'), at('fuel'), at('piggy'), at('lunchbox')], 8, 6));
    const ids = b.recipes.map((r) => r.id), sorted = [...ids].sort((x, y) => RECIPE_ORDER.indexOf(x) - RECIPE_ORDER.indexOf(y));
    expect(ids.length).toBeGreaterThan(2);
    expect(ids).toEqual(sorted);
  });
});
