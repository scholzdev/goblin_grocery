import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import fan from '../../../src/content/items/fan';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { build } from '../../golden/carts';
import { around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

// The legacy numbers: +30% range/reach and +30% projectile speed at ★1, scaled by TIER.mult. Toaster (kitchen / heat / electric) shares no set with
// the fan (cleaning) and has no combo with it alone; the Pan (a sweep) is the non-projectile case.
const toaster = ITEMS.toaster.weapon!, pan = ITEMS.pan.weapon!, spray = ITEMS.spray.weapon!;
const gun = at('toaster');

describe('Desk Fan: build', () => {
  it('adds +30% / +45% / +60% range and projectile speed to a projectile weapon at ★1 / ★2 / ★3', () => {
    for (const [tier, bonus] of [[1, 0.3], [2, 0.45], [3, 0.6]] as const) {
      const w = stats([gun, at('fan', tier)]);
      expect(w.range).toBeCloseTo(toaster.range * (1 + bonus));
      expect(w.projectileSpeed).toBeCloseTo(toaster.projectileSpeed * (1 + bonus));
    }
  });

  it('gives a non-projectile weapon the range only (no projectile speed to speed up)', () => {
    const w = stats([at('pan'), at('fan', 3)]);
    expect(w.range).toBeCloseTo(pan.range * 1.6);
    expect(w.projectileSpeed).toBe(pan.projectileSpeed);
  });

  it('records the buff, and nothing else changes', () => {
    const [w] = computeBuild(cart('toaster', ['fan'])).weapons;
    const [plain] = computeBuild(cart('toaster', [])).weapons;
    expect(w.buffs).toEqual(['fan']);
    expect(w.cooldown).toBe(plain.cooldown);
    expect(w.burn).toBeNull();
    expect(w.pierce).toBe(0);
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([gun, at('fan', 3, { near: [], apart: [0] })]);
    expect(w.range).toBe(toaster.range);
    expect(w.projectileSpeed).toBe(toaster.projectileSpeed);
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    const w = stats([gun, at('fan', 1), at('fan', 3, { near: [0] })]);
    expect(w.range).toBeCloseTo(toaster.range * 1.6);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4 = +75%), range and speed alike', () => {
    const w = stats([gun, at('fan', 3), gilded(1)]);
    expect(w.range).toBeCloseTo(toaster.range * (1 + 0.3 * TIER.mult(4)));
    expect(w.projectileSpeed).toBeCloseTo(toaster.projectileSpeed * (1 + 0.3 * TIER.mult(4)));
    expect(1 + 0.3 * TIER.mult(4)).toBe(1.75);
  });

  it('is replaced by the Mist Machine on a Spray Bottle: no fan buff, the combo range plus the Cleaning set instead', () => {
    const inv = build([at('spray'), at('fan', 3)]);
    const [w] = computeBuild(inv).weapons;
    expect(w.recipes).toEqual(['mistMachine']);
    expect(w.buffs).toEqual([]);
    expect(w.range).toBeCloseTo(spray.range * 1.4 * 1.15); // Mist Machine x1.4, Cleaning L1 x1.15; no x1.6 from the fan
  });
});

describe('Desk Fan: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('fan')).toBe(fan);
    const def = ITEMS.fan;
    expect(def).toMatchObject({ id: 'fan', family: 'cleaning', name: 'Desk Fan', kind: 'module', price: 9, electrical: false, buff: 'fan' });
    expect(def.element).toBeUndefined();
    expect(def.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    expect(def.rules).toBe('Any adjacent weapon gains {0} range or reach and {1} projectile speed.');
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('fan', 1, 1)).toEqual(['vacuum', 'fan', 'fuel']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('fan', t))).toEqual([
      'Any adjacent weapon gains +30% range or reach and +30% projectile speed.',
      'Any adjacent weapon gains +45% range or reach and +45% projectile speed.',
      'Any adjacent weapon gains +60% range or reach and +60% projectile speed.',
    ]);
    setLang('de');
    expect(itemRules('fan', 3)).toBe('Jede angrenzende Waffe erhält +60% Reichweite und +60% Projektiltempo.');
    expect(itemT('fan')).toEqual({ name: 'Tischventilator', blurb: 'Wuusch. Mehr Reichweite für alles, was er berührt.', rules: 'Jede angrenzende Waffe erhält {0} Reichweite und {1} Projektiltempo.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('fan')).toEqual([
      { label: 'Range / reach', values: ['+30%', '+45%', '+60%'] },
      { label: 'Projectile speed', values: ['+30%', '+45%', '+60%'] },
    ]);
    setLang('de');
    expect(tierScaling('fan').map((r) => r.label)).toEqual(['Distanz / Reichweite', 'Projektiltempo']);
  });

  it('shows its buff line per weapon kind with the right percentage per tier', () => {
    const lines = (weapon: 'toaster' | 'pan', tier: number) => {
      const inv = cart(weapon, ['fan']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(lines('toaster', 1)).toBe('+30% speed & range (Desk Fan)');
    expect(lines('toaster', 3)).toBe('+60% speed & range (Desk Fan ★3)');
    expect(lines('pan', 2)).toBe('+45% reach (Desk Fan ★2)');
  });
});
