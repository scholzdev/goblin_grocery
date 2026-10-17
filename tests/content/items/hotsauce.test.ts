import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import hotsauce from '../../../src/content/items/hotsauce';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import type { ItemTypeId } from '../../../src/types';
import { cart } from '../../cart';
import { build, type Spec } from '../../golden/carts';

afterEach(() => setLang('en'));

// Nail Gun (tools / blast) shares no set with Hot Sauce (kitchen / heat) and has no combo with it, so the only things that touch its damage
// are the sauce and Bundle Deal (+6% per distinct touching type).
const BASE = 3, BUNDLE_1 = 1.06;
const dmg = (specs: Spec[]) => computeBuild(build(specs)).weapons[0].damage;
const gun: Spec = { type: 'nailgun' };
const sauce = (tier?: number, extra: Partial<Spec> = {}): Spec => ({ type: 'hotsauce', ...(tier ? { tier } : {}), ...extra });

describe('Hot Sauce: build', () => {
  it('adds +25% / +37.5% / +50% hit damage to a touching weapon at ★1 / ★2 / ★3', () => {
    expect(dmg([gun, sauce(1)])).toBeCloseTo(BASE * 1.25 * BUNDLE_1);
    expect(dmg([gun, sauce(2)])).toBeCloseTo(BASE * 1.375 * BUNDLE_1);
    expect(dmg([gun, sauce(3)])).toBeCloseTo(BASE * 1.5 * BUNDLE_1);
  });

  it('records the buff on the weapon, and nothing else changes', () => {
    const [w] = computeBuild(cart('nailgun', ['hotsauce'])).weapons;
    const [plain] = computeBuild(cart('nailgun', [])).weapons;
    expect(w.buffs).toEqual(['hotsauce']);
    expect(w.cooldown).toBe(plain.cooldown);
    expect(w.range).toBe(plain.range);
    expect(w.burn).toBeNull();
    expect(w.recipes).toEqual([]);
  });

  it('does nothing for a weapon it does not touch', () => {
    const inv = build([gun, sauce(3, { near: [], apart: [0] })]);
    const [w] = computeBuild(inv).weapons;
    expect(w.damage).toBe(BASE);
    expect(w.buffs).toEqual([]);
  });

  it('buffs only the weapons it touches', () => {
    const inv = build([gun, { type: 'toaster', near: [] }, sauce(1, { near: [0], apart: [1] })]);
    const [g, toaster] = computeBuild(inv).weapons;
    expect(g.buffs).toEqual(['hotsauce']);
    expect(toaster.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(dmg([gun, sauce(1), sauce(3)])).toBeCloseTo(BASE * 1.5 * BUNDLE_1);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4 = +62.5%) without touching the weapon itself', () => {
    const inv = build([gun, sauce(3), { type: 'goldstar', near: [1], apart: [0] }]);
    expect(computeBuild(inv).weapons[0].damage).toBeCloseTo(BASE * (1 + 0.25 * TIER.mult(4)) * BUNDLE_1);
    expect(1 + 0.25 * TIER.mult(4)).toBe(1.625);
  });
});

describe('Hot Sauce: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('hotsauce')).toBe(hotsauce);
    const def = ITEMS.hotsauce;
    expect(def).toMatchObject({ id: 'hotsauce', family: 'kitchen', element: 'heat', kind: 'module', price: 7, electrical: false, buff: 'hotsauce' });
    expect(def.cells).toEqual([{ x: 0, y: 0 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    const ids = Object.keys(ITEMS) as ItemTypeId[];
    expect(ids.slice(ids.indexOf('ice') - 1, ids.indexOf('ice') + 3)).toEqual(['magnet', 'ice', 'hotsauce', 'lunchbox']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('hotsauce', t))).toEqual([
      'Adjacent weapons gain +25% hit damage.', 'Adjacent weapons gain +38% hit damage.', 'Adjacent weapons gain +50% hit damage.',
    ]);
    setLang('de');
    expect([1, 2, 3].map((t) => itemRules('hotsauce', t))).toEqual([
      'Angrenzende Waffen erhalten +25% Trefferschaden.', 'Angrenzende Waffen erhalten +38% Trefferschaden.', 'Angrenzende Waffen erhalten +50% Trefferschaden.',
    ]);
    expect(itemT('hotsauce')).toEqual({ name: 'Scharfe Soße', blurb: 'Extra scharfer Schaden.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('hotsauce')).toEqual([{ label: 'Damage', values: ['+25%', '+38%', '+50%'] }]);
    setLang('de');
    expect(tierScaling('hotsauce')).toEqual([{ label: 'Schaden', values: ['+25%', '+38%', '+50%'] }]);
  });

  it('shows its buff line with the right percentage per tier', () => {
    const lines = (tier: number) => {
      const inv = cart('nailgun', ['hotsauce']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv);
    };
    expect(lines(1)[0]).toBe('+25% damage (Hot Sauce)');
    expect(lines(3)[0]).toBe('+50% damage (Hot Sauce ★3)');
  });
});
