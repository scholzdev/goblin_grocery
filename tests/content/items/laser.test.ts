import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import laser from '../../../src/content/items/laser';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { beamOnce } from '../../../src/engine/patterns';
import { around, arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Laser: one barcode beam down the best line, every enemy on it once (engine/patterns/laser.ts). Legendary: ★1 only, no tier scaling.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Self-Checkout Laser: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('laser')).toBe(laser);
    const def = ITEMS.laser;
    expect(def).toMatchObject({ id: 'laser', family: 'checkout', kind: 'weapon', price: 40, electrical: true });
    expect(def.element).toBeUndefined();
    expect(def.tags).toEqual(['ranged']);
    expect(def.legendary).toBe(true);
    expect(def.cells).toEqual([{x: 1, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}, {x: 2, y: 1}, {x: 1, y: 2}]);
    expect(def.weapon).toEqual({ pattern: 'laser', damage: 20, cooldown: 1.6, range: 620, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('laser', 1, 1)).toEqual(['goldstar', 'laser', 'snackbag']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('laser', t))).toEqual([
      'Every 1.6 s fires a barcode beam (620 long) that hits every enemy in the line once for 20 damage. Electrical.',
      'Every 1.6 s fires a barcode beam (620 long) that hits every enemy in the line once for 20 damage. Electrical.',
      'Every 1.6 s fires a barcode beam (620 long) that hits every enemy in the line once for 20 damage. Electrical.',
    ]);
    expect(itemT('laser')).toMatchObject({ name: 'Self-Checkout Laser', blurb: 'Unexpected item in the bagging area. ZAP.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('laser', t))).toEqual(['Feuert alle 1,6 s einen Barcode-Strahl (620 lang), der jeden Gegner auf der Linie einmal für 20 Schaden trifft. Elektrisch.', 'Feuert alle 1,6 s einen Barcode-Strahl (620 lang), der jeden Gegner auf der Linie einmal für 20 Schaden trifft. Elektrisch.']);
    expect(itemT('laser')).toMatchObject({ name: 'Selbstscan-Laser', blurb: 'Unerwarteter Artikel im Gepäckbereich. ZACK.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('laser')).toEqual([]); // a legendary has no ★ rows
    expect([1, 2, 3].map((t) => itemRules('laser', t))).toEqual([itemRules('laser', 1), itemRules('laser', 1), itemRules('laser', 1)]);
  });
});

describe('Self-Checkout Laser: build', () => {
  it('is a legendary: no ★ scaling, the base damage and interval at every tier', () => {
    const base = ITEMS.laser.weapon!;
    const w = stats([at('laser')]);
    expect(w).toMatchObject({ pattern: 'laser', damage: 20, cooldown: 1.6, range: 620 });
    expect(contentItem('laser')!.tune).toEqual({ damage: 20, cooldown: 1.6, range: 620 });
    expect(w.damage).toBe(base.damage);
  });
});

describe('Self-Checkout Laser: pattern laser', () => {
  it('hits every enemy on the line once for 20 with a push of 70 along the beam, none off it or beyond 620', () => {
    const { a, fake } = arsenal([at('laser')]);
    const e1 = fake.spawnEnemy({ x: 200, hp: 1000 });
    const e2 = fake.spawnEnemy({ x: 400, y: 10, hp: 1000 });
    const e3 = fake.spawnEnemy({ x: 600, y: -5, hp: 1000 });
    const off = fake.spawnEnemy({ x: 300, y: 120, hp: 1000 });
    const beyond = fake.spawnEnemy({ x: 700, hp: 1000 });
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([e1.id, e2.id, e3.id]);
    expect(hits.every((c) => c.dmg === 20 && c.opts.kb === 70)).toBe(true);
    expect(hits[0].opts).toMatchObject({ kbX: 1, kbY: 0 });
    expect([off, beyond].some((e) => hits.some((c) => c.enemy === e.id))).toBe(false);
    expect(fake.callsOf('sound').map((c) => [c.name, c.opts])).toEqual([['zap', { rate: 1.5 }]]);
  });

  it('draws the beam sprite 620 long and 34 wide at the nose, then thins it out', () => {
    const { a, fake } = arsenal([at('laser')]);
    fake.spawnEnemy({ x: 200, hp: 1000 });
    a.step(0.5);
    expect(a.sprites[0].key).toBe('fx_laser');
    expect(a.sprites[0].log).toContain('setDisplaySize(620,34)');
    expect(a.tweens[0]).toMatchObject({ displayHeight: 4, alpha: 0, duration: 260 });
  });

  it('aims down the line that crosses the most groceries, not just at the nearest one', () => {
    const { a, fake } = arsenal([at('laser')]);
    const th = -0.3, c = Math.cos(th), s = Math.sin(th);
    const lonely = fake.spawnEnemy({ x: 118, y: 150, hp: 1000 }); // the nearest, alone on its line
    const l1 = fake.spawnEnemy({ x: 18 + 300 * c, y: 300 * s, hp: 1000 });
    const l2 = fake.spawnEnemy({ x: 18 + 500 * c, y: 500 * s, hp: 1000 });
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits.map((h) => h.enemy)).toEqual([l1.id, l2.id]);
    expect(hits.some((h) => h.enemy === lonely.id)).toBe(false);
    expect(hits[0].opts.kbX).toBeCloseTo(c);
    expect(hits[0].opts.kbY).toBeCloseTo(s);
  });

  it('on a tie the nearest target\'s line wins', () => {
    const { a, fake } = arsenal([at('laser')]);
    const nearest = fake.spawnEnemy({ x: 100, y: 100, hp: 1000 });
    const other = fake.spawnEnemy({ x: 300, y: -100, hp: 1000 });
    a.step(0.5);
    expect(fake.callsOf('damage').map((c) => c.enemy)).toEqual([nearest.id]);
    expect(other.hp).toBe(1000);
  });

  it('an echo (Power Surge\'s aftershock) is lighter on the push and pitched higher', () => {
    const { a, fake } = arsenal([at('laser')]);
    const e = fake.spawnEnemy({ x: 200, hp: 1000 });
    beamOnce(a, a.weapons[0], e, true);
    expect(fake.callsOf('damage')[0].opts.kb).toBe(20);
    expect(fake.callsOf('sound').map((c) => c.opts)).toEqual([{ rate: 1.8 }]);
  });

  it('is electrical: the department rate speeds its cooldown up (a legendary has no ★ scaling, so it is 1.6 s)', () => {
    const { a } = arsenal([at('laser')]);
    expect(a.weapons[0].electrical).toBe(true);
    expect(a.weapons[0].stats.cooldown).toBe(1.6);
    expect(a.weapons[0].tune).toEqual({ damage: 20, cooldown: 1.6, range: 620 });
  });
});
