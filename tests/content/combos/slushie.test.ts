import { describe, expect, it } from 'vitest';
import slushie from '../../../src/content/combos/slushie';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('slushie', slushie, ['Slushie', 'Slush']);

describe('Slushie: runtime', () => {
  const setup = () => {
    const { fake, stats } = arena(partsOf(slushie));
    const shot = (hits: number[]) => ({ active: true, x: 0, y: 0, vx: 0, vy: 0, life: 1, damage: 3, stats, splash: null, tracker: { hits: new Set(hits) } }) as never;
    const hit = (enemy: ReturnType<typeof fake.spawnEnemy>, ids: number[]) => fake.hooks.emit('pattern:shotHit', { stats: stats as never, enemy: enemy as never, shot: shot(ids) });
    return { fake, stats, hit };
  };
  it('adds nothing on the first hit, then slows 10 points harder per hit, capped at the Ice Pack cap', () => {
    const { fake, stats, hit } = setup();
    const e = fake.spawnEnemy({ hp: 1000 });
    hit(e, [e.id]);
    expect(fake.callsOf('slow')).toHaveLength(0);
    hit(e, [101, e.id]);
    hit(e, [101, 102, e.id]);
    const pcts = fake.callsOf('slow').map((s) => s.slow.pct);
    expect(pcts[0]).toBeCloseTo(stats.slow!.pct + 0.1);
    expect(pcts[1]).toBeCloseTo(Math.min(0.6, stats.slow!.pct + 0.2));
    expect(fake.callsOf('slow')[0].slow.duration).toBe(stats.slow!.duration);
    hit(e, Array.from({ length: 9 }, (_, i) => i));
    expect(fake.callsOf('slow').at(-1)!.slow.pct).toBe(0.6);
  });
  it('freezes 0.5 s only on the final hit (1 + bounces + pierce), and not again within 2.5 s', () => {
    const { fake, stats, hit } = setup();
    const last = 1 + stats.bounces + stats.pierce, ids = Array.from({ length: last }, (_, i) => i);
    const e = fake.spawnEnemy({ hp: 1000 });
    hit(e, ids.slice(0, last - 1));
    expect(fake.callsOf('stun')).toHaveLength(0);
    hit(e, ids);
    expect(fake.callsOf('stun').map((s) => [s.enemy, s.seconds, s.tag])).toEqual([[e.id, 0.5, 'frost']]);
    expect(e.frozenT).toBeGreaterThan(0);
    fake.advance(2);
    hit(e, ids);
    expect(fake.callsOf('stun')).toHaveLength(1);
    fake.advance(0.6);
    hit(e, ids);
    expect(fake.callsOf('stun')).toHaveLength(2);
  });
  it('a cap that finds no next target freezes the enemy it last hit', () => {
    const { fake, stats } = setup();
    const e = fake.spawnEnemy({ hp: 1000 });
    const shot = { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 1, damage: 3, stats, splash: null, tracker: { hits: new Set([e.id]) } } as never;
    fake.hooks.emit('pattern:shotHit', { stats: stats as never, enemy: e as never, shot });
    expect(fake.callsOf('stun')).toHaveLength(0);
    fake.hooks.emit('pattern:bounce', { stats: stats as never, shot, x: 0, y: 0, next: null });
    expect(fake.callsOf('stun').map((s) => s.enemy)).toEqual([e.id]);
  });
  it('a cap that bounces on to a next target does not freeze yet', () => {
    const { fake, stats } = setup();
    const e = fake.spawnEnemy({ hp: 1000 }), n = fake.spawnEnemy({ hp: 1000 });
    const shot = { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 1, damage: 3, stats, splash: null, tracker: { hits: new Set([e.id]) } } as never;
    fake.hooks.emit('pattern:shotHit', { stats: stats as never, enemy: e as never, shot });
    fake.hooks.emit('pattern:bounce', { stats: stats as never, shot, x: 0, y: 0, next: n as never });
    expect(fake.callsOf('stun')).toHaveLength(0);
  });
  it('ignores a dead enemy', () => {
    const { fake, stats, hit } = setup();
    const dead = fake.spawnEnemy({ alive: false });
    hit(dead, Array.from({ length: 1 + stats.bounces + stats.pierce }, (_, i) => i));
    expect(fake.callsOf('stun')).toHaveLength(0);
  });
});
