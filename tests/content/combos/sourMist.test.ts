import { describe, expect, it } from 'vitest';
import sourMist from '../../../src/content/combos/sourMist';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('sourMist', sourMist, ['Sour Mist', 'Sauernebel']);

describe('Sour Mist: runtime', () => {
  it('poisons every enemy the cone hit: 4 dps for 3 s', () => {
    const { fake, stats } = arena(partsOf(sourMist));
    const es = [fake.spawnEnemy(), fake.spawnEnemy()];
    fake.hooks.emit('pattern:cone', { stats, x: 0, y: 0, angle: 0, hits: es });
    expect(fake.callsOf('poison').map((p) => [p.enemy, p.dps, p.duration])).toEqual(es.map((e) => [e.id, 4, 3]));
  });
  it('an empty cone and a plain spray bottle do nothing, and no random numbers are drawn', () => {
    const { fake, stats } = arena(partsOf(sourMist), { seed: 3 });
    fake.hooks.emit('pattern:cone', { stats, x: 0, y: 0, angle: 0, hits: [] });
    const plain = arena([at('spray')]);
    plain.fake.hooks.emit('pattern:cone', { stats: plain.stats, x: 0, y: 0, angle: 0, hits: [fake.spawnEnemy()] });
    expect(fake.callsOf('poison')).toHaveLength(0);
    expect(plain.fake.callsOf('poison')).toHaveLength(0);
    expect(fake.rng()).toBe(arena(partsOf(sourMist), { seed: 3 }).fake.rng());
  });
});
