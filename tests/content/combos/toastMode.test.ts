import { describe, expect, it } from 'vitest';
import toastMode from '../../../src/content/combos/toastMode';
import { applyCombo, bare, describeCombo, partsOf, weaponOf } from './helpers';

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
