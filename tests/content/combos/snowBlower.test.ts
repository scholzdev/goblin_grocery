import { describe, expect, it } from 'vitest';
import snowBlower from '../../../src/content/combos/snowBlower';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('snowBlower', snowBlower, ['Snow Blower', 'Schneefräse']);

describe('Snow Blower: runtime', () => {
  it('each blast drops one puddle of the snow cone at the end of the cone', () => {
    const { fake, b, stats } = arena(partsOf(snowBlower));
    const snow = b.weapons.find((w) => w.type === 'snowcone')!;
    fake.hooks.emit('pattern:cone', { stats, x: 10, y: 20, angle: Math.PI / 2, hits: [] });
    const [p] = fake.callsOf('spawnPuddle');
    expect(fake.callsOf('spawnPuddle')).toHaveLength(1);
    expect(p).toMatchObject({ weapon: snow.uid, x: expect.closeTo(10, 6), y: expect.closeTo(20 + stats.range, 6) });
  });
  it('does not fire for the snow cone\'s own events', () => {
    const { fake, b } = arena(partsOf(snowBlower));
    fake.hooks.emit('pattern:cone', { stats: b.weapons.find((w) => w.type === 'snowcone')!, x: 0, y: 0, angle: 0, hits: [] });
    expect(fake.callsOf('spawnPuddle')).toHaveLength(0);
  });
});
