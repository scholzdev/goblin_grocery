import { describe, expect, it } from 'vitest';
import shrapnel from '../../../src/content/combos/shrapnel';
import { combatRng } from '../../../src/systems/rng';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('shrapnel', shrapnel, ['Shrapnel', 'Splitterbombe']);

describe('Shrapnel: runtime', () => {
  it('a blast sends 6 nails in a ring (one rng jitter each, in order): 40% damage, speed 520, range 260, 2 hits each', () => {
    const { fake, stats } = arena(partsOf(shrapnel), { seed: 15 });
    fake.hooks.emit('pattern:explode', { stats, x: 40, y: 50, hits: [] });
    const shots = fake.callsOf('spawnShot').map((s) => s.spec), ref = combatRng(15, 0);
    expect(shots).toHaveLength(6);
    shots.forEach((s, i) => {
      expect(s.angle).toBe((i / 6) * Math.PI * 2 + ref() * 0.3);
      expect(s).toMatchObject({ key: 'proj_nail', x: 40, y: 50, speed: 520, life: 260 / 520, damage: stats.damage * 0.4, maxHits: 2, stats });
    });
    expect(fake.rng()).toBe(ref());
  });
  it('a cooker without the combo fires no nails and draws nothing', () => {
    const { fake, stats } = arena([at('cooker')], { seed: 15 });
    fake.hooks.emit('pattern:explode', { stats, x: 0, y: 0, hits: [] });
    expect(fake.callsOf('spawnShot')).toHaveLength(0);
    expect(fake.rng()).toBe(combatRng(15, 0)());
  });
});
