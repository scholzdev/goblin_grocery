import { describe, expect, it } from 'vitest';
import barcodeFlag from '../../../src/content/combos/barcodeFlag';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('barcodeFlag', barcodeFlag, ['Sale Scan', 'Sale-Scan']);

describe('Sale Scan: runtime', () => {
  const beam = (stats: never, targets: never[], stage: 'before' | 'after' = 'before') => ({ stats, target: targets[0], echo: false, stage, angle: 0, targets, damageMult: 1, hits: [] });
  it('marks every enemy in the line for the Sale Flag mark time at its tier', () => {
    for (const tier of [1, 3]) {
      const { fake, stats } = arena([at('laser'), at('flag', tier)]);
      const a = fake.spawnEnemy({ x: 50 }), b = fake.spawnEnemy({ x: 90 });
      fake.hooks.emit('pattern:beam', beam(stats as never, [a, b] as never[]));
      expect(fake.callsOf('mark').map((m) => [m.enemy, m.seconds])).toEqual([[a.id, 2 * [1, 1.5, 2][tier - 1]], [b.id, 2 * [1, 1.5, 2][tier - 1]]]);
    }
  });
  it('does nothing in the after stage, and for a laser without the combo', () => {
    const { fake, stats } = arena(partsOf(barcodeFlag));
    fake.hooks.emit('pattern:beam', beam(stats as never, [fake.spawnEnemy() as never], 'after'));
    const plain = arena([at('laser')]);
    plain.fake.hooks.emit('pattern:beam', beam(plain.stats as never, [plain.fake.spawnEnemy() as never]));
    expect(fake.callsOf('mark')).toHaveLength(0);
    expect(plain.fake.callsOf('mark')).toHaveLength(0);
  });
});
