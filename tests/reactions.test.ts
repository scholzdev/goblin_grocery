import { afterEach, describe, expect, it } from 'vitest';
import { REACTIONS, REACTION_IDS, type ReactionId } from '../src/engine/define';
import { FakeCtx } from '../src/engine/fakeCtx';
import { ELEMENT_COLORS } from '../src/engine/damageType';
import { REACTION_LABEL, REACTION_TEXT, consumeBurn, consumeFrost, isBurning, isFrosted, isPoisoned, markFrostStun, reactionReady } from '../src/engine/reactions';
import { spawnFirePool } from '../src/engine/patterns';
import { damageBreakdownHtml } from '../src/ui/damageBreakdown';
import { newDamageStats, recordReaction, type DamageSink } from '../src/systems/damageStats';
import { applyBurn, applyPoison, applyShred, applySlow, cleanseStatus, newStatus, shredStacks } from '../src/systems/combat';
import { applyWet, isWet } from '../src/engine/wet';
import { t } from '../src/i18n';
import { setLang } from '../src/i18n/lang';
import { arena, arsenal, at, far } from './content/helpers';

// Element reactions (docs/item-hooks-refactor.md "Reactions"): the four rules, the cooldown, the frosted definition, what a reaction hit may and may not do, the
// breakdown and the texts. Everything runs through the FakeCtx, which owns the same `Reactor` as the arena.

afterEach(() => setLang('en'));

const BURN = { dps: 3, duration: 3, tick: 0.5 };
const SLOW = { pct: 0.3, duration: 4 };
/** The reaction bursts a FakeCtx logged (the damage calls flagged with `opts.reaction`). */
const bursts = (f: FakeCtx, id?: ReactionId) => f.callsOf('damage').filter((c) => c.opts.reaction && (!id || c.opts.reaction === id));
const counts = (f: FakeCtx) => f.dmgLog.damage.reactions;
const labels = (f: FakeCtx) => f.callsOf('fx').filter((c) => c.method === 'label').map((c) => c.args[2]);
/** Enemies in a row along x. */
const row = (f: FakeCtx, xs: number[], extra: Parameters<FakeCtx['spawnEnemy']>[0] = {}) => xs.map((x) => f.spawnEnemy({ hp: 1000, x, ...extra }));

describe('REACTIONS and the frosted rule', () => {
  it('the numbers', () => {
    expect(REACTIONS).toEqual({
      cooldown: 1,
      shatter: { flat: 8, share: 0.5, cooldown: 3 },
      fumes: { radius: 60, duration: 2, tick: 0.5, poisonDuration: 2 },
      conduct: { hops: 3, share: 0.6 },
      crack: { targets: 3, radius: 90, share: 0.5, shred: 1 },
      iceSheet: { slide: 1.5, slam: 12, speed: 260 },
      detonate: { radius: 70 },
    });
    expect([...REACTION_IDS]).toEqual(['shatter', 'fumes', 'conduct', 'crack', 'iceSheet', 'detonate']);
  });

  it('a stats-driven slow (ctx.slow: Ice Pack, Jelly frost, Cold Storage, Brain Freeze) frosts the enemy for the slow\'s duration', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy();
    expect(isFrosted(e.status, 0)).toBe(false);
    f.slow(e, SLOW);
    expect(isFrosted(e.status, 3.99)).toBe(true);
    expect(isFrosted(e.status, 4)).toBe(false);
  });

  it('the soap puddle and the wet-floor slow (applySlow without the frost flag) do not count', () => {
    const s = newStatus();
    applySlow(s, SLOW, 0);
    expect(s.slowUntil).toBe(4);
    expect(isFrosted(s, 1)).toBe(false);
  });

  it('a real Mop puddle does not frost: it slows, and a Fuel Can burn on top does not Shatter', () => {
    const { a, fake } = arsenal([at('mop'), at('fuel')]);
    const e = fake.spawnEnemy({ hp: 1000, x: 0, y: 0 });
    fake.player.x = 0; fake.player.y = 0;
    a.run(12, 0.05);
    expect(e.status.slowUntil).toBeGreaterThan(fake.time);
    expect(isFrosted(e.status, fake.time)).toBe(false);
    fake.ignite(e, BURN);
    expect(counts(fake).shatter).toBe(0);
  });

  it('an Ice Pack on a weapon frosts what its hit lands on', () => {
    const { fake, stats } = arena([at('toaster'), at('ice')]);
    const e = fake.spawnEnemy({ hp: 100 });
    expect(stats.slow).toBeTruthy();
    fake.hit(e, 10, { ...stats, critChance: 0 });
    expect(isFrosted(e.status, fake.time)).toBe(true);
  });

  it('a frost-tagged stun (the freeze: Frost set, Black Ice, Frostbite Nails) frosts; an electric stun and the dash stun do not', () => {
    const f = new FakeCtx();
    const [ice, spark, dash] = row(f, [0, 500, 1000]);
    f.stun(ice, 1, 'frost');
    f.stun(spark, 1, 'electric');
    f.stun(dash, 1);
    expect(isFrosted(ice.status, 0.5)).toBe(true);
    expect(isFrosted(ice.status, 1)).toBe(false);
    expect(isFrosted(spark.status, 0.5)).toBe(false);
    expect(isFrosted(dash.status, 0.5)).toBe(false);
  });

  it('a boss has no stun to freeze, but its frost slow frosts it (bosses are not immune)', () => {
    const f = new FakeCtx();
    const boss = f.spawnEnemy({ hp: 1000, def: { id: 'boss_frozen', behavior: 'boss' } });
    f.stun(boss, 1, 'frost');
    expect(isFrosted(boss.status, 0.5)).toBe(false);
    f.slow(boss, SLOW);
    f.ignite(boss, BURN);
    expect(counts(f).shatter).toBe(1);
  });

  it('burning, poisoned and the cooldown are plain reads of the status', () => {
    const s = newStatus();
    expect([isBurning(s, 0), isPoisoned(s, 0), reactionReady(s, 0)]).toEqual([false, false, true]);
    applyBurn(s, BURN, 0); applyPoison(s, 2, 2, 0);
    expect([isBurning(s, 1), isPoisoned(s, 1), isBurning(s, 3), isPoisoned(s, 2)]).toEqual([true, true, false, false]);
    s.reactionCdUntil = 1;
    expect([reactionReady(s, 0.99), reactionReady(s, 1)]).toEqual([false, true]);
    markFrostStun(s, 2, 5);
    expect(s.frostUntil).toBe(7);
  });
});

describe('Shatter: burn + frosted', () => {
  it('burn, then frost slow: a flat burst of 8 (no hit damage known), the label pops, the count is recorded', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 100 });
    f.ignite(e, BURN);
    expect(bursts(f)).toHaveLength(0);
    f.slow(e, SLOW);
    expect(bursts(f)).toHaveLength(1);
    expect(bursts(f)[0]).toMatchObject({ enemy: e.id, dmg: 8, source: null, opts: { reaction: 'shatter', tags: ['heat', 'frost'], label: 'Shatter' } });
    expect(e.hp).toBe(92);
    expect(labels(f)).toEqual(['SHATTER!']);
    expect(counts(f)).toEqual({ shatter: 1, fumes: 0, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 });
    expect(f.dmgLog.damage.byType.reaction).toBe(8);
  });

  it('frost slow, then burn: the same', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 100 });
    f.slow(e, SLOW);
    f.ignite(e, BURN);
    expect(bursts(f, 'shatter')).toHaveLength(1);
    expect(e.hp).toBe(92);
  });

  it('a freeze (frost stun) counts too, in either order, and the burst breaks it: the stun and the ice block are cut', () => {
    const f = new FakeCtx();
    const [a, b] = row(f, [0, 500], { hp: 100 });
    f.ignite(a, BURN);
    a.frozenT = 2; // (the Frost set writes it right after its stun)
    f.stun(a, 2, 'frost');
    expect(bursts(f)).toHaveLength(1);
    expect(a.stateT).toBe(0);
    expect(a.frozenT).toBeLessThan(0.01);
    f.stun(b, 2, 'frost');
    f.ignite(b, BURN);
    expect(bursts(f)).toHaveLength(2);
    expect(b.stateT).toBe(0);
  });

  it('it eats the burn and the frost, and nothing else (poison, wet, shred, a longer slow stay)', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 100 });
    f.poison(e, 2, 5); f.wet(e, 5); f.shred(e, 2);
    f.slow(e, SLOW);
    f.ignite(e, BURN); // wet: steam halves the burn and dries it, the burn is still a burn
    expect(counts(f).shatter).toBe(1);
    expect(isBurning(e.status, 0)).toBe(false);
    expect(e.status).toMatchObject({ burnUntil: 0, burnDps: 0, slowUntil: 0, slowPct: 0, frostUntil: 0 });
    expect(e.status.poisonUntil).toBe(5);
    expect(shredStacks(e.status, 0)).toBe(2);
    expect(counts(f).fumes).toBe(0); // the cooldown ate it: burn + poison was possible too
  });

  it('a soap slow that outlasts the frost stays', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 100 });
    f.slow(e, { pct: 0.3, duration: 1 });
    applySlow(e.status, { pct: 0.25, duration: 5 }, 0); // the mop
    f.ignite(e, BURN);
    expect(counts(f).shatter).toBe(1);
    expect(e.status.slowUntil).toBe(5);
    expect(isFrosted(e.status, 0)).toBe(false);
  });

  it('inside a hit the burst is 8 + 50% of that hit\'s final damage, once, after the whole hit (burn AND slow of the same toast)', () => {
    const { fake, stats } = arena([at('toaster'), at('fuel'), at('ice')]);
    const st = { ...stats, critChance: 0 };
    const e = fake.spawnEnemy({ hp: 100 });
    fake.hit(e, 10, st);
    const dealt = fake.dmgLog.damageByWeapon[st.uid];
    expect(dealt).toBe(10);
    expect(bursts(fake)).toHaveLength(1);
    expect(bursts(fake)[0].dmg).toBe(8 + 0.5 * dealt);
    expect(e.hp).toBe(100 - dealt - 13);
    expect(counts(fake).shatter).toBe(1);
  });

  it('inside a hit, either order: a burn-only hit on a frosted enemy, a slow-only hit on a burning one', () => {
    const { fake, stats } = arena([at('toaster'), at('fuel'), at('ice')]);
    const st = { ...stats, critChance: 0 };
    const [x, y] = row(fake, [0, 500], { hp: 100 });
    fake.slow(x, SLOW);
    fake.hit(x, 10, { ...st, slow: null });
    fake.ignite(y, BURN);
    fake.hit(y, 10, { ...st, burn: null });
    expect(bursts(fake, 'shatter').map((c) => [c.enemy, c.dmg])).toEqual([[x.id, 13], [y.id, 13]]);
  });

  it('no application, no reaction: hitting a burning frosted enemy with a hit that applies neither does not shatter again', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.slow(e, SLOW); f.ignite(e, BURN); // shatters, eaten
    f.ignite(e, BURN); // burning again, not frosted
    f.advance(2);
    f.hit(e, 10, null, { label: 'Plain' });
    expect(counts(f).shatter).toBe(1);
  });

  it('the burst uses the affinity of heat AND frost together (best weak minus best resist)', () => {
    const f = new FakeCtx();
    const banana = f.spawnReal('banana', { hp: 1000 }); // weak to frost
    const turkey = f.spawnReal('turkey', { hp: 1000, x: 500 }); // weak to heat, resists frost: x1.0, and armor does not soak a reaction
    const gum = f.spawnReal('gum', { hp: 1000, x: 1000 }); // weak to frost, resists heat: x1.0
    for (const e of [banana, turkey, gum]) { f.slow(e, SLOW); f.ignite(e, BURN); }
    expect(bursts(f).map((c) => c.enemy)).toEqual([banana.id, turkey.id, gum.id]);
    expect(1000 - banana.hp).toBeCloseTo(8 * 1.3, 9);
    expect([1000 - turkey.hp, 1000 - gum.hp]).toEqual([8, 8]);
    expect(f.dmgLog.damage.weak).toBeCloseTo(8 * 1.3, 9);
  });

  it('a killing hit takes no Shatter (a burst on a corpse does nothing), and the cooldown stays unspent', () => {
    const { fake, stats } = arena([at('toaster'), at('fuel'), at('ice')]);
    const e = fake.spawnEnemy({ hp: 5 });
    fake.hit(e, 10, { ...stats, critChance: 0 });
    expect(e.alive).toBe(false);
    expect(bursts(fake)).toHaveLength(0);
    expect(e.status.reactionCdUntil).toBe(0);
  });
});

describe('Toxic Fumes: burn + poison', () => {
  const setup = () => {
    const f = new FakeCtx();
    const [src, near, away] = row(f, [0, 70, 100], { hp: 1000 });
    return { f, src, near, away };
  };

  it('poison, then burn: a cloud poisons the OTHER enemies inside (radius 60 + their radius) with the source\'s poison dps for 2 s; the burn is eaten, the poison stays', () => {
    const { f, src, near, away } = setup();
    f.poison(src, 3, 5);
    expect(counts(f).fumes).toBe(0);
    f.ignite(src, BURN);
    expect(counts(f).fumes).toBe(1);
    expect(labels(f)).toEqual(['FUMES!']);
    expect(near.status).toMatchObject({ poisonDps: 3, poisonUntil: 2 });
    expect(away.status.poisonDps).toBe(0);
    expect(src.status).toMatchObject({ poisonDps: 3, poisonUntil: 5, burnUntil: 0, burnDps: 0 });
    expect(bursts(f)).toHaveLength(0); // no burst of its own
  });

  it('burn, then poison: the same', () => {
    const { f, src, near } = setup();
    f.ignite(src, BURN);
    f.poison(src, 4, 5);
    expect(counts(f).fumes).toBe(1);
    expect(near.status.poisonDps).toBe(4);
    expect(isBurning(src.status, 0)).toBe(false);
    expect(isPoisoned(src.status, 0)).toBe(true);
  });

  it('the cloud ticks at once and every 0.5 s for 2 s: a later arrival is poisoned until the last tick, then no more', () => {
    const { f, src, away } = setup();
    f.poison(src, 3, 9); f.ignite(src, BURN);
    f.advance(1.2);
    away.x = 70;
    expect(away.status.poisonDps).toBe(0);
    f.advance(0.4); // the tick at 1.5
    expect(away.status).toMatchObject({ poisonDps: 3, poisonUntil: 3.5 });
    const late = f.spawnEnemy({ hp: 1000, x: 500 });
    f.advance(0.7); // t = 2.3: the cloud is over
    late.x = 0;
    f.advance(2);
    expect(late.status.poisonDps).toBe(0);
  });

  it('the cloud stops with the aisle (combatActive false)', () => {
    const { f, src, away } = setup();
    f.poison(src, 3, 9); f.ignite(src, BURN);
    f.active = false;
    away.x = 70;
    f.advance(2.5);
    expect(away.status.poisonDps).toBe(0);
  });

  it('the cloud\'s poison is not an application: a burning neighbor in it is poisoned but does not react', () => {
    const { f, src, near } = setup();
    f.ignite(near, BURN);
    f.poison(src, 3, 5); f.ignite(src, BURN);
    expect(isPoisoned(near.status, 0)).toBe(true);
    expect(isBurning(near.status, 0)).toBe(true);
    expect(counts(f).fumes).toBe(1);
    f.advance(2.5);
    expect(counts(f).fumes).toBe(1);
  });

  it('inside a hit: the hit that burns a poisoned enemy sets it off once, at the end of the hit', () => {
    const { fake, stats } = arena([at('toaster'), at('fuel')]);
    const [src, near] = row(fake, [0, 50], { hp: 1000 });
    fake.poison(src, 2, 5);
    fake.hit(src, 10, { ...stats, critChance: 0 });
    expect(counts(fake).fumes).toBe(1);
    expect(near.status.poisonDps).toBe(2);
  });
});

describe('Conduct: wet + an electric hit', () => {
  it('an electric hit on a wet enemy: 3 hops to the nearest, each 60% of the hit (which already got x1.2), the Wet is eaten', () => {
    const f = new FakeCtx();
    const [src, ...rest] = row(f, [0, 50, 100, 150, 200]);
    f.wet(src);
    f.hit(src, 10, null, { tags: ['electric'], label: 'Zap' });
    const dealt = f.dmgLog.damageByWeapon.Zap;
    expect(dealt).toBeCloseTo(12, 12);
    expect(bursts(f, 'conduct').map((c) => [c.enemy, c.dmg])).toEqual([[rest[0].id, 0.6 * dealt], [rest[1].id, 0.6 * dealt], [rest[2].id, 0.6 * dealt]]);
    expect(bursts(f).every((c) => c.opts.tags?.[0] === 'electric')).toBe(true);
    expect(rest[3].hp).toBe(1000);
    expect(isWet(src.status, 0)).toBe(false);
    expect(labels(f)).toEqual(['CONDUCT!']);
    expect(counts(f).conduct).toBe(1);
  });

  it('hops go to the nearest enemy not hit yet within the chain range (120), not through a gap', () => {
    const f = new FakeCtx();
    const [src, a, b, , far1] = row(f, [0, 100, 200, 400, 530]);
    f.wet(src);
    f.hit(src, 10, null, { tags: ['electric'] });
    expect(bursts(f).map((c) => c.enemy)).toEqual([a.id, b.id]); // 400 is 200 from b, 530 is further
    expect(far1.hp).toBe(1000);
  });

  it('a dry enemy, or a wet one hit without the electric tag, does not conduct', () => {
    const f = new FakeCtx();
    const [dry, wet, , spare] = row(f, [0, 500, 1000, 1030]);
    f.wet(wet);
    f.hit(dry, 10, null, { tags: ['electric'] });
    f.hit(wet, 10, null, { tags: ['heat'] });
    expect(counts(f).conduct).toBe(0);
    expect(spare.hp).toBe(1000);
  });

  it('its hops have the electric affinity (a soda is weak to it) and never the Wet bonus', () => {
    const f = new FakeCtx();
    const src = f.spawnEnemy({ hp: 1000 }), soda = f.spawnReal('soda', { hp: 1000, x: 60 });
    f.wet(src); f.wet(soda);
    f.hit(src, 10, null, { tags: ['electric'], label: 'Zap' });
    expect(1000 - soda.hp).toBeCloseTo(0.6 * 12 * 1.3, 9);
  });

  it('a beam that kills still conducts', () => {
    const f = new FakeCtx();
    const [src, a] = row(f, [0, 50]);
    src.hp = 5;
    f.wet(src);
    f.hit(src, 10, null, { tags: ['electric'], label: 'Zap' });
    expect(src.alive).toBe(false);
    expect(bursts(f, 'conduct').map((c) => c.enemy)).toEqual([a.id]);
  });

  it('with a laser: its beam is electric by its element; with Fuel Can the burn steams the Wet away first, so no Conduct', () => {
    const wetBeam = (specs: Parameters<typeof arena>[0]) => {
      const { fake, stats } = arena(specs);
      const [src] = row(fake, [0, 60, 120], { hp: 1000 });
      fake.wet(src);
      fake.hit(src, 10, { ...stats, critChance: 0 });
      return { fake, src };
    };
    const plain = wetBeam([at('laser')]);
    expect(counts(plain.fake).conduct).toBe(1);
    const steamed = wetBeam([at('laser'), at('fuel')]);
    expect(steamed.src.status.burnUntil).toBeGreaterThan(0);
    expect(isWet(steamed.src.status, 0)).toBe(false);
    expect(counts(steamed.fake).conduct).toBe(0);
    expect(steamed.fake.dmgLog.damageByWeapon.Conduct).toBeUndefined();
  });
});

describe('Crack: shred at the cap + a blast hit', () => {
  const field = () => {
    const f = new FakeCtx();
    const [src, ...others] = row(f, [0, 30, 60, 85, 89, 91, 400]);
    return { f, src, others };
  };

  it('a blast hit on an enemy at 3 stacks: shrapnel to the 3 nearest others within 90 px, 50% each and +1 Shred; its stacks are eaten', () => {
    const { f, src, others } = field();
    f.shred(src, 3);
    f.hit(src, 10, null, { tags: ['blast'], label: 'Boom' });
    const dealt = f.dmgLog.damageByWeapon.Boom;
    const hit = bursts(f, 'crack');
    expect(hit.map((c) => c.enemy)).toEqual([others[0].id, others[1].id, others[2].id]);
    expect(hit.every((c) => c.dmg === 0.5 * dealt && c.opts.tags === undefined)).toBe(true);
    expect(f.callsOf('shred').filter((c) => c.enemy !== src.id).map((c) => [c.enemy, c.stacks])).toEqual(hit.map((c) => [c.enemy, 1]));
    expect(others.slice(0, 3).map((e) => shredStacks(e.status, 0))).toEqual([1, 1, 1]);
    expect(others.slice(3).map((e) => shredStacks(e.status, 0))).toEqual([0, 0, 0]); // 89 px is the fourth nearest, 91 and 400 are out of reach
    expect(src.status).toMatchObject({ shredStacks: 0, shredUntil: 0 });
    expect(labels(f)).toEqual(['CRACK!']);
  });

  it('an explosion that brings the stacks to the cap cracks in the same hit (blast hits leave a stack first)', () => {
    const { f, src, others } = field();
    f.shred(src, 2);
    f.hit(src, 10, null, { tags: ['blast'] });
    expect(counts(f).crack).toBe(1);
    expect(bursts(f)).toHaveLength(3);
    expect(shredStacks(src.status, 0)).toBe(0);
    expect(shredStacks(others[0].status, 0)).toBe(1);
  });

  it('a weapon with the blast element (Nail Gun) counts, a plain hit does not, fewer than 3 stacks do not', () => {
    const { fake, stats } = arena([at('nailgun')]);
    const [capped] = row(fake, [0, 500], { hp: 1000 });
    fake.shred(capped, 3);
    fake.hit(capped, 5, { ...stats, critChance: 0 });
    expect(counts(fake).crack).toBe(1);
    const f = new FakeCtx();
    const [x, y, z] = row(f, [0, 40, 600]);
    f.shred(x, 3);
    f.hit(x, 10, null, { tags: ['heat'] });
    expect(counts(f).crack).toBe(0);
    f.shred(z, 1);
    f.hit(z, 10, null, { tags: ['blast'] }); // 1 + the blast's own stack = 2
    expect(counts(f).crack).toBe(0);
    expect(y.hp).toBe(1000);
  });

  it('a blast that kills the cracked enemy still sends its shrapnel', () => {
    const { f, src, others } = field();
    src.hp = 4;
    f.shred(src, 3);
    f.hit(src, 10, null, { tags: ['blast'] });
    expect(src.alive).toBe(false);
    expect(bursts(f, 'crack')).toHaveLength(3);
    expect(others[0].hp).toBeLessThan(1000);
  });

  it('with no one in reach it still eats the stacks and pops the label', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.shred(e, 3);
    f.hit(e, 10, null, { tags: ['blast'] });
    expect(counts(f).crack).toBe(1);
    expect(bursts(f)).toHaveLength(0);
    expect(shredStacks(e.status, 0)).toBe(0);
  });
});

describe('cooldown and order', () => {
  it('Shatter has its own 3 s cooldown per enemy: blocked at 2.9 s, allowed at 3 s, and a blocked trigger eats nothing', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.slow(e, SLOW); f.ignite(e, BURN);
    expect(counts(f).shatter).toBe(1);
    f.advance(1); // the shared 1 s is over, Shatter's 3 s is not
    f.slow(e, SLOW); f.ignite(e, BURN);
    expect(counts(f).shatter).toBe(1);
    expect(isBurning(e.status, f.time)).toBe(true);
    expect(isFrosted(e.status, f.time)).toBe(true);
    f.advance(1.9); // t = 2.9
    f.slow(e, SLOW); f.ignite(e, BURN);
    expect(counts(f).shatter).toBe(1);
    f.advance(0.1); // t = 3
    f.slow(e, SLOW);
    expect(counts(f).shatter).toBe(2);
    expect(e.status.shatterCdUntil).toBe(6);
  });

  it('the shared 1 s still blocks the others after a Shatter, and they go off at 1 s (Fumes, Conduct, Crack keep 1 s)', () => {
    const f = new FakeCtx();
    const [e, b] = row(f, [0, 800]);
    f.slow(e, SLOW); f.ignite(e, BURN); // Shatter
    f.poison(e, 2, 9);
    f.advance(0.99);
    f.ignite(e, BURN); // Fumes possible, blocked by the shared cooldown
    expect(counts(f).fumes).toBe(0);
    f.advance(0.01); // t = 1
    f.ignite(e, BURN);
    expect(counts(f)).toEqual({ shatter: 1, fumes: 1, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 });
    // Conduct and Crack: 1 s apart on the same enemy
    f.wet(b, 9); f.shred(b, 3);
    f.hit(b, 10, null, { tags: ['electric'] });
    expect(counts(f).conduct).toBe(1);
    f.hit(b, 10, null, { tags: ['blast'] });
    expect(counts(f).crack).toBe(0);
    f.advance(1);
    f.shred(b, 3);
    f.hit(b, 10, null, { tags: ['blast'] });
    expect(counts(f).crack).toBe(1);
  });

  it('a Shatter that waits on its own cooldown lets Fumes through once the shared cooldown allows', () => {
    const f = new FakeCtx();
    const [e, n] = row(f, [0, 50]);
    f.slow(e, SLOW); f.ignite(e, BURN); // Shatter at 0
    f.advance(1.5);
    f.slow(e, SLOW); f.poison(e, 2, 9);
    f.ignite(e, BURN); // burn + frosted (Shatter: waiting) and burn + poison
    expect(counts(f)).toEqual({ shatter: 1, fumes: 1, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 });
    expect(n.status.poisonDps).toBe(2);
  });

  it('the cooldown is shared by the four reactions and kept per enemy', () => {
    const f = new FakeCtx();
    const [a, b] = row(f, [0, 800]);
    f.slow(a, SLOW); f.ignite(a, BURN); // Shatter
    f.poison(a, 2, 5); f.ignite(a, BURN); // Fumes possible, blocked
    expect(counts(f)).toEqual({ shatter: 1, fumes: 0, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 });
    f.poison(b, 2, 5); f.ignite(b, BURN); // another enemy reacts at once
    expect(counts(f).fumes).toBe(1);
    f.advance(1);
    f.ignite(a, BURN);
    expect(counts(f).fumes).toBe(2);
  });

  it('when a hit makes several possible, Shatter goes first, then Fumes, Conduct, Crack; one per trigger', () => {
    const { fake, stats } = arena([at('laser'), at('fuel'), at('ice')]);
    const [src] = row(fake, [0, 50], { hp: 1000 });
    fake.poison(src, 2, 5); fake.wet(src); fake.shred(src, 3);
    fake.hit(src, 10, { ...stats, critChance: 0 }); // burn + frost + poison + wet + 3 stacks and an electric beam: all four are possible
    expect(counts(fake)).toEqual({ shatter: 1, fumes: 0, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 });
  });

  it('the Sanitizer\'s cleanse prevents a reaction: no burn, nothing to react with', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.slow(e, SLOW); f.ignite(e, BURN);
    f.advance(3);
    f.slow(e, SLOW); // frosted again, not burning
    f.ignite(e, BURN);
    cleanseStatus(e.status); // burn gone
    f.advance(3);
    f.slow(e, SLOW);
    expect(counts(f).shatter).toBe(2);
  });

  it('a status applied outside a hit to an enemy that is mid-hit elsewhere does not mix them up', () => {
    const { fake, stats } = arena([at('toaster'), at('fuel')]);
    const [a, b] = row(fake, [0, 500], { hp: 1000 });
    fake.slow(a, SLOW);
    fake.hit(b, 10, { ...stats, critChance: 0 }); // b burns; a is not b
    expect(counts(fake).shatter).toBe(0);
  });
});

describe('reaction hits', () => {
  it('never crit and draw no rng: a crit-certain trigger crits once, its reaction hits add no roll', () => {
    const run = (react: boolean) => {
      const { fake, stats } = arena([at('toaster'), at('fuel'), at('ice')]);
      const e = fake.spawnEnemy({ hp: 1000 });
      fake.hit(e, 10, { ...stats, critChance: 1, slow: react ? stats.slow : null });
      return { fake, e };
    };
    const reacted = run(true), plain = run(false);
    expect(counts(reacted.fake).shatter).toBe(1);
    expect(counts(plain.fake).shatter).toBe(0);
    const dealt = reacted.fake.dmgLog.damageByWeapon[reacted.fake.build.weapons[0].uid];
    expect(dealt).toBe(20); // the toast crit (x2)
    expect(bursts(reacted.fake)[0].dmg).toBe(8 + 0.5 * dealt); // the burst is flat plus a share, no x2 on top
    expect(reacted.fake.rng()).toBe(plain.fake.rng()); // the same number of draws
  });

  it('never react: a Conduct hop is an electric hit on wet neighbors, and none of them conducts again', () => {
    const f = new FakeCtx();
    const [src, a, b] = row(f, [0, 50, 100]);
    for (const e of [src, a, b]) f.wet(e);
    f.hit(src, 10, null, { tags: ['electric'] });
    expect(counts(f).conduct).toBe(1);
    expect(bursts(f)).toHaveLength(2);
    expect(isWet(a.status, 0)).toBe(true); // a hop does not eat the Wet of the enemy it lands on either
  });

  it('do not run the weapon hooks: an Electric-set cart does not arc from a Conduct hop, and the hit that set it off keeps its own chain', () => {
    const { fake, stats } = arena([at('laser'), far('battery'), far('toaster'), far('blender')]); // Electric L3; the Laser's beam is electric
    expect(stats.chainChance).toBeGreaterThan(0);
    const st = { ...stats, critChance: 0, chainChance: 1 };
    const [src] = row(fake, [0, 40, 80, 120, 160, 200], { hp: 1000 });
    fake.wet(src);
    fake.hit(src, 10, st);
    const calls = fake.callsOf('damage');
    expect(calls.filter((c) => c.opts.chained)).toHaveLength(st.chainJumps + 1); // L3: 3 jumps, +1 for the wet origin
    expect(bursts(fake, 'conduct')).toHaveLength(3);
    expect(calls.filter((c) => c.opts.reaction && c.opts.chained)).toHaveLength(0);
    expect(calls).toHaveLength(st.chainJumps + 1 + 3);
  });

  it('are shown and counted as the reaction type, armor does not soak them, they carry no weapon', () => {
    const f = new FakeCtx();
    const beans = f.spawnReal('beans', { hp: 1000 }); // armor 3
    f.slow(beans, SLOW); f.ignite(beans, BURN);
    expect(1000 - beans.hp).toBe(8);
    expect(f.dmgLog.damage.byType.reaction).toBe(8);
    expect(f.dmgLog.damage.byType.heat).toBe(0);
    expect(f.dmgLog.damageByWeapon).toEqual({ Shatter: 8 });
  });

  it('the reaction hit of a Shatter that kills credits the kill and the enemy dies once', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 6 });
    f.slow(e, SLOW); f.ignite(e, BURN); // flat 8 kills a 6 hp enemy
    expect(e.alive).toBe(false);
    expect(e.hp).toBe(-2);
  });
});

describe('a burning pool is an application too', () => {
  it('a Pressure-Point-style fire pool on a frosted enemy shatters it, once, and the burn is eaten', () => {
    const { a, b, fake } = arsenal([at('mop'), at('fuel')]);
    const e = fake.spawnEnemy({ hp: 1000, x: 0, y: 0 });
    fake.slow(e, SLOW);
    spawnFirePool(a, 0, 0, 80, 3, b.weapons[0], { dps: 1, duration: 1, tick: 0.5 });
    a.step(0.05);
    expect(counts(fake).shatter).toBe(1);
    expect(isBurning(e.status, fake.time)).toBe(false);
    a.run(10, 0.05); // the pool keeps burning but the frost is gone and the cooldown runs
    expect(counts(fake).shatter).toBe(1);
  });
});

describe('breakdown and texts', () => {
  const sink = (): DamageSink => ({ damageByWeapon: {}, damage: newDamageStats() });
  const names = { name: (k: string) => k, type: () => 'physical' as const };

  it('recordReaction counts per reaction; newDamageStats starts at zero', () => {
    const s = sink();
    expect(s.damage.reactions).toEqual({ shatter: 0, fumes: 0, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 });
    recordReaction(s, 'fumes'); recordReaction(s, 'fumes'); recordReaction(s, 'crack');
    expect(s.damage.reactions).toEqual({ shatter: 0, fumes: 2, conduct: 0, crack: 1, iceSheet: 0, detonate: 0 });
  });

  it('the run-end breakdown has a Reactions line with counts and damage, en and de, hidden at zero', () => {
    const s = sink();
    s.damageByWeapon.toaster = 100; s.damage.byType.physical = 100;
    expect(damageBreakdownHtml(s, names, true)).not.toContain(t('dmgReactions'));
    s.damage.byType.reaction = 40; s.damage.reactions = { shatter: 3, fumes: 1, conduct: 0, crack: 0, iceSheet: 0, detonate: 0 };
    const en = damageBreakdownHtml(s, names, true);
    expect(en).toContain('Reactions');
    expect(en).toContain('Shatter ×3, Toxic Fumes ×1 · 40');
    setLang('de');
    const de = damageBreakdownHtml(s, names, true);
    expect(de).toContain('Reaktionen');
    expect(de).toContain('Splitter ×3, Giftwolke ×1 · 40');
  });

  it('a fumes-only run shows the count without a damage figure', () => {
    const s = sink();
    s.damageByWeapon.toaster = 100; s.damage.byType.physical = 100; s.damage.reactions.fumes = 2;
    expect(damageBreakdownHtml(s, names, false)).toContain('Toxic Fumes ×2</span>');
  });

  it('every reaction has its label and name in EN and DE, the burst hits are keyed by the English name, the color is the reaction teal', () => {
    const en = REACTION_IDS.map((id) => [t(REACTION_TEXT[id].label), t(REACTION_TEXT[id].name)]);
    expect(en).toEqual([['SHATTER!', 'Shatter'], ['FUMES!', 'Toxic Fumes'], ['CONDUCT!', 'Conduct'], ['CRACK!', 'Crack'], ['ICE SHEET!', 'Ice Sheet'], ['DETONATE!', 'Detonate']]);
    setLang('de');
    expect(REACTION_IDS.map((id) => [t(REACTION_TEXT[id].label), t(REACTION_TEXT[id].name)])).toEqual([['SPLITTER!', 'Splitter'], ['GIFTWOLKE!', 'Giftwolke'], ['KURZSCHLUSS!', 'Kurzschluss'], ['PANZERBRUCH!', 'Panzerbruch'], ['EISFLÄCHE!', 'Eisfläche'], ['DETONATION!', 'Detonation']]);
    expect(REACTION_LABEL).toEqual({ shatter: 'Shatter', fumes: 'Toxic Fumes', conduct: 'Conduct', crack: 'Crack', iceSheet: 'Ice Sheet', detonate: 'Detonate' });
    expect(ELEMENT_COLORS.reaction).toBe('#3FE0C5');
  });

  it('the label pops in the language of the game', () => {
    setLang('de');
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 100 });
    f.slow(e, SLOW); f.ignite(e, BURN);
    expect(labels(f)).toEqual(['SPLITTER!']);
  });

  it('pure helpers: consumeBurn / consumeFrost leave everything else alone', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy();
    applyBurn(e.status, BURN, 0); applyShred(e.status, 2, 4, 0); applyWet(e.status, 3, 0);
    e.status.frostUntil = 2; e.status.slowUntil = 2; e.status.slowPct = 0.3;
    consumeBurn(e.status); consumeFrost(e, 0);
    expect(e.status).toMatchObject({ burnDps: 0, burnUntil: 0, slowUntil: 0, slowPct: 0, frostUntil: 0, shredStacks: 2, wetUntil: 3 });
  });
});
