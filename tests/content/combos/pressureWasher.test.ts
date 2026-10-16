import { describe, expect, it } from 'vitest';
import pressureWasher from '../../../src/content/combos/pressureWasher';
import { applyCombo, bare, describeCombo, partsOf, weaponOf, at } from './helpers';

describeCombo('pressureWasher', pressureWasher, ['Pressure Washer', 'Hochdruckreiniger']);

describe('Pressure Washer: build', () => {
  it('narrows the cone to 25 degrees, range x2, damage x2.5', () => {
    const base = bare('spray'), w = applyCombo(pressureWasher, base);
    expect(w.arcDeg).toBe(25);
    expect(w.range).toBe(base.range * 2);
    expect(w.damage).toBe(base.damage * 2.5);
  });
  it('adds the tape arc snapshot (what Duct Tape contributed before the combos) on top of 25', () => {
    expect(applyCombo(pressureWasher, bare('spray'), 15).arcDeg).toBe(40);
  });
  it('Tape on the cart widens the washer by the tape arc only (a Mist Machine arc never leaks in)', () => {
    const plain = weaponOf(partsOf(pressureWasher));
    const taped = weaponOf([...partsOf(pressureWasher), at('tape')]);
    expect(plain.arcDeg).toBe(25);
    expect(taped.arcDeg).toBeGreaterThan(25);
  });
});
