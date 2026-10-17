import { afterEach, describe, expect, it, vi } from 'vitest';
import nailstorm from '../../../src/content/combos/nailstorm';
import { applyCombo, bare, describeCombo, partsOf, activeIn, at, far } from './helpers';
import { computeBuild } from '../../../src/systems/synergies';
import { build, type Spec } from '../../golden/carts';
import { stepArsenal } from '../../../src/engine/patterns';
import { arsenal } from '../helpers';

afterEach(() => vi.restoreAllMocks());

describeCombo('nailstorm', nailstorm, ['Nailstorm', 'Nagelsturm']);

describe('Nailstorm: build', () => {
  it('adds one pierce and turns on homing', () => {
    const base = bare('nailgun'), w = applyCombo(nailstorm, base);
    expect(w.pierce).toBe(base.pierce + 1);
    expect(w.homing).toBe(true);
    expect(w.damage).toBe(base.damage);
  });
  it('tune carries the homing numbers the weapon code reads (turn 7 rad/s, range 200)', () => {
    expect(nailstorm.tune).toMatchObject({ extraPierce: 1, homingTurn: 7, homingRange: 200 });
  });
  it('Ray Gun replaces it on the same weapon: only one of the two is active', () => {
    const ray = [at('nailgun'), at('battery'), at('tinfoilhat'), at('magnet')];
    expect(activeIn(partsOf(nailstorm))).toContain('nailstorm');
    expect(activeIn(ray)).toContain('rayGun');
    expect(activeIn(ray)).not.toContain('nailstorm');
    expect(computeBuild(build(ray, 8, 6)).weapons[0].homing).toBeFalsy();
  });
  it('a second Nail Gun without the parts is untouched', () => {
    const b = computeBuild(build([...partsOf(nailstorm), far('nailgun')], 8, 6));
    expect(b.weapons.find((w) => w.uid === 'u3')?.homing).toBeFalsy();
  });
});

describe('Nailstorm: pattern hooks', () => {
  const P = { player: { x: 100, y: 400 } };
  const homing = (a: ReturnType<typeof arsenal>['a'], x: number, y: number, angle: number) => {
    const shot = a.spawn('proj_nail', x, y, angle, 400, 3, 3, a.weapons[0].stats, 3)!;
    shot.homing = true;
    return shot;
  };

  it('a nail that hit something is armed; nails of the plain Nail Gun are not', () => {
    for (const [specs, armed] of [[partsOf(nailstorm), true], [[at('nailgun')], false]] as [Spec[], boolean][]) {
      const { a, fake } = arsenal(specs, P);
      fake.spawnEnemy({ x: 365, y: 400, hp: 100000 });
      const shot = a.spawn('proj_nail', 330, 400, 0, 400, 3, 3, a.weapons[0].stats, 3)!;
      expect(shot.homing).toBe(false);
      stepArsenal(a, 0.05, false);
      expect(fake.callsOf('damage')).toHaveLength(1);
      expect(shot.homing).toBe(armed);
    }
  });

  it('a second Nail Gun that does not touch the parts stays straight', () => {
    const { a, fake } = arsenal([...partsOf(nailstorm), far('nailgun')], P);
    fake.spawnEnemy({ x: 365, y: 400, hp: 100000 });
    const plain = a.weapons.find((w) => w.stats.uid === 'u3')!;
    const shot = a.spawn('proj_nail', 330, 400, 0, 400, 3, 3, plain.stats, 3)!;
    stepArsenal(a, 0.05, false);
    expect(shot.homing).toBe(false);
  });

  it('steers an armed nail toward an enemy within 200, at most 7 rad/s x dt, at the same speed', () => {
    const { a, fake } = arsenal(partsOf(nailstorm), P);
    fake.spawnEnemy({ x: 300, y: 500, hp: 100000 }); // 90° off to the side, 100 px away
    const shot = homing(a, 300, 400, 0);
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(7 * 0.05); // 0.35 rad, not the whole 90°
    expect(Math.hypot(shot.vx, shot.vy)).toBeCloseTo(400);
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(7 * 0.1);
  });

  it('turns the short way round (angle wrap) and does not turn when it already points at the enemy', () => {
    const { a, fake } = arsenal(partsOf(nailstorm), P);
    const shot = homing(a, 600, 400, Math.PI - 0.1);
    const want = Math.PI + 0.1; // the same direction as -π + 0.1: 0.2 rad the short way, 6.08 the long way
    fake.spawnEnemy({ x: 600 + 100 * Math.cos(want), y: 400 + 100 * Math.sin(want), hp: 100000 });
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(shot.vy, shot.vx)).toBeCloseTo(-Math.PI + 0.1);
    const ahead = homing(a, 600, 700, 0);
    fake.spawnEnemy({ x: 700, y: 700, hp: 100000 });
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(ahead.vy, ahead.vx)).toBe(0);
  });

  it('ignores enemies beyond 200 and the ones the nail already hit', () => {
    const { a, fake } = arsenal(partsOf(nailstorm), P);
    const farOne = fake.spawnEnemy({ x: 300, y: 650, hp: 100000 }); // 250 px away
    const shot = homing(a, 300, 400, 0);
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(shot.vy, shot.vx)).toBe(0);
    farOne.y = 500;
    shot.tracker.hits.add(farOne.id); // already pierced: not a target
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(shot.vy, shot.vx)).toBe(0);
  });

  it('does not steer a shot nobody armed, nor an armed shot of another weapon\'s combo', () => {
    const { a, fake } = arsenal([...partsOf(nailstorm), far('nailgun')], P);
    fake.spawnEnemy({ x: 300, y: 500, hp: 100000 });
    const plain = a.weapons.find((w) => w.stats.uid === 'u3')!;
    const shot = a.spawn('proj_nail', 300, 400, 0, 400, 3, 3, plain.stats, 3)!;
    shot.homing = true;
    stepArsenal(a, 0.05, false);
    expect(Math.atan2(shot.vy, shot.vx)).toBe(0);
  });

  it('draws the teal spark trail 30% of the frames', () => {
    const { a, fake } = arsenal(partsOf(nailstorm), P);
    a.spawn('proj_nail', 300, 400, 0, 400, 3, 3, a.weapons[0].stats, 3);
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    stepArsenal(a, 0.05, false);
    expect(fake.callsOf('fx').filter((c) => c.method === 'spark').map((c) => c.args)).toEqual([[320, 374, 1, 0x3fb7a6]]);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    stepArsenal(a, 0.05, false);
    expect(fake.callsOf('fx').filter((c) => c.method === 'spark')).toHaveLength(1);
  });

  it('end to end: a nail curves on to a second enemy after its first hit (and goes straight past it without the combo)', () => {
    const run = (specs: Parameters<typeof arsenal>[0]) => {
      const { a, fake } = arsenal(specs, { seed: 2, ...P });
      fake.spawnEnemy({ x: 260, y: 400, hp: 100000 });
      const second = fake.spawnEnemy({ x: 330, y: 480, hp: 100000 });
      a.run(120, 0.01);
      return fake.callsOf('damage').filter((c) => c.enemy === second.id).length;
    };
    expect(run(partsOf(nailstorm))).toBeGreaterThan(0);
    expect(run([at('nailgun')])).toBe(0);
  });
});
