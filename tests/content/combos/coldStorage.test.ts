import { describe, expect, it } from 'vitest';
import coldStorage from '../../../src/content/combos/coldStorage';
import { applyCombo, bare, describeCombo, partsOf, weaponOf, far } from './helpers';

describeCombo('coldStorage', coldStorage, ['Cold Storage', 'Kühlhaus']);

describe('Cold Storage: build', () => {
  it('turns on the frost ring, sets slow 50% for 1.5 s, damage x2.5, range x1.2', () => {
    const base = bare('vacuum'), w = applyCombo(coldStorage, base);
    expect(w.frostRing).toBe(true);
    expect(w.slow).toEqual({ pct: 0.5, duration: 1.5 });
    expect(w.damage).toBe(base.damage * 2.5);
    expect(w.range).toBe(base.range * 1.2);
  });
  it('replaces the Ice Pack slow instead of adding to it', () => {
    expect(weaponOf(partsOf(coldStorage)).slow).toEqual({ pct: 0.5, duration: 1.5 });
  });
  it('order guard: the Frost set bonus (post-combo, order 1000) lands after the combo slow: 0.5 -> 0.6 at Frost L1', () => {
    const w = weaponOf([...partsOf(coldStorage), far('fizz')]);
    expect(w.slow).toEqual({ pct: 0.6, duration: 1.5 });
  });
});
