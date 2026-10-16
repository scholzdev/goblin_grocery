import { afterEach, describe, expect, it } from 'vitest';
import blast from '../../../src/content/sets/blast';
import { ITEMS } from '../../../src/data/items';
import { contentSet, contentSetTune, contentTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { arena, at, far, full } from '../helpers';
import { draws, expectSetText, seedWhere } from './helpers';

afterEach(() => setLang('en'));

const popper = contentTune('popper', 1); // damage and radius of the Party Popper blast at ★1
const GUN = at('nailgun'); // a blast weapon (element blast)
const stats = (c: Parameters<typeof full>[0]) => full(c).weapons[0];
// Blast members that touch nothing: Slam Bumper (passive), Double Bag (module not next to the weapon), Party Popper (module, far).
const popFar = [far('popper'), far('bumper'), far('doublebag')];
const rooms = (n: number) => [GUN, ...popFar.slice(0, n)]; // nailgun counts too: n = 1 -> 2 blast types (L1) ...

describe('Blast set: thresholds and radius', () => {
  it('2 / 3 / 4 distinct blast types give L1 / L2 / L3', () => {
    expect([0, 1, 2, 3].map((n) => full(rooms(n)).sets.blast)).toEqual([0, 1, 2, 3]);
  });

  it('no bonus below the threshold: the Party Popper blast has its own radius', () => {
    expect(stats([at('pan'), at('popper')]).popper).toEqual({ damage: popper.damage, radius: popper.radius });
  });

  it('L1 widens the Party Popper blast by 15% (any weapon carrying a popper, blast or not)', () => {
    const w = stats([at('pan'), at('popper'), far('bumper')]); // popper + bumper = L1
    expect(w.popper).toEqual({ damage: popper.damage, radius: popper.radius * 1.15 });
  });

  it('L3 replaces the number: 25%', () => {
    const w = stats([at('pan'), at('popper'), far('bumper'), far('doublebag'), far('multipack')]); // 4 blast types
    expect(w.popper).toEqual({ damage: popper.damage, radius: popper.radius * 1.25 });
  });

  it('widens the area of Microwave and Cooker (zap / mortar) 15%, other patterns keep theirs', () => {
    for (const weapon of ['microwave', 'cooker'] as const) {
      const base = stats([at(weapon)]).aoe, w = stats([at(weapon), far('popper'), far('bumper')]);
      expect(w.aoe, weapon).toBeCloseTo(base * 1.15, 10);
    }
    const pan = stats([at('pan'), far('popper'), far('bumper')]);
    expect(pan.aoe).toBe(ITEMS.pan.weapon!.aoe);
  });

  it('Jelly Beans in their blast flavor count toward the set', () => {
    expect(full([GUN, { ...far('jellybeans'), flavor: 'blast' }]).sets.blast).toBe(1); // nailgun + beans = 2 types: L1
    expect(full([GUN, { ...far('jellybeans'), flavor: 'heat' }]).sets.blast).toBe(0); // the nailgun alone
  });
});

describe('Blast set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3)', () => {
    expect(contentSet('blast')).toBe(blast);
    expect(contentSetTune('blast', 1)).toEqual({ radiusMult: 1.15, killChance: 0.1, damage: 6, radius: 60 });
    expect(contentSetTune('blast', 2)).toEqual(contentSetTune('blast', 1));
    expect(contentSetTune('blast', 3)).toEqual({ radiusMult: 1.25, killChance: 0.2, damage: 10, radius: 75 });
  });

  it('runs at set order 50; its kill hook rolls after the Kitchen heal (20 > 10)', () => {
    expect(blast.build).toMatchObject({ phase: 'set', order: 50 });
    expect(blast.hooks?.order).toBe(20);
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('blast', {
      en: { name: 'Blast', bonus: ['Blast radius +15%', 'Weapon kills: 10% chance to pop (6 dmg)', 'Blast radius +25%; weapon kills: 20% chance to pop (10 dmg)'] },
      de: { name: 'Knall', bonus: ['Explosionsradius +15 %', 'Waffen-Kills: 10 % Chance zu platzen (6 Schaden)', 'Explosionsradius +25 %; Waffen-Kills: 20 % Chance zu platzen (10 Schaden)'] },
    });
  });
});

// Runtime: `afterKill`. A lethal weapon hit at L2+ rolls once; a pop is the pink set blast at the enemy, damaging everything in its radius.
describe('Blast set: pop on kills', () => {
  const kill = (n: number, seed: number, opts = {}) => {
    const a = arena(rooms(n), { seed });
    const e = a.fake.spawnEnemy({ hp: 1, x: 40, y: 60 });
    a.fake.hit(e, 5, a.stats, opts);
    return { ...a, e };
  };

  it('a lucky roll pops: the set blast (6 damage, radius 60 at L2) at the enemy, pink; one draw', () => {
    const seed = seedWhere((r) => r < 0.1);
    const { fake } = kill(2, seed);
    expect(fake.callsOf('popperBlast')).toEqual([{ at: 0, kind: 'popperBlast', x: 40, y: 60, damage: 6, radius: 60, setPop: true }]);
    expect(fake.rng()).toBe(draws(seed, 2)[1]);
  });

  it('L3 pops harder, wider and more often (10 damage, radius 75, 20%)', () => {
    const seed = seedWhere((r) => r < 0.2 && r >= 0.1);
    const { fake } = kill(3, seed);
    expect(fake.callsOf('popperBlast')).toEqual([{ at: 0, kind: 'popperBlast', x: 40, y: 60, damage: 10, radius: 75, setPop: true }]);
  });

  it('a miss does nothing and uses exactly one draw; below L2 there is no roll', () => {
    const seed = seedWhere((r) => r >= 0.1);
    const miss = kill(2, seed);
    expect(miss.fake.callsOf('popperBlast')).toEqual([]);
    expect(miss.fake.rng()).toBe(draws(seed, 2)[1]);
    const l1 = kill(1, 1);
    expect(l1.fake.callsOf('popperBlast')).toEqual([]);
    expect(l1.fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('popper blasts never pop again; other enemies in the radius are hit, and the ones it kills do not re-trigger', () => {
    const seed = seedWhere((r) => r < 0.1);
    const a = arena(rooms(2), { seed });
    const near = a.fake.spawnEnemy({ hp: 1, x: 50, y: 60 });
    a.fake.hit(a.fake.spawnEnemy({ hp: 1, x: 40, y: 60 }), 5, a.stats);
    expect(a.fake.callsOf('popperBlast')).toHaveLength(1);
    expect(near.alive).toBe(false);
    const again = arena(rooms(2), { seed });
    again.fake.hit(again.fake.spawnEnemy({ hp: 1 }), 5, again.stats, { fromPopper: true });
    expect(again.fake.callsOf('popperBlast')).toEqual([]);
    expect(again.fake.rng()).toBe(draws(seed, 1)[0]); // not a single draw
  });

  it('needs a weapon kill: a non-lethal hit or a weaponless hit (the dash) rolls nothing', () => {
    const a = arena(rooms(2), { seed: 1 });
    a.fake.hit(a.fake.spawnEnemy({ hp: 100 }), 5, a.stats);
    a.fake.hit(a.fake.spawnEnemy({ hp: 1 }), 5, null, { label: 'shove' });
    expect(a.fake.callsOf('popperBlast')).toEqual([]);
    expect(a.fake.rng()).toBe(draws(1, 1)[0]);
  });

  it('rolls after the Kitchen heal when both sets are at L2: the first draw heals, the second pops', () => {
    // Pan + Sample + Sourdough = Kitchen L2; Popper + Bumper + Double Bag = Blast L2.
    const cart = [at('pan'), far('sample'), far('sourdough'), ...popFar];
    const both = seedWhere((r) => r < 0.05, (r) => r < 0.1);
    const a = arena(cart, { seed: both, hp: 10, maxHp: 100 });
    expect(a.b.sets).toMatchObject({ kitchen: 2, blast: 2 });
    a.fake.hit(a.fake.spawnEnemy({ hp: 1 }), 5, a.stats);
    expect(a.fake.calls.map((c) => c.kind).filter((k) => k === 'heal' || k === 'popperBlast')).toEqual(['heal', 'popperBlast']);
    expect(a.fake.rng()).toBe(draws(both, 3)[2]);
    const popOnly = seedWhere((r) => r >= 0.05, (r) => r < 0.1);
    const b = arena(cart, { seed: popOnly, hp: 10, maxHp: 100 });
    b.fake.hit(b.fake.spawnEnemy({ hp: 1 }), 5, b.stats);
    expect(b.fake.callsOf('heal')).toEqual([]);
    expect(b.fake.callsOf('popperBlast')).toHaveLength(1);
  });
});
