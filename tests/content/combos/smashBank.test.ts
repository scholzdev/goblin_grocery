import { describe, expect, it } from 'vitest';
import smashBank from '../../../src/content/combos/smashBank';
import { arena, describeCombo, draws, partsOf, at } from './helpers';

describeCombo('smashBank', smashBank, ['Smash the Bank', 'Sparschwein-Schlag']);

describe('Smash the Bank: runtime', () => {
  const sweep = (stats: never, stage: 'before' | 'hit' | 'after', enemy?: never) => ({ stats, stage, x: 0, y: 0, angle: 0, bonus: false, range: 100, dmg: 9, hits: [], enemy });
  it('rolls once per enemy the sweep damages (hit stage): a 15% chance of a coin at that enemy, labelled "Smash the Bank"', () => {
    const { fake, stats } = arena(partsOf(smashBank), { seed: 12 });
    const want = draws(12, 60).map((r) => r < 0.15);
    expect(want.some(Boolean) && want.some((x) => !x)).toBe(true);
    for (let i = 0; i < 60; i++) {
      const before = fake.callsOf('dropCoin').length, e = fake.spawnEnemy({ x: i, y: 2 * i });
      fake.hooks.emit('pattern:sweep', sweep(stats as never, 'hit', e as never));
      expect(fake.callsOf('dropCoin').length - before, `#${i}`).toBe(want[i] ? 1 : 0);
      if (want[i]) expect(fake.callsOf('dropCoin').at(-1)).toMatchObject({ x: i, y: 2 * i, label: 'Smash the Bank' });
    }
    expect(fake.rng()).toBe(draws(12, 61)[60]);
  });
  it('the other stages and other pans draw nothing', () => {
    const { fake, stats } = arena(partsOf(smashBank), { seed: 12 });
    const e = fake.spawnEnemy();
    fake.hooks.emit('pattern:sweep', sweep(stats as never, 'before'));
    fake.hooks.emit('pattern:sweep', sweep(stats as never, 'after'));
    const plain = arena([at('pan')], { seed: 12 });
    plain.fake.hooks.emit('pattern:sweep', sweep(plain.stats as never, 'hit', e as never));
    expect(fake.rng()).toBe(draws(12, 1)[0]);
    expect(plain.fake.callsOf('dropCoin')).toHaveLength(0);
  });
});
