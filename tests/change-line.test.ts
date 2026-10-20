import { describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n';
import { createRun, mergeItems, moveItem, recomputeBuild, sellItem } from '../src/state/run';
import type { Inventory } from '../src/types';
import { changeLine } from '../src/ui/changeLine';
import { build } from './golden/carts';

const shopWith = (inv: Inventory) => {
  const s = createRun(1);
  s.inventory = inv;
  s.phase = 'shop';
  recomputeBuild(s);
  return s;
};
/** Drops `uid` on a grid cell, as the shop does, and returns the line it shows. */
const drop = (inv: Inventory, uid: string, x: number, y: number, sets = true) => {
  const s = shopWith(inv);
  const before = s.build;
  expect(moveItem(s, uid, { where: 'grid', x, y, rot: 0 }).ok, 'the drop is legal').toBe(true);
  return changeLine(before, s.build, sets).join(' · ');
};

describe('shop: what a drop changed', () => {
  it('a drop that forms a combo names it; moving it away names the loss', () => {
    const apart = build([{ type: 'toaster' }, { type: 'sourdough', at: [0, 3] }]);
    expect(drop(apart, 'u1', 3, 1)).toContain('Combo on: Fresh Bread');
    const touching = build([{ type: 'toaster' }, { type: 'sourdough', at: [3, 1] }]);
    expect(drop(touching, 'u1', 0, 3)).toContain('Combo lost: Fresh Bread');
  });

  it('a drop that changes nothing shows no line', () => {
    expect(drop(build([{ type: 'toaster' }, { type: 'sample', at: [4, 3] }]), 'u1', 0, 3)).toBe('');
  });

  it('a merge names the weapon\'s new damage and interval, and the sets a ★2 copy fills', () => {
    const s = shopWith(build([{ type: 'toaster' }, { type: 'toaster', at: [1, 3] }]));
    const before = s.build;
    expect(mergeItems(s, 'u1', 'u0').ok).toBe(true);
    expect(changeLine(before, s.build, true).join(' · ')).toMatch(/^Toaster: damage [\d.]+ → [\d.]+, every [\d.]+ s → [\d.]+ s · Kitchen set level 0 → 1 · Heat set level 0 → 1 · Electric set level 0 → 1$/);
  });

  it('set level changes are named only while sets are shown, in EN and DE', () => {
    const sold = shopWith(build([{ type: 'toaster' }, { type: 'sample', tier: 2, at: [4, 3] }, { type: 'hotsauce', at: [0, 3] }]));
    const before = sold.build;
    expect(sellItem(sold, 'u1').ok).toBe(true);
    expect(changeLine(before, sold.build, true)).toEqual(['Kitchen set level 2 → 1']);
    expect(changeLine(before, sold.build, false), 'sets not met yet').toEqual([]);
    setLang('de');
    expect(changeLine(before, sold.build, true)).toEqual(['Küche-Set Stufe 2 → 1']);
    setLang('en');
  });
});
