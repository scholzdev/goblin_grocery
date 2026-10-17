import { describe, expect, it } from 'vitest';
import potSlam from '../../../src/content/combos/potSlam';
import { arena, describeCombo, partsOf, at } from './helpers';

describeCombo('potSlam', potSlam, ['Pot Slam', 'Topf-Slam']);

describe('Pot Slam: build', () => {
  it('changes no stats: the blast is the onDashEnd hook', () => {
    expect(potSlam.build).toBeUndefined();
  });
});

describe('Pot Slam: runtime', () => {
  it('the dash end makes the cooker blast at the landing spot, with or without a hit', () => {
    const { fake, stats } = arena(partsOf(potSlam));
    for (const hit of [true, false]) fake.hooks.emit('onDashEnd', { x: 30, y: 40, dx: 1, dy: 0, hit });
    expect(fake.callsOf('explode')).toEqual([expect.objectContaining({ weapon: stats.uid, x: 30, y: 40 }), expect.objectContaining({ weapon: stats.uid, x: 30, y: 40 })]);
  });
  it('only cookers with the combo blast (a second plain cooker does not)', () => {
    const { fake, stats } = arena([...partsOf(potSlam), { ...at('cooker'), near: [], apart: [0] }]);
    fake.hooks.emit('onDashEnd', { x: 1, y: 2, dx: 1, dy: 0, hit: true });
    expect(fake.callsOf('explode').map((c) => c.weapon)).toEqual([stats.uid]);
  });
  it('order guard: Pot Slam (order 0) blasts before Express Checkout (order 10) sweeps', () => {
    const specs = [at('pan'), at('bell'), { ...at('cooker'), near: [], apart: [0] }, { ...at('bumper'), near: [2], apart: [0] }];
    const { fake } = arena(specs);
    fake.hooks.emit('onDashEnd', { x: 1, y: 2, dx: 1, dy: 0, hit: true });
    const kinds = fake.calls.filter((c) => c.kind === 'explode' || c.kind === 'sweep').map((c) => c.kind);
    expect(kinds).toEqual(['explode', 'sweep']);
  });
});
