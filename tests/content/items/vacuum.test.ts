import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER } from '../../../src/data/items';
import vacuum from '../../../src/content/items/vacuum';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, full, setTuneAt, stats } from '../helpers';

afterEach(() => setLang('en'));

// A lone ★3 cleaning weapon is 3 Cleaning set points: L1 (range / area x1.15).
const CLEANING = setTuneAt('cleaning', 3)!;

// Pulse: constant suction every frame plus a damage pulse every cooldown (engine/patterns/pulse.ts), and the +60 coin pickup radius (a final `player` build hook).
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Vacuum: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('vacuum')).toBe(vacuum);
    const def = ITEMS.vacuum;
    expect(def).toMatchObject({ id: 'vacuum', family: 'cleaning', kind: 'weapon', price: 18, electrical: true });
    expect(def.element).toBeUndefined();
    expect(def.tags).toEqual(['area']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0}, {x: 1, y: 1}]);
    expect(def.weapon).toEqual({ pattern: 'pulse', damage: 2, cooldown: 0.65, range: 150, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 70, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('vacuum', 1, 1)).toEqual(['nailgun', 'vacuum', 'fan']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('vacuum', t))).toEqual([
      'Constantly pulls nearby enemies toward the cart. Every 0.65 s, enemies in range take 2 damage. +60 coin pickup radius. Active (E, 1 per aisle): Full Suck, for 2 s the pull is x3 and the range x2, and every coin on screen flies to you.',
      'Constantly pulls nearby enemies toward the cart. Every 0.59 s, enemies in range take 3 damage. +60 coin pickup radius. Active (E, 1 per aisle): Full Suck, for 2 s the pull is x3 and the range x2, and every coin on screen flies to you.',
      'Constantly pulls nearby enemies toward the cart. Every 0.52 s, enemies in range take 4 damage. +60 coin pickup radius. Active (E, 1 per aisle): Full Suck, for 2 s the pull is x3 and the range x2, and every coin on screen flies to you. ★3: Each damage pulse knocks the groceries right at the cart back out.',
    ]);
    expect(itemT('vacuum')).toMatchObject({ name: 'Vacuum', blurb: 'Utility weapon. Sucks groceries closer, and coins too.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('vacuum', t))).toEqual(['Zieht Gegner in der Nähe ständig zum Wagen. Alle 0,65 s erleiden Gegner im Radius 2 Schaden. +60 Münz-Sammelradius. Aktiv (E, 1 pro Gang): Volle Saugkraft, 2 s lang x3 Sog und x2 Reichweite, und alle Münzen im Bild fliegen zu dir.', 'Zieht Gegner in der Nähe ständig zum Wagen. Alle 0,52 s erleiden Gegner im Radius 4 Schaden. +60 Münz-Sammelradius. Aktiv (E, 1 pro Gang): Volle Saugkraft, 2 s lang x3 Sog und x2 Reichweite, und alle Münzen im Bild fliegen zu dir. ★3: Jeder Schadensstoß stößt die Gegner direkt am Wagen zurück.']);
    expect(itemT('vacuum')).toMatchObject({ name: 'Staubsauger', blurb: 'Hilfswaffe. Saugt Gegner heran, Münzen übrigens auch.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('vacuum')).toEqual([
      { label: 'Damage', values: ['2', '3', '4'] },
      { label: 'Interval', values: ['0.65 s', '0.59 s', '0.52 s'] },
    ]);
    setLang('de');
    expect(tierScaling('vacuum')).toEqual([
      { label: 'Schaden', values: ['2', '3', '4'] },
      { label: 'Intervall', values: ['0,65 s', '0,59 s', '0,52 s'] },
    ]);
  });
});

describe('Vacuum: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.vacuum.weapon!;
    const tune = contentItem('vacuum')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('vacuum', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('vacuum', t)]).damage)).toEqual([2.0, 3.0, 4.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('vacuum')])).toMatchObject({ pattern: 'pulse', range: 150, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 70, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

describe('Vacuum: pattern pulse', () => {
  it('pulls an enemy toward the cart while fighting: kx += pull x 9 x dt, scaled by its knockback resist', () => {
    const { a, fake } = arsenal([at('vacuum', 3)]);
    const light = fake.spawnEnemy({ x: -120, hp: 1000 });
    const heavy = fake.spawnEnemy({ x: 0, y: 120, hp: 1000, def: { knockbackResist: 0.5 } });
    a.step(0.1);
    expect(light.kx).toBeCloseTo(70 * 9 * 0.1); // 63 px/s, straight at the cart
    expect(light.ky).toBeCloseTo(0);
    expect(heavy.ky).toBeCloseTo(-70 * 9 * 0.1 * (1 - 0.5 * 0.7));
  });

  it('does not pull outside the range (150 x Cleaning L2 + radius), inside the nozzle (radius sum + 12), while not firing, or a spawning enemy', () => {
    const { a, fake } = arsenal([at('vacuum', 3)]);
    const far = fake.spawnEnemy({ x: -(150 * CLEANING.rangeMult + 21), hp: 1000 });
    const close = fake.spawnEnemy({ x: 50, hp: 1000 });
    const spawning = fake.spawnEnemy({ x: -100, hp: 1000, state: 'spawn' });
    a.step(0.1);
    expect([far.kx, close.kx, spawning.kx]).toEqual([0, 0, 0]);
    const pulled = fake.spawnEnemy({ x: -100, hp: 1000 });
    a.step(0.1, false);
    expect(pulled.kx).toBe(0);
    a.step(0.1, true);
    expect(pulled.kx).toBeGreaterThan(0);
  });

  it('every ★3 interval (0.52 s) it pulses: each enemy in range takes 4 damage with no push of its own, and a ring is drawn', () => {
    const { a, fake } = arsenal([at('vacuum', 3)]);
    const e1 = fake.spawnEnemy({ x: -120, hp: 1000 });
    const e2 = fake.spawnEnemy({ x: 0, y: 160, hp: 1000 });
    const out = fake.spawnEnemy({ x: 0, y: 200, hp: 1000 });
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => [c.enemy, c.dmg, c.opts])).toEqual([[e1.id, 4, {}], [e2.id, 4, {}]]);
    expect(hits.some((c) => c.enemy === out.id)).toBe(false);
    expect(fake.callsOf('fx').filter((c) => c.method === 'ring').map((c) => c.args.slice(0, 5))).toEqual([['fx_pulse', 0, 0, 150 * CLEANING.rangeMult * 2.2, 420]]);
    expect(fake.callsOf('sound').map((c) => [c.name, c.opts])).toEqual([['vacuum_pulse', { volume: 0.7 }]]);
    a.run(12, 0.05);
    const all = fake.callsOf('damage');
    expect(all).toHaveLength(4);
    expect(Math.abs(all[2].at - all[0].at - 0.52)).toBeLessThan(0.06);
  });

  it('from ★3 (★4 too) a pulse knocks the groceries within 40 of the cart\'s edge straight back out; at ★2 it pushes nobody', () => {
    const pushes = (tier: number) => {
      const { a, fake } = arsenal([at('vacuum', tier)]);
      const close = fake.spawnEnemy({ x: -30, y: 40, hp: 1000 }); // 50 from the center: 10 past the touching distance (20 + 20)
      const edge = fake.spawnEnemy({ x: 79, hp: 1000 }); // 39 past it
      const deep = fake.spawnEnemy({ x: 0, y: -120, hp: 1000 }); // in range, but far from the cart
      a.step(0.5);
      const opts = (id: number) => fake.callsOf('damage').find((c) => c.enemy === id)!.opts;
      return [opts(close.id), opts(edge.id), opts(deep.id)];
    };
    expect(pushes(2), '★2').toEqual([{}, {}, {}]);
    for (const t of [3, 4]) expect(pushes(t), `★${t}`).toEqual([{ kb: 150, kbX: -0.6, kbY: 0.8 }, { kb: 150, kbX: 1, kbY: 0 }, {}]);
  });

  it('the pulse fires with an enemy in range only, and a pulse does not wait for the suction', () => {
    const { a, fake } = arsenal([at('vacuum', 3)]);
    fake.spawnEnemy({ x: -180, hp: 1000 }); // beyond 150
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0);
    expect(a.weapons[0].cd).toBe(0.05);
  });
});

describe('Vacuum: coin pickup radius', () => {
  const radius = (specs: Parameters<typeof full>[0], perk = {}) => full(specs, perk).pickupRadius;

  it('adds +60 to the base pickup radius at every tier, next to a Magnet and the perk', () => {
    const base = radius([at('toaster')]);
    expect(base).toBe(PLAYER.pickupRadius);
    for (const t of [1, 2, 3, 4]) expect(radius([at('vacuum', t)]), `★${t}`).toBe(base + 60);
    expect(radius([at('vacuum', 3), { type: 'magnet', near: [], apart: [0] }], { pickupRadius: 25 })).toBe(base + 60 + 60 + 25);
  });

  it('does not stack: a second vacuum adds nothing, and the perk adds on top', () => {
    const one = radius([at('vacuum')]);
    expect(radius([at('vacuum'), { type: 'vacuum', near: [], apart: [0] }])).toBe(one);
    expect(radius([at('vacuum')], { pickupRadius: 25 })).toBe(one + 25);
  });

  it('reads the number from the content tune (60)', () => {
    expect(contentItem('vacuum')!.tune).toMatchObject({ pickup: 60 });
  });
});
