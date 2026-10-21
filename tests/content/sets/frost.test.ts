import { afterEach, describe, expect, it } from 'vitest';
import frost from '../../../src/content/sets/frost';
import { contentSet, contentSetTune, contentTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import type { WeaponStats } from '../../../src/types';
import { arena, at, far, full, gilded } from '../helpers';
import { draws, expectSetText, seedWhere } from './helpers';

afterEach(() => setLang('en'));

const ice = contentTune('ice', 1); // slow pct .25 for 1 s at ★1
const FIZZ = at('fizz'), ICE = at('ice'); // a frost weapon, and its Ice Pack touching it
// Frost members that touch nothing: a ★2 Mop and a ★2 Spray Bottle (weapons elsewhere in the cart), 2 Frost points each.
const cart = (n: number) => [FIZZ, ICE, ...[far('mop', 2), far('spray', 2)].slice(0, n)];
const stats = (c: Parameters<typeof full>[0]) => full(c).weapons[0];

describe('Frost set: slow bonus', () => {
  it('2 / 4 / 6 set points give L1 / L2 / L3 (fizz + ice = 2, each ★2 member adds 2)', () => {
    expect([0, 1, 2].map((n) => full(cart(n)).sets.frost)).toEqual([1, 2, 3]);
    expect(full([FIZZ, far('ice')]).sets.frost).toBe(1);
  });

  it('below the threshold the slow is the Ice Pack\'s own', () => {
    expect(stats([at('pan'), ICE]).slow).toEqual({ pct: ice.pct, duration: ice.duration }); // the Ice Pack is the only frost type
  });

  it('L1 adds 10 points to the slow, the duration is unchanged', () => {
    expect(stats(cart(0)).slow).toEqual({ pct: ice.pct + 0.1, duration: ice.duration });
  });

  it('L2 keeps the 10 points, L3 replaces them with 15', () => {
    expect(stats(cart(1)).slow).toEqual({ pct: ice.pct + 0.1, duration: ice.duration });
    expect(stats(cart(2)).slow).toEqual({ pct: ice.pct + 0.15, duration: ice.duration });
  });

  it('is capped at 60% (L1, L2) / 70% (L3); a Gold Star-lifted Ice Pack is 4 Frost points, so two ★1 members take it to the L3 cap', () => {
    expect(contentTune('ice', 4).pct).toBeGreaterThan(0.6);
    expect(stats([FIZZ, at('ice', 3), gilded(1), far('mop')]).slow!.pct).toBe(0.7); // ★3 lifted to an effective ★4: 6 Frost points, L3
    expect(stats([FIZZ, at('ice', 3), gilded(1)]).slow!.pct).toBe(0.6); // 5 Frost points: L2, still the 60% cap
    expect(stats([at('pan'), at('ice', 3)]).slow!.pct).toBeCloseTo(0.6, 12); // ★3 alone: 3 Frost points, L1: 0.5 + 0.1, right at the cap
  });

  it('applies to the slow a combo sets, not only the Ice Pack\'s (after the combos)', () => {
    const brain = stats([at('blender'), ICE, far('mop')]); // Brain Freeze (slow 40% for 0.6 s) + Frost L1
    expect(brain.recipes).toContain('brainFreeze');
    expect(brain.slow).toEqual({ pct: 0.4 + 0.1, duration: 0.6 });
  });

  it('does nothing to a weapon without a slow', () => {
    const pan = stats([at('pan'), far('ice'), far('mop')]); // frost L1 in the cart, but the pan has no slow
    expect(pan.slow).toBeNull();
  });

  it('Jelly Beans in their frost flavor count toward the set', () => {
    expect(full([FIZZ, { ...far('jellybeans'), flavor: 'frost' }]).sets.frost).toBe(1);
    expect(full([FIZZ, { ...far('jellybeans'), flavor: 'heat' }]).sets.frost).toBe(0);
  });
});

describe('Frost set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3)', () => {
    expect(contentSet('frost')).toBe(frost);
    expect(contentSetTune('frost', 1)).toEqual({ slowBonus: 0.1, slowCap: 0.6, stunMinSlow: 0.35, stunChance: 0.1, stun: 0.5 });
    expect(contentSetTune('frost', 2)).toEqual(contentSetTune('frost', 1));
    expect(contentSetTune('frost', 3)).toEqual({ slowBonus: 0.15, slowCap: 0.7, stunMinSlow: 0.35, stunChance: 0.2, stun: 0.7 });
  });

  it('adds its slow bonus last in post-combo, and rolls its freeze before the Electric chain', () => {
    expect(frost.build).toMatchObject({ phase: 'post-combo', order: 1000 });
    expect(frost.hooks?.order).toBe(20);
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('frost', {
      en: { name: 'Frost', bonus: ['Slow +10 points (max 60%)', 'Hits on slowed (≥35%) enemies freeze 0.5 s (10%)', 'Slow +15 points (max 70%); hits on slowed enemies freeze 0.7 s (20%)'] },
      de: { name: 'Frost', bonus: ['Verlangsamung +10 Punkte (max. 60 %)', 'Treffer auf verlangsamte (≥35 %) Gegner frieren 0,5 s ein (10 %)', 'Verlangsamung +15 Punkte (max. 70 %); Treffer auf verlangsamte Gegner frieren 0,7 s ein (20 %)'] },
    });
  });
});

// Runtime: `afterHit`, after the engine applied this hit's slow. One draw when every condition holds, none otherwise.
describe('Frost set: freeze', () => {
  const freeze = (n: number, seed: number, boss = false) => {
    const a = arena(cart(n), { seed });
    return { ...a, enemy: a.fake.spawnEnemy({ hp: 1000, def: { behavior: boss ? 'boss' : 'chase' } }) };
  };

  it('is Frost L2 with a 35% slow: the very hit that slows can already freeze (the setup of the tests below)', () => {
    const { b, stats: w } = freeze(1, 1);
    expect(b.sets.frost).toBe(2);
    expect(w.slow?.pct).toBeCloseTo(0.35, 12);
  });

  it('a lucky roll stuns for the set\'s seconds, turns the enemy into an ice block and plays the frost sound; one draw', () => {
    const seed = seedWhere((r) => r < 0.1);
    const { fake, stats: w, enemy } = freeze(1, seed);
    fake.hit(enemy, 3, w);
    expect(fake.callsOf('stun')).toEqual([{ at: 0, kind: 'stun', enemy: enemy.id, seconds: 0.5, tag: 'frost' }]);
    expect(enemy.frozenT).toBe(0.5);
    expect(fake.callsOf('sound')).toEqual([{ at: 0, kind: 'sound', name: 'frost', opts: { rate: 1.3, volume: 0.5 } }]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('a miss does nothing and still uses exactly one draw', () => {
    const seed = seedWhere((r) => r >= 0.1);
    const { fake, stats: w, enemy } = freeze(1, seed);
    fake.hit(enemy, 3, w);
    expect(fake.callsOf('stun')).toEqual([]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('L3 freezes longer (0.7 s) on a better chance (20%)', () => {
    const seed = seedWhere((r) => r < 0.2 && r >= 0.1);
    const { fake, stats: w, enemy } = freeze(2, seed);
    fake.hit(enemy, 3, w);
    expect(fake.callsOf('stun')).toEqual([{ at: 0, kind: 'stun', enemy: enemy.id, seconds: 0.7, tag: 'frost' }]);
  });

  it('bosses are stunned by the call but never turn into an ice block (no sound either)', () => {
    const seed = seedWhere((r) => r < 0.1);
    const { fake, stats: w, enemy } = freeze(1, seed, true);
    fake.hit(enemy, 3, w);
    expect(fake.callsOf('stun')).toHaveLength(1);
    expect(enemy.frozenT).toBeUndefined();
    expect(fake.callsOf('sound')).toEqual([]);
  });

  it('needs L2: at L1 there is no roll (no draw)', () => {
    const { fake, stats: w, enemy } = freeze(0, 1);
    fake.hit(enemy, 3, w);
    expect(fake.callsOf('stun')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('needs the enemy to be slowed by 35% or more: no roll below that or without a slow', () => {
    const { fake, stats: w, enemy } = freeze(1, 1);
    fake.hit(enemy, 3, { ...w, slow: { pct: 0.2, duration: 1 } });
    fake.hit(fake.spawnEnemy({ hp: 1000 }), 3, { ...w, slow: null });
    expect(fake.callsOf('stun')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('direct hits only: not DoT, aura or puddle ticks', () => {
    const { fake, stats: w } = freeze(1, 1);
    const tick = (s: WeaponStats, o = {}) => { const e = fake.spawnEnemy({ hp: 1000 }); e.status.slowPct = 0.5; e.status.slowUntil = 10; fake.hit(e, 1, { ...s, slow: null }, o); };
    tick(w, { isDot: true }); tick({ ...w, pattern: 'aura' }); tick({ ...w, pattern: 'puddle' });
    expect(fake.callsOf('stun')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
    tick(w); // the same pre-slowed enemy with a direct pattern rolls
    expect(fake.rng()).toBe(draws(1, 3)[2]);
  });
});

describe('Frost set: draw order next to the Electric chain', () => {
  // Nailgun (electrical) + Ice Pack touching it + Fizz and a ★2 Mop (Frost L2) + Battery (Electric L1: 10% to arc to 1 enemy): both sets roll on one hit.
  const both = (seed: number) => {
    const a = arena([at('nailgun'), ICE, far('fizz'), far('mop', 2), far('battery')], { seed });
    const target = a.fake.spawnEnemy({ hp: 1000, x: 0, y: 0 }), other = a.fake.spawnEnemy({ hp: 1000, x: 60, y: 0 });
    return { ...a, target, other };
  };

  it('the first draw is the freeze roll, the second the chain roll', () => {
    const freezeOnly = seedWhere((r) => r < 0.1, (r) => r >= 0.1);
    const a = both(freezeOnly);
    expect(a.b.sets.frost).toBe(2);
    expect(a.b.sets.electric).toBe(1);
    a.fake.hit(a.target, 3, a.stats);
    expect(a.fake.callsOf('stun')).toHaveLength(1);
    expect(a.fake.callsOf('damage')).toEqual([]); // no chain
    expect(a.fake.rng()).toBe(draws(freezeOnly, 3)[2]);

    // The chained hit goes through the whole pipeline: it rolls its own freeze (the third draw), which also misses here.
    const chainOnly = seedWhere((r) => r >= 0.1, (r) => r < 0.1, (r) => r >= 0.1);
    const c = both(chainOnly);
    c.fake.hit(c.target, 3, c.stats);
    expect(c.fake.callsOf('stun')).toEqual([]);
    expect(c.fake.callsOf('damage')).toHaveLength(1);
    expect(c.fake.rng()).toBe(draws(chainOnly, 4)[3]);
  });
});

describe('Frost set: puddle slow (pattern:puddleEnter)', () => {
  const enter = (c: ReturnType<typeof arena>, pct: number) => {
    const ev = { stats: c.stats, enemy: c.fake.spawnEnemy(), first: false, puddle: { x: 0, y: 0, r: 60 }, slow: { pct, duration: 0.5 } };
    c.fake.hooks.emit('pattern:puddleEnter', ev as never);
    return ev.slow;
  };
  it('adds the set bonus to the puddle slow at L1+, capped, duration unchanged', () => {
    const t = contentSetTune('frost', 1);
    expect(enter(arena(cart(0)), 0.25)).toEqual({ pct: 0.25 + t.slowBonus, duration: 0.5 });
    expect(enter(arena(cart(0)), 0.58).pct).toBe(t.slowCap);
  });
  it('does nothing below the threshold', () => {
    expect(enter(arena([at('mop')]), 0.25)).toEqual({ pct: 0.25, duration: 0.5 });
  });
});
