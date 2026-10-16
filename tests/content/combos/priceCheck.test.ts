import { describe, expect, it } from 'vitest';
import priceCheck from '../../../src/content/combos/priceCheck';
import { MARK_MULT, markedDamage } from '../../../src/engine/marks';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('priceCheck', priceCheck, ['Price Check', 'Preisprüfung']);

describe('Price Check: runtime', () => {
  const beam = (stats: never, targets: never[], stage: 'before' | 'after' = 'before') => ({ stats, target: targets[0], targets, echo: false, stage, angle: 0, damageMult: 1, hits: [] });
  it('marks every enemy in the beam line for 3 s before the beam damages them', () => {
    const { fake, stats } = arena(partsOf(priceCheck));
    const es = [fake.spawnEnemy(), fake.spawnEnemy(), fake.spawnEnemy()];
    fake.hooks.emit('pattern:beam', beam(stats as never, es as never[]));
    expect(fake.callsOf('mark').map((m) => [m.enemy, m.seconds])).toEqual(es.map((e) => [e.id, 3]));
  });
  it('the "after" stage and plain lasers mark nothing', () => {
    const { fake, stats } = arena(partsOf(priceCheck));
    fake.hooks.emit('pattern:beam', beam(stats as never, [fake.spawnEnemy() as never], 'after'));
    const plain = arena([at('laser')]);
    plain.fake.hooks.emit('pattern:beam', beam(plain.stats as never, [plain.fake.spawnEnemy() as never]));
    expect(fake.callsOf('mark')).toHaveLength(0);
    expect(plain.fake.callsOf('mark')).toHaveLength(0);
  });
  it('the mark multiplier lives in the engine (marks.ts), owned by this combo\'s tune: x1.2 while marked, x1 after it expires', () => {
    expect(MARK_MULT).toBe(priceCheck.tune!.damageMult);
    expect(MARK_MULT).toBe(1.2);
    expect(markedDamage(10, 5, 4)).toBeCloseTo(12, 12);
    expect(markedDamage(10, 5, 5)).toBe(10);
    expect(markedDamage(10, undefined, 0)).toBe(10);
  });
  it('a marked enemy takes x1.2 from any source in the shared hit pipeline, until the mark expires', () => {
    const { fake, stats } = arena(partsOf(priceCheck));
    const e = fake.spawnEnemy({ hp: 1000 });
    fake.mark(e, 3);
    fake.hit(e, 10, { ...stats, critChance: 0 });
    expect(e.hp).toBeCloseTo(1000 - 12, 9);
    fake.advance(3.5);
    fake.hit(e, 10, { ...stats, critChance: 0 });
    expect(e.hp).toBeCloseTo(1000 - 12 - 10, 9);
  });
});
