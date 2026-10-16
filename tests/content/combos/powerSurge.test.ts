import { describe, expect, it } from 'vitest';
import powerSurge from '../../../src/content/combos/powerSurge';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('powerSurge', powerSurge, ['Power Surge', 'Stromstoß']);

describe('Power Surge: runtime', () => {
  const beam = (stats: never, target: never, echo: boolean, stage: 'before' | 'after' = 'before') => ({ stats, target, echo, stage, angle: 0, targets: [target], damageMult: 1, hits: [] });
  it('a first beam schedules an aftershock beam 0.25 s later at the same target (echo)', () => {
    const { fake, stats } = arena(partsOf(powerSurge));
    const e = fake.spawnEnemy({ x: 100 });
    fake.hooks.emit('pattern:beam', beam(stats as never, e as never, false));
    expect(fake.callsOf('beam')).toHaveLength(0);
    fake.advance(0.249);
    expect(fake.callsOf('beam')).toHaveLength(0);
    fake.advance(0.002);
    expect(fake.callsOf('beam')).toEqual([expect.objectContaining({ weapon: stats.uid, target: e.id, echo: true })]);
  });
  it('the aftershock retargets the nearest enemy in range when the target died, and is skipped when the aisle is over', () => {
    const { fake, stats } = arena(partsOf(powerSurge));
    const e = fake.spawnEnemy({ x: 100 }), other = fake.spawnEnemy({ x: 200 });
    fake.hooks.emit('pattern:beam', beam(stats as never, e as never, false));
    e.alive = false;
    fake.advance(0.3);
    expect(fake.callsOf('beam').map((b) => b.target)).toEqual([other.id]);
    fake.hooks.emit('pattern:beam', beam(stats as never, other as never, false));
    fake.active = false;
    fake.advance(0.3);
    expect(fake.callsOf('beam')).toHaveLength(1);
  });
  it('the echo beam itself deals 25% damage and schedules nothing more', () => {
    const { fake, stats } = arena(partsOf(powerSurge));
    const ev = beam(stats as never, fake.spawnEnemy() as never, true);
    fake.hooks.emit('pattern:beam', ev);
    expect(ev.damageMult).toBe(0.25);
    fake.advance(5);
    expect(fake.callsOf('beam')).toHaveLength(0);
  });
  it('a first beam keeps full damage; the after stage and other lasers do nothing', () => {
    const { fake, stats } = arena(partsOf(powerSurge));
    const ev = beam(stats as never, fake.spawnEnemy() as never, false);
    fake.hooks.emit('pattern:beam', ev);
    expect(ev.damageMult).toBe(1);
    fake.hooks.emit('pattern:beam', beam(stats as never, fake.spawnEnemy() as never, false, 'after'));
    const plain = arena([at('laser')]);
    plain.fake.hooks.emit('pattern:beam', beam(plain.stats as never, plain.fake.spawnEnemy() as never, false));
    plain.fake.advance(1);
    expect(plain.fake.callsOf('beam')).toHaveLength(0);
  });
  it('draws no random numbers', () => {
    const { fake, stats } = arena(partsOf(powerSurge), { seed: 5 });
    fake.hooks.emit('pattern:beam', beam(stats as never, fake.spawnEnemy() as never, false));
    fake.advance(1);
    expect(fake.rng()).toBe(arena(partsOf(powerSurge), { seed: 5 }).fake.rng());
  });
});
