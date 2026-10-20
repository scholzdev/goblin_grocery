import { describe, expect, it } from 'vitest';
import { newSetLevels, setCount, setGains, setsOf, type SetCandidate } from '../src/data/sets';
import { SET_THRESHOLDS } from '../src/engine/define';
import type { ItemInstance, ItemTypeId } from '../src/types';

const at = (...types: ItemTypeId[]): ItemInstance[] => types.map((type, i) => ({ uid: `s${i}`, type, x: 0, y: 0, rot: 0 }));
const pack = (type: ItemTypeId, extra: Partial<ItemInstance> = {}): ItemInstance => ({ uid: `k${type}${extra.tier ?? 1}${extra.double ? 'd' : ''}`, type, x: 0, y: 0, rot: 0, ...extra });

describe('setGains', () => {
  it('new type counts one more', () => {
    expect(setGains(at('bell'), { type: 'pricegun' })).toEqual([{ id: 'checkout', from: 1, to: 2, levelUp: true }]);
    expect(setGains([], { type: 'bell' })).toEqual([{ id: 'checkout', from: 0, to: 1, levelUp: false }]);
  });
  it('a copy that adds no points to its sets gains nothing', () => {
    expect(setGains(at('bell'), { type: 'bell' })).toEqual([]);
  });
  it('level-up at 2 -> 3 as well', () => {
    expect(setGains(at('bell', 'pricegun'), { type: 'coupon' })).toEqual([{ id: 'checkout', from: 2, to: 3, levelUp: true }]);
  });
  it('multi-set item returns one entry per set', () => {
    const g = setGains(at('pan', 'blender', 'mop'), { type: 'ice' });
    expect(g.map((x) => x.id).sort()).toEqual(['frost', 'kitchen']);
    expect(g.find((x) => x.id === 'kitchen')).toMatchObject({ from: 2, to: 3, levelUp: true });
    expect(g.find((x) => x.id === 'frost')).toMatchObject({ from: 1, to: 2, levelUp: true });
  });
  it('maxed sets are skipped', () => {
    // Max level is 3 = thresholds[2] (4 types); 3 types is still gaining.
    expect(setGains(at('bell', 'pricegun', 'coupon'), { type: 'bubblewrap' })).toEqual([{ id: 'checkout', from: 3, to: 4, levelUp: true }]);
    expect(setGains(at('bell', 'pricegun', 'coupon', 'bubblewrap'), { type: 'goldstar' })).toEqual([]);
  });
  it('a double pack of a type already owned as a double pack predicts no level-up (bug 6)', () => {
    expect(setGains([pack('bell', { double: true }), pack('pricegun')], { type: 'bell', double: true }), '[bell (double), pricegun] + double Bell').toEqual([]);
    expect(setGains([pack('bell'), pack('bell', { double: true })], { type: 'bell', double: true }), '[bell, bell (double)] + double Bell').toEqual([]);
  });
  it('every predicted count is the real count after placing the candidate', () => {
    const carts: ItemInstance[][] = [
      [],
      [pack('bell', { double: true }), pack('pricegun')],
      [pack('bell'), pack('bell', { double: true })],
      [pack('sample', { tier: 2 }), pack('ice')],
      [pack('fan', { tier: 3 }), pack('hotsauce', { tier: 2, double: true })],
    ];
    const types: ItemTypeId[] = ['bell', 'pricegun', 'sample', 'ice', 'hotsauce', 'fan', 'toaster'];
    for (const placed of carts) for (const type of types) for (const tier of [1, 2, 3]) for (const double of [false, true]) {
      const cand: SetCandidate = { type, tier, double };
      const after = [...placed, { ...cand, uid: 'cand', x: 40, y: 40, rot: 0 as const }];
      const gains = setGains(placed, cand);
      for (const id of setsOf(type)) {
        const g = gains.find((x) => x.id === id), was = setCount(placed, id), now = setCount(after, id);
        const label = `${placed.map((p) => p.uid).join('+')} + ${type}★${tier}${double ? ' double' : ''} in ${id}`;
        if (g) expect([g.from, g.to], label).toEqual([was, now]);
        else expect(now === was || was >= SET_THRESHOLDS[2], label).toBe(true);
      }
    }
  });
});

describe('newSetLevels', () => {
  it('reports only increases', () => {
    const z = { kitchen: 0, cleaning: 0, tools: 0, snacks: 0, checkout: 0, heat: 0, frost: 0, blast: 0, electric: 0 };
    expect(newSetLevels({ ...z, kitchen: 1, heat: 2 }, { ...z, kitchen: 2, heat: 1, frost: 1 })).toEqual([{ id: 'kitchen', lv: 2 }, { id: 'frost', lv: 1 }]);
  });
});
