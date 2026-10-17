import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import energy from '../../../src/content/items/energy';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: movement speed x(1 + 12%) at ★1, the bonus scaled by TIER.mult; the cart-wide best copy counts. The starter perk's multiplier is applied on top.
describe('Energy Drink: build', () => {
  it('adds 12% / 18% / 24% move speed at ★1 / ★2 / ★3', () => {
    expect(full([at('toaster')]).moveSpeedMult).toBe(1);
    [1, 2, 3].forEach((t, i) => expect(full([at('toaster'), far('energy', t)]).moveSpeedMult).toBeCloseTo([1.12, 1.18, 1.24][i], 12));
  });

  it('matches the legacy formula 1 + 0.12 x TIER.mult exactly', () => {
    for (const t of [1, 2, 3]) expect(full([at('toaster'), far('energy', t)]).moveSpeedMult).toBeCloseTo(1 + 0.12 * TIER.mult(t), 12);
  });

  it('changes nothing but the move speed', () => {
    const plain = full([at('toaster')]), withDrink = full([at('toaster'), far('energy', 3)]);
    expect(withDrink.weapons).toEqual(plain.weapons);
    expect({ ...withDrink, moveSpeedMult: 0 }).toEqual({ ...plain, moveSpeedMult: 0 });
  });

  it('does not stack: the best copy in the whole cart counts once', () => {
    expect(full([at('toaster'), far('energy', 1), far('energy', 3)]).moveSpeedMult).toBeCloseTo(1.24, 12);
    expect(full([at('toaster'), far('energy', 2), at('energy', 1, { near: [0] })]).moveSpeedMult).toBeCloseTo(1.18, 12);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: +30%)', () => {
    expect(0.12 * TIER.mult(4)).toBeCloseTo(0.3, 12);
    expect(full([at('toaster'), corner('energy', 3), gilded(1)]).moveSpeedMult).toBeCloseTo(1.3, 12);
    expect(full([at('toaster'), corner('energy', 1), gilded(1)]).moveSpeedMult).toBeCloseTo(1.18, 12); // ★1 -> effective ★2
  });

  it('multiplies with the starter perk (Line Cook x0.95, Night Shift x1.08)', () => {
    const pan = PLAYER.starters.pan.perk!, night = PLAYER.starters.night.perk!;
    expect(full([at('toaster')], pan).moveSpeedMult).toBeCloseTo(0.95, 12);
    expect(full([at('toaster'), far('energy')], pan).moveSpeedMult).toBeCloseTo(1.12 * 0.95, 12);
    expect(full([at('toaster'), far('energy', 2)], night).moveSpeedMult).toBeCloseTo(1.18 * 1.08, 12);
  });
});

describe('Energy Drink: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('energy')).toBe(energy);
    expect(ITEMS.energy).toMatchObject({ id: 'energy', family: 'snacks', kind: 'passive', price: 8, electrical: false });
    expect(ITEMS.energy.element).toBeUndefined();
    expect(ITEMS.energy.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.energy.legendary).toBeUndefined();
  });

  it('keeps its tune in one place', () => {
    expect(contentTune('energy', 1).speed).toBe(0.12);
    expect(contentTune('energy', 3).speed).toBe(0.24);
  });

  it('keeps its position in the item order', () => {
    expect(around('energy', 1, 1)).toEqual(['bubblewrap', 'energy', 'fortune']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('energy', t))).toEqual([
      '+12% movement speed (does not stack).',
      '+18% movement speed (does not stack).',
      '+24% movement speed (does not stack).',
    ]);
    setLang('de');
    expect(itemRules('energy', 3)).toBe('+24% Bewegungstempo (stapelt sich nicht).');
    expect(itemT('energy')).toMatchObject({ name: 'Energydrink', blurb: 'Wruum wruum. Schnellerer Wagen.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('energy')).toEqual([{ label: 'Move speed', values: ['+12%', '+18%', '+24%'] }]);
    setLang('de');
    expect(tierScaling('energy')).toEqual([{ label: 'Lauftempo', values: ['+12%', '+18%', '+24%'] }]);
  });
});
