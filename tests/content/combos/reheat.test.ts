import { describe, expect, it } from 'vitest';
import reheat from '../../../src/content/combos/reheat';
import { arena, describeCombo, partsOf } from './helpers';

describeCombo('reheat', reheat, ['Reheat', 'Aufwärmen']);

describe('Reheat: runtime', () => {
  const zap = (stats: never, target: never, link: number, stage: 'before' | 'hit' | 'after') => ({ stats, target, link, stage, damageMult: 1, hits: [] });
  it('the first zap target gets a fire pool (radius = the microwave aoe, 2.5 s, combo tune)', () => {
    const { fake, stats } = arena(partsOf(reheat));
    const e = fake.spawnEnemy({ x: 70, y: 80 });
    fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 0, 'before'));
    const [pool] = fake.callsOf('spawnPool');
    expect(pool.spec).toMatchObject({ x: 70, y: 80, r: stats.aoe, time: 2.5, stats, tune: reheat.tune });
  });
  it('not on chain links, not in the hit/after stages', () => {
    const { fake, stats } = arena(partsOf(reheat));
    const e = fake.spawnEnemy();
    fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 1, 'before'));
    fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 0, 'hit'));
    fake.hooks.emit('pattern:zap', zap(stats as never, e as never, 0, 'after'));
    expect(fake.callsOf('spawnPool')).toHaveLength(0);
  });
});
