import { afterEach, describe, expect, it, vi } from 'vitest';
import toastMode from '../../../src/content/combos/toastMode';
import { applyCombo, bare, describeCombo, far, partsOf, weaponOf } from './helpers';
import { arsenal } from '../helpers';

afterEach(() => vi.restoreAllMocks());

describeCombo('toastMode', toastMode, ['Toast Mode', 'Toast-Modus']);

describe('Toast Mode: build', () => {
  it('turns the toaster into a 3-toast, 22 degree spread with 75% damage each', () => {
    const base = bare('toaster'), w = applyCombo(toastMode, base);
    expect(w.count).toBe(3);
    expect(w.damage).toBe(base.damage * 0.75);
    expect(w.spreadDeg).toBe(22);
  });
  it('is what computeBuild produces for the full cart (the Fan and Fuel Can modules still apply on top)', () => {
    const w = weaponOf(partsOf(toastMode));
    expect(w.recipes).toContain('toastMode');
    expect(w.count).toBeGreaterThanOrEqual(3);
    expect(w.spreadDeg).toBe(22);
  });
});

describe('Toast Mode: look (pattern:look)', () => {
  const P = { player: { x: 100, y: 400 } };

  it('restyles its toaster: pop at 0.85, golden hit sparks, a flame trail', () => {
    const { a } = arsenal(partsOf(toastMode), P);
    expect(a.looks.get('u0')).toMatchObject({ soundRate: 0.85, hitSpark: 0xf5bd45 });
    expect(typeof a.looks.get('u0')!.trail).toBe('function');
  });

  it('plays the lower pop when it fires, and a toaster without the combo keeps rate 1', () => {
    const { a, fake } = arsenal([...partsOf(toastMode), far('toaster')], P);
    expect(a.looks.has('u0')).toBe(true);
    expect([...a.looks.keys()]).toEqual(['u0']);
    fake.spawnEnemy({ x: 400, y: 400, hp: 100000 });
    a.run(40, 0.02);
    const pops = fake.callsOf('sound').filter((c) => c.name === 'toast_pop').map((c) => c.opts);
    expect(pops).toContainEqual({ rate: 0.85 });
    expect(pops).toContainEqual({ rate: 1 });
  });

  it('the trail lights a flame behind each live toast 70% of the frames (cosmetic Math.random, no combat rng)', () => {
    const { a, fake } = arsenal(partsOf(toastMode), P);
    const stats = a.weapons[0].stats;
    const shot = a.spawn('proj_toast', 300, 400, 0, 500, 2, 5, stats, 1)!;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const before = fake.rng();
    a.step(0.02);
    const flames = fake.callsOf('fx').filter((c) => c.method === 'flame');
    expect(flames).toHaveLength(1);
    expect(flames[0].args).toEqual([shot.x - shot.vx * 0.02, shot.y - 26 - shot.vy * 0.02]);
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    a.step(0.02);
    expect(fake.callsOf('fx').filter((c) => c.method === 'flame')).toHaveLength(1);
    expect(typeof before).toBe('number');
  });
});
