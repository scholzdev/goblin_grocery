import { describe, expect, it } from 'vitest';
import pressurePoint from '../../../src/content/combos/pressurePoint';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('pressurePoint', pressurePoint, ['Pressure Point', 'Druckpunkt']);

describe('Pressure Point: build', () => {
  it('changes no stats: the pool is the pattern:explode hook', () => {
    expect(pressurePoint.build).toBeUndefined();
  });
});

describe('Pressure Point: runtime', () => {
  it('a blast leaves a fire pool at the blast: radius = the cooker aoe, 2.5 s, the combo tune (3 dps for 2 s, tick 0.5)', () => {
    const { fake, stats } = arena(partsOf(pressurePoint));
    fake.hooks.emit('pattern:explode', { stats, x: 12, y: 34, hits: [] });
    const [pool] = fake.callsOf('spawnPool');
    expect(pool.spec).toMatchObject({ x: 12, y: 34, r: stats.aoe, time: 2.5, stats, tune: pressurePoint.tune });
  });
  it('does not fire for a cooker without the combo, and draws no random numbers', () => {
    const { fake, stats } = arena([at('cooker')]);
    fake.hooks.emit('pattern:explode', { stats, x: 1, y: 1, hits: [] });
    expect(fake.callsOf('spawnPool')).toHaveLength(0);
    const { fake: f2, stats: s2 } = arena(partsOf(pressurePoint), { seed: 8 });
    f2.hooks.emit('pattern:explode', { stats: s2, x: 1, y: 1, hits: [] });
    expect(f2.rng()).toBe(arena(partsOf(pressurePoint), { seed: 8 }).fake.rng());
  });
});
