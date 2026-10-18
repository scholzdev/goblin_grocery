import { describe, expect, it } from 'vitest';
import { REACTIONS } from '../src/engine/define';
import { FakeCtx } from '../src/engine/fakeCtx';
import { REACTION_LABEL, REACTION_TEXT, isFrozen } from '../src/engine/reactions';
import { t } from '../src/i18n';
import { arena, arsenal, at } from './content/helpers';

// Ice Sheet (wet + a frost hit that did not freeze) and Detonate (poisoned + a blast hit): the rules, the cooldown they share with the other four, the freeze that
// pre-empts Ice Sheet, Black Ice staying as it is, and the Detonate damage. Run through the FakeCtx, which owns the same `Reactor` as the arena.

const bursts = (f: FakeCtx, id: string) => f.callsOf('damage').filter((c) => c.opts.reaction === id);
const labels = (f: FakeCtx) => f.callsOf('fx').filter((c) => c.method === 'label').map((c) => c.args[2]);
const slides = (f: FakeCtx) => f.callsOf('slide');

describe('Ice Sheet: wet + a frost hit', () => {
  it('a frost hit on a wet enemy: it slides 1.5 s for the slam, the Wet is eaten, the label pops', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000, x: 100 });
    f.wet(e);
    f.advance(0.1);
    f.hit(e, 5, null, { tags: ['frost'], label: 'Cone' });
    expect(slides(f)).toEqual([expect.objectContaining({ enemy: e.id, seconds: 1.5, slam: 12, speed: 260 })]);
    expect(e.slideUntil).toBeCloseTo(1.6, 9);
    expect(e.kx).toBeCloseTo(260, 6); // away from the goblin at the origin
    expect(e.status.wetUntil).toBe(0);
    expect(labels(f)).toEqual(['ICE SHEET!']);
    expect(f.dmgLog.damage.reactions.iceSheet).toBe(1);
  });

  it('a dry enemy, a wet one hit without the frost tag, a boss and a corpse do not slide', () => {
    const f = new FakeCtx();
    const dry = f.spawnEnemy({ hp: 1000, x: 0 }), wet = f.spawnEnemy({ hp: 1000, x: 300 }), boss = f.spawnEnemy({ hp: 1000, x: 600, def: { behavior: 'boss' } }), doomed = f.spawnEnemy({ hp: 3, x: 900 });
    f.wet(wet); f.wet(boss); f.wet(doomed);
    f.advance(0.1);
    f.hit(dry, 5, null, { tags: ['frost'] });
    f.hit(wet, 5, null, { tags: ['heat'] });
    f.hit(boss, 5, null, { tags: ['frost'] });
    f.hit(doomed, 50, null, { tags: ['frost'] });
    expect(slides(f)).toEqual([]);
    expect(f.dmgLog.damage.reactions.iceSheet).toBe(0);
    expect(boss.status.wetUntil).toBeGreaterThan(0); // the boss keeps its Wet: nothing was spent
  });

  it('a frozen enemy (frost stun) does not slide: the freeze comes first', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.wet(e);
    f.advance(0.1);
    f.stun(e, 1, 'frost');
    expect(isFrozen(e, f.time)).toBe(true);
    f.hit(e, 5, null, { tags: ['frost'] });
    expect(slides(f)).toEqual([]);
    expect(e.status.wetUntil).toBeGreaterThan(0);
  });

  it('shares the one-second cooldown with the other reactions', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 });
    f.wet(e);
    f.advance(0.1);
    f.hit(e, 5, null, { tags: ['frost'] });
    f.wet(e);
    f.advance(0.1);
    f.hit(e, 5, null, { tags: ['frost'] });
    expect(slides(f)).toHaveLength(1);
    f.advance(1);
    f.hit(e, 5, null, { tags: ['frost'] });
    expect(slides(f)).toHaveLength(2);
  });

  it('with the Frost set a freeze pre-empts it: a hit that freezes never slides, one that does not freeze does (the wet freeze chance is doubled)', () => {
    let froze = 0, slid = 0;
    for (let seed = 1; seed <= 60 && !(froze && slid); seed++) {
      const { fake, stats } = arsenal([at('fizz'), at('ice'), at('mop')], { seed });
      expect(fake.build.sets.frost).toBeGreaterThanOrEqual(2);
      const e = fake.spawnEnemy({ hp: 1000, x: 100 });
      fake.wet(e);
      fake.advance(0.1);
      fake.hit(e, 5, { ...stats, critChance: 0 });
      const frozenNow = fake.callsOf('stun').length > 0;
      expect(frozenNow && slides(fake).length > 0, `seed ${seed}`).toBe(false);
      if (frozenNow) froze++; else if (slides(fake).length) slid++;
    }
    expect(froze).toBeGreaterThan(0);
    expect(slid).toBeGreaterThan(0);
  });

  it('Black Ice still freezes the first tick in a puddle: that freeze, not a slide, is what the enemy gets', () => {
    const { fake, a } = arsenal([at('mop'), at('ice')]);
    const e = fake.spawnEnemy({ hp: 1000, x: 0, y: 0 });
    fake.player.x = 0; fake.player.y = 0;
    expect(fake.build.recipes.map((r) => r.id)).toContain('blackIce');
    a.run(14, 0.05);
    expect(fake.callsOf('stun')[0]).toEqual(expect.objectContaining({ enemy: e.id, seconds: 0.8, tag: 'frost' }));
    expect(slides(fake)).toEqual([]); // frozen for the tick that soaked and hit it
  });

  it('a frost slow from the hit (Ice Pack) is a frost hit too, whatever the weapon\'s tags', () => {
    const { fake, stats } = arena([at('toaster'), at('ice')]);
    expect(stats.slow).toBeTruthy();
    const e = fake.spawnEnemy({ hp: 1000, x: 100 });
    fake.wet(e);
    fake.advance(0.1);
    fake.hit(e, 5, { ...stats, critChance: 0 });
    expect(slides(fake)).toHaveLength(1);
  });

  it('a Wet applied in the same frame comes too late: the Spray, the Mop and the Snow Cone Machine never slide what they soak, and the Spray keeps its Wet for Conduct', () => {
    for (const [weapon, x] of [['spray', 60], ['mop', 0], ['snowcone', 0]] as const) {
      const { fake, a } = arsenal([at(weapon)]);
      const e = fake.spawnEnemy({ hp: 100000, x, y: 0 });
      fake.player.x = 0; fake.player.y = 0;
      a.run(60, 0.05);
      expect(fake.callsOf('damage').filter((c) => c.enemy === e.id).length, weapon).toBeGreaterThan(1);
      expect(slides(fake), weapon).toEqual([]);
      expect(e.status.wetUntil, weapon).toBeGreaterThan(fake.time);
    }
  });

  it('the Snow Cone Machine soaks and slows, and the next frost hit from anything else sends the enemy sliding', () => {
    const { fake, a } = arsenal([at('snowcone')]);
    const e = fake.spawnEnemy({ hp: 100000, x: 0, y: 0 });
    fake.player.x = 0; fake.player.y = 0;
    a.run(14, 0.05);
    expect(e.status.wetUntil).toBeGreaterThan(fake.time);
    fake.advance(0.1);
    fake.hit(e, 5, null, { tags: ['frost'] });
    expect(slides(fake)).toHaveLength(1);
  });
});

describe('Detonate: poisoned + a blast hit', () => {
  it('eats the poison and bursts poison dps x the seconds left on everything within 70 px (itself included), teal and blast-tagged', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000, x: 0 }), near = f.spawnEnemy({ hp: 1000, x: 60 }), far = f.spawnEnemy({ hp: 1000, x: 200 });
    f.poison(e, 4, 5);
    f.advance(2); // 3 s left
    f.hit(e, 7, null, { tags: ['blast'], label: 'Pot' });
    const hits = bursts(f, 'detonate');
    expect(hits.map((c) => [c.enemy, c.dmg])).toEqual([[e.id, 12], [near.id, 12]]);
    expect(near.hp).toBe(988);
    expect(far.hp).toBe(1000);
    expect(e.status.poisonDps).toBe(0);
    expect(e.status.poisonUntil).toBe(0);
    expect(labels(f)).toEqual(['DETONATE!']);
    expect(f.dmgLog.damage.reactions.detonate).toBe(1);
    expect(f.dmgLog.damageByWeapon[REACTION_LABEL.detonate]).toBeGreaterThan(0);
  });

  it('a non-blast hit on a poisoned enemy, or a blast on an unpoisoned one, does nothing', () => {
    const f = new FakeCtx();
    const a = f.spawnEnemy({ hp: 1000, x: 0 }), b = f.spawnEnemy({ hp: 1000, x: 500 });
    f.poison(a, 4, 5);
    f.hit(a, 7, null, { tags: ['heat'] });
    f.hit(b, 7, null, { tags: ['blast'] });
    expect(bursts(f, 'detonate')).toEqual([]);
    expect(a.status.poisonDps).toBe(4);
  });

  it('goes before Crack: a poisoned enemy at the Shred cap detonates (every blast hit shreds, so a bunch would crack forever otherwise)', () => {
    const f = new FakeCtx();
    const e = f.spawnEnemy({ hp: 1000 }), n = f.spawnEnemy({ hp: 1000, x: 50 });
    f.poison(e, 4, 5); f.shred(e, 3);
    f.hit(e, 7, null, { tags: ['blast'] });
    expect(f.dmgLog.damage.reactions).toMatchObject({ detonate: 1, crack: 0 });
    expect(n.status.shredStacks).toBe(0);
  });

  it('its burst never reacts again, and the shared cooldown holds', () => {
    const f = new FakeCtx();
    const a = f.spawnEnemy({ hp: 1000, x: 0 }), b = f.spawnEnemy({ hp: 1000, x: 30 });
    f.poison(a, 4, 5); f.poison(b, 4, 5);
    f.hit(a, 7, null, { tags: ['blast'] });
    expect(f.dmgLog.damage.reactions.detonate).toBe(1);
    expect(b.status.poisonDps).toBe(4); // the burst hit b but did not detonate it
    f.hit(a, 7, null, { tags: ['blast'] });
    expect(f.dmgLog.damage.reactions.detonate).toBe(1);
  });

  it('the Moldy Bread + Pressure Cooker chain: the first pot poisons, the next pot detonates', () => {
    const { fake, stats } = arsenal([at('cooker'), at('moldybread')]);
    const e = fake.spawnEnemy({ hp: 5000, x: 100 });
    expect(fake.build.weapons[0].type).toBe('cooker');
    fake.hooks.emit('pattern:explode', { stats, x: 100, y: 0, hits: [] });
    expect(e.status.poisonDps).toBe(2);
    fake.advance(1);
    fake.hit(e, 20, stats, { tags: ['blast'] });
    expect(fake.dmgLog.damage.reactions.detonate).toBe(1);
  });
});

describe('texts', () => {
  it('both reactions have a label and a breakdown name in en and de', () => {
    for (const id of ['iceSheet', 'detonate'] as const) {
      expect(t(REACTION_TEXT[id].label)).not.toBe(REACTION_TEXT[id].label);
      expect(t(REACTION_TEXT[id].name)).not.toBe(REACTION_TEXT[id].name);
      expect(REACTIONS[id]).toBeDefined();
    }
  });
});
