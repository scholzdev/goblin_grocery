import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import multipack from '../../../src/content/items/multipack';
import { contentComboTune, contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import type { ItemTypeId } from '../../../src/types';
import { cart } from '../../cart';
import { around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

// Legacy, split in two: the `module` part gives +20% damage (x TIER.mult) to weapons that cannot repeat; the `post-combo` part adds the count after the
// combos (Toast Mode sets it): +1 / +1 / +2 projectiles, or +1 repeat for sweeps/cones/mortars. The weapons below share no set with the pack
// (snacks / blast) except the Fizz Cannon, and have no combo with it except where a test says so. Every touching type adds Bundle Deal's +6% damage.
const base = (id: ItemTypeId) => ITEMS[id].weapon!;
const BUNDLE_1 = 1.06;
const damage = (id: ItemTypeId, tier: number) => stats([at(id), at('multipack', tier)]).damage / base(id).damage;

describe('Multipack: projectiles (module skips, post-combo adds shots)', () => {
  it('adds +1 / +1 / +2 projectiles at ★1 / ★2 / ★3 and records the buff', () => {
    for (const id of ['toaster', 'nailgun'] as const) {
      expect([1, 2, 3].map((t) => stats([at(id), at('multipack', t)]).count)).toEqual([1, 1, 2].map((n) => base(id).count + n));
      expect(stats([at(id), at('multipack')]).buffs).toEqual(['multipack']);
    }
  });

  it('leaves the damage alone (apart from Bundle Deal)', () => {
    expect(damage('toaster', 3)).toBeCloseTo(BUNDLE_1);
  });

  it('applies after the combos: Toast Mode sets the count, the pack adds on top', () => {
    const w = stats([at('toaster'), at('fan'), at('fuel'), at('multipack')]);
    expect(w.recipes).toContain('toastMode');
    expect(w.count).toBe(contentComboTune('toastMode').count + 1);
  });

  it('uses the best copy touching the weapon, not the best copy in the cart', () => {
    const w = stats([at('toaster'), at('multipack', 1), at('multipack', 3, { near: [], apart: [0] })]);
    expect(w.count).toBe(base('toaster').count + 1);
  });

  it('records the buff after the module buffs (Hot Sauce first)', () => {
    expect(stats([at('toaster'), at('multipack'), at('hotsauce')]).buffs).toEqual(['hotsauce', 'multipack']);
  });
});

describe('Multipack: sweeps, cones, mortars (module skips, post-combo adds one repeat)', () => {
  it('adds one repeat at every tier, and no damage', () => {
    for (const id of ['pan', 'leafblower', 'cooker'] as const) {
      for (const t of [1, 2, 3]) {
        const w = stats([at(id), at('multipack', t)]);
        expect(w.count).toBe(base(id).count + 1);
        expect(w.buffs).toEqual(['multipack']);
      }
    }
    expect(damage('pan', 3)).toBeCloseTo(BUNDLE_1);
  });
});

describe('Multipack: everything else (module adds damage, no count)', () => {
  it('gives +20% / +30% / +40% damage to zaps, auras, pulses, puddles at ★1 / ★2 / ★3', () => {
    for (const id of ['microwave', 'blender', 'vacuum', 'mop'] as const) {
      expect(damage(id, 1)).toBeCloseTo(1.2 * BUNDLE_1);
      expect(damage(id, 2)).toBeCloseTo(1.3 * BUNDLE_1);
      expect(damage(id, 3)).toBeCloseTo(1.4 * BUNDLE_1);
      const w = stats([at(id), at('multipack', 3)]);
      expect(w.count).toBe(base(id).count);
      expect(w.buffs).toEqual(['multipack']);
    }
  });
});

describe('Multipack: general', () => {
  it('does nothing for a weapon it does not touch', () => {
    for (const id of ['toaster', 'pan', 'microwave'] as const) {
      const w = stats([at(id), at('multipack', 3, { near: [], apart: [0] })]);
      expect(w.count).toBe(base(id).count);
      expect(w.damage).toBe(base(id).damage);
      expect(w.buffs).toEqual([]);
    }
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([at('toaster'), at('multipack', 1), at('multipack', 3, { near: [0] })]).count).toBe(base('toaster').count + 2);
  });

  it('keeps the repeat delay in its tune (read by the arsenal at runtime)', () => {
    expect(contentTune('multipack', 1).repeatDelay).toBe(0.18);
  });
});

describe('Multipack: Gold Star (effective ★4)', () => {
  it('keeps the extra shots at +2 (a threshold, not linear), but the melee damage continues linearly (+50%)', () => {
    expect(stats([at('toaster'), at('multipack', 3), gilded(1)]).count).toBe(base('toaster').count + 2);
    expect(stats([at('toaster'), at('multipack', 2), gilded(1)]).count).toBe(base('toaster').count + 2); // effective ★3
    expect(0.2 * TIER.mult(4)).toBe(0.5);
    // (the sticker may touch the weapon too here: that only adds a Bundle Deal type, which the ratio below accounts for)
    const w = stats([at('microwave'), at('multipack', 3), { type: 'goldstar', near: [1] }]);
    expect(w.damage / base('microwave').damage).toBeCloseTo(1.5 * (1 + 0.06 * w.bundle));
  });
});

describe('Multipack: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('multipack')).toBe(multipack);
    const def = ITEMS.multipack;
    expect(def).toMatchObject({ id: 'multipack', family: 'snacks', element: 'blast', kind: 'module', price: 13, electrical: false, buff: 'multipack' });
    expect(def.cells).toEqual([{ x: 0, y: 0 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order (last until the Can Opener, the Decaf, the Expired Coupon, the Popcorn Maker, the Sparklers, the Barter Stamp, the Collector Binder, the Fire Extinguisher, the Air Horn, the Avocado, the Fresh Fish, the Potted Basil, the Kombucha SCOBY, the Snow Cone Machine and the Moldy Bread were appended)', () => {
    expect(around('multipack', 1, 0)).toEqual(['doublebag', 'multipack']);
    expect(Object.keys(ITEMS).at(-16)).toBe('multipack');
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('multipack', t))).toEqual([
      'Any adjacent weapon: projectiles +1, sweeps/cones/mortars attack one extra time, other weapons +20% damage.',
      'Any adjacent weapon: projectiles +1, sweeps/cones/mortars attack one extra time, other weapons +30% damage.',
      'Any adjacent weapon: projectiles +2, sweeps/cones/mortars attack one extra time, other weapons +40% damage.',
    ]);
    setLang('de');
    expect(itemRules('multipack', 3)).toBe('Jede angrenzende Waffe: Projektile +2, Schwünge/Kegel/Mörser greifen einmal zusätzlich an, andere Waffen +40% Schaden.');
    expect(itemT('multipack').blurb).toBe('Eins kaufen, zwei feuern.');
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('multipack')).toEqual([
      { label: 'Extra shots', values: ['+1', '+1', '+2'] },
      { label: 'Melee damage', values: ['+20%', '+30%', '+40%'] },
    ]);
    setLang('de');
    expect(tierScaling('multipack').map((r) => r.label)).toEqual(['Extra-Schüsse', 'Nahkampfschaden']);
  });

  it('shows its buff line per weapon kind with the right numbers per tier', () => {
    const line = (weapon: ItemTypeId, tier: number) => {
      const inv = cart(weapon, ['multipack']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line('toaster', 1)).toBe('+1 projectile(s) (Multipack)');
    expect(line('toaster', 3)).toBe('+2 projectile(s) (Multipack ★3)');
    expect(line('pan', 2)).toBe('Attack repeats once (Multipack ★2)');
    expect(line('microwave', 1)).toBe('+20% damage (Multipack)');
    expect(line('microwave', 3)).toBe('+40% damage (Multipack ★3)');
  });
});

