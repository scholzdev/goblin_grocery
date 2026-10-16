import { describe, expect, it } from 'vitest';
import mistMachine from '../../../src/content/combos/mistMachine';
import { applyCombo, bare, describeCombo, partsOf, weaponOf, at } from './helpers';
import { computeBuild } from '../../../src/systems/synergies';
import { build } from '../../golden/carts';

describeCombo('mistMachine', mistMachine, ['Mist Machine', 'Nebelmaschine']);

describe('Mist Machine: build', () => {
  it('sets the cone arc to 120 degrees and the range x1.4', () => {
    const base = bare('spray'), w = applyCombo(mistMachine, base);
    expect(w.arcDeg).toBe(120);
    expect(w.range).toBe(base.range * 1.4);
  });
  it('keeps the arc contributed by earlier modifiers (arcDeg += 120 - base arc)', () => {
    const base = { ...bare('spray'), arcDeg: 80 };
    expect(applyCombo(mistMachine, base).arcDeg).toBe(130);
  });
  it('suppresses the Desk Fan buff on the spray: the cart does not get the fan range/speed', () => {
    expect(mistMachine.suppresses).toEqual(['fan']);
    const alone = weaponOf(partsOf(mistMachine));
    const w = computeBuild(build([at('spray'), at('fan')], 8, 6)).weapons[0];
    expect(w.arcDeg).toBe(alone.arcDeg);
    expect(w.range).toBe(alone.range);
    expect(w.cooldown).toBe(alone.cooldown);
  });
});
