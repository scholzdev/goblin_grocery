import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import nailgun from '../../../src/content/items/nailgun';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { combatRng } from '../../../src/systems/rng';
import { around, arsenal, at, setTuneAt, stats } from '../helpers';

afterEach(() => setLang('en'));

// Burst: three nails per cooldown, one rng draw each (engine/patterns/burst.ts). Nailstorm's homing and Ray Gun's bolt are tested with those combos.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Nail Gun: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('nailgun')).toBe(nailgun);
    const def = ITEMS.nailgun;
    expect(def).toMatchObject({ id: 'nailgun', family: 'tools', kind: 'weapon', price: 16, electrical: true });
    expect(def.element).toBe('blast');
    expect(def.tags).toEqual(['ranged']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 1, y: 0}]);
    expect(def.weapon).toEqual({ pattern: 'burst', damage: 3, cooldown: 1.1, range: 480, projectileSpeed: 760, count: 3, burstInterval: 0.08, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('nailgun', 1, 1)).toEqual(['pan', 'nailgun', 'vacuum']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('nailgun', t))).toEqual([
      'Fires a three-nail burst every 1.1 s. 3 damage per nail. 480 range.',
      'Fires a three-nail burst every 0.99 s. 4.5 damage per nail. 480 range.',
      'Fires a three-nail burst every 0.88 s. 6 damage per nail. 480 range. ★3: The nails of a burst spread out over different enemies.',
    ]);
    expect(itemT('nailgun')).toMatchObject({ name: 'Nail Gun', blurb: 'Rat-a-tat three-nail bursts.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('nailgun', t))).toEqual(['Feuert alle 1,1 s eine Dreier-Nagelsalve. 3 Schaden pro Nagel. 480 Reichweite.', 'Feuert alle 0,88 s eine Dreier-Nagelsalve. 6 Schaden pro Nagel. 480 Reichweite. ★3: Die Nägel einer Salve verteilen sich auf verschiedene Gegner.']);
    expect(itemT('nailgun')).toMatchObject({ name: 'Nagelpistole', blurb: 'Ratatatat, Dreier-Nagelsalven.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('nailgun')).toEqual([
      { label: 'Damage', values: ['3', '4.5', '6'] },
      { label: 'Interval', values: ['1.1 s', '0.99 s', '0.88 s'] },
    ]);
    setLang('de');
    expect(tierScaling('nailgun')).toEqual([
      { label: 'Schaden', values: ['3', '4,5', '6'] },
      { label: 'Intervall', values: ['1,1 s', '0,99 s', '0,88 s'] },
    ]);
  });
});

describe('Nail Gun: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says, the interval also by the Tools bonus its own set points reach', () => {
    const base = ITEMS.nailgun.weapon!;
    const tune = contentItem('nailgun')!.tune as unknown as Record<string, readonly number[]>;
    const tools = (t: number) => setTuneAt('tools', t)?.cooldownDiv ?? 1;
    for (const t of [1, 2, 3]) {
      const w = stats([at('nailgun', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t) / tools(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1] / tools(t));
    }
    expect([1, 2, 3].map((t) => stats([at('nailgun', t)]).damage)).toEqual([3.0, 4.5, 6.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('nailgun')])).toMatchObject({ pattern: 'burst', range: 480, projectileSpeed: 760, count: 3, burstInterval: 0.08, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

// The goblin stands at (100, 400): projectiles that leave the arena (y < 140 ...) are removed, so the nails need room.
const P = { player: { x: 100, y: 400 } };

describe('Nail Gun: pattern burst', () => {
  const nails = (a: ReturnType<typeof arsenal>['a']) => a.spawned.filter((s) => s.key === 'proj_nail');

  it('fires a burst of three nails 0.08 s apart from the nose of the cart, then waits for the cooldown', () => {
    const { a, fake } = arsenal([at('nailgun', 3)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.run(220, 0.01);
    const first = nails(a).slice(0, 3);
    expect(first).toHaveLength(3);
    expect(first.every((s) => s.x === 118 && s.y === 400 && s.speed === 760 && s.damage === 6 && s.maxHits === 1)).toBe(true);
    expect(first[0].life).toBe(480 / 760);
    expect(Math.abs(first[1].at - first[0].at - 0.08)).toBeLessThan(0.02);
    expect(Math.abs(first[2].at - first[1].at - 0.08)).toBeLessThan(0.02);
    // the next burst starts one ★3 interval (0.88 s, faster by its own Tools L2) after the first
    const second = nails(a)[3];
    expect(Math.abs(second.at - first[0].at - 0.88 / setTuneAt('tools', 3)!.cooldownDiv - 0.01)).toBeLessThan(0.03);
  });

  it('draws exactly one number per nail from the combat rng, in order, and the "nail_burst" sound plays on the first nail only', () => {
    const { a, fake } = arsenal([at('nailgun', 3)], { seed: 11, ...P });
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    const ref = combatRng(11, 0);
    a.run(60, 0.01);
    const n = nails(a).slice(0, 3);
    expect(n.map((s) => s.angle)).toEqual(n.map(() => Math.atan2(0, 300 - 18) + (ref() - 0.5) * 0.08));
    expect(a.sounds.filter((s) => s === 'nail_burst')).toHaveLength(1);
    expect(a.recoils).toHaveLength(1);
  });

  it('each nail aims at the nearest enemy at that moment', () => {
    const { a, fake } = arsenal([at('nailgun', 3)], { seed: 3, ...P });
    const first = fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    const ref = combatRng(3, 0);
    // run until the first nail is out, then move the target away and bring another
    for (let i = 0; i < 200 && !nails(a).length; i++) a.step(0.01);
    expect(nails(a)).toHaveLength(1);
    first.x = 900;
    fake.spawnEnemy({ x: 300, y: 500, hp: 1000 });
    for (let i = 0; i < 40 && nails(a).length < 3; i++) a.step(0.01);
    const [n1, n2, n3] = nails(a);
    expect(n1.angle).toBe(Math.atan2(0, 300 - 18) + (ref() - 0.5) * 0.08);
    expect(n2.angle).toBe(Math.atan2(100, 200 - 18) + (ref() - 0.5) * 0.08);
    expect(n3.angle).toBe(Math.atan2(100, 200 - 18) + (ref() - 0.5) * 0.08);
  });

  it('from ★3 the nails of a burst go to different enemies, nearest first; ★2 puts all three on the nearest', () => {
    const burstAt = (tier: number, enemies: { x: number; y: number }[]) => {
      const { a, fake } = arsenal([at('nailgun', tier)], { seed: 7, ...P });
      for (const e of enemies) fake.spawnEnemy({ ...e, hp: 1000 });
      a.run(60, 0.01);
      const ref = combatRng(7, 0);
      return nails(a).slice(0, 3).map((s) => s.angle - (ref() - 0.5) * 0.08);
    };
    const three = [{ x: 300, y: 400 }, { x: 300, y: 560 }, { x: 300, y: 230 }];
    const near = 0, low = Math.atan2(160, 300 - 118), high = Math.atan2(-170, 300 - 118);
    const close = (got: number[], want: number[]) => got.forEach((g, i) => expect(g, `nail ${i + 1}`).toBeCloseTo(want[i], 12));
    close(burstAt(2, three), [near, near, near]);
    close(burstAt(3, three), [near, low, high]);
    close(burstAt(4, three), [near, low, high]);
    close(burstAt(3, three.slice(0, 2)), [near, low, near]);
  });

  it('a burst that finds nobody for a nail still spends it (burstLeft counts down) and draws no number for it', () => {
    const { a, fake } = arsenal([at('nailgun', 3)], { seed: 5, ...P });
    const e = fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    for (let i = 0; i < 200 && !nails(a).length; i++) a.step(0.01);
    e.x = 900; // gone before nails 2 and 3
    a.run(30, 0.01);
    expect(nails(a)).toHaveLength(1);
    expect(a.weapons[0].burstLeft).toBe(0);
    const ref = combatRng(5, 0);
    ref();
    expect(fake.rng()).toBe(ref());
  });

  it('Duct Tape lets a nail pierce (+2 at ★3)', () => {
    const { a, fake } = arsenal([at('nailgun', 3), at('tape', 3)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.run(60, 0.01);
    expect(nails(a)[0].maxHits).toBe(3);
  });
});
