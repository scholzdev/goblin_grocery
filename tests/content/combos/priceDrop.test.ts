import { describe, expect, it } from 'vitest';
import priceDrop from '../../../src/content/combos/priceDrop';
import { arena, at, describeCombo, partsOf } from './helpers';

describeCombo('priceDrop', priceDrop, ['Price Drop', 'Preissturz']);

describe('Price Drop: runtime', () => {
  const kill = (fake: ReturnType<typeof arena>['fake'], stats: unknown, roll: number) => {
    fake.rng = () => roll;
    fake.hooks.emit('onKill', { enemy: fake.spawnEnemy(), hit: { stats } as never });
  };
  it('a laser kill rolls at 2x the coupon chance: 0.6 at tier 1 (0.59 drops, 0.61 does not)', () => {
    const { fake, stats } = arena(partsOf(priceDrop));
    kill(fake, stats, 0.59);
    expect(fake.callsOf('dropCoin')).toHaveLength(1);
    kill(fake, stats, 0.61);
    expect(fake.callsOf('dropCoin')).toHaveLength(1);
  });
  it('is capped by the coupon cap (0.9)', () => {
    const { fake, stats } = arena([at('laser'), at('coupon', 3)]);
    kill(fake, stats, 0.85);
    expect(fake.callsOf('dropCoin')).toHaveLength(1);
    kill(fake, stats, 0.91);
    expect(fake.callsOf('dropCoin')).toHaveLength(1);
  });
  it('does not roll for a kill without a laser hit (only the coupon\'s own roll runs)', () => {
    const { fake } = arena(partsOf(priceDrop));
    fake.rng = () => 0.5;
    fake.hooks.emit('onKill', { enemy: fake.spawnEnemy(), hit: null });
    expect(fake.callsOf('dropCoin')).toHaveLength(0);
  });
});
