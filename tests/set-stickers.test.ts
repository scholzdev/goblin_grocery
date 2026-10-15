import { describe, expect, it } from 'vitest';
import { newSetLevels, setGains } from '../src/data/sets';
import type { ItemInstance, ItemTypeId } from '../src/types';

const at = (...types: ItemTypeId[]): ItemInstance[] => types.map((type, i) => ({ uid: `s${i}`, type, x: 0, y: 0, rot: 0 }));

describe('setGains', () => {
  it('new type counts one more', () => {
    expect(setGains(at('bell'), 'pricegun')).toEqual([{ id: 'checkout', from: 1, to: 2, levelUp: true }]);
    expect(setGains([], 'bell')).toEqual([{ id: 'checkout', from: 0, to: 1, levelUp: false }]);
  });
  it('skips sets the type is already in', () => {
    expect(setGains(at('bell'), 'bell')).toEqual([]);
  });
  it('level-up at 2 -> 3 as well', () => {
    expect(setGains(at('bell', 'pricegun'), 'coupon')).toEqual([{ id: 'checkout', from: 2, to: 3, levelUp: true }]);
  });
  it('multi-set item returns one entry per set', () => {
    const g = setGains(at('pan', 'blender', 'mop'), 'ice');
    expect(g.map((x) => x.id).sort()).toEqual(['frost', 'kitchen']);
    expect(g.find((x) => x.id === 'kitchen')).toMatchObject({ from: 2, to: 3, levelUp: true });
    expect(g.find((x) => x.id === 'frost')).toMatchObject({ from: 1, to: 2, levelUp: true });
  });
  it('maxed sets are skipped', () => {
    expect(setGains(at('bell', 'pricegun', 'coupon'), 'bubblewrap')).toEqual([]);
  });
});

describe('newSetLevels', () => {
  it('reports only increases', () => {
    const z = { kitchen: 0, cleaning: 0, tools: 0, snacks: 0, checkout: 0, heat: 0, frost: 0, blast: 0, electric: 0 };
    expect(newSetLevels({ ...z, kitchen: 1, heat: 2 }, { ...z, kitchen: 2, heat: 1, frost: 1 })).toEqual([{ id: 'kitchen', lv: 2 }, { id: 'frost', lv: 1 }]);
  });
});
