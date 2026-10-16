import { describe, expect, it } from 'vitest';
import brainFreeze from '../../../src/content/combos/brainFreeze';
import { applyCombo, bare, describeCombo, partsOf, weaponOf, far } from './helpers';

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
