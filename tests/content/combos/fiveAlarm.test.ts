import { describe, expect, it } from 'vitest';
import fiveAlarm from '../../../src/content/combos/fiveAlarm';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('fiveAlarm', fiveAlarm, ['Five-Alarm Toast', 'Fünf-Alarm-Toast']);

/** hp lost by one 10-damage hit (hp is large so nothing dies). */
const dealt = (fake: ReturnType<typeof arena>['fake'], stats: ReturnType<typeof arena>['stats'], burning: boolean, extra: Record<string, unknown> = {}) => {
  const e = fake.spawnEnemy({ hp: 1000, ...extra });
  if (burning) e.status.burnUntil = fake.time + 3;
  fake.hit(e, 10, stats);
  return 1000 - e.hp;
};

describe('Five-Alarm Toast: runtime', () => {
  it('toast damage vs a burning enemy x1.8, otherwise normal', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm));
    expect(dealt(fake, stats, false)).toBe(10);
    expect(dealt(fake, stats, true)).toBeCloseTo(18, 12);
  });
  it('an expired burn does not count', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm));
    const e = fake.spawnEnemy({ hp: 1000 });
    e.status.burnUntil = 1; fake.advance(2);
    fake.hit(e, 10, stats);
    expect(e.hp).toBe(990);
  });
  it('not for a non-toast pattern, and not for a toaster without the combo', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm));
    expect(dealt(fake, { ...stats, pattern: 'sweep' }, true)).toBe(10);
    const plain = arena([at('toaster')]);
    expect(dealt(plain.fake, plain.stats, true)).toBe(10);
  });
  it('order guard: the x1.8 is applied in modifyDamage, so the mark (x1.2) and a crit multiply on top of it', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm));
    const e = fake.spawnEnemy({ hp: 1000 });
    e.status.burnUntil = 10; e.markedUntil = 10;
    fake.hit(e, 10, { ...stats, critChance: 0 });
    expect(1000 - e.hp).toBeCloseTo(10 * 1.8 * 1.2, 9);
  });
  it('draws no random numbers when the weapon cannot crit', () => {
    const { fake, stats } = arena(partsOf(fiveAlarm), { seed: 6 });
    dealt(fake, { ...stats, critChance: 0 }, true);
    expect(fake.rng()).toBe(arena(partsOf(fiveAlarm), { seed: 6 }).fake.rng());
  });
});
