import { describe, expect, it } from 'vitest';
import leafPile from '../../../src/content/combos/leafPile';
import { arena, at, describeCombo, partsOf } from './helpers';

describeCombo('leafPile', leafPile, ['Leaf Pile', 'Laubhaufen']);

describe('Leaf Pile: runtime', () => {
  const cone = (stats: never, hits: never[]) => ({ stats, x: 0, y: 0, angle: 0, hits });
  it('spreads the strongest burn among the hit enemies to everyone near a burning one, including enemies outside the cone', () => {
    const { fake, stats } = arena(partsOf(leafPile));
    const weak = fake.spawnEnemy({ x: 100 }), strong = fake.spawnEnemy({ x: 140 }), cold = fake.spawnEnemy({ x: 160 }), outside = fake.spawnEnemy({ x: 140, y: 70 }), far = fake.spawnEnemy({ x: 600 });
    Object.assign(weak.status, { burnDps: 2, burnUntil: 3, burnTick: 0.5 });
    Object.assign(strong.status, { burnDps: 5, burnUntil: 2, burnTick: 0.25 });
    fake.hooks.emit('pattern:cone', cone(stats as never, [weak, strong, cold] as never[]));
    const ignited = fake.callsOf('ignite');
    expect(ignited.map((i) => i.enemy).sort()).toEqual([weak.id, cold.id, outside.id].sort());
    expect(ignited.every((i) => i.burn.dps === 5 && i.burn.duration === 2 && i.burn.tick === 0.25)).toBe(true);
    expect(far.status.burnUntil).toBe(0);
  });
  it('does nothing when no hit enemy is burning, or for a leaf blower without the combo', () => {
    const { fake, stats } = arena(partsOf(leafPile));
    fake.hooks.emit('pattern:cone', cone(stats as never, [fake.spawnEnemy() as never]));
    expect(fake.callsOf('ignite')).toHaveLength(0);
    const plain = arena([at('leafblower')]);
    const e = plain.fake.spawnEnemy();
    e.status.burnDps = 3; e.status.burnUntil = 5;
    plain.fake.hooks.emit('pattern:cone', cone(plain.stats as never, [e as never]));
    expect(plain.fake.callsOf('ignite')).toHaveLength(0);
  });
});
