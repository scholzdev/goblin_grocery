import { describe, expect, it } from 'vitest';
import { computeBuild, tierScaling } from '../src/systems/synergies';
import { applyPoison, newStatus, tickPoison } from '../src/systems/combat';
import { PLAYER } from '../src/data/items';
import { contentTune } from '../src/engine/registry';
import { RECIPES, recipeIcon, recipeParts } from '../src/data/recipes';
import { cart } from './cart';
import type { Inventory, ItemTypeId } from '../src/types';

const inv = (items: [ItemTypeId, number, number][]): Inventory => ({
  cols: 5, rows: 4, shelf: [],
  placed: items.map(([type, x, y], i) => ({ uid: `u${i}`, type, x, y, rot: 0 })),
});

describe('cart combos (no weapon)', () => {
  it('Sugar Rush: energy touching boot activates it with weaponUid null; apart it does not', () => {
    const on = computeBuild(inv([['energy', 0, 0], ['boot', 1, 0]]));
    expect(on.recipes).toEqual([{ id: 'sugarRush', weaponUid: null, supportUids: ['u0', 'u1'] }]);
    expect(computeBuild(inv([['energy', 0, 0], ['boot', 3, 3]])).recipes).toEqual([]);
    expect(computeBuild(inv([['energy', 0, 0]])).recipes).toEqual([]);
  });
  it('is listed once even with two anchors, and parts/icon helpers skip the missing weapon', () => {
    const b = computeBuild(inv([['energy', 0, 0], ['boot', 1, 0], ['energy', 0, 1]]));
    expect(b.recipes.filter((r) => r.id === 'sugarRush')).toHaveLength(1);
    expect(recipeParts(RECIPES.sugarRush)).toEqual(['energy', 'boot']);
    expect(recipeIcon(RECIPES.sugarRush)).toBe('energy');
  });
});

describe('batch 1 weapon combos', () => {
  it.each([
    ['smashBank', 'pan', ['piggy']],
    ['bagIt', 'vacuum', ['doublebag', 'boot']],
    ['sourMist', 'spray', ['expiredmilk', 'fan']],
  ] as const)('%s activates with all parts and not without one', (id, weapon, sup) => {
    expect(computeBuild(cart(weapon, [...sup])).weapons[0].recipes).toContain(id);
    for (let i = 0; i < sup.length; i++) expect(computeBuild(cart(weapon, sup.filter((_, j) => j !== i))).weapons[0].recipes).not.toContain(id);
  });
  it('Mist Machine and Sour Mist can be active together', () => {
    expect(computeBuild(cart('spray', ['expiredmilk', 'fan'])).weapons[0].recipes).toEqual(expect.arrayContaining(['mistMachine', 'sourMist']));
  });
});

describe('Expired Milk', () => {
  it('multiplies final max HP by 0.9 (after flat bonuses), not a flat -10', () => {
    expect(computeBuild(inv([['toaster', 0, 0]])).maxHp).toBe(PLAYER.maxHp);
    expect(computeBuild(inv([['toaster', 0, 0], ['expiredmilk', 3, 2]])).maxHp).toBe(Math.round(PLAYER.maxHp * 0.9));
    // Control with another snacks item (same set count): the milk multiplies the whole total, not a flat -10.
    const ctrl = computeBuild(inv([['toaster', 0, 0], ['lunchbox', 3, 0], ['fortune', 3, 2]])).maxHp;
    const milk = computeBuild(inv([['toaster', 0, 0], ['lunchbox', 3, 0], ['expiredmilk', 3, 2]])).maxHp;
    expect(ctrl).toBeGreaterThan(PLAYER.maxHp);
    expect(milk).toBe(Math.round(ctrl * 0.9));
    expect(milk).not.toBe(ctrl - 10);
  });
  it('aura dps scales with tier and is 0 without the item', () => {
    expect(computeBuild(inv([['toaster', 0, 0]])).stinkDps).toBe(0);
    expect(computeBuild(inv([['toaster', 0, 0], ['expiredmilk', 3, 2]])).stinkDps).toBe(contentTune('expiredmilk', 1).dps);
    expect(tierScaling('expiredmilk')[0].values).toEqual(['3/s', '4.5/s', '6/s']);
  });
});

describe('poison status', () => {
  it('ticks every 0.5 s, refreshes duration and never stacks dps', () => {
    const s = newStatus();
    applyPoison(s, 4, 3, 10);
    expect(tickPoison(s, 10.4)).toBe(0);
    expect(tickPoison(s, 10.5)).toBeCloseTo(2);
    applyPoison(s, 2, 3, 11); // weaker refresh: keeps 4 dps, pushes the end to 14
    expect(s.poisonDps).toBe(4);
    expect(s.poisonUntil).toBe(14);
    expect(tickPoison(s, 20)).toBeCloseTo(4 * 0.5 * 7); // ticks until 14 only (11.0 .. 14.0)
  });
});
