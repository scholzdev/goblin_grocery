import { describe, expect, it } from 'vitest';
import nailstorm from '../../../src/content/combos/nailstorm';
import { applyCombo, bare, describeCombo, partsOf, activeIn, at, far } from './helpers';
import { computeBuild } from '../../../src/systems/synergies';
import { build } from '../../golden/carts';

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
