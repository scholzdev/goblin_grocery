import { describe, expect, it } from 'vitest';
import frostbiteNails from '../../../src/content/combos/frostbiteNails';
import { applyCombo, arena, bare, describeCombo, partsOf } from './helpers';

describeCombo('frostbiteNails', frostbiteNails, ['Frostbite Nails', 'Frostbeulen-Nägel']);

describe('Frostbite Nails: build', () => {
  it('adds one pierce', () => {
    const base = bare('nailgun');
    expect(applyCombo(frostbiteNails, base).pierce).toBe(base.pierce + 1);
  });
});

describe('Frostbite Nails: runtime', () => {
  const shotHit = (stats: ReturnType<typeof arena>['stats'], enemy: never) => ({ stats, enemy, shot: { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 1, damage: 3, stats, splash: null } as never });
  it('freezes (stuns 0.7 s) the enemy on every 3rd nail that hits it, counted per enemy', () => {
    const { fake, stats } = arena(partsOf(frostbiteNails));
    const a = fake.spawnEnemy(), b = fake.spawnEnemy();
    for (let i = 1; i <= 7; i++) fake.hooks.emit('pattern:shotHit', shotHit(stats, a as never));
    expect(fake.callsOf('stun').map((s) => [s.enemy, s.seconds])).toEqual([[a.id, 0.7], [a.id, 0.7]]);
    fake.hooks.emit('pattern:shotHit', shotHit(stats, b as never));
    expect(fake.callsOf('stun')).toHaveLength(2);
    expect(a.nailHits).toBe(7);
    expect(b.nailHits).toBe(1);
  });
  it('does not count a dead enemy or a non-burst weapon', () => {
    const { fake, stats } = arena(partsOf(frostbiteNails));
    const dead = fake.spawnEnemy({ alive: false });
    fake.hooks.emit('pattern:shotHit', shotHit(stats, dead as never));
    expect(dead.nailHits).toBeUndefined();
    const e = fake.spawnEnemy();
    fake.hooks.emit('pattern:shotHit', shotHit({ ...stats, pattern: 'toast' }, e as never));
    expect(e.nailHits).toBeUndefined();
  });
  it('draws no random numbers', () => {
    const { fake, stats } = arena(partsOf(frostbiteNails), { seed: 3 });
    const e = fake.spawnEnemy();
    for (let i = 0; i < 6; i++) fake.hooks.emit('pattern:shotHit', shotHit(stats, e as never));
    const { fake: ref } = arena(partsOf(frostbiteNails), { seed: 3 });
    expect(fake.rng()).toBe(ref.rng());
  });
});
