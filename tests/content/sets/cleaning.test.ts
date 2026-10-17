import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import cleaning from '../../../src/content/sets/cleaning';
import { contentSet, contentSetTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { weakenMult } from '../../../src/systems/combat';
import { arena, at, far, full } from '../helpers';
import { expectSetText, hitOf } from './helpers';

afterEach(() => setLang('en'));

// Cleaning members that touch nothing: Desk Fan (module, not next to the weapon), Spray Bottle and Vacuum (weapons elsewhere in the cart).
const MOP = at('mop'), LEAF = at('leafblower'); // a puddle weapon, a cone weapon
const members = (n: number) => [far('fan'), far('spray'), far('vacuum')].slice(0, n);
const cart = (weapon: ReturnType<typeof at>, n: number) => [weapon, ...members(n)];
// An 8x6 cart: four rooms of weapons need the space.
const stats = (c: Parameters<typeof full>[0]) => full(c).weapons[0], sets = (c: Parameters<typeof full>[0]) => full(c).sets;

describe('Cleaning set: thresholds', () => {
  it('2 / 3 / 4 distinct cleaning types give L1 / L2 / L3; the weapon alone is 1', () => {
    expect([0, 1, 2, 3].map((n) => sets(cart(MOP, n)).cleaning)).toEqual([0, 1, 2, 3]);
  });

  it('no bonus below the threshold: the weapon keeps its base range, area and duration', () => {
    const w = stats(cart(MOP, 0));
    expect(w.range).toBe(ITEMS.mop.weapon!.range);
    expect(w.aoe).toBe(ITEMS.mop.weapon!.aoe);
    expect(w.duration).toBe(ITEMS.mop.weapon!.duration);
  });

  it('L1 widens range and area by 15% (puddle duration unchanged)', () => {
    const base = stats(cart(MOP, 0)), w = stats(cart(MOP, 1));
    expect(w.range).toBeCloseTo(base.range * 1.15, 10);
    expect(w.aoe).toBeCloseTo(base.aoe * 1.15, 10);
    expect(w.duration).toBe(base.duration);
  });

  it('L2 keeps the 15% and makes puddles last +1 s (puddle weapons only)', () => {
    const base = stats(cart(MOP, 0)), w = stats(cart(MOP, 2));
    expect(w.range).toBeCloseTo(base.range * 1.15, 10);
    expect(w.duration).toBe(base.duration + 1);
    const leaf = stats(cart(LEAF, 2)), leafBase = stats(cart(LEAF, 0));
    expect(leaf.duration).toBe(leafBase.duration); // a cone has no puddle to lengthen
    expect(leaf.range).toBeCloseTo(leafBase.range * 1.15, 10);
  });

  it('L3 replaces the numbers: +25% range/area and +2 s', () => {
    const base = stats(cart(MOP, 0)), w = stats(cart(MOP, 3));
    expect(w.range).toBeCloseTo(base.range * 1.25, 10);
    expect(w.aoe).toBeCloseTo(base.aoe * 1.25, 10);
    expect(w.duration).toBe(base.duration + 2);
  });

  it('only cleaning weapons: a kitchen weapon in a Cleaning L3 cart is untouched', () => {
    const pan = at('pan'), withSet = [pan, ...members(3), far('mop')]; // four cleaning types, none of them the pan
    expect(sets(withSet).cleaning).toBe(3);
    const plain = stats([pan]), w = stats(withSet);
    expect(w.range).toBe(plain.range);
    expect(w.aoe).toBe(plain.aoe);
  });
});

describe('Cleaning set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3)', () => {
    expect(contentSet('cleaning')).toBe(cleaning);
    expect(contentSetTune('cleaning', 1)).toEqual({ rangeMult: 1.15, aoeMult: 1.15, knockbackMult: 1.4, puddleExtra: 1, weakenPct: 0, weakenTime: 0 });
    expect(contentSetTune('cleaning', 2)).toEqual({ ...contentSetTune('cleaning', 1), weakenPct: 0.2, weakenTime: 2 });
    expect(contentSetTune('cleaning', 3)).toEqual({ rangeMult: 1.25, aoeMult: 1.25, knockbackMult: 1.8, puddleExtra: 2, weakenPct: 0.2, weakenTime: 2 });
  });

  it('runs at set order 20, its hook at 30', () => {
    expect(cleaning.build).toMatchObject({ phase: 'set', order: 20 });
    expect(cleaning.hooks?.order).toBe(30);
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('cleaning', {
      en: { name: 'Cleaning', bonus: ['Cleaning weapons +15% range/area', '+40% knockback, puddles last +1 s, hits weaken enemies by 20% for 2 s', '+25% range/area, +80% knockback, puddles last +2 s, hits weaken enemies by 20% for 2 s'] },
      de: { name: 'Putzen', bonus: ['Putzwaffen +15 % Reichweite/Fläche', '+40 % Rückstoß, Pfützen halten +1 s länger, Treffer schwächen Gegner um 20 % für 2 s', '+25 % Reichweite/Fläche, +80 % Rückstoß, Pfützen halten +2 s länger, Treffer schwächen Gegner um 20 % für 2 s'] },
    });
  });
});

// Runtime: `afterHit` multiplies the knockback (`hit.kbMult`, the scene applies it last) and spritzes teal on direct hits. No rng.
describe('Cleaning set: knockback', () => {
  const run = (n: number, weapon = LEAF) => {
    const a = arena(cart(weapon, n), { seed: 1 });
    return { ...a, enemy: a.fake.spawnEnemy({ hp: 100, x: 10, y: 80 }) };
  };
  const emit = (n: number, opts = {}, patch: object = {}, weapon = LEAF) => {
    const { fake, stats: w, enemy } = run(n, weapon);
    const hit = hitOf(enemy, { ...w, ...patch }, { kb: 100, kbX: 1, kbY: 0, ...opts });
    fake.hooks.emit('afterHit', hit);
    return { hit, fake };
  };

  it('L2 multiplies the push by 1.4, L3 by 1.8; below L2 it stays 1', () => {
    expect(emit(1).hit.kbMult).toBe(1);
    expect(emit(2).hit.kbMult).toBe(1.4);
    expect(emit(3).hit.kbMult).toBe(1.8);
  });

  it('applies to the cleaning weapon\'s DoT, aura and puddle hits as well (the legacy multiplier had no such exception)', () => {
    expect(emit(2, { isDot: true }).hit.kbMult).toBe(1.4);
    expect(emit(2, {}, { pattern: 'aura' }).hit.kbMult).toBe(1.4);
    expect(emit(2, {}, { pattern: 'puddle' }).hit.kbMult).toBe(1.4);
  });

  it('leaves other weapons alone', () => {
    const { fake, stats: w, enemy } = (() => { const a = arena([at('pan'), ...members(3)], { seed: 1 }); return { ...a, enemy: a.fake.spawnEnemy({ hp: 100 }) }; })();
    const hit = hitOf(enemy, w, { kb: 100 });
    fake.hooks.emit('afterHit', hit);
    expect(hit.kbMult).toBe(1);
    expect(fake.callsOf('fx')).toEqual([]);
  });

  it('spritzes teal at the enemy on direct hits only (not DoT, aura or puddle ticks), and only when there is a push', () => {
    const spark = (r: ReturnType<typeof emit>) => r.fake.callsOf('fx').filter((c) => c.method === 'spark');
    expect(spark(emit(2))[0].args).toEqual([10, 50, 3, 0x3fb7a6]);
    expect(spark(emit(2, { isDot: true }))).toEqual([]);
    expect(spark(emit(2, {}, { pattern: 'aura' }))).toEqual([]);
    expect(spark(emit(2, {}, { pattern: 'puddle' }))).toEqual([]);
    expect(spark(emit(2, { kb: 0 }))).toEqual([]);
    expect(spark(emit(1))).toEqual([]);
  });

  it('draws no random numbers', () => {
    const { fake } = emit(3);
    expect(fake.rng()).toBe(run(3).fake.rng());
  });
});

// Weaken (docs/item-hooks-refactor.md "Weaken"): L2 / L3 `afterHit` weakens the enemy by 20% for 2 s on every DIRECT hit of a cleaning weapon, quiet cone and puddle ticks included.
describe('Cleaning set: weaken', () => {
  const emit = (n: number, opts = {}, patch: object = {}, weapon = LEAF) => {
    const a = arena(cart(weapon, n), { seed: 1 });
    const enemy = a.fake.spawnEnemy({ hp: 100, x: 10, y: 80 });
    a.fake.hooks.emit('afterHit', hitOf(enemy, { ...a.stats, ...patch }, { kb: 100, kbX: 1, kbY: 0, ...opts }));
    return { ...a, enemy };
  };

  it('L2 and L3 weaken by 20% for 2 s, L1 does nothing', () => {
    for (const n of [2, 3]) {
      const r = emit(n);
      expect(r.fake.callsOf('weaken')).toEqual([{ at: 0, kind: 'weaken', enemy: r.enemy.id, pct: 0.2, seconds: 2 }]);
      expect(weakenMult(r.enemy.status, 0)).toBeCloseTo(0.8, 10);
      expect(weakenMult(r.enemy.status, 2)).toBe(1); // over after its 2 s
    }
    expect(emit(1).fake.callsOf('weaken')).toEqual([]);
  });

  it('counts the quiet cone and puddle ticks (the family\'s main delivery), not DoT, echo, chain or pop hits', () => {
    expect(emit(2, { quiet: true }).fake.callsOf('weaken')).toHaveLength(1);
    expect(emit(2, { quiet: true }, { pattern: 'puddle' }, MOP).fake.callsOf('weaken')).toHaveLength(1);
    for (const o of [{ isDot: true }, { echo: true }, { chained: true }, { fromPopper: true }]) expect(emit(2, o).fake.callsOf('weaken'), JSON.stringify(o)).toEqual([]);
  });

  it('only cleaning weapons', () => {
    const a = arena([at('pan'), ...members(3)], { seed: 1 }), enemy = a.fake.spawnEnemy({ hp: 100 });
    a.fake.hooks.emit('afterHit', hitOf(enemy, a.stats, { kb: 100 }));
    expect(a.fake.callsOf('weaken')).toEqual([]);
  });

  it('draws no random numbers', () => {
    expect(emit(3).fake.rng()).toBe(arena(cart(LEAF, 3), { seed: 1 }).fake.rng());
  });
});
