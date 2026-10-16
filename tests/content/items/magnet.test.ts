import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import magnet from '../../../src/content/items/magnet';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

const BASE = PLAYER.pickupRadius; // 70

// Legacy: pickup radius +60 at ★1, rounded after x TIER.mult; the cart-wide best copy counts (no stacking), Gold Star included. The Vacuum's +60 is separate.
describe('Magnet: build', () => {
  it('adds 60 / 90 / 120 pickup radius at ★1 / ★2 / ★3', () => {
    expect(full([at('toaster')]).pickupRadius).toBe(BASE);
    expect([1, 2, 3].map((t) => full([at('toaster'), far('magnet', t)]).pickupRadius)).toEqual([BASE + 60, BASE + 90, BASE + 120]);
  });

  it('changes nothing but the pickup radius, and does not touch the weapon stats', () => {
    const plain = full([at('toaster')]), withMagnet = full([at('toaster'), far('magnet', 2)]);
    expect(withMagnet.weapons).toEqual(plain.weapons);
    expect({ ...withMagnet, pickupRadius: 0 }).toEqual({ ...plain, pickupRadius: 0 });
  });

  it('does not stack: the best copy in the whole cart counts once, wherever it sits', () => {
    expect(full([at('toaster'), far('magnet', 1), far('magnet', 3)]).pickupRadius).toBe(BASE + 120);
    expect(full([at('toaster'), far('magnet', 1), at('magnet', 2, { near: [0] })]).pickupRadius).toBe(BASE + 90);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: round(60 x 2.5) = 150)', () => {
    expect(Math.round(60 * TIER.mult(4))).toBe(150);
    expect(full([at('toaster'), corner('magnet', 3), gilded(1)]).pickupRadius).toBe(BASE + 150);
    expect(full([at('toaster'), corner('magnet', 1), gilded(1)]).pickupRadius).toBe(BASE + 90); // ★1 -> effective ★2
  });

  it('adds to the Vacuum\'s own +60 and to the perk', () => {
    expect(full([at('vacuum')]).pickupRadius).toBe(BASE + 60);
    expect(full([at('vacuum'), far('magnet', 2)]).pickupRadius).toBe(BASE + 60 + 90);
    expect(full([at('vacuum'), far('magnet', 3)], { pickupRadius: 25 }).pickupRadius).toBe(BASE + 60 + 120 + 25);
    expect(full([at('toaster'), far('magnet')], { pickupRadius: -10 }).pickupRadius).toBe(BASE + 60 - 10);
  });
});

describe('Magnet: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('magnet')).toBe(magnet);
    expect(ITEMS.magnet).toMatchObject({ id: 'magnet', family: 'tools', name: 'Magnet', kind: 'passive', price: 7, electrical: false });
    expect(ITEMS.magnet.element).toBeUndefined();
    expect(ITEMS.magnet.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.magnet.rules).toBe('{0} coin pickup radius (does not stack). Combo: Nailstorm with Nail Gun + Battery.');
    expect(ITEMS.magnet.legendary).toBeUndefined();
    expect(ITEMS.magnet.buff).toBeUndefined();
  });

  it('keeps its tune in one place', () => {
    expect(contentTune('magnet', 1).pickup).toBe(60);
    expect(contentTune('magnet', 3).pickup).toBe(120);
    expect(contentTune('magnet', 4).pickup).toBe(150);
  });

  it('keeps its position in the item order', () => {
    expect(around('magnet', 1, 1)).toEqual(['battery', 'magnet', 'ice']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('magnet', t))).toEqual([
      '+60 coin pickup radius (does not stack). Combo: Nailstorm with Nail Gun + Battery.',
      '+90 coin pickup radius (does not stack). Combo: Nailstorm with Nail Gun + Battery.',
      '+120 coin pickup radius (does not stack). Combo: Nailstorm with Nail Gun + Battery.',
    ]);
    setLang('de');
    expect(itemRules('magnet', 2)).toBe('+90 Münz-Sammelradius (stapelt sich nicht). Combo: Nagelsturm mit Nagelpistole + Batterie.');
    expect(itemT('magnet')).toMatchObject({ name: 'Magnet', blurb: 'Münzen kommen zu dir.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('magnet')).toEqual([{ label: 'Pickup range', values: ['+60', '+90', '+120'] }]);
    setLang('de');
    expect(tierScaling('magnet')).toEqual([{ label: 'Einsammelreichweite', values: ['+60', '+90', '+120'] }]);
  });
});
