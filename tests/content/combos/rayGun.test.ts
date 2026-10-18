import { describe, expect, it } from 'vitest';
import rayGun from '../../../src/content/combos/rayGun';
import { activeIn, arena, describeCombo, partsOf, at } from './helpers';

describeCombo('rayGun', rayGun, ['Ray Gun', 'Strahlenkanone']);

describe('Ray Gun: replaces Nailstorm', () => {
  it('with the Nailstorm parts plus a Tinfoil Hat the cart has Ray Gun and not Nailstorm', () => {
    expect(activeIn(partsOf(rayGun))).toContain('rayGun');
    expect(activeIn(partsOf(rayGun))).not.toContain('nailstorm');
    expect(rayGun.replaces).toEqual(['nailstorm']);
  });
  it('without the hat it is Nailstorm', () => {
    expect(activeIn([at('nailgun'), at('magnet'), at('battery')])).toEqual(expect.arrayContaining(['nailstorm']));
    expect(activeIn([at('nailgun'), at('magnet'), at('battery')])).not.toContain('rayGun');
  });
});

describe('Ray Gun: runtime', () => {
  const fire = (stats: never, first = true) => ({ stats, x: 5, y: 6, angle: 0.5, first, handled: false });
  it('replaces the default nail with an energy bolt (handled) at the given angle, speed and range of the weapon', () => {
    const { fake, stats } = arena(partsOf(rayGun));
    const ev = fire(stats as never);
    fake.hooks.emit('pattern:fire', ev);
    expect(ev.handled).toBe(true);
    expect(fake.callsOf('spawnShot')[0].spec).toMatchObject({ key: 'proj_raybolt', x: 5, y: 6, angle: 0.5, speed: stats.projectileSpeed, life: stats.range / stats.projectileSpeed, damage: stats.damage, maxHits: 1 });
    expect(fake.callsOf('sound').map((s) => s.name)).toEqual(['zap']);
  });
  it('every 3rd bolt (per weapon) is the big red one: 120 radius x1.2, the others 60 radius x0.6', () => {
    const { fake, stats } = arena(partsOf(rayGun));
    for (let i = 0; i < 6; i++) fake.hooks.emit('pattern:fire', fire(stats as never));
    const keys = fake.callsOf('spawnShot').map((s) => s.spec.key);
    expect(keys).toEqual(['proj_raybolt', 'proj_raybolt', 'proj_raybolt_red', 'proj_raybolt', 'proj_raybolt', 'proj_raybolt_red']);
    expect(fake.playerShots.map((s) => s.splash)).toEqual([{ r: 60, m: 0.6 }, { r: 60, m: 0.6 }, { r: 120, m: 1.2 }, { r: 60, m: 0.6 }, { r: 60, m: 0.6 }, { r: 120, m: 1.2 }]);
  });
  it('only the first bolt of a burst plays the sound', () => {
    const { fake, stats } = arena(partsOf(rayGun));
    fake.hooks.emit('pattern:fire', fire(stats as never, true));
    fake.hooks.emit('pattern:fire', fire(stats as never, false));
    expect(fake.callsOf('sound')).toHaveLength(1);
  });
  it('a hit splashes the other enemies inside the ring (not the one hit, not those outside) for shot damage x multiplier', () => {
    const { fake, stats } = arena(partsOf(rayGun));
    fake.hooks.emit('pattern:fire', fire(stats as never));
    const shot = fake.playerShots[0];
    shot.x = 100; shot.y = 100; shot.damage = 10;
    const hit = fake.spawnEnemy({ x: 100, y: 100, hp: 100 }), near = fake.spawnEnemy({ x: 140, y: 100, hp: 100 }), far = fake.spawnEnemy({ x: 400, y: 100, hp: 100 });
    fake.clear();
    fake.hooks.emit('pattern:shotHit', { stats, shot, enemy: hit });
    const dmg = fake.callsOf('damage');
    expect(dmg).toHaveLength(1);
    expect(dmg[0]).toMatchObject({ enemy: near.id, dmg: 6 });
    expect(dmg[0].opts).toMatchObject({ quiet: true, chained: true });
    expect(far.hp).toBe(100);
    expect(fake.callsOf('fx').some((f) => f.method === 'ring')).toBe(true);
  });
  it('a plain nail (no splash) and a Nail Gun without the combo do nothing', () => {
    const { fake, stats } = arena(partsOf(rayGun));
    const e = fake.spawnEnemy();
    fake.hooks.emit('pattern:shotHit', { stats, enemy: e, shot: { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 1, damage: 3, stats, splash: null, tracker: { hits: new Set<number>() } } });
    const plain = arena([at('nailgun')]);
    const ev = fire(plain.stats as never);
    plain.fake.hooks.emit('pattern:fire', ev);
    expect(fake.calls).toHaveLength(0);
    expect(ev.handled).toBe(false);
  });
});
