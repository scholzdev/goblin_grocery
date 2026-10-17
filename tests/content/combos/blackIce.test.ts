import { describe, expect, it } from 'vitest';
import blackIce from '../../../src/content/combos/blackIce';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('blackIce', blackIce, ['Black Ice', 'Glatteis']);

describe('Black Ice: runtime', () => {
  const enter = (stats: never, enemy: never, first: boolean) => ({ stats, enemy, first, puddle: { x: 0, y: 0, r: 60 }, slow: { pct: 0.25, duration: 0.5 } });
  it('an enemy\'s first tick in a puddle freezes it (stun 0.8 s) with a frost burst above it', () => {
    const { fake, stats } = arena(partsOf(blackIce));
    const e = fake.spawnEnemy({ x: 3, y: 90 });
    fake.hooks.emit('pattern:puddleEnter', enter(stats as never, e as never, true));
    expect(fake.callsOf('stun')).toEqual([expect.objectContaining({ enemy: e.id, seconds: 0.8 })]);
    expect(fake.callsOf('fx').find((f) => f.method === 'frostBurst')!.args).toEqual([3, 70, 4]);
  });
  it('later ticks and mops without the combo do nothing', () => {
    const { fake, stats } = arena(partsOf(blackIce));
    const e = fake.spawnEnemy();
    fake.hooks.emit('pattern:puddleEnter', enter(stats as never, e as never, false));
    const plain = arena([at('mop')]);
    plain.fake.hooks.emit('pattern:puddleEnter', enter(plain.stats as never, e as never, true));
    expect(fake.calls).toHaveLength(0);
    expect(plain.fake.calls).toHaveLength(0);
  });
});
