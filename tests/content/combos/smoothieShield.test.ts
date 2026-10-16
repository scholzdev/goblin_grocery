import { describe, expect, it } from 'vitest';
import smoothieShield from '../../../src/content/combos/smoothieShield';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('smoothieShield', smoothieShield, ['Smoothie Shield', 'Smoothie-Schild']);

describe('Smoothie Shield: runtime', () => {
  const aura = (stats: never) => ({ stats, x: 0, y: 0, range: 85, hit: false });
  it('every blender tick destroys the enemy shots inside its radius (with a spark), and only those', () => {
    const { fake, stats } = arena(partsOf(smoothieShield));
    const inside = fake.spawnHostileShot({ x: 60, y: 0 }), edge = fake.spawnHostileShot({ x: 85, y: 0 }), out = fake.spawnHostileShot({ x: 90, y: 0 });
    fake.hooks.emit('pattern:aura', aura(stats as never));
    expect(fake.callsOf('killShot').map((k) => k.shot)).toEqual([inside, edge]);
    expect(out.active).toBe(true);
    expect(fake.callsOf('fx').filter((f) => f.method === 'spark')).toHaveLength(2);
  });
  it('a blender without the combo lets shots through', () => {
    const { fake, stats } = arena([at('blender')]);
    const shot = fake.spawnHostileShot({ x: 10, y: 0 });
    fake.hooks.emit('pattern:aura', aura(stats as never));
    expect(shot.active).toBe(true);
  });
});
