import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import cooker from '../../../src/content/items/cooker';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import type { StubSprite } from '../../../src/engine/patterns/fakeHost';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { explodeAt } from '../../../src/engine/patterns';
import { around, arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Mortar: a pot lobbed at the densest group, an explosion on landing (engine/patterns/mortar.ts). Pressure Point / Shrapnel hook the explosion (tests/content/combos).
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Pressure Cooker: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('cooker')).toBe(cooker);
    const def = ITEMS.cooker;
    expect(def).toMatchObject({ id: 'cooker', family: 'kitchen', kind: 'weapon', price: 18, electrical: false });
    expect(def.element).toBe('heat');
    expect(def.tags).toEqual(['area']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1}, {x: 2, y: 1}]);
    expect(def.weapon).toEqual({ pattern: 'mortar', damage: 16, cooldown: 2.6, range: 420, projectileSpeed: 380, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 90 });
  });

  it('keeps its position in the item order', () => {
    expect(around('cooker', 1, 1)).toEqual(['snackbag', 'cooker', 'spray']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('cooker', t))).toEqual([
      'Every 2.6 s lobs a pot at the densest group within 420. It explodes for 16 damage to everything within 90, with knockback.',
      'Every 2.34 s lobs a pot at the densest group within 420. It explodes for 24 damage to everything within 90, with knockback.',
      'Every 2.08 s lobs a pot at the densest group within 420. It explodes for 32 damage to everything within 90, with knockback.',
    ]);
    expect(itemT('cooker')).toMatchObject({ name: 'Pressure Cooker', blurb: 'Lobs a whistling pot. KABOOM.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('cooker', t))).toEqual(['Schleudert alle 2,6 s einen Topf auf die dichteste Gruppe im Umkreis von 420. Er explodiert und macht 16 Schaden an allem im Umkreis von 90, mit Rückstoß.', 'Schleudert alle 2,08 s einen Topf auf die dichteste Gruppe im Umkreis von 420. Er explodiert und macht 32 Schaden an allem im Umkreis von 90, mit Rückstoß.']);
    expect(itemT('cooker')).toMatchObject({ name: 'Schnellkochtopf', blurb: 'Schleudert einen pfeifenden Topf. KABUMM.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('cooker')).toEqual([
      { label: 'Damage', values: ['16', '24', '32'] },
      { label: 'Interval', values: ['2.6 s', '2.34 s', '2.08 s'] },
    ]);
    setLang('de');
    expect(tierScaling('cooker')).toEqual([
      { label: 'Schaden', values: ['16', '24', '32'] },
      { label: 'Intervall', values: ['2,6 s', '2,34 s', '2,08 s'] },
    ]);
  });
});

describe('Pressure Cooker: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.cooker.weapon!;
    const tune = contentItem('cooker')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('cooker', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('cooker', t)]).damage)).toEqual([16.0, 24.0, 32.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('cooker')])).toMatchObject({ pattern: 'mortar', range: 420, projectileSpeed: 380, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 90 });
  });
});

describe('Pressure Cooker: pattern mortar', () => {
  const cluster = (fake: ReturnType<typeof arsenal>['fake']) => ({
    lone: fake.spawnEnemy({ x: 100, hp: 1000 }),
    c1: fake.spawnEnemy({ x: 300, y: 100, hp: 1000 }),
    c2: fake.spawnEnemy({ x: 330, y: 100, hp: 1000 }),
    c3: fake.spawnEnemy({ x: 300, y: 140, hp: 1000 }),
  });

  it('lobs one pot at the densest group within 420: from the nose of the cart to the first enemy with the most neighbours in 90', () => {
    const { a, fake } = arsenal([at('cooker', 3)]);
    const { c1 } = cluster(fake);
    a.step(0.5);
    expect(a.pots).toHaveLength(1);
    const pot = a.pots[0];
    expect([pot.sx, pot.sy, pot.tx, pot.ty]).toEqual([18, 0, c1.x, c1.y]);
    expect(pot.dur).toBe(Math.max(0.35, Math.hypot(300 - 18, 100) / 380));
    expect(a.sprites.map((s) => s.key)).toEqual(['proj_pot', 'shadow']);
    expect(fake.callsOf('sound').map((c) => [c.name, c.opts])).toEqual([['whistle', { volume: 0.35 }]]);
    expect(fake.callsOf('fx').find((c) => c.method === 'ring')!.args.slice(0, 5)).toEqual(['fx_pulse', 300, 100, 180, 500]);
    expect(a.recoils).toHaveLength(1);
  });

  it('explodes on landing: 32 damage to everything within 90 + radius with a push of 220 away from the center, nothing outside', () => {
    const { a, fake } = arsenal([at('cooker', 3)]);
    const { lone, c1, c2, c3 } = cluster(fake);
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0); // nothing until it lands
    a.run(40, 0.05);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([c1.id, c2.id, c3.id]);
    expect(hits.every((c) => c.dmg === 32)).toBe(true);
    expect(hits[0].opts).toEqual({ kb: 220, kbX: 0, kbY: 0, tags: ['blast'] });
    expect(hits[1].opts).toMatchObject({ kb: 220, kbX: 1, kbY: 0 });
    expect(hits.some((c) => c.enemy === lone.id)).toBe(false);
    expect(a.pots).toHaveLength(0);
    expect(fake.callsOf('sound').map((c) => c.name)).toEqual(['whistle', 'boom']);
    expect(fake.callsOf('fx').map((c) => c.method)).toEqual(expect.arrayContaining(['ring', 'puff', 'crumbsAt', 'shake']));
  });

  it('flies for dist / 380 s (at least 0.35 s) along a straight shadow with an arc over it', () => {
    const { a, fake } = arsenal([at('cooker', 3)]);
    fake.spawnEnemy({ x: 118, hp: 1000 }); // 100 px from the nose: the minimum flight
    a.weapons[0].cd = 0.05;
    a.step(0.05);
    expect(a.pots[0].dur).toBe(0.35);
    a.step(0.125);
    expect(a.pots[0].t).toBeCloseTo(0.175);
    expect((a.pots[0].shadow as StubSprite).x).toBeCloseTo(18 + (118 - 18) * 0.5);
    expect((a.pots[0].img as StubSprite).y).toBeCloseTo(-30 - (60 + 0.35 * 120));
  });

  it('ignores what is beyond 420, and lobs nothing without a target', () => {
    const { a, fake } = arsenal([at('cooker', 3)]);
    fake.spawnEnemy({ x: 430, hp: 1000 });
    a.step(0.5);
    expect(a.pots).toHaveLength(0);
    expect(a.weapons[0].cd).toBe(0.05);
  });

  it('Multipack lobs a second pot, 0.18 s later', () => {
    const { a, fake } = arsenal([at('cooker', 3), at('multipack', 1)]);
    cluster(fake);
    a.step(0.5);
    expect(a.pots).toHaveLength(1);
    fake.advance(0.2);
    expect(a.pots).toHaveLength(2);
  });

  it('explodeAt is also the entry point for Pot Slam: it explodes the given weapon\'s numbers at any spot', () => {
    const { a, fake } = arsenal([at('cooker', 3)]);
    const e = fake.spawnEnemy({ x: 500, y: 300, hp: 1000 });
    explodeAt(a, 500, 300, a.weapons[0].stats);
    expect(fake.callsOf('damage')).toHaveLength(1);
    expect(fake.callsOf('damage')[0]).toMatchObject({ enemy: e.id, dmg: 32 });
  });
});
