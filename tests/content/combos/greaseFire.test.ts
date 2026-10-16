import { describe, expect, it } from 'vitest';
import greaseFire from '../../../src/content/combos/greaseFire';
import { applyCombo, bare, describeCombo, partsOf, weaponOf } from './helpers';

describeCombo('greaseFire', greaseFire, ['Grease Fire', 'Fettbrand']);

describe('Grease Fire: build', () => {
  it('widens the puddle x1.4 and doubles the burn dps', () => {
    const base = { ...bare('mop'), burn: { dps: 3, duration: 2, tick: 0.5 } }, w = applyCombo(greaseFire, base);
    expect(w.range).toBe(base.range * 1.4);
    expect(w.burn).toEqual({ dps: 6, duration: 2, tick: 0.5 });
  });
  it('without a burn (the Fuel Can module not applied) only the radius changes', () => {
    const base = bare('mop'), w = applyCombo(greaseFire, base);
    expect(w.burn).toBeFalsy();
    expect(w.range).toBe(base.range * 1.4);
  });
  it('the full cart has a burn that is the doubled Fuel Can burn', () => {
    const w = weaponOf(partsOf(greaseFire));
    expect(w.burn).toBeTruthy();
    expect(w.burn!.dps).toBeGreaterThan(0);
  });
});
