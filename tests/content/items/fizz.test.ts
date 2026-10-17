import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import fizz from '../../../src/content/items/fizz';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Ricochet: bottle caps that bounce on to other enemies (engine/patterns/ricochet.ts and the bounce in projectile.ts).
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Fizz Cannon: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('fizz')).toBe(fizz);
    const def = ITEMS.fizz;
    expect(def).toMatchObject({ id: 'fizz', family: 'snacks', kind: 'weapon', price: 14, electrical: false });
    expect(def.element).toBe('frost');
    expect(def.tags).toEqual(['ranged']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 1, y: 0}]);
    expect(def.weapon).toEqual({ pattern: 'ricochet', damage: 6, cooldown: 1, range: 420, projectileSpeed: 620, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 2, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('fizz', 1, 1)).toEqual(['blender', 'fizz', 'mop']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('fizz', t))).toEqual([
      'Fires a bottle cap for 6 damage every 1 s that bounces to 2 more enemies (never the same one twice). 420 range.',
      'Fires a bottle cap for 9 damage every 0.9 s that bounces to 2 more enemies (never the same one twice). 420 range.',
      'Fires a bottle cap for 12 damage every 0.8 s that bounces to 2 more enemies (never the same one twice). 420 range.',
    ]);
    expect(itemT('fizz')).toMatchObject({ name: 'Fizz Cannon', blurb: 'Shaken soda fires ricocheting bottle caps.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('fizz', t))).toEqual(['Feuert alle 1 s einen Kronkorken für 6 Schaden, der auf 2 weitere Gegner abprallt (nie zweimal auf denselben). 420 Reichweite.', 'Feuert alle 0,8 s einen Kronkorken für 12 Schaden, der auf 2 weitere Gegner abprallt (nie zweimal auf denselben). 420 Reichweite.']);
    expect(itemT('fizz')).toMatchObject({ name: 'Sprudelkanone', blurb: 'Geschüttelte Limo schießt abprallende Kronkorken.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('fizz')).toEqual([
      { label: 'Damage', values: ['6', '9', '12'] },
      { label: 'Interval', values: ['1 s', '0.9 s', '0.8 s'] },
    ]);
    setLang('de');
    expect(tierScaling('fizz')).toEqual([
      { label: 'Schaden', values: ['6', '9', '12'] },
      { label: 'Intervall', values: ['1 s', '0,9 s', '0,8 s'] },
    ]);
  });
});

describe('Fizz Cannon: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.fizz.weapon!;
    const tune = contentItem('fizz')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('fizz', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('fizz', t)]).damage)).toEqual([6.0, 9.0, 12.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('fizz')])).toMatchObject({ pattern: 'ricochet', range: 420, projectileSpeed: 620, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 2, chain: 0, aoe: 0 });
  });
});

// The goblin stands at (100, 400): projectiles that leave the arena (y < 140 ...) are removed, so the caps need room.
const P = { player: { x: 100, y: 400 } };

describe('Fizz Cannon: pattern ricochet', () => {
  it('fires a bottle cap from the nose of the cart that can hit 1 + bounces enemies (3 at ★3)', () => {
    const { a, fake } = arsenal([at('fizz', 3)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.step(0.5);
    const [cap] = a.spawned;
    expect(cap).toMatchObject({ key: 'proj_cap', x: 118, y: 400, speed: 620, damage: 12, maxHits: 3 });
    expect(cap.life).toBe(420 / 620);
    expect(cap.shot.ricochet).toBe(true);
    expect(fake.callsOf('sound').map((c) => [c.name, c.opts])).toEqual([['cap_ping', { rate: 0.8 }]]);
  });

  it('Duct Tape adds pierce on top of the bounces', () => {
    const { a, fake } = arsenal([at('fizz', 3), at('tape', 3)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.step(0.5);
    expect(a.spawned[0].maxHits).toBe(5);
  });

  it('Multipack fans the caps out 0.2 rad apart', () => {
    const { a, fake } = arsenal([at('fizz', 3), at('multipack', 1)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.step(0.5);
    expect(a.spawned.map((s) => s.angle)).toEqual([-0.1, 0.1]);
  });

  it('bounces to the next enemy it has not hit (within 230) and never hits the same one twice', () => {
    const { a, fake } = arsenal([at('fizz', 3)], P);
    const first = fake.spawnEnemy({ x: 300, y: 400, hp: 1000 });
    const second = fake.spawnEnemy({ x: 300, y: 550, hp: 1000 });
    a.run(60, 0.02);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([first.id, second.id]);
    expect(hits.every((c) => c.dmg === 12)).toBe(true);
  });

  it('with nobody left to bounce to the cap flies on (a ★3 cap is not spent by one hit)', () => {
    const { a, fake } = arsenal([at('fizz', 3)], P);
    fake.spawnEnemy({ x: 300, y: 400, hp: 1000 });
    a.run(45, 0.02); // fires at ~0.4 s, hits ~0.3 s later, would fly on for 0.68 s in all
    expect(fake.callsOf('damage')).toHaveLength(1);
    expect(a.shots[0].active).toBe(true);
    expect(a.shots[0].vx).toBeGreaterThan(0);
  });
});
