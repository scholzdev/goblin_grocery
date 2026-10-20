import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import kitchen from '../../../src/content/sets/kitchen';
import { contentSet, contentSetTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { arena, at, far, sets, stats } from '../helpers';
import { draws, expectSetText, seedWhere } from './helpers';

afterEach(() => setLang('en'));

const PAN = at('pan'); // a kitchen weapon (sweep)
// Kitchen members that touch nothing: Free Sample and Sourdough (passives), Ice Pack (a module not next to the weapon).
const L1 = [PAN, far('sample')], L2 = [...L1, far('sourdough')], L3 = [...L2, far('ice')];
const base = ITEMS.pan.weapon!.damage * TIER.weaponDamage(1);

describe('Kitchen set: thresholds', () => {
  it('counts set points (one per ★1 kitchen type): the weapon alone is 1 (no bonus), 2 / 3 / 4 give L1 / L2 / L3', () => {
    expect([[PAN], L1, L2, L3].map((c) => sets(c).kitchen)).toEqual([0, 1, 2, 3]);
    expect(sets([PAN, far('sample'), far('sample')]).kitchen).toBe(1); // a duplicate type counts once
  });

  it('no bonus below the threshold: damage is the weapon\'s own', () => {
    expect(stats([PAN]).damage).toBe(base);
  });

  it('L1 +10% damage, L2 the same, L3 +20% (the L3 numbers replace, they do not add)', () => {
    expect(stats(L1).damage).toBeCloseTo(base * 1.1, 10);
    expect(stats(L2).damage).toBeCloseTo(base * 1.1, 10);
    expect(stats(L3).damage).toBeCloseTo(base * 1.2, 10);
  });

  it('only kitchen weapons: a cleaning weapon in the same cart is untouched', () => {
    const leaf = at('leafblower');
    const members = [far('sample'), far('sourdough'), far('ice')]; // three kitchen types and no kitchen weapon: L2
    expect(sets([leaf, ...members]).kitchen).toBe(2);
    expect(stats([leaf, ...members]).damage).toBe(stats([leaf]).damage);
  });

  it('is applied once per weapon, before Bundle Deal (the bundle multiplier comes after the set phase)', () => {
    // A touching Sample is a kitchen type and a bundle item: damage = base x 1.1 (set) x (1 + perItem x 1).
    const touching = stats([PAN, at('sample')]).damage;
    expect(touching).toBeCloseTo(base * 1.1 * (1 + 0.06), 10);
  });
});

describe('Kitchen set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3: L2 shares L1\'s numbers)', () => {
    expect(contentSet('kitchen')).toBe(kitchen);
    expect(contentSetTune('kitchen', 1)).toEqual({ damageMult: 1.1, healChance: 0.05, heal: 3 });
    expect(contentSetTune('kitchen', 2)).toEqual({ damageMult: 1.1, healChance: 0.05, heal: 3 });
    expect(contentSetTune('kitchen', 3)).toEqual({ damageMult: 1.2, healChance: 0.1, heal: 4 });
  });

  it('runs at set order 10 and its heal hook before the Blast pop', () => {
    expect(kitchen.build?.phase).toBe('set');
    expect(kitchen.build?.order).toBe(10);
    expect(kitchen.hooks?.order).toBe(10);
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('kitchen', {
      en: { name: 'Kitchen', bonus: ['Kitchen weapons +10% damage', 'Kitchen kills: 5% chance to heal 3 HP', 'Kitchen weapons +20% damage; kills: 10% chance to heal 4 HP'] },
      de: { name: 'Küche', bonus: ['Küchenwaffen +10 % Schaden', 'Küchen-Kills: 5 % Chance, 3 LP zu heilen', 'Küchenwaffen +20 % Schaden; Kills: 10 % Chance, 4 LP zu heilen'] },
    });
  });
});

// Runtime: `afterKill`. Kills by a kitchen weapon roll once at L2+; the heal is +3 HP (L2) / +4 HP (L3) at the goblin.
describe('Kitchen set: heal on kills', () => {
  const kill = (cart: Parameters<typeof arena>[0], seed: number, weapon = 0) => {
    const { fake, b } = arena(cart, { seed, hp: 10, maxHp: 100 });
    const e = fake.spawnEnemy({ hp: 1, x: 40, y: 60 });
    fake.hit(e, 5, b.weapons[weapon]);
    return { fake, e };
  };

  it('a lucky roll heals the set\'s HP and shows the heart at the enemy (L2: 3 HP, L3: 4 HP); one draw', () => {
    for (const [cart, hp, chance] of [[L2, 3, 0.05], [L3, 4, 0.1]] as const) {
      const seed = seedWhere((r) => r < chance);
      const { fake } = kill(cart, seed);
      expect(fake.callsOf('heal')).toEqual([{ at: 0, kind: 'heal', hp }]);
      expect(fake.callsOf('healFx')).toEqual([{ at: 0, kind: 'healFx', x: 40, y: 30 }]);
      expect(fake.run.hp).toBe(10 + hp);
      expect(fake.rng()).toBe(draws(seed, 2)[1]);
    }
  });

  it('an unlucky roll does nothing but still uses exactly one draw', () => {
    const seed = seedWhere((r) => r >= 0.05);
    const { fake } = kill(L2, seed);
    expect(fake.callsOf('heal')).toEqual([]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('needs L2: at L1 there is no roll (no draw)', () => {
    const { fake } = kill(L1, 1);
    expect(fake.callsOf('heal')).toEqual([]);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('needs a kitchen weapon and a kill: a cleaning weapon or a non-lethal hit rolls nothing', () => {
    const cart = [at('leafblower'), far('sample'), far('sourdough'), far('ice')]; // Kitchen L3 without a kitchen weapon
    const { fake, e } = kill(cart, 1);
    expect(fake.callsOf('heal')).toEqual([]);
    expect(e.alive).toBe(false);
    expect(fake.rng()).toBe(draws(1, 1)[0]);
    const nonLethal = arena(L3, { seed: 1, hp: 10, maxHp: 100 });
    nonLethal.fake.hit(nonLethal.fake.spawnEnemy({ hp: 100 }), 5, nonLethal.stats);
    expect(nonLethal.fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('heals at most to max HP (the ctx clamps)', () => {
    const seed = seedWhere((r) => r < 0.05);
    const { fake, b } = arena(L2, { seed, hp: 99, maxHp: 100 });
    fake.hit(fake.spawnEnemy({ hp: 1 }), 5, b.weapons[0]);
    expect(fake.run.hp).toBe(100);
  });
});
