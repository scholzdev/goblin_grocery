import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import { cartWeight, slowWeight } from '../../../src/systems/weight';
import { build } from '../../golden/carts';
import { at, corner, far, full } from '../helpers';

const cells = (...types: (keyof typeof ITEMS)[]) => types.reduce((n, t) => n + ITEMS[t].cells.length, 0);

describe('Helium Balloon', () => {
  it('adds +10% / +15% / +20% move speed at ★1 / ★2 / ★3, the best copy counting once', () => {
    [1.1, 1.15, 1.2].forEach((m, i) => expect(full([at('toaster'), far('balloon', i + 1)]).moveSpeedMult).toBeCloseTo(m, 12));
    expect(full([at('toaster'), far('balloon', 1), far('balloon', 3)]).moveSpeedMult).toBeCloseTo(1.2, 12);
  });

  it('is plain speed without a ball: nothing is weightless to lose', () => {
    const b = full([at('toaster'), far('balloon')]);
    expect(b.shoveDamage).toBe(full([at('toaster')]).shoveDamage);
  });

  it('makes the items touching it count as zero cells for the ball\'s slow, but not for its damage', () => {
    const specs = [at('toaster'), far('bowlingball'), at('balloon', 1, { near: [1], apart: [0] })];
    const inv = build(specs, 8, 6), b = full(specs);
    const total = cells('toaster', 'bowlingball', 'balloon');
    expect(cartWeight(inv)).toBe(total);
    expect(slowWeight(inv)).toBe(total - cells('bowlingball'));
    expect(b.shoveDamage).toBe(6 + total); // the damage still counts every cell
    expect(b.moveSpeedMult).toBeCloseTo(1.1 * (1 - 0.005 * (total - cells('bowlingball'))), 12);
  });

  it('only zeroes the items it touches: a far item still slows', () => {
    const specs = [at('toaster'), far('bowlingball'), at('balloon', 1, { near: [1], apart: [0] }), corner('fuel')];
    const inv = build(specs, 8, 6);
    expect(slowWeight(inv)).toBe(cells('toaster', 'balloon', 'fuel'));
  });

  it('counts an item touching two balloons once', () => {
    const specs = [at('toaster'), far('bowlingball'), at('balloon', 1, { near: [1], apart: [0] }), at('balloon', 1, { near: [1], apart: [0, 2] })];
    const inv = build(specs, 8, 6);
    expect(slowWeight(inv)).toBe(cells('toaster', 'balloon', 'balloon'));
  });
});
