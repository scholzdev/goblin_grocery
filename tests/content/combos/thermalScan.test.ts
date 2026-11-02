import { describe, expect, it } from 'vitest';
import thermalScan from '../../../src/content/combos/thermalScan';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('thermalScan', thermalScan, ['Thermal Scanner', 'Wärmescanner']);

describe('Thermal Scanner: runtime', () => {
  const beam = (stats: never, echo: boolean) => ({ stats, target: undefined as never, echo, stage: 'before' as const, angle: 0, targets: [], damageMult: 1, hits: [] });
  it('a beam leaves 3 fire pools spaced along its line, 2 s each, with the combo tune', () => {
    const { fake, stats } = arena(partsOf(thermalScan));
    fake.player.x = 100; fake.player.y = 40; fake.player.facing = 1;
    fake.hooks.emit('pattern:beam', beam(stats as never, false));
    const pools = fake.callsOf('spawnPool').map((p) => p.spec);
    expect(pools).toHaveLength(3);
    const ds = pools.map((p) => p.x - 118);
    [stats.range / 6, stats.range / 2, (stats.range * 5) / 6].forEach((d, i) => expect(ds[i]).toBeCloseTo(d, 6));
    expect(pools.every((p) => p.y === 40 && p.time === 2 && p.stats === stats)).toBe(true);
  });
  it('echo beams leave nothing; the pools burn only through the Fuel burn on the laser', () => {
    const { fake, stats } = arena(partsOf(thermalScan));
    fake.hooks.emit('pattern:beam', beam(stats as never, true));
    expect(fake.callsOf('spawnPool')).toHaveLength(0);
    expect(stats.burn).toBeDefined();
  });
});
