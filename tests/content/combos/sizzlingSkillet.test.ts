import { describe, expect, it } from 'vitest';
import sizzlingSkillet from '../../../src/content/combos/sizzlingSkillet';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('sizzlingSkillet', sizzlingSkillet, ['Sizzling Skillet', 'Zischende Pfanne']);

describe('Sizzling Skillet: runtime', () => {
  const sweep = (stats: never, stage: 'before' | 'hit' | 'after', angle = 0) => ({ stats, stage, x: 10, y: 20, angle, bonus: false, range: 150, dmg: 9, hits: [] });
  it('after the sweep, 3 fire pools fan out across 80% of the arc at 70% range (y squashed x0.62), 34 radius, 2 s', () => {
    const { fake, stats } = arena(partsOf(sizzlingSkillet));
    fake.hooks.emit('pattern:sweep', sweep(stats as never, 'after', 0));
    const pools = fake.callsOf('spawnPool').map((p) => p.spec);
    expect(pools).toHaveLength(3);
    const half = (stats.arcDeg * Math.PI / 180) * 0.4;
    [-half, 0, half].forEach((a, i) => {
      expect(pools[i].x).toBeCloseTo(10 + Math.cos(a) * stats.range * 0.7, 9);
      expect(pools[i].y).toBeCloseTo(20 + Math.sin(a) * stats.range * 0.7 * 0.62, 9);
      expect(pools[i]).toMatchObject({ r: 34, time: 2, stats, tune: sizzlingSkillet.tune });
    });
  });
  it('only in the "after" stage, and the bonus sweep counts too', () => {
    const { fake, stats } = arena(partsOf(sizzlingSkillet));
    fake.hooks.emit('pattern:sweep', sweep(stats as never, 'before'));
    fake.hooks.emit('pattern:sweep', sweep(stats as never, 'hit'));
    expect(fake.callsOf('spawnPool')).toHaveLength(0);
    fake.hooks.emit('pattern:sweep', { ...sweep(stats as never, 'after'), bonus: true });
    expect(fake.callsOf('spawnPool')).toHaveLength(3);
  });
});
