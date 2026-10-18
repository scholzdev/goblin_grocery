import { describe, expect, it } from 'vitest';
import { contentItem, iconOf, sellValue } from '../../../src/engine/registry';
import { sellPrice } from '../../../src/systems/shop';
import { createRun, openShop, sellItem } from '../../../src/state/run';
import { mulberry32 } from '../../../src/systems/rng';
import type { ItemInstance, RunState } from '../../../src/types';
import { arena, at, far, full, stats } from '../helpers';

// Avocado / Fresh Fish (perishables) and Potted Basil / Kombucha Scoby (growers): the per-instance `age` / `kills` counters (docs/new-items-plan.md).
const PAN = at('pan');
const ALONE = stats([PAN]).damage;
// Any touching item adds the Bundle Deal (+6% per distinct touching type): the reference for "no effect of the item itself".
const BASE = ALONE * 1.06;
const aged = (type: 'avocado' | 'fish' | 'basil' | 'scoby', age: number, tier?: number) => ({ ...at(type, tier, type === 'fish' ? { near: [], apart: [0] } : {}), age });

const shopRun = (): RunState => { const s = createRun(5); s.phase = 'shop'; return s; };
const place = (s: RunState, type: ItemInstance['type'], x: number, y: number, extra: Partial<ItemInstance> = {}): ItemInstance => {
  const i: ItemInstance = { uid: `t_${type}`, type, x, y, rot: 0, ...extra };
  s.inventory.placed.push(i);
  return i;
};

describe('Avocado', () => {
  it('adds +10% damage per aisle in the cart for aisles 1 to 3', () => {
    expect([0, 1, 2].map((age) => stats([PAN, aged('avocado', age)]).damage / BASE)).toEqual([1.1, 1.2, 1.3].map((v) => expect.closeTo(v, 10)));
  });

  it('is brown from aisle 4 (age 3): adjacent weapons deal 20% less, and it stays brown', () => {
    for (const age of [3, 4, 9]) expect(stats([PAN, aged('avocado', age)]).damage / BASE).toBeCloseTo(0.8, 10);
  });

  it('gives +12% / +15% per aisle at ★2 / ★3', () => {
    expect(stats([PAN, aged('avocado', 1, 2)]).damage / BASE).toBeCloseTo(1 + 0.12 * 2, 10);
    expect(stats([PAN, aged('avocado', 2, 3)]).damage / BASE).toBeCloseTo(1 + 0.15 * 3, 10);
  });

  it('does nothing to a weapon it does not touch', () => {
    expect(stats([PAN, { ...aged('avocado', 0), near: [], apart: [0] }]).damage).toBe(ALONE);
  });

  it('ages one aisle per shop while in the cart, flips brown at the 4th aisle and changes its icon', () => {
    const s = shopRun(), rng = mulberry32(1), a = place(s, 'avocado', 0, 0);
    const seen: [number, number, string][] = [];
    for (let n = 0; n < 4; n++) { seen.push([a.age ?? 0, sellValue(a, sellPrice('avocado')), iconOf(a)]); openShop(s, rng); }
    seen.push([a.age ?? 0, sellValue(a, sellPrice('avocado')), iconOf(a)]);
    expect(seen).toEqual([[0, 4, 'icon_avocado'], [1, 8, 'icon_avocado'], [2, 12, 'icon_avocado'], [3, 1, 'icon_avocado_rotten'], [4, 1, 'icon_avocado_rotten']]);
  });

  it('does not age on the shelf', () => {
    const s = shopRun(), a: ItemInstance = { uid: 'sh', type: 'avocado', x: 0, y: 0, rot: 0 };
    s.inventory.shelf[0] = a;
    openShop(s, mulberry32(1));
    expect(a.age ?? 0).toBe(0);
  });

  it('pays the instance value when sold', () => {
    const s = shopRun(), a = place(s, 'avocado', 0, 0, { age: 2 }), before = s.money;
    expect(sellItem(s, a.uid).ok).toBe(true);
    expect(s.money - before).toBe(12);
    const b = place(s, 'avocado', 0, 0, { age: 3 }), m = s.money;
    sellItem(s, b.uid);
    expect(s.money - m).toBe(1);
  });
});

describe('Fresh Fish', () => {
  it('adds crit chance to every weapon while fresh (2 aisles): +15% / +20% / +25%', () => {
    const plain = stats([PAN]).critChance;
    for (const age of [0, 1]) expect(stats([PAN, aged('fish', age)]).critChance).toBeCloseTo(plain + 0.15, 10);
    expect([2, 3].map((t) => stats([PAN, aged('fish', 0, t)]).critChance - plain)).toEqual([expect.closeTo(0.2, 10), expect.closeTo(0.25, 10)]);
  });

  it('loses the crit and stinks for good from the 3rd aisle: +20% shop prices and a stink aura', () => {
    const fresh = full([PAN, aged('fish', 1)]), stale = full([PAN, aged('fish', 2)]);
    expect([fresh.priceMult, fresh.stinkDps]).toEqual([1, 0]);
    expect(stale.weapons[0].critChance).toBe(stats([PAN]).critChance);
    expect(stale.priceMult).toBeCloseTo(1.2, 10);
    expect(stale.stinkDps).toBe(3);
    expect(full([PAN, aged('fish', 9)]).priceMult).toBeCloseTo(1.2, 10);
  });

  it('keeps the markup on top of Expired Coupon (x0.75) and next to Expired Milk\'s aura', () => {
    expect(full([PAN, aged('fish', 2), far('expiredcoupon')]).priceMult).toBeCloseTo(0.9, 10);
    expect(full([PAN, aged('fish', 2), far('expiredmilk', 3)]).stinkDps).toBe(6);
  });

  it('poisons enemies near the cart once it stinks, and not while fresh', () => {
    const run = (age: number) => {
      const { fake } = arena([PAN, aged('fish', age)]);
      fake.player.x = 100; fake.player.y = 100;
      fake.spawnEnemy({ x: 150, y: 100 });
      fake.tick(0.016);
      return fake.callsOf('poison').map((c) => [c.dps, c.duration]);
    };
    expect(run(1)).toEqual([]);
    expect(run(2)).toEqual([[3, 1]]);
  });

  it('raises the prices of the next shop the moment it starts to stink (aging happens before the offers roll)', () => {
    const s = shopRun(), rng = mulberry32(3);
    place(s, 'pan', 0, 0);
    const f = place(s, 'fish', 2, 0, { age: 1 });
    openShop(s, rng);
    expect(f.age).toBe(2);
    expect(s.build.priceMult).toBeCloseTo(1.2, 10);
    const base = createRun(5); base.phase = 'shop'; place(base, 'pan', 0, 0);
    openShop(base, mulberry32(3));
    expect(base.build.priceMult).toBe(1);
  });
});

describe('Potted Basil', () => {
  const kill = (a: ReturnType<typeof arena>, n: number) => { for (let i = 0; i < n; i++) a.fake.hit(a.fake.spawnEnemy({ hp: 1, x: i * 10, y: 5 }), 5, a.stats); };

  it('counts kills of the adjacent weapon on the instance (and no other kills)', () => {
    const a = arena([PAN, at('basil')]);
    kill(a, 7);
    a.fake.hit(a.fake.spawnEnemy({ hp: 1, x: 5, y: 5 }), 5, null); // not a weapon kill
    expect(a.inv.placed.find((p) => p.type === 'basil')!.kills).toBe(7);
  });

  it('does not count kills of a weapon it does not touch', () => {
    const a = arena([PAN, { ...at('basil'), near: [], apart: [0] }]);
    kill(a, 5);
    expect(a.inv.placed.find((p) => p.type === 'basil')!.kills ?? 0).toBe(0);
  });

  it('adds +2% / +3% / +4% damage per 25 kills, uncapped', () => {
    const dmg = (kills: number, tier = 1) => stats([PAN, { ...at('basil', tier), kills }]).damage / BASE;
    const REF = dmg(0);
    expect(dmg(24)).toBe(REF);
    expect(dmg(25) / REF).toBeCloseTo(1.02, 10);
    expect(dmg(100) / REF).toBeCloseTo(1.08, 10);
    expect(dmg(1000) / REF).toBeCloseTo(1.8, 10);
    expect(dmg(50, 2) / REF).toBeCloseTo(1.06, 10);
    expect(dmg(50, 3) / REF).toBeCloseTo(1.08, 10);
  });

  it('keeps the count across aisles and loses it when sold', () => {
    const s = shopRun(), rng = mulberry32(1), b = place(s, 'basil', 0, 0, { kills: 60 });
    openShop(s, rng); openShop(s, rng);
    expect(b.kills).toBe(60);
    sellItem(s, b.uid);
    const again = place(s, 'basil', 0, 0);
    expect(again.kills ?? 0).toBe(0);
  });
});

describe('Kombucha Scoby', () => {
  const poisonOf = (age: number, tier = 1) => {
    const a = arena([PAN, { ...at('scoby', tier), age }]);
    const e = a.fake.spawnEnemy({ hp: 1000 });
    a.fake.hit(e, 5, a.stats);
    return a;
  };

  it('poisons on a direct hit of an adjacent weapon', () => {
    const [c] = poisonOf(0).fake.callsOf('poison');
    expect([c.dps, c.duration]).toEqual([2, 3]);
  });

  it('is 10% stronger per aisle in the cart', () => {
    expect([0, 1, 5].map((age) => poisonOf(age).fake.callsOf('poison')[0].dps)).toEqual([expect.closeTo(2, 10), expect.closeTo(2.2, 10), expect.closeTo(3, 10)]);
    expect(poisonOf(2, 3).fake.callsOf('poison')[0].dps).toBeCloseTo(4 * 1.2, 10);
  });

  it('grows one aisle per shop', () => {
    const s = shopRun(), rng = mulberry32(1), k = place(s, 'scoby', 0, 0);
    for (let i = 0; i < 3; i++) openShop(s, rng);
    expect(k.age).toBe(3);
  });

  it('counts a kill on a burning-and-poisoned enemy (Toxic Fumes) as an extra aisle, once per aisle', () => {
    const a = arena([PAN, at('scoby')]);
    const fumes = () => {
      const e = a.fake.spawnEnemy({ hp: 1, x: Math.random() * 100, y: 5 });
      e.status.burnUntil = 99; e.status.burnDps = 1; e.status.poisonUntil = 99; e.status.poisonDps = 1;
      a.fake.hit(e, 5, a.stats);
    };
    const scoby = a.inv.placed.find((p) => p.type === 'scoby')!;
    fumes(); fumes();
    expect(scoby.age).toBe(1);
    a.fake.hit(a.fake.spawnEnemy({ hp: 1 }), 5, a.stats); // plain kill: nothing
    expect(scoby.age).toBe(1);
  });
});

describe('item registration', () => {
  it('age mode: Sourdough also on the shelf, the new four in the cart only', () => {
    expect(contentItem('sourdough')!.age).toBe('owned');
    for (const id of ['avocado', 'fish', 'basil', 'scoby'] as const) expect(contentItem(id)!.age).toBe('cart');
  });
});
