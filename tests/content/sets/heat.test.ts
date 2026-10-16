import { afterEach, describe, expect, it } from 'vitest';
import heat from '../../../src/content/sets/heat';
import { contentSet, contentSetTune, contentTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { arena, at, far, full } from '../helpers';
import { draws, expectSetText, seedWhere } from './helpers';

afterEach(() => setLang('en'));

const fuel = contentTune('fuel', 1); // the burn the Fuel Can gives at ★1; the set's ignite is built from it too
const PAN = at('pan'); // a heat weapon (kitchen, element heat)
const FUEL = at('fuel'); // touches the pan: gives it a burn
// Heat members that touch nothing: Hot Sauce (module), Cooker and Toaster (weapons elsewhere in the cart).
const burnCart = (n: number) => [PAN, FUEL, ...[far('hotsauce'), far('cooker')].slice(0, n)];
const igniteCart = (n: number) => [PAN, ...[far('hotsauce'), far('cooker'), far('toaster')].slice(0, n)];
const stats = (c: Parameters<typeof full>[0]) => full(c).weapons[0];

describe('Heat set: burn', () => {
  it('2 / 3 / 4 distinct heat types give L1 / L2 / L3; the pan alone is 1', () => {
    expect([0, 1, 2].map((n) => full(burnCart(n)).sets.heat)).toEqual([1, 2, 3]); // pan + fuel = 2 types, + hotsauce 3, + cooker 4
    expect(full([PAN]).sets.heat).toBe(0);
  });

  it('below the threshold the burn is the Fuel Can\'s own', () => {
    const alone = stats([at('fizz'), FUEL]); // fizz is a frost weapon: the fuel is the only heat type
    expect(alone.burn).toEqual({ dps: fuel.dps, duration: fuel.duration, tick: fuel.tick });
  });

  it('L1 burns +1 s longer, the damage per second is unchanged', () => {
    expect(stats(burnCart(0)).burn).toEqual({ dps: fuel.dps, duration: fuel.duration + 1, tick: fuel.tick });
  });

  it('L2 multiplies the burn damage by 1.4 on top', () => {
    expect(stats(burnCart(1)).burn).toEqual({ dps: fuel.dps * 1.4, duration: fuel.duration + 1, tick: fuel.tick });
  });

  it('L3 replaces the numbers: +2 s, x1.8', () => {
    expect(stats(burnCart(2)).burn).toEqual({ dps: fuel.dps * 1.8, duration: fuel.duration + 2, tick: fuel.tick });
  });

  it('extends any weapon\'s burn, not only heat weapons\'', () => {
    const fizz = stats([at('fizz'), FUEL, far('hotsauce'), far('cooker')]); // heat L2 (fuel, hotsauce, cooker), fizz is frost
    expect(fizz.burn).toEqual({ dps: fuel.dps * 1.4, duration: fuel.duration + 1, tick: fuel.tick });
  });

  it('Jelly Beans in their heat flavor count toward the set (and take it away in another flavor)', () => {
    const beans = (flavor: 'heat' | 'frost') => full([PAN, { ...far('jellybeans'), flavor }]);
    expect(beans('heat').sets.heat).toBe(1);
    expect(beans('frost').sets.heat).toBe(0);
  });
});

describe('Heat set: ignite chance (L2+)', () => {
  it('no ignite below L2: L0 (the pan alone) and L1 (two heat types)', () => {
    expect(stats(igniteCart(0)).ignite).toBeNull();
    expect(full(igniteCart(1)).sets.heat).toBe(1);
    expect(stats(igniteCart(1)).ignite).toBeNull();
  });

  it('L2: heat weapons without a burn ignite 15% of hits, with the Fuel Can\'s burn x1.4 for +1 s', () => {
    expect(full(igniteCart(2)).sets.heat).toBe(2);
    expect(stats(igniteCart(2)).ignite).toEqual({ chance: 0.15, burn: { dps: fuel.dps * 1.4, duration: fuel.duration + 1, tick: fuel.tick } });
  });

  it('L3 replaces the numbers: 25%, +2 s (the damage multiplier stays 1.4)', () => {
    expect(stats(igniteCart(3)).ignite).toEqual({ chance: 0.25, burn: { dps: fuel.dps * 1.4, duration: fuel.duration + 2, tick: fuel.tick } });
  });

  it('only for heat-element weapons without a burn', () => {
    expect(stats([at('fizz'), far('hotsauce'), far('cooker'), far('toaster')]).ignite).toBeNull(); // fizz is a frost weapon
    const withBurn = stats([PAN, FUEL, far('hotsauce'), far('cooker')]);
    expect(withBurn.burn).not.toBeNull();
    expect(withBurn.ignite).toBeNull();
    const beans = stats([PAN, { ...far('jellybeans'), flavor: 'heat' }, far('cooker')]); // L2 through the beans
    expect(beans.ignite).not.toBeNull(); // the pan itself is heat; the beans are far, so the pan has no burn
  });
});

describe('Heat set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3)', () => {
    expect(contentSet('heat')).toBe(heat);
    expect(contentSetTune('heat', 1)).toEqual({ burnExtra: 1, burnMult: 1.4, igniteChance: 0.15, igniteDpsMult: 1.4, igniteExtra: 1 });
    expect(contentSetTune('heat', 2)).toEqual(contentSetTune('heat', 1));
    expect(contentSetTune('heat', 3)).toEqual({ burnExtra: 2, burnMult: 1.8, igniteChance: 0.25, igniteDpsMult: 1.4, igniteExtra: 2 });
  });

  it('runs at set order 40, has no combat hooks (the engine rolls WeaponStats.ignite)', () => {
    expect(heat.build).toMatchObject({ phase: 'set', order: 40 });
    expect(heat.hooks).toBeUndefined();
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('heat', {
      en: { name: 'Heat', bonus: ['Burn lasts +1 s', 'Burn damage ×1.4; heat weapons ignite 15% of hits', 'Burn +2 s, damage ×1.8; heat weapons ignite 25% of hits'] },
      de: { name: 'Hitze', bonus: ['Brennen dauert +1 s länger', 'Brandschaden ×1,4; Hitzewaffen zünden 15 % der Treffer', 'Brennen +2 s, Schaden ×1,8; Hitzewaffen zünden 25 % der Treffer'] },
    });
  });
});

// The ignite roll itself (one draw per direct hit without a burn) is the engine's (engine/onHitStatuses.ts, tests/engine/onHitStatuses.test.ts);
// here only the contract: the stats this set builds are what a hit rolls and applies.
describe('Heat set: what a hit does with the stats it built', () => {
  it('a lucky roll ignites with the set\'s burn, a miss does nothing; one draw either way', () => {
    const lucky = seedWhere((r) => r < 0.15), unlucky = seedWhere((r) => r >= 0.15);
    const a = arena(igniteCart(2), { seed: lucky }), e = a.fake.spawnEnemy({ hp: 100 });
    a.fake.hit(e, 3, a.stats);
    expect(a.fake.callsOf('ignite')).toEqual([{ at: 0, kind: 'ignite', enemy: e.id, burn: a.stats.ignite!.burn }]);
    expect(a.fake.rng()).toBe(draws(lucky, 2)[1]);
    const b = arena(igniteCart(2), { seed: unlucky });
    b.fake.hit(b.fake.spawnEnemy({ hp: 100 }), 3, b.stats);
    expect(b.fake.callsOf('ignite')).toEqual([]);
    expect(b.fake.rng()).toBe(draws(unlucky, 2)[1]);
  });
});
