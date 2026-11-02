import { describe, expect, it } from 'vitest';
import airRaid from '../../../src/content/combos/airRaid';
import { arena, at, describeCombo, partsOf } from './helpers';

describeCombo('airRaid', airRaid, ['Air Raid', 'Fliegeralarm']);

describe('Air Raid: runtime', () => {
  it('every 5th blast stuns the enemies it hit for 0.5 s', () => {
    const { fake, stats } = arena(partsOf(airRaid));
    const e = fake.spawnEnemy();
    for (let i = 1; i <= 10; i++) {
      fake.hooks.emit('pattern:cone', { stats, x: 0, y: 0, angle: 0, hits: [e] });
      expect(fake.callsOf('stun')).toHaveLength(Math.floor(i / 5));
    }
    expect(fake.callsOf('stun')[0]).toMatchObject({ enemy: e.id, seconds: 0.5 });
    expect(fake.callsOf('fx').filter((f) => f.method === 'ring')).toHaveLength(2);
  });
  it('a leaf blower without the combo is not counted', () => {
    const plain = arena([at('leafblower')]);
    for (let i = 0; i < 5; i++) plain.fake.hooks.emit('pattern:cone', { stats: plain.stats, x: 0, y: 0, angle: 0, hits: [plain.fake.spawnEnemy()] });
    expect(plain.fake.callsOf('stun')).toHaveLength(0);
  });
});
