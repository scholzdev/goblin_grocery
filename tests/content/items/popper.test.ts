import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import popper from '../../../src/content/items/popper';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: 6 confetti damage at ★1 x TIER.mult, radius 70. Toaster (kitchen / heat / electric) shares no set with the popper (snacks / blast) and
// has no combo with it; a Nail Gun (blast) adds the Blast set.
describe('Party Popper: build', () => {
  it('explodes kills for 6 / 9 / 12 damage in a 70 radius at ★1 / ★2 / ★3', () => {
    expect(stats([at('toaster'), at('popper')]).popper).toEqual({ damage: 6, radius: 70 });
    expect(stats([at('toaster'), at('popper', 2)]).popper).toEqual({ damage: 9, radius: 70 });
    expect(stats([at('toaster'), at('popper', 3)]).popper).toEqual({ damage: 12, radius: 70 });
  });

  it('records the buff, and nothing else changes', () => {
    const [w] = computeBuild(cart('toaster', ['popper'])).weapons;
    const [plain] = computeBuild(cart('toaster', [])).weapons;
    expect(w.buffs).toEqual(['popper']);
    expect(w.cooldown).toBe(plain.cooldown);
    expect(w.range).toBe(plain.range);
    expect(w.burn).toBeNull();
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([at('toaster'), at('popper', 3, { near: [], apart: [0] })]);
    expect(w.popper).toBeNull();
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([at('toaster'), at('popper', 1), at('popper', 3, { near: [0] })]).popper?.damage).toBe(12);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4 = 15 damage)', () => {
    expect(stats([at('toaster'), at('popper', 3), gilded(1)]).popper?.damage).toBeCloseTo(6 * TIER.mult(4));
    expect(6 * TIER.mult(4)).toBe(15);
  });

  it('is widened by the Blast set (still legacy): a Nail Gun makes it L1, +15% radius', () => {
    expect(stats([at('nailgun'), at('popper')]).popper).toEqual({ damage: 6, radius: 70 * 1.15 });
  });

  it('is what Jelly Beans (blast) scales: 70% of the ★1 damage at ★1', () => {
    expect(contentTune('popper', 1)).toEqual({ damage: 6, radius: 70 });
    expect(stats([at('toaster'), at('jellybeans', 1, { flavor: 'blast' })]).popper).toEqual({ damage: 6 * 0.7, radius: 70 });
  });
});

describe('Party Popper: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('popper')).toBe(popper);
    const def = ITEMS.popper;
    expect(def).toMatchObject({ id: 'popper', family: 'snacks', element: 'blast', name: 'Party Popper', kind: 'module', price: 10, electrical: false, buff: 'popper' });
    expect(def.cells).toEqual([{ x: 0, y: 0 }]);
    expect(def.rules).toBe('Enemies killed by adjacent weapons explode in confetti: {0} damage within 70. Popper explosions never chain.');
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('popper', 1, 1)).toEqual(['spray', 'popper', 'doublebag']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('popper', t))).toEqual([
      'Enemies killed by adjacent weapons explode in confetti: 6 damage within 70. Popper explosions never chain.',
      'Enemies killed by adjacent weapons explode in confetti: 9 damage within 70. Popper explosions never chain.',
      'Enemies killed by adjacent weapons explode in confetti: 12 damage within 70. Popper explosions never chain.',
    ]);
    setLang('de');
    expect(itemRules('popper', 3)).toBe('Von angrenzenden Waffen besiegte Gegner explodieren in Konfetti: 12 Schaden im Umkreis von 70. Knaller-Explosionen lösen keine Kettenreaktion aus.');
    expect(itemT('popper').name).toBe('Partyknaller');
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('popper')).toEqual([{ label: 'Blast damage', values: ['6', '9', '12'] }]);
    setLang('de');
    expect(tierScaling('popper')).toEqual([{ label: 'Explosionsschaden', values: ['6', '9', '12'] }]);
  });

  it('shows its buff line with the right numbers per tier', () => {
    const line = (tier: number) => {
      const inv = cart('toaster', ['popper']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line(1)).toBe('Kills explode: 6 dmg, 70 radius (Party Popper)');
    expect(line(3)).toBe('Kills explode: 12 dmg, 70 radius (Party Popper ★3)');
  });
});
