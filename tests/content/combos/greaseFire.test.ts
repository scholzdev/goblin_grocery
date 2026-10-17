import { afterEach, describe, expect, it, vi } from 'vitest';
import greaseFire from '../../../src/content/combos/greaseFire';
import { applyCombo, bare, describeCombo, far, partsOf, weaponOf } from './helpers';
import { arsenal } from '../helpers';

afterEach(() => vi.restoreAllMocks());

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

describe('Grease Fire: look (pattern:look)', () => {
  it('its puddles are the burning slick; a mop without the combo drops the soap puddle', () => {
    const { a } = arsenal([...partsOf(greaseFire), far('mop')]);
    expect(a.looks.get('u0')!.puddleKey).toBe('fx_puddle_fire');
    expect(a.looks.has('u2')).toBe(false);
    a.step(0.7); // both mops drop their puddle
    expect(a.puddles.map((p) => p.img.texture.key).sort()).toEqual(['fx_puddle', 'fx_puddle_fire']);
  });

  it('flames flicker over the slick 25% of the frames, inside its flattened ellipse', () => {
    const { a, fake } = arsenal(partsOf(greaseFire), { player: { x: 300, y: 300 } });
    a.step(0.5);
    const pd = a.puddles[0];
    const flames = () => fake.callsOf('fx').filter((c) => c.method === 'flame');
    const before = flames().length;
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    a.step(0.05);
    expect(flames()).toHaveLength(before + 1);
    const [fx, fy] = flames().at(-1)!.args as number[];
    expect(Math.abs(fx - pd.x)).toBeLessThanOrEqual(pd.r * 0.8);
    expect(Math.abs(fy - pd.y)).toBeLessThanOrEqual(pd.r * 0.4);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    a.step(0.05);
    expect(flames()).toHaveLength(before + 1);
  });
});
