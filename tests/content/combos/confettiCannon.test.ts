import { describe, expect, it } from 'vitest';
import confettiCannon from '../../../src/content/combos/confettiCannon';
import { contentSetTune } from '../../../src/engine/registry';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('confettiCannon', confettiCannon, ['Confetti Cannon', 'Konfettikanone']);

describe('Confetti Cannon: runtime', () => {
  const bounce = (stats: never, damage: number) => ({ stats, x: 10, y: 20, next: null, shot: { active: true, x: 10, y: 20, vx: 0, vy: 0, life: 1, damage, stats, splash: null, tracker: { hits: new Set<number>() } } });
  it('every ricochet cap pops a confetti blast at the bounce: 50% of the shot damage, radius 60', () => {
    const { fake, stats } = arena(partsOf(confettiCannon));
    fake.hooks.emit('pattern:bounce', bounce(stats as never, 8));
    expect(fake.callsOf('popperBlast')).toEqual([expect.objectContaining({ x: 10, y: 20, damage: 4, radius: 60, setPop: false })]);
  });
  it('the Blast set radius bonus widens it (read from the set tune, L1)', () => {
    const { fake, stats } = arena(partsOf(confettiCannon));
    fake.build.sets.blast = 1;
    fake.hooks.emit('pattern:bounce', bounce(stats as never, 8));
    expect(fake.callsOf('popperBlast')[0].radius).toBe(60 * contentSetTune('blast', 1).radiusMult);
    expect(contentSetTune('blast', 1).radiusMult).toBeGreaterThan(1);
  });
  it('the blast damages the enemies inside as a popper hit (no re-trigger) and nothing outside', () => {
    const { fake, stats } = arena(partsOf(confettiCannon));
    const near = fake.spawnEnemy({ x: 20, y: 20, hp: 100 }), far = fake.spawnEnemy({ x: 500, y: 500, hp: 100 });
    fake.hooks.emit('pattern:bounce', bounce(stats as never, 8));
    expect(fake.callsOf('damage').map((d) => d.enemy)).toEqual([near.id]);
    expect(far.hp).toBe(100);
  });
  it('a fizz without the combo pops nothing', () => {
    const { fake, stats } = arena([at('fizz')]);
    fake.hooks.emit('pattern:bounce', bounce(stats as never, 8));
    expect(fake.callsOf('popperBlast')).toHaveLength(0);
  });
});
