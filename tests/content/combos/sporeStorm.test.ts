import { describe, expect, it } from 'vitest';
import sporeStorm from '../../../src/content/combos/sporeStorm';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('sporeStorm', sporeStorm, ['Spore Storm', 'Sporensturm']);

describe('Spore Storm: runtime', () => {
  it('poisons the enemies around the cone end with the Moldy Bread numbers, then re-applies the cloud every tick for its duration', () => {
    const { fake, stats } = arena(partsOf(sporeStorm));
    const at = { x: stats.range, y: 0 };
    const inside = fake.spawnEnemy({ x: at.x + 40 }), outside = fake.spawnEnemy({ x: at.x + 200 });
    fake.hooks.emit('pattern:cone', { stats, x: 0, y: 0, angle: 0, hits: [] });
    expect(fake.callsOf('poison')).toEqual([expect.objectContaining({ enemy: inside.id, dps: 2, duration: 2 })]);
    fake.advance(3.1);
    expect(fake.callsOf('poison').filter((p) => p.enemy === inside.id)).toHaveLength(6);
    expect(fake.callsOf('poison').some((p) => p.enemy === outside.id)).toBe(false);
  });
  it('the cloud is skipped once the aisle is over', () => {
    const { fake, stats } = arena(partsOf(sporeStorm));
    fake.spawnEnemy({ x: stats.range });
    fake.hooks.emit('pattern:cone', { stats, x: 0, y: 0, angle: 0, hits: [] });
    fake.active = false;
    fake.advance(3.1);
    expect(fake.callsOf('poison')).toHaveLength(1);
  });
});
