import { describe, expect, it } from 'vitest';
import { ENEMIES, MINI_BOSS, enemiesWeakTo, miniBossDef } from '../../src/data/enemies';
import { ITEMS } from '../../src/data/items';
import { armorDamage } from '../../src/systems/combat';
import { affinityMult, burnFor, markMult, poisonTimeFor, resistTag, slowFor, statusDurationMult, tryStagger, weakTag } from '../../src/engine/affinity';
import { AFFINITY, type AffinityMap, type AffinityTag } from '../../src/engine/define';
import { FakeCtx } from '../../src/engine/fakeCtx';
import { hitTags, weaponTags } from '../../src/engine/hitTags';
import { MARK_MULT, markedDamage } from '../../src/engine/marks';
import type { ItemTypeId } from '../../src/types';
import { arena, arsenal, at, far, setTuneAt } from '../content/helpers';

// The element soft counters: the pure rules (engine/affinity), the hit tags (engine/hitTags), and the damage / status / stagger pipeline through FakeCtx,
// which mirrors ArenaScene.damageEnemy. The enemy table itself is pinned in tests/content/enemies/registry.test.ts.

const def = (weak?: AffinityMap, resist?: AffinityMap) => ({ weak, resist });
/** Damage a fresh 1000 HP `id` loses from one `dmg` hit (a weapon's stats, or none, with these opts). */
const dealt = (id: keyof typeof ENEMIES, dmg: number, opts: Parameters<FakeCtx['damage']>[3] = {}, source: Parameters<FakeCtx['damage']>[2] = null): number => {
  const fake = new FakeCtx();
  const e = fake.spawnReal(id, { hp: 1000 });
  fake.damage(e, dmg, source, opts);
  return 1000 - e.hp;
};

describe('affinityMult: the damage rule', () => {
  it('is x1 without an affinity or without a matching tag', () => {
    expect(affinityMult(def(), ['heat'])).toBe(1);
    expect(affinityMult(def({ heat: 0.3 }), [])).toBe(1);
    expect(affinityMult(def({ heat: 0.3 }), ['frost', 'blast'])).toBe(1);
  });

  it('weak adds its magnitude, resist takes it away: +30% / -30%, a boss +40%', () => {
    expect(affinityMult(def({ heat: 0.3 }), ['heat'])).toBeCloseTo(1.3, 12);
    expect(affinityMult(def(undefined, { frost: 0.3 }), ['frost'])).toBeCloseTo(0.7, 12);
    expect(affinityMult(def({ heat: AFFINITY.bossWeak }), ['heat'])).toBeCloseTo(1.4, 12);
  });

  it('takes the single BEST weak among the hit\'s tags (they never stack)', () => {
    expect(affinityMult(def({ heat: 0.3, blast: 0.4 }), ['heat', 'blast'])).toBeCloseTo(1.4, 12);
    expect(affinityMult(def({ heat: 0.3, blast: 0.3 }), ['heat', 'blast'])).toBeCloseTo(1.3, 12);
  });

  it('takes the single strongest resist the same way', () => {
    expect(affinityMult(def(undefined, { heat: 0.2, frost: 0.5 }), ['heat', 'frost'])).toBeCloseTo(0.5, 12);
  });

  it('adds weak and resist into one multiplier: heat + frost vs a turkey (weak heat, resist frost) is x1', () => {
    expect(affinityMult(ENEMIES.turkey, ['heat', 'frost'])).toBe(1);
    expect(affinityMult(ENEMIES.turkey, ['heat'])).toBeCloseTo(1.3, 12);
    expect(affinityMult(ENEMIES.turkey, ['frost'])).toBeCloseTo(0.7, 12);
    expect(affinityMult(def({ heat: 0.4 }, { frost: 0.3 }), ['heat', 'frost'])).toBeCloseTo(1.1, 12);
  });

  it('never goes below 0, and ignores the `mark` tag (it is not a hit tag)', () => {
    expect(affinityMult(def(undefined, { heat: 1 }), ['heat'])).toBe(0);
    expect(affinityMult(def({ mark: 5 }), ['mark'])).toBe(1);
  });

  it('weakTag / resistTag name the strongest matched tag (feedback and stagger key on them)', () => {
    expect(weakTag(def({ heat: 0.3, blast: 0.4 }), ['heat', 'blast'])).toBe('blast');
    expect(weakTag(def({ heat: 0.3 }), ['frost'])).toBeNull();
    expect(weakTag(def(), ['heat'])).toBeNull();
    expect(resistTag(ENEMIES.turkey, ['heat', 'frost'])).toBe('frost');
    expect(resistTag(ENEMIES.turkey, ['heat'])).toBeNull();
    expect(weakTag(ENEMIES.boss, ['heat'])).toBeNull();
    expect(weakTag(ENEMIES.boss, ['heat'], true)).toBe('mark'); // a marked Manager
  });
});

describe('statusDurationMult: the status-time rule', () => {
  it('is x1.5 weak, x0.5 resisting, x1 otherwise or without a tag', () => {
    expect(statusDurationMult(ENEMIES.banana, 'frost')).toBe(1.5);
    expect(statusDurationMult(ENEMIES.turkey, 'frost')).toBe(0.5);
    expect(statusDurationMult(ENEMIES.turkey, 'heat')).toBe(1.5);
    expect(statusDurationMult(ENEMIES.milk, 'frost')).toBe(1);
    expect(statusDurationMult(ENEMIES.banana)).toBe(1); // the dash stun has no element
  });

  it('is the same for a boss (+40% damage does not make the time longer)', () => {
    expect(statusDurationMult(ENEMIES.boss_frozen, 'heat')).toBe(AFFINITY.weakDuration);
    expect(statusDurationMult(ENEMIES.boss_frozen, 'frost')).toBe(AFFINITY.resistDuration);
  });

  it('scales only the duration of a burn / slow / poison, never the dps or the slow percentage', () => {
    const burn = { dps: 4, duration: 2, tick: 0.5 }, slow = { pct: 0.3, duration: 2 };
    expect(burnFor(ENEMIES.baguette, burn)).toEqual({ dps: 4, duration: 3, tick: 0.5 });
    expect(burnFor(ENEMIES.gum, burn)).toEqual({ dps: 4, duration: 1, tick: 0.5 });
    expect(burnFor(ENEMIES.milk, burn)).toBe(burn);
    expect(slowFor(ENEMIES.banana, slow)).toEqual({ pct: 0.3, duration: 3 });
    expect(slowFor(ENEMIES.turkey, slow)).toEqual({ pct: 0.3, duration: 1 });
    expect(slowFor(ENEMIES.milk, slow)).toBe(slow);
    expect(poisonTimeFor(ENEMIES.spitter, 4)).toBe(2);
    expect(poisonTimeFor(ENEMIES.milk, 4)).toBe(4);
  });
});

describe('markMult: the mark-specific rule', () => {
  it('is Price Check\'s x1.2 for everyone but the Manager', () => {
    expect(MARK_MULT).toBe(1.2);
    for (const id of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]) if (id !== 'boss') expect(markMult(ENEMIES[id]), id).toBe(MARK_MULT);
  });

  it('doubles the bonus against the Manager: x1.4, not a generic +40%', () => {
    expect(markMult(ENEMIES.boss)).toBeCloseTo(1.4, 12);
    expect(markMult(def({ mark: 1 }))).toBeCloseTo(1 + (MARK_MULT - 1) * 2, 12);
    expect(markMult(def(undefined, { mark: 0.5 }))).toBeCloseTo(1 + (MARK_MULT - 1) * 0.5, 12);
  });

  it('markedDamage applies the passed multiplier only while marked', () => {
    expect(markedDamage(10, 5, 4, markMult(ENEMIES.boss))).toBeCloseTo(14, 12);
    expect(markedDamage(10, 5, 5, markMult(ENEMIES.boss))).toBe(10);
    expect(markedDamage(10, 5, 4)).toBeCloseTo(12, 12);
  });

  it('through the pipeline: a marked Manager takes x1.4, a marked milk x1.2, an unmarked Manager x1; heat does nothing to it', () => {
    const fake = new FakeCtx();
    const boss = fake.spawnReal('boss', { hp: 1000 }), milk = fake.spawnReal('baguette', { hp: 1000 }); // baguette: weak heat only, mark neutral
    fake.damage(boss, 10, null, { tags: ['heat'] });
    expect(1000 - boss.hp).toBe(10);
    fake.mark(boss, 5); fake.mark(milk, 5);
    fake.damage(boss, 10, null); fake.damage(milk, 10, null);
    expect(1000 - boss.hp).toBeCloseTo(10 + 14, 12);
    expect(1000 - milk.hp).toBeCloseTo(12, 12);
  });
});

describe('hit tags', () => {
  const sets = (type: ItemTypeId) => [...weaponTags(type)].sort();

  it('a weapon carries its declared element, the Cleaning family and its declared `elements` (the electrical flag adds no tag)', () => {
    expect(sets('pan')).toEqual(['heat']);
    expect(sets('cooker')).toEqual(['heat']);
    expect(sets('toaster')).toEqual(['heat']);
    expect(sets('microwave')).toEqual(['heat']);
    expect(sets('fizz')).toEqual(['frost']);
    expect(sets('mop')).toEqual(['cleaning', 'frost']);
    expect(sets('spray')).toEqual(['cleaning', 'frost']);
    expect(sets('leafblower')).toEqual(['cleaning']);
    expect(sets('vacuum')).toEqual(['cleaning']);
    expect(sets('nailgun')).toEqual(['blast']);
    expect(sets('blender')).toEqual(['electric']); // declared `elements`
    expect(sets('laser')).toEqual(['electric']);
  });

  it('electric on a weapon is declared, not derived from `electrical`: only the Laser and the Blender, not Toaster, Microwave, Nail Gun or Vacuum', () => {
    for (const id of ['toaster', 'microwave', 'nailgun', 'vacuum', 'blender', 'laser'] as const) expect(ITEMS[id].electrical, id).toBe(true);
    for (const id of ['laser', 'blender'] as const) { expect(ITEMS[id].elements, id).toEqual(['electric']); expect(weaponTags(id), id).toContain('electric'); }
    for (const id of ['toaster', 'microwave', 'nailgun', 'vacuum'] as const) { expect(ITEMS[id].elements, id).toBeUndefined(); expect(weaponTags(id), id).not.toContain('electric'); }
    const electric = (Object.keys(ITEMS) as ItemTypeId[]).filter((id) => weaponTags(id).includes('electric')).sort();
    expect(electric).toEqual(['blender', 'laser']);
  });

  it('is derived from the item data: every weapon\'s tags are its declared element, its Cleaning family and its `elements`', () => {
    for (const id of Object.keys(ITEMS) as ItemTypeId[]) {
      const d = ITEMS[id];
      const expected = [d.family, d.element, ...(d.elements ?? [])].filter((s): s is typeof s & AffinityTag => !!s && ['heat', 'frost', 'electric', 'blast', 'cleaning'].includes(s));
      expect(sets(id), id).toEqual([...new Set(expected)].sort());
    }
  });

  it('the kind of hit adds tags: burn tick heat, poison tick poison, chained electric, popper blast, extra `tags`', () => {
    expect(hitTags(null, { isDot: true })).toEqual(['heat']);
    expect(hitTags(null, { isDot: true, poison: true })).toEqual(['poison']);
    expect(hitTags(null, { chained: true })).toEqual(['electric']);
    expect(hitTags(null, { fromPopper: true })).toEqual(['blast']);
    expect(hitTags(null, { tags: ['cleaning'] })).toEqual(['cleaning']);
    expect(hitTags(null, {})).toEqual([]);
  });

  it('merges the weapon\'s and the kind\'s tags without duplicates; a plain weapon hit is the cached array', () => {
    const cooker = { type: 'cooker' as ItemTypeId };
    expect(hitTags(cooker, {})).toBe(weaponTags('cooker'));
    expect([...hitTags(cooker, { tags: ['blast'] })].sort()).toEqual(['blast', 'heat']);
    expect([...hitTags({ type: 'nailgun' }, { chained: true })].sort()).toEqual(['blast', 'electric']); // an arc adds electric to the nail gun's own blast
    expect(hitTags({ type: 'nailgun' }, { fromPopper: true })).toBe(weaponTags('nailgun')); // already blast: nothing to add
    expect(hitTags({ type: 'laser' }, { chained: true })).toBe(weaponTags('laser')); // already electric: nothing to add
    expect(hitTags({ type: 'pan' }, { chained: true, fromPopper: true }).length).toBe(3);
  });
});

describe('damage through the pipeline, per tag source', () => {
  const pan = () => arena([at('pan')]);

  it('weapon: a Skillet (heat) hits a baguette (weak heat) for x1.3, a gum (resists heat) for x0.7, a milk for x1', () => {
    const a = pan();
    const bag = a.fake.spawnReal('baguette', { hp: 1000 }), gum = a.fake.spawnReal('gum', { hp: 1000 }), milk = a.fake.spawnReal('milk', { hp: 1000 });
    for (const e of [bag, gum]) a.fake.hit(e, 10, a.stats);
    expect(1000 - bag.hp).toBeCloseTo(13, 12);
    expect(1000 - gum.hp).toBeCloseTo(7, 12);
    a.fake.hit(milk, 10, a.stats);
    expect(1000 - milk.hp).toBe(10);
  });

  it('weapon: Laser and Blender hits are electric (vs soda +30%), a Toaster hit is not (x1)', () => {
    for (const id of ['laser', 'blender', 'toaster'] as const) {
      const a = arena([at(id)]);
      const soda = a.fake.spawnReal('soda', { hp: 1000 });
      a.fake.hit(soda, 10, a.stats);
      if (id === 'toaster') expect(1000 - soda.hp, id).toBe(10);
      else expect(1000 - soda.hp, id).toBeCloseTo(13, 12);
    }
    for (const id of ['microwave', 'nailgun', 'vacuum'] as const) {
      const a = arena([at(id)]);
      const soda = a.fake.spawnReal('soda', { hp: 1000 });
      a.fake.hit(soda, 10, a.stats);
      expect(1000 - soda.hp, id).toBe(10);
    }
  });

  it('weapon: an electrical weapon is not electric by itself (Toaster vs soda x1, vs turkey x1.3 via heat), cleaning ones are cleaning (Mop vs expired)', () => {
    const toaster = arena([at('toaster')]), mop = arena([at('mop')]);
    const soda = toaster.fake.spawnReal('soda', { hp: 1000 }), turkey = toaster.fake.spawnReal('turkey', { hp: 1000 });
    toaster.fake.hit(soda, 10, toaster.stats); toaster.fake.hit(turkey, 10, toaster.stats);
    expect(1000 - soda.hp).toBe(10); // electrical flag, no electric tag
    expect(1000 - turkey.hp).toBeCloseTo(armorDamage(13, 2), 12); // heat weak (13), then the turkey's armor 2 (11); the toaster is not frost, so no resist
    const expired = mop.fake.spawnReal('expired', { hp: 1000 }), turkey2 = mop.fake.spawnReal('turkey', { hp: 1000 });
    mop.fake.hit(expired, 10, mop.stats); mop.fake.hit(turkey2, 10, mop.stats);
    expect(1000 - expired.hp).toBeCloseTo(13, 12); // cleaning weak
    expect(1000 - turkey2.hp).toBeCloseTo(armorDamage(7, 2), 12); // the mop is frost: the turkey resists (7), then armor 2 (5)
  });

  it('a Spray Bottle (cleaning + frost) is weak-only on a gum (frost), and a heat + frost hit on a turkey cancels out', () => {
    const spray = arena([at('spray')]);
    const gum = spray.fake.spawnReal('gum', { hp: 1000 });
    spray.fake.hit(gum, 10, spray.stats);
    expect(1000 - gum.hp).toBeCloseTo(13, 12);
    const fake = new FakeCtx();
    const turkey = fake.spawnReal('turkey', { hp: 1000 });
    fake.damage(turkey, 10, null, { tags: ['heat', 'frost'] });
    expect(1000 - turkey.hp).toBe(armorDamage(10, 2)); // x1.0 through the affinity, then the turkey's armor 2: 8
  });

  it('burn tick (heat) vs baguette x1.3, vs gum x0.7; a poison tick vs spitter is resisted x0.7, vs a milk full', () => {
    expect(dealt('baguette', 10, { isDot: true })).toBeCloseTo(13, 12);
    expect(dealt('gum', 10, { isDot: true })).toBeCloseTo(7, 12);
    expect(dealt('spitter', 10, { isDot: true, poison: true })).toBeCloseTo(7, 12);
    expect(dealt('expired', 10, { isDot: true, poison: true })).toBeCloseTo(7, 12);
    expect(dealt('milk', 10, { isDot: true, poison: true })).toBe(10);
    expect(dealt('milk', 10, { isDot: true })).toBe(10);
  });

  it('a real Electric-set arc is the electric hit: the toaster hits a soda for x1, its arc to the next enemy is half damage x1.3 (soda) or x1 (banana)', () => {
    const seed = (() => { for (let s = 1; s < 500; s++) { const f = new FakeCtx({ seed: s }); if (f.rng() < 0.3) return s; } throw new Error('seed'); })();
    const a = arena([at('toaster'), at('battery'), far('vacuum'), far('laser')], { seed }); // toaster + battery + vacuum + laser: Electric L3
    expect(a.b.sets.electric).toBe(3);
    const hit = a.fake.spawnReal('soda', { x: 0, hp: 1000 }), next = a.fake.spawnReal('soda', { x: 60, hp: 1000 }), plain = a.fake.spawnReal('banana', { x: 110, hp: 1000 });
    a.fake.hit(hit, 10, a.stats);
    expect(1000 - hit.hp).toBe(10);
    expect(1000 - next.hp).toBeCloseTo(5 * 1.3, 12);
    expect(1000 - plain.hp).toBeCloseTo(5, 12);
    expect(a.fake.callsOf('damage').every((c) => c.opts.chained)).toBe(true);
  });

  it('electric chain vs soda x1.3 (the chained flag is electric whatever fired it)', () => {
    expect(dealt('soda', 10, { chained: true })).toBeCloseTo(13, 12);
    expect(dealt('beans', 10, { chained: true })).toBeCloseTo(armorDamage(13, 3), 12); // x1.3 first, then the armor step (FakeCtx runs the scene's `hitArmor`)
    expect(dealt('milk', 10, { chained: true })).toBe(10);
  });

  it('popper blast vs milk x1.3 through ctx.popperBlast; a blast hit on a boss that resists blast is x0.7', () => {
    const fake = new FakeCtx();
    const milk = fake.spawnReal('milk', { hp: 1000 }), checkout = fake.spawnReal('boss_checkout', { hp: 1000 }), egg = fake.spawnReal('egg', { hp: 1000 });
    fake.popperBlast({ x: 0, y: 0 }, { damage: 10, radius: 100 });
    expect(1000 - milk.hp).toBeCloseTo(13, 12);
    expect(1000 - egg.hp).toBeCloseTo(13, 12);
    expect(1000 - checkout.hp).toBeCloseTo(armorDamage(7, 3), 12); // x0.7 = 7, then the Kiosk's armor 3: 4
  });

  it('explosion (the Pressure Cooker\'s pot) is a blast hit on top of heat: it hurts a milk by x1.3 though the cooker is heat', () => {
    const { a, fake } = arsenal([at('cooker', 3)]);
    const milk = fake.spawnReal('milk', { x: 300, y: 100, hp: 1000 }), plain = fake.spawnEnemy({ x: 330, y: 100, hp: 1000 });
    a.step(0.5);
    a.run(40, 0.05);
    const pot = 32 * setTuneAt('kitchen', 3)!.damageMult; // the lone ★3 cooker is 3 Kitchen points: L2
    expect(1000 - plain.hp).toBeCloseTo(pot, 10);
    expect(1000 - milk.hp).toBeCloseTo(pot * 1.3, 10);
  });

  it('labelled hits carry their tags: the Leaf Blower slam is cleaning (expired x1.3), a live cable electric, an oven vent heat', () => {
    expect(dealt('expired', 10, { label: 'Slam', tags: ['cleaning'] })).toBeCloseTo(13, 12);
    expect(dealt('expired', 10, { label: 'Slam' })).toBe(10);
    expect(dealt('soda', 10, { label: 'Live cable', tags: ['electric'] })).toBeCloseTo(13, 12);
    expect(dealt('baguette', 10, { label: 'Oven vent', tags: ['heat'] })).toBeCloseTo(13, 12);
    expect(dealt('egg', 10, { label: 'Bag It', tags: ['blast'] })).toBeCloseTo(13, 12);
  });

  it('raises the hit before armor: the order is pinned in tests/content/combos/order.test.ts and the damageEnemy source-order test', () => {
    expect(dealt('beans', 20, { chained: true })).toBeCloseTo(armorDamage(26, 3), 12);
  });

  it('the slice has no affinity: every tag is x1', () => {
    for (const tag of ['heat', 'frost', 'electric', 'blast', 'cleaning', 'poison'] as const) expect(dealt('slice', 10, { tags: [tag] }), tag).toBe(10);
  });
});

describe('status durations through the ctx', () => {
  it('frost slow: halved on a turkey, x1.5 on a banana, unchanged on a milk; the percentage never changes', () => {
    const fake = new FakeCtx();
    const turkey = fake.spawnReal('turkey'), banana = fake.spawnReal('banana'), milk = fake.spawnReal('milk');
    for (const e of [turkey, banana, milk]) fake.slow(e, { pct: 0.3, duration: 2 });
    expect(turkey.status.slowUntil).toBe(1);
    expect(banana.status.slowUntil).toBe(3);
    expect(milk.status.slowUntil).toBe(2);
    expect([turkey, banana, milk].map((e) => e.status.slowPct)).toEqual([0.3, 0.3, 0.3]);
  });

  it('burn (heat): x1.5 on a baguette, x0.5 on a gum; the dps and the tick stay', () => {
    const fake = new FakeCtx();
    const bag = fake.spawnReal('baguette'), gum = fake.spawnReal('gum');
    fake.ignite(bag, { dps: 4, duration: 2, tick: 0.5 }); fake.ignite(gum, { dps: 4, duration: 2, tick: 0.5 });
    expect(bag.status.burnUntil).toBe(3);
    expect(gum.status.burnUntil).toBe(1);
    expect([bag.status.burnDps, gum.status.burnDps, bag.status.burnTick]).toEqual([4, 4, 0.5]);
  });

  it('poison: halved on a spitter, honey and expired milk, whole on a milk', () => {
    const fake = new FakeCtx();
    const es = (['spitter', 'honey', 'expired', 'milk'] as const).map((id) => fake.spawnReal(id));
    for (const e of es) fake.poison(e, 3, 4);
    expect(es.map((e) => e.status.poisonUntil)).toEqual([2, 2, 2, 4]);
    expect(es.map((e) => e.status.poisonDps)).toEqual([3, 3, 3, 3]);
  });

  it('stuns: a frost stun scales with the frost affinity, an electric one with the electric affinity, an untagged one never; bosses stay immune', () => {
    const fake = new FakeCtx();
    const banana = fake.spawnReal('banana'), turkey = fake.spawnReal('turkey'), soda = fake.spawnReal('soda'), beans = fake.spawnReal('beans'), milk = fake.spawnReal('milk');
    expect(fake.stun(banana, 1, 'frost')).toBe(1.5);
    expect(fake.stun(turkey, 1, 'frost')).toBe(0.5);
    expect(fake.stun(soda, 1, 'electric')).toBe(1.5);
    expect(fake.stun(beans, 1, 'frost')).toBe(1);
    expect(fake.stun(milk, 1)).toBe(1);
    expect(fake.stun(banana, 1)).toBe(1); // the Tools set's dash stun: no element
    expect([banana.stateT, turkey.stateT, soda.stateT]).toEqual([1.5, 0.5, 1.5]);
    const boss = fake.spawnReal('boss_frozen');
    expect(fake.stun(boss, 1, 'electric')).toBe(0);
    expect(boss.state).toBe('walk');
  });

  it('the Frost set\'s freeze (L2) uses the scaled time for the ice block, 0 for a boss', () => {
    // a lucky roll of the freeze hook: find a seed whose first combat draw is below the L2 chance (the other freeze tests do the same)
    const seed = (() => { for (let s = 1; s < 500; s++) { const f = new FakeCtx({ seed: s }); if (f.rng() < 0.1) return s; } throw new Error('seed'); })();
    const run = (id: keyof typeof ENEMIES) => {
      const a = arena([at('fizz'), at('ice'), far('mop')], { seed });
      const e = a.fake.spawnReal(id, { hp: 1000 });
      a.fake.hit(e, 3, a.stats);
      return e;
    };
    expect(run('turkey').frozenT).toBe(0.25);
    expect(run('banana').frozenT).toBe(0.75);
    expect(run('milk').frozenT).toBe(0.5);
    expect(run('boss_frozen').frozenT).toBeUndefined();
  });
});

describe('status durations in the pattern code', () => {
  it('the Mop\'s puddle slow scales with the frost affinity of the enemy standing in it (0.5 s: turkey 0.25, milk 0.5, banana 0.75), the percentage does not', () => {
    const { a, fake } = arsenal([at('mop', 3)]);
    const es = (['turkey', 'milk', 'banana'] as const).map((id) => fake.spawnReal(id, { x: -40, y: 4, hp: 100000 }));
    a.run(15, 0.05);
    const last = (id: number) => fake.callsOf('damage').filter((c) => c.enemy === id).at(-1)!.at;
    expect(es.map((e) => +(e.status.slowUntil - last(e.id)).toFixed(6))).toEqual([0.25, 0.5, 0.75]);
    const pct = 0.25 + setTuneAt('frost', 3)!.slowBonus; // the lone ★3 mop is 3 Frost points: L2
    expect(es.map((e) => e.status.slowPct)).toEqual([pct, pct, pct]);
  });
});

describe('boss weakness stagger', () => {
  const boss = (fake: FakeCtx, id: keyof typeof ENEMIES = 'boss_frozen') => fake.spawnReal(id, { hp: 5000 });
  const heat = { tags: ['heat'] } as const;

  it('a hit on the weak tag staggers a walking boss for 0.25 s (state stun)', () => {
    const fake = new FakeCtx();
    const b = boss(fake);
    fake.damage(b, 10, null, heat);
    expect(b.state).toBe('stun');
    expect(b.stateT).toBe(AFFINITY.stagger.time);
    expect(fake.callsOf('stagger')).toEqual([{ at: 0, kind: 'stagger', enemy: b.id }]);
    expect(5000 - b.hp).toBeCloseTo(armorDamage(14, 2), 12); // boss weak = +40% (14), then the Freezer's armor 2: 12
  });

  it('does not stagger on another tag, on a resisted tag, or from a burn tick', () => {
    const fake = new FakeCtx();
    const b = boss(fake);
    fake.damage(b, 10, null, { tags: ['frost'] });
    fake.damage(b, 10, null, { tags: ['electric'] });
    fake.damage(b, 10, null, { isDot: true }); // a heat tick: no stagger from ticks
    fake.damage(b, 10, null);
    expect(b.state).toBe('walk');
    expect(fake.callsOf('stagger')).toHaveLength(0);
  });

  it('only in the walk state: never interrupts a tell, an attack, a recovery or a stun, and a refused one starts no cooldown', () => {
    const fake = new FakeCtx();
    for (const state of ['tell', 'attack', 'recover', 'stun', 'spawn']) {
      const b = boss(fake);
      b.state = state;
      fake.damage(b, 10, null, heat);
      expect(b.state, state).toBe(state);
      expect(b.staggerAt, state).toBeUndefined();
    }
    const b = boss(fake);
    b.state = 'tell';
    fake.damage(b, 10, null, heat);
    b.state = 'walk';
    fake.damage(b, 10, null, heat);
    expect(b.state).toBe('stun'); // the refused hit did not use the cooldown up
  });

  it('has a per-boss cooldown of 4 s', () => {
    const fake = new FakeCtx();
    const b = boss(fake), other = boss(fake, 'boss_frozen');
    fake.damage(b, 10, null, heat);
    expect(b.staggerAt).toBe(0);
    b.state = 'walk';
    fake.advance(3.9);
    fake.damage(b, 10, null, heat);
    expect(b.state).toBe('walk');
    fake.damage(other, 10, null, heat); // another boss has its own cooldown
    expect(other.state).toBe('stun');
    fake.advance(0.1);
    fake.damage(b, 10, null, heat);
    expect(b.state).toBe('stun');
    expect(fake.callsOf('stagger').map((c) => c.at)).toEqual([0, 3.9, 4]); // b at 0 and again at 4, the other boss at 3.9
  });

  it('the normal stun immunity stays: ctx.stun on a boss does nothing, even with the weak element', () => {
    const fake = new FakeCtx();
    const b = boss(fake);
    expect(fake.stun(b, 2, 'frost')).toBe(0);
    expect(fake.stun(b, 2)).toBe(0);
    expect(b.state).toBe('walk');
  });

  it('a regular grocery weak to the hit does not stagger (bosses and mini-bosses only)', () => {
    const fake = new FakeCtx();
    const bag = fake.spawnReal('baguette', { hp: 1000 });
    fake.damage(bag, 10, null, heat);
    expect(bag.state).toBe('walk');
    expect(fake.callsOf('stagger')).toHaveLength(0);
  });

  it('every boss staggers on its own weak element and not on the others', () => {
    const cases: [keyof typeof ENEMIES, AffinityTag][] = [['boss_frozen', 'heat'], ['boss_bakery', 'frost'], ['boss_electronics', 'cleaning'], ['boss_checkout', 'electric']];
    for (const [id, tag] of cases) {
      const fake = new FakeCtx();
      const b = boss(fake, id);
      for (const other of ['heat', 'frost', 'electric', 'blast', 'cleaning'] as const) if (other !== tag) { fake.damage(b, 1, null, { tags: [other] }); expect(b.state, `${id} ${other}`).toBe('walk'); }
      fake.damage(b, 1, null, { tags: [tag] });
      expect(b.state, id).toBe('stun');
    }
  });

  it('the Manager staggers only while marked', () => {
    const fake = new FakeCtx();
    const b = boss(fake, 'boss');
    fake.damage(b, 10, null, heat);
    expect(b.state).toBe('walk');
    fake.mark(b, 5);
    fake.damage(b, 10, null);
    expect(b.state).toBe('stun');
  });

  it('a real weapon does it: a Skillet (heat) staggers the Walk-In Freezer', () => {
    const a = arena([at('pan')]);
    const b = a.fake.spawnReal('boss_frozen', { hp: 5000 });
    a.fake.hit(b, 10, a.stats);
    expect(b.state).toBe('stun');
    expect(5000 - b.hp).toBeCloseTo(armorDamage(14, 2), 12); // +40% (14), then armor 2: 12
  });

  it('tryStagger is a pure decision: weak match, walking, off cooldown, and it starts the cooldown', () => {
    const e = { state: 'walk', def: { ...ENEMIES.boss_bakery } } as Parameters<typeof tryStagger>[0];
    expect(tryStagger(e, ['heat'], false, 0)).toBe(false); // resisted
    expect(tryStagger(e, ['frost'], false, 1)).toBe(true);
    expect(e.staggerAt).toBe(1);
    expect(tryStagger(e, ['frost'], false, 4.9)).toBe(false);
    expect(tryStagger(e, ['frost'], false, 5)).toBe(true);
    expect(tryStagger({ state: 'walk', def: { ...ENEMIES.milk } }, ['blast'], false, 0)).toBe(false); // not a boss
  });
});

describe('mini-boss giants inherit the affinity of their grocery', () => {
  it('the merge keeps weak and resist: MINI_BOSS.def and the variants never name them', () => {
    expect(MINI_BOSS.def).not.toHaveProperty('weak');
    expect(MINI_BOSS.def).not.toHaveProperty('resist');
    for (const v of MINI_BOSS.variants) { expect(v.def).not.toHaveProperty('weak'); expect(v.def).not.toHaveProperty('resist'); }
  });

  it('every giant (both variants, every theme) is a boss-behavior copy with its grocery\'s own weak and resist', () => {
    for (const v of MINI_BOSS.variants) {
      for (const id of Object.values(v.byTheme)) {
        const g = miniBossDef(ENEMIES[id!], v);
        expect(g.behavior, id).toBe('boss');
        expect(g.id, id).toBe(id);
        expect(g.weak, id).toEqual(ENEMIES[id!].weak);
        expect(g.resist, id).toEqual(ENEMIES[id!].resist);
      }
    }
  });

  it('a Frozen Turkey giant takes +30% from heat, -30% from frost, staggers on heat, and is stun-immune', () => {
    const giant = miniBossDef(ENEMIES.turkey, MINI_BOSS.variants[0]);
    expect(affinityMult(giant, ['heat'])).toBeCloseTo(1.3, 12);
    expect(affinityMult(giant, ['frost'])).toBeCloseTo(0.7, 12);
    const fake = new FakeCtx();
    const e = fake.spawnEnemy({ hp: 5000, def: { id: 'turkey', radius: giant.radius, behavior: giant.behavior, knockbackResist: 1, weak: giant.weak, resist: giant.resist } });
    expect(fake.stun(e, 1, 'frost')).toBe(0);
    fake.damage(e, 10, null, { tags: ['heat'] });
    expect(e.state).toBe('stun');
    expect(5000 - e.hp).toBeCloseTo(13, 12); // the grocery's +30%, not a boss's +40%
  });
});

describe('derived lists', () => {
  it('"Strong vs" is derived from the enemy files: groceries first, bosses after', () => {
    expect(enemiesWeakTo(['heat'])).toEqual(['turkey', 'cereal', 'baguette', 'boss_frozen']);
    expect(enemiesWeakTo(['blast'])).toEqual(['milk', 'sanitizer', 'egg', 'melon']);
    expect(enemiesWeakTo(['electric'])).toEqual(['giftcard', 'soda', 'beans', 'boss_checkout']);
    expect(enemiesWeakTo(['cleaning'])).toEqual(['expired', 'boss_electronics']);
    expect(enemiesWeakTo(['frost'])).toEqual(['banana', 'gum', 'spitter', 'honey', 'boss_bakery']);
    expect(enemiesWeakTo(['heat', 'electric'])).toEqual(['giftcard', 'soda', 'beans', 'turkey', 'cereal', 'baguette', 'boss_frozen', 'boss_checkout']);
    expect(enemiesWeakTo(['mark'])).toEqual(['boss']);
    expect(enemiesWeakTo([])).toEqual([]);
  });
});

// ArenaScene / PhaserCtx cannot run headless: pin the wiring by source, like the damageEnemy order guards do.
const SRC = import.meta.glob('../../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const src = (path: string): string => { const k = Object.keys(SRC).find((p) => p.endsWith(`/${path}`)); if (!k) throw new Error(`no source ${path}`); return SRC[k]; };

describe('wiring (source guards)', () => {
  const arena_ = src('scenes/ArenaScene.ts'), ctx = src('scenes/phaserCtx.ts');

  it('stunEnemy scales by the tag and keeps the boss guard; staggerEnemy is the only way past it and walks only', () => {
    const stun = arena_.slice(arena_.indexOf('stunEnemy(e: Enemy'), arena_.indexOf('staggerEnemy(e: Enemy'));
    expect(stun).toContain("e.def.behavior === 'boss'");
    expect(stun).toContain('bossSeconds <= 0 || e.state !== \'walk\') return 0'); // a boss only gets the opt-in cap (Air Horn), never the full stun
    expect(stun).toContain('statusDurationMult(e.def, tag)');
    const stagger = arena_.slice(arena_.indexOf('staggerEnemy(e: Enemy'), arena_.indexOf('/** Floor slow multiplier'));
    expect(stagger).toContain("e.state !== 'walk'");
    expect(stagger).toContain('AFFINITY.stagger.time');
    expect(stagger).not.toMatch(/Math\.random|this\.rng/);
  });

  it('PhaserCtx scales burn, slow and poison durations and passes the stun tag; the puddle code scales its direct burn / slow', () => {
    expect(ctx).toContain('burnFor(e.def, this.sc.aisleEvent.burn(burn))');
    expect(ctx).toContain('slowFor(e.def, slow)');
    expect(ctx).toContain('poisonTimeFor(e.def, duration)');
    expect(ctx).toContain('stunEnemy(e as Enemy, seconds, tag, bossSeconds)');
    const pud = src('engine/patterns/puddle.ts');
    expect(pud).toContain('burnFor(e.def, sc.aisleEvent.burn(pd.burn))');
    expect(pud).toContain('slowFor(e.def, slow)');
    expect(src('scenes/events.ts')).toContain('slowFor(e.def, { pct: WET.enemySlow, duration: 0.3 })'); // the wet-floor event goes through the same path
  });

  it('the element-tagged stuns and hits name their tag at the call site', () => {
    expect(src('content/sets/frost.ts')).toContain('ctx.stun(e, t.stun, Tag.frost)');
    expect(src('content/combos/blackIce.ts')).toContain('Tag.frost)');
    expect(src('content/combos/frostbiteNails.ts')).toContain('t.freeze, Tag.frost)');
    expect(src('content/combos/sparksFly.ts')).toContain('t.stun, Tag.electric)');
    expect(src('scenes/hazards.ts')).toContain("sc.stunEnemy(e, T.stun, 'electric')");
    expect(src('scenes/hazards.ts')).toContain("label: 'Live cable', tags: ['electric']");
    expect(src('scenes/hazards.ts')).toContain("label: 'Oven vent', tags: ['heat']");
    expect(src('content/combos/bagIt.ts')).toContain("label: 'Bag It', tags: [Tag.blast]");
    expect(src('engine/patterns/mortar.ts')).toContain('tags: BLAST');
    expect(arena_).toContain("label: 'Slam', tags: ['cleaning']");
    expect(arena_).toContain("label: 'Egg Carton', tags: ['blast']");
  });

  it('a weakness stagger does not trigger the half-HP volley chain of a charge recovery', () => {
    const enemies = src('scenes/enemies.ts');
    expect(enemies).toContain("d.behavior === 'boss' && !e.staggered && scene.halfHp(e)");
  });

  it('the AI never reads the affinity itself (one place: engine/affinity)', () => {
    expect(src('scenes/enemies.ts')).not.toMatch(/\.weak\b|\.resist\b/);
  });
});
