import { describe, expect, it } from 'vitest';
import brainFreeze from '../../../src/content/combos/brainFreeze';
import { applyCombo, bare, describeCombo, partsOf, weaponOf, far } from './helpers';
import { arsenal } from '../helpers';

describeCombo('brainFreeze', brainFreeze, ['Brain Freeze', 'Eiskopfschmerz']);

describe('Brain Freeze: build', () => {
  it('widens the blender x1.25 and sets slow 40% for 0.6 s', () => {
    const base = bare('blender'), w = applyCombo(brainFreeze, base);
    expect(w.range).toBe(base.range * 1.25);
    expect(w.slow).toEqual({ pct: 0.4, duration: 0.6 });
    expect(w.damage).toBe(base.damage);
  });
  it('overrides the Ice Pack slow', () => {
    expect(brainFreeze.overrides).toEqual(['slow']);
    expect(weaponOf(partsOf(brainFreeze)).slow).toEqual({ pct: 0.5 - 0.1, duration: 0.6 });
  });
  it('order guard: Frost L1 (post-combo, order 1000) adds +0.1 after the combo slow: 0.4 -> 0.5', () => {
    expect(weaponOf([...partsOf(brainFreeze), far('fizz')]).slow).toEqual({ pct: 0.5, duration: 0.6 });
  });
});

describe('Brain Freeze: look (pattern:look)', () => {
  it('spins its blades at 9 rad/s in pale ice-blue, the plain blender at 12 untinted', () => {
    const { a } = arsenal([...partsOf(brainFreeze), far('blender')]);
    expect(a.looks.get('u0')).toEqual({ bladeSpin: 9, bladeTint: 0xcff3ff });
    expect(a.looks.has('u3')).toBe(false); // the cart has the blender first, then its parts, then the far one
    const rings = a.weapons.filter((w) => w.blades);
    expect(rings).toHaveLength(2);
    a.step(0.1);
    const [frost, plain] = rings.map((w) => w.blades as unknown as { rotation: number; log: string[] });
    expect(frost.rotation).toBeCloseTo(0.9);
    expect(frost.log).toContain(`setTint(${0xcff3ff})`);
    expect(plain.rotation).toBeCloseTo(1.2);
    expect(plain.log.some((l) => l.startsWith('setTint'))).toBe(false);
  });
});
