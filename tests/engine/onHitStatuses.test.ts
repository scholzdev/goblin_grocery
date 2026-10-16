import { describe, expect, it } from 'vitest';
import { contentSetTune } from '../../src/engine/registry';
import { combatRng } from '../../src/systems/rng';
import type { WeaponStats } from '../../src/types';
import { arena, at, gilded } from '../content/helpers';
import type { Spec } from '../golden/carts';

// The stats-driven on-hit behavior (src/engine/onHitStatuses.ts): burn, Heat L2 ignite, slow, Frost L2 freeze, Double Bag echo. Every
// source (Fuel Can, Jelly Beans, sets, combos) sets the WeaponStats field; the engine applies it. All through FakeCtx with real
// WeaponStats from computeBuild carts. The fake runs the same functions the scene calls, at the same position of the damage pipeline.

const FROST = contentSetTune('frost', 2), FROST3 = contentSetTune('frost', 3); // L1/L2 share their numbers; L3 replaces them
const S = (type: Spec['type'], extra: Partial<Spec> = {}): Spec => ({ type, ...extra });

/** First seed whose first combat draw satisfies `ok` (and, with `second`, the second draw too). */
const seedWhere = (ok: (r: number) => boolean, second?: (r: number) => boolean): number => {
  for (let seed = 1; seed < 5000; seed++) { const r = combatRng(seed, 0), a = r(), b = r(); if (ok(a) && (!second || second(b))) return seed; }
  throw new Error('no seed');
};
/** The next number the fake would draw (a probe: draws are consumed). */
const draws = (seed: number, n: number): number[] => { const r = combatRng(seed, 0); return Array.from({ length: n }, () => r()); };

describe('burn (WeaponStats.burn)', () => {
  it('a hit with a burn weapon sets the enemy on fire: dps, duration, tick from the stats', () => {
    const { fake, stats } = arena([at('nailgun'), at('fuel')]);
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    expect(fake.callsOf('ignite')).toEqual([{ at: 0, kind: 'ignite', enemy: e.id, burn: { dps: 2.5, duration: 2, tick: 0.5 } }]);
    expect(e.status).toMatchObject({ burnDps: 2.5, burnUntil: 2, burnTick: 0.5 });
  });

  it('refreshes instead of stacking: a second hit extends the timer, the dps stays', () => {
    const { fake, stats } = arena([at('nailgun'), at('fuel')]);
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    const firstTick = e.status.nextBurnAt;
    fake.advance(1);
    fake.hit(e, 3, stats); fake.hit(e, 3, stats);
    expect(e.status.burnDps).toBe(2.5);
    expect(e.status.burnUntil).toBe(3); // 1 + 2
    expect(e.status.nextBurnAt).toBe(firstTick); // still burning: the tick schedule is not restarted
  });

  it('keeps the stronger burn while it burns, and restarts a weaker one once it ran out', () => {
    const strong = arena([at('nailgun'), at('fuel', 3)]), weak = arena([at('nailgun'), at('fuel', 1)]);
    const e = strong.fake.spawnEnemy({ hp: 100 });
    strong.fake.hit(e, 3, strong.stats);
    strong.fake.advance(1); strong.fake.hit(e, 3, weak.stats);
    expect(e.status.burnDps).toBe(5);
    strong.fake.advance(5); strong.fake.hit(e, 3, weak.stats); // the burn is long over
    expect(e.status.burnDps).toBe(2.5);
  });

  it('is not tied to the Fuel Can: a Jelly Beans (heat) burn applies the same way, with its own numbers', () => {
    const { fake, stats } = arena([at('nailgun'), at('jellybeans', 1, { flavor: 'heat' })]);
    expect(stats.buffs).not.toContain('fuel');
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    expect(e.status.burnDps).toBeCloseTo(1.75, 12);
  });

  it('goes through the aisle burn modifier (heatwave events, departments)', () => {
    const { fake, stats } = arena([at('nailgun'), at('fuel')], { burnMult: 2 });
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    expect(e.status.burnDps).toBe(5);
  });

  it('burn ticks themselves (isDot hits) never re-ignite, and a weapon without burn does nothing', () => {
    const { fake, stats } = arena([at('nailgun'), at('fuel')]);
    const plain = arena([at('nailgun')]);
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, plain.stats);
    expect(fake.callsOf('ignite')).toEqual([]);
    expect(e.status.burnDps).toBe(0);
    fake.hit(e, 1, { ...stats, burn: null }, { isDot: true });
    expect(fake.callsOf('ignite')).toEqual([]);
  });
});

describe('Heat L2 ignite (WeaponStats.ignite)', () => {
  // Pan with the Hot Sauce touching it, the Fuel Can and the Cooker apart: Heat L3 and an ignite chance, but no burn of its own.
  const heat = () => arena([S('pan'), S('hotsauce'), S('fuel', { near: [], apart: [0] }), S('cooker', { near: [] })]);

  it('has an ignite chance and no burn in this cart (the setup of the tests below)', () => {
    const { stats, b } = heat();
    expect(b.sets.heat).toBeGreaterThanOrEqual(2);
    expect(stats.burn).toBeNull();
    expect(stats.ignite?.chance).toBe(0.25);
  });

  it('ignites when the roll is under the chance: burn, three flames and a ring; one draw', () => {
    const seed = seedWhere((r) => r < 0.25);
    const { fake, stats } = arena([S('pan'), S('hotsauce'), S('fuel', { near: [], apart: [0] }), S('cooker', { near: [] })], { seed });
    const e = fake.spawnEnemy({ hp: 100, x: 10, y: 80 });
    fake.hit(e, 3, stats);
    expect(fake.callsOf('ignite')).toEqual([{ at: 0, kind: 'ignite', enemy: e.id, burn: stats.ignite!.burn }]);
    expect(fake.callsOf('fx').filter((c) => c.method === 'flame')).toHaveLength(3);
    expect(fake.callsOf('fx').find((c) => c.method === 'ring')?.args).toEqual(['fx_pulse', 10, 80, 60, 200, 0xff7a3d]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('does nothing when the roll misses, and still consumes exactly one draw', () => {
    const seed = seedWhere((r) => r >= 0.25);
    const { fake, stats } = arena([S('pan'), S('hotsauce'), S('fuel', { near: [], apart: [0] }), S('cooker', { near: [] })], { seed });
    fake.hit(fake.spawnEnemy({ hp: 100 }), 3, stats);
    expect(fake.callsOf('ignite')).toEqual([]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('only without a burn of its own: no roll, no draw', () => {
    const seed = seedWhere((r) => r < 0.25);
    const { fake, stats } = arena([S('pan'), S('hotsauce'), S('fuel', { near: [], apart: [0] }), S('cooker', { near: [] })], { seed });
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, { ...stats, burn: { dps: 2.5, duration: 2, tick: 0.5 } });
    expect(fake.callsOf('ignite')).toHaveLength(1); // the weapon's own burn, not the ignite
    expect(fake.callsOf('ignite')[0].burn).toEqual({ dps: 2.5, duration: 2, tick: 0.5 });
    expect(fake.rng()).toBe(draws(seed, 1)[0]);
  });

  it('direct hits only: a DoT tick does not roll', () => {
    const { fake, stats } = heat();
    fake.hit(fake.spawnEnemy({ hp: 100 }), 1, stats, { isDot: true });
    expect(fake.callsOf('ignite')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });
});

describe('slow (WeaponStats.slow)', () => {
  it('a hit with a slow weapon slows the enemy for the stats\' duration', () => {
    const { fake, stats } = arena([at('nailgun'), at('ice')]);
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    expect(fake.callsOf('slow')).toEqual([{ at: 0, kind: 'slow', enemy: e.id, slow: { pct: 0.25, duration: 1 } }]);
    expect(e.status).toMatchObject({ slowPct: 0.25, slowUntil: 1 });
  });

  it('refreshes the timer and keeps the stronger slow while it lasts', () => {
    const strong = arena([at('nailgun'), at('ice', 3)]), weak = arena([at('nailgun'), at('ice', 1)]);
    const e = strong.fake.spawnEnemy({ hp: 100 });
    strong.fake.hit(e, 3, strong.stats);
    strong.fake.advance(0.5); strong.fake.hit(e, 3, weak.stats);
    expect(e.status).toMatchObject({ slowPct: 0.5, slowUntil: 1.5 });
    strong.fake.advance(2); strong.fake.hit(e, 3, weak.stats); // expired: the weaker slow replaces it
    expect(e.status.slowPct).toBe(0.25);
  });

  it('is not tied to the Ice Pack: a Jelly Beans (frost) slow applies the same way', () => {
    const { fake, stats } = arena([at('nailgun'), at('jellybeans', 1, { flavor: 'frost' })]);
    expect(stats.buffs).not.toContain('ice');
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    expect(e.status.slowPct).toBeCloseTo(0.175, 12);
  });

  it('applies what the build computed, caps included: Ice ★4 + Frost L3 stops at the set cap', () => {
    // Fizz with an Ice Pack (★3, lifted to an effective ★4 by the Gold Star) and Mop + Spray for Frost L3 (slow cap 70%).
    const { fake, stats, b } = arena([S('fizz'), S('ice', { tier: 3 }), S('mop', { near: [] }), S('spray', { near: [] }), gilded(1)]);
    expect(b.sets.frost).toBe(3);
    expect(stats.slow?.pct).toBe(FROST3.slowCap);
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 3, stats);
    expect(e.status.slowPct).toBe(FROST3.slowCap);
  });
});

describe('Frost L2 freeze', () => {
  // Fizz Cannon + Ice Pack + Mop: Frost L2. The pack's 25% plus the set's 10% reaches the 35% the freeze needs.
  const frost = (seed?: number, boss = false) => {
    const a = arena([S('fizz'), S('ice'), S('mop', { near: [] })], seed ? { seed } : {});
    return { ...a, enemy: a.fake.spawnEnemy({ hp: 1000, def: { behavior: boss ? 'boss' : 'chase' } }) };
  };

  it('is Frost L2 with a 35% slow (the setup of the tests below)', () => {
    const { b, stats } = frost();
    expect(b.sets.frost).toBe(2);
    expect(stats.slow?.pct).toBe(0.35);
    expect(FROST.stunMinSlow).toBe(0.35);
  });

  it('freezes on a lucky roll: stun for the set\'s seconds, the ice-block timer and the frost sound', () => {
    const seed = seedWhere((r) => r < FROST.stunChance);
    const { fake, stats, enemy } = frost(seed);
    fake.hit(enemy, 3, stats);
    expect(fake.callsOf('stun')).toEqual([{ at: 0, kind: 'stun', enemy: enemy.id, seconds: FROST.stun }]);
    expect(enemy.frozenT).toBe(FROST.stun);
    expect(fake.callsOf('sound')).toEqual([{ at: 0, kind: 'sound', name: 'frost', opts: { rate: 1.3, volume: 0.5 } }]);
  });

  it('does nothing on an unlucky roll, and uses exactly one draw', () => {
    const seed = seedWhere((r) => r >= FROST.stunChance);
    const { fake, stats, enemy } = frost(seed);
    fake.hit(enemy, 3, stats);
    expect(fake.callsOf('stun')).toEqual([]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('bosses are stunned by the call but never turn into an ice block', () => {
    const seed = seedWhere((r) => r < FROST.stunChance);
    const { fake, stats, enemy } = frost(seed, true);
    fake.hit(enemy, 3, stats);
    expect(enemy.frozenT).toBeUndefined();
    expect(fake.callsOf('sound')).toEqual([]);
  });

  it('needs the enemy to be slowed enough: no roll (no draw) below 35% slow or without a slow at all', () => {
    const { fake, stats, enemy } = frost(1);
    fake.hit(enemy, 3, { ...stats, slow: { pct: 0.2, duration: 1 } }); // slowed to 20% only
    fake.hit(fake.spawnEnemy({ hp: 1000 }), 3, { ...stats, slow: null }); // not slowed
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('needs Frost L2: at L1 and at 0 there is no roll', () => {
    const l1 = arena([S('fizz'), S('ice')], { seed: 1 });
    expect(l1.b.sets.frost).toBe(1);
    l1.fake.hit(l1.fake.spawnEnemy({ hp: 1000 }), 3, l1.stats);
    expect(l1.fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('direct hits only: not on DoT ticks, aura or puddle ticks', () => {
    const { fake, stats } = frost(1);
    const tick = (s: WeaponStats, o = {}) => { const e = fake.spawnEnemy({ hp: 1000 }); e.status.slowPct = 0.5; e.status.slowUntil = 10; fake.hit(e, 1, { ...s, slow: null }, o); };
    tick(stats, { isDot: true });
    tick({ ...stats, pattern: 'aura' });
    tick({ ...stats, pattern: 'puddle' });
    expect(fake.callsOf('stun')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]); // no roll, no draw
    tick(stats); // the same pre-slowed enemy with a direct pattern does roll
    expect(fake.rng()).toBe(draws(1, 3)[2]); // (the probe above took the first draw, the roll the second)
  });

  it('Frost L3 freezes for longer, on a better chance', () => {
    const seed = seedWhere((r) => r < FROST3.stunChance && r >= FROST.stunChance);
    const { fake, stats, b } = arena([S('fizz'), S('ice'), S('mop', { near: [] }), S('spray', { near: [] })], { seed });
    expect(b.sets.frost).toBe(3);
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 3, stats);
    expect(fake.callsOf('stun')).toEqual([{ at: 0, kind: 'stun', enemy: e.id, seconds: FROST3.stun }]);
  });
});

describe('draw order inside one hit: ignite first, then the freeze', () => {
  // A weapon with both an ignite chance (Heat L2) and a slow (Frost L2): the combination does not exist in a build, but the engine
  // rule must hold for any stats.
  const both = (seed: number) => {
    const a = arena([S('fizz'), S('ice'), S('mop', { near: [] })], { seed });
    return { ...a, stats: { ...a.stats, ignite: { chance: 0.25, burn: { dps: 3, duration: 2, tick: 0.5 } } } as WeaponStats };
  };
  it('the first draw is the ignite roll, the second the freeze roll', () => {
    const seed = seedWhere((r) => r >= 0.25, (r) => r < FROST.stunChance);
    const { fake, stats } = both(seed);
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 3, stats);
    expect(fake.callsOf('ignite')).toEqual([]); // the first draw missed the ignite ...
    expect(fake.callsOf('stun')).toHaveLength(1); // ... and the second one froze
    expect(fake.rng()).toBe(draws(seed, 3)[2]);
  });
  it('with a lucky first draw the ignite fires and the freeze takes the second', () => {
    const seed = seedWhere((r) => r < 0.25, (r) => r >= FROST.stunChance);
    const { fake, stats } = both(seed);
    fake.hit(fake.spawnEnemy({ hp: 1000 }), 3, stats);
    expect(fake.callsOf('ignite')).toHaveLength(1);
    expect(fake.callsOf('stun')).toEqual([]);
  });
});

describe('Double Bag echo (WeaponStats.echo)', () => {
  const bag = (opts = {}) => arena([at('nailgun'), at('doublebag')], opts);

  it('strikes a second time 0.12 s later for the echo fraction of the incoming hit', () => {
    const { fake, stats } = bag();
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 10, stats);
    expect(e.hp).toBe(90);
    fake.advance(0.1);
    expect(e.hp).toBe(90);
    fake.advance(0.03);
    expect(e.hp).toBe(85); // 10 x 0.5
    expect(fake.callsOf('damage')).toEqual([{ at: 0.12, kind: 'damage', enemy: e.id, dmg: 5, source: stats.uid, opts: { echo: true, quiet: undefined } }]);
    expect(fake.callsOf('fx').find((c) => c.method === 'popImage')?.args.slice(0, 1)).toEqual(['fx_echo']);
  });

  it('echoes are computed from the incoming damage, not from the crit or armor result', () => {
    const { fake, stats } = bag();
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 10, { ...stats, critChance: 1 }); // 20 dealt
    fake.advance(1);
    expect(fake.callsOf('damage')[0].dmg).toBe(5);
  });

  it('echoes never echo, and DoT ticks, popper blasts and chained hits are not echoed', () => {
    const { fake, stats } = bag();
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.hit(e, 10, stats, { echo: true });
    fake.hit(e, 10, stats, { isDot: true });
    fake.hit(e, 10, stats, { fromPopper: true });
    fake.hit(e, 10, stats, { chained: true });
    fake.advance(1);
    expect(fake.callsOf('delay')).toEqual([]);
    expect(fake.callsOf('damage')).toEqual([]);
    fake.hit(e, 10, stats); // a direct hit schedules exactly one, and its echo schedules none
    fake.advance(1);
    expect(fake.callsOf('delay')).toHaveLength(1);
    expect(fake.callsOf('damage')).toHaveLength(1);
  });

  it('keeps the hit\'s quiet flag (area ticks echo quietly)', () => {
    const { fake, stats } = bag();
    fake.hit(fake.spawnEnemy({ hp: 100 }), 10, stats, { quiet: true });
    fake.advance(1);
    expect(fake.callsOf('damage')[0].opts).toEqual({ echo: true, quiet: true });
  });

  it('is skipped when the enemy died meanwhile or the aisle is over', () => {
    const { fake, stats } = bag();
    const dead = fake.spawnEnemy({ hp: 100 }), over = fake.spawnEnemy({ hp: 100 });
    fake.hit(dead, 10, stats); fake.hit(over, 10, stats);
    dead.alive = false; fake.active = false;
    fake.advance(1);
    expect(fake.callsOf('damage')).toEqual([]);
  });

  it('a lethal hit still schedules it and is then skipped (dead target); a weapon without echo schedules nothing; it draws no rng', () => {
    const { fake, stats } = bag({ seed: 5 });
    fake.hit(fake.spawnEnemy({ hp: 5 }), 10, stats);
    fake.advance(1);
    expect(fake.callsOf('damage')).toEqual([]);
    const plain = arena([at('nailgun')]);
    plain.fake.hit(plain.fake.spawnEnemy({ hp: 100 }), 10, plain.stats);
    expect(plain.fake.callsOf('delay')).toEqual([]);
    expect(fake.rng()).toBe(draws(5, 1)[0]);
  });
});

describe('a plain weapon is untouched by the engine modules', () => {
  it('a toaster-only cart: a hit costs exactly its damage and triggers no status, delay, blast, coin or draw', () => {
    const { fake, stats } = arena([at('toaster')], { seed: 11 });
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 7, stats);
    fake.hit(e, 7, stats, { kb: 100 });
    expect(e.hp).toBe(86);
    expect(e.status).toMatchObject({ burnDps: 0, slowPct: 0, slowUntil: 0 });
    for (const kind of ['ignite', 'slow', 'stun', 'delay', 'popperBlast', 'dropCoin', 'sound'] as const) expect(fake.callsOf(kind), kind).toEqual([]);
    fake.hit(e, 100, stats); // a kill: nothing explodes, nothing drops
    expect(e.alive).toBe(false);
    expect(fake.calls.filter((c) => c.kind !== 'damage')).toEqual([]);
    expect(fake.rng()).toBe(draws(11, 1)[0]); // toaster has no crit, ignite or freeze roll: not one draw was spent
  });
});

// Guard for the order of ArenaScene.damageEnemy (docs/item-hooks-refactor.md §4c): the engine modules sit exactly where the lines they
// replaced were, and the lines around them (knockback, flash/number fx, kill) are still there. The sets' afterHit / afterKill emits sit where the Frost freeze, Cleaning knockback, Electric chain, Kitchen heal and Blast pop lines were.
const arenaSource = (Object.values(import.meta.glob('../../src/scenes/ArenaScene.ts', { query: '?raw', import: 'default', eager: true }))[0] as string);
describe('ArenaScene.damageEnemy keeps its pipeline', () => {
  const body = arenaSource.slice(arenaSource.indexOf('damageEnemy(e: Enemy'), arenaSource.indexOf('/** Kitchen L2 heal'));
  const at_ = (needle: string): number => { const i = body.indexOf(needle); expect(i, needle).toBeGreaterThan(-1); return i; };
  it('runs the steps in order', () => {
    const order = [
      "H.emit('modifyDamage'", 'markedDamage(dmg, e.markedUntil, now)', 'this.rng() < stats.critChance', "H.emit('onCrit'", 'armorDamage(',
      'e.hp -= dmg', "H.emit('onHit'", 'applyHitStatuses(hit', "H.emit('afterHit'", 'if (o.kb) {', 'e.kx += ', "this.fx.spark(e.x, e.y - 30, 3, armored", 'this.fx.number(', 'scheduleEcho(hit',
      'this.killEnemy(e, true, hit)', "H.emit('afterKill'", 'applyKillEffects(hit',
    ].map(at_);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
