import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import toaster from '../../../src/content/items/toaster';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { degToRad } from '../../../src/engine/patterns';
import { arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Toast: a volley of `count` toasts toward the nearest enemy (engine/patterns/toast.ts). Toast Mode's look and flames are in tests/content/combos/toastMode.test.ts.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Toaster: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('toaster')).toBe(toaster);
    const def = ITEMS.toaster;
    expect(def).toMatchObject({ id: 'toaster', family: 'kitchen', kind: 'weapon', price: 12, electrical: true });
    expect(def.element).toBe('heat');
    expect(def.tags).toEqual(['ranged']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 1, y: 0}]);
    expect(def.weapon).toEqual({ pattern: 'toast', damage: 9, cooldown: 1, range: 455, projectileSpeed: 540, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(Object.keys(ITEMS).slice(0, 2)).toEqual(['toaster', 'pan']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('toaster', t))).toEqual([
      'Fires toast for 9 damage every 1 s. 455 range. Each toast hits one enemy.',
      'Fires toast for 13.5 damage every 0.9 s. 455 range. Each toast hits one enemy.',
      'Fires toast for 18 damage every 0.8 s. 455 range. Each toast hits one enemy. ★3: Also fires a toast at a second enemy.',
    ]);
    expect(itemT('toaster')).toMatchObject({ name: 'Toaster', blurb: 'Lobs hot toast at the nearest grocery.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('toaster', t))).toEqual(['Feuert alle 1 s Toast für 9 Schaden. 455 Reichweite. Jeder Toast trifft einen Gegner.', 'Feuert alle 0,8 s Toast für 18 Schaden. 455 Reichweite. Jeder Toast trifft einen Gegner. ★3: Feuert zusätzlich einen Toast auf einen zweiten Gegner.']);
    expect(itemT('toaster')).toMatchObject({ name: 'Toaster', blurb: 'Schleudert heißen Toast auf den nächsten Gegner.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('toaster')).toEqual([
      { label: 'Damage', values: ['9', '13.5', '18'] },
      { label: 'Interval', values: ['1 s', '0.9 s', '0.8 s'] },
    ]);
    setLang('de');
    expect(tierScaling('toaster')).toEqual([
      { label: 'Schaden', values: ['9', '13,5', '18'] },
      { label: 'Intervall', values: ['1 s', '0,9 s', '0,8 s'] },
    ]);
  });
});

describe('Toaster: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.toaster.weapon!;
    const tune = contentItem('toaster')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('toaster', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('toaster', t)]).damage)).toEqual([9.0, 13.5, 18.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('toaster')])).toMatchObject({ pattern: 'toast', range: 455, projectileSpeed: 540, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

// The goblin stands at (100, 400): projectiles that leave the arena (y < 140 ...) are removed, so the shots need room.
const P = { player: { x: 100, y: 400 } };

describe('Toaster: pattern toast', () => {
  it('lobs one toast from the nose of the cart at the nearest enemy, one ★3 interval apart', () => {
    const { a, fake, b } = arsenal([at('toaster', 3)], P);
    fake.spawnEnemy({ x: 400, y: 460, hp: 1000 });
    fake.spawnEnemy({ x: 500, y: 380, hp: 1000 });
    a.run(60, 0.02);
    const [s1, , s2] = a.spawned; // the middle one is the ★3 toast at the second enemy
    expect(s1).toMatchObject({ key: 'proj_toast', x: 118, y: 400, speed: 540, damage: 18, maxHits: 1 });
    expect(s1.angle).toBe(Math.atan2(60, 300 - 18));
    expect(s1.life).toBe(455 / 540);
    expect(s1.stats).toBe(b.weapons[0]);
    expect(Math.abs(s2.at - s1.at - 0.8)).toBeLessThan(0.03);
    expect(a.sounds.slice(0, 2)).toEqual(['toast_pop@1', 'toast_pop@1']);
    expect(a.recoils[0]).toBe(b.weapons[0].uid);
  });

  it('from ★3 a volley also throws one toast at the nearest other enemy in range; ★2 throws only at the nearest', () => {
    const volley = (tier: number) => {
      const { a, fake } = arsenal([at('toaster', tier)], P);
      fake.spawnEnemy({ x: 300, y: 400, hp: 1000 });
      fake.spawnEnemy({ x: 500, y: 500, hp: 1000 });
      fake.spawnEnemy({ x: 350, y: 250, hp: 1000 });
      a.run(25, 0.02);
      return a.spawned.filter((s) => s.at === a.spawned[0].at);
    };
    const toNearest = Math.atan2(0, 300 - 118), toSecond = Math.atan2(250 - 400, 350 - 118);
    expect(volley(2).map((s) => s.angle)).toEqual([toNearest]);
    expect(volley(3).map((s) => s.angle)).toEqual([toNearest, toSecond]);
    expect(volley(3)[1]).toMatchObject({ key: 'proj_toast', damage: 18, maxHits: 1 });
    expect(volley(4).map((s) => s.angle)).toEqual([toNearest, toSecond]);
  });

  it('the ★3 second toast needs a second enemy inside the range', () => {
    const { a, fake } = arsenal([at('toaster', 3)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    fake.spawnEnemy({ x: 580, y: 400, hp: 1000 });
    a.run(25, 0.02);
    expect(a.spawned).toHaveLength(1);
  });

  it('only shoots at what is inside the 455 range (measured from the goblin)', () => {
    const { a, fake } = arsenal([at('toaster', 3)], P);
    fake.spawnEnemy({ x: 570, y: 400, hp: 1000 });
    a.run(30, 0.05);
    expect(a.spawned).toHaveLength(0);
    fake.enemies[0].x = 550;
    a.step(0.05);
    expect(a.spawned).toHaveLength(1);
  });

  it('flies at 540 px/s for range / speed seconds and hits one enemy (pierce 0), more with Duct Tape', () => {
    const plain = arsenal([at('toaster', 3)], P);
    plain.fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    plain.a.run(12, 0.05);
    expect(plain.a.spawned[0].maxHits).toBe(1);
    const taped = arsenal([at('toaster', 3), at('tape', 3)], P);
    taped.fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    taped.a.run(12, 0.05);
    expect(taped.a.spawned[0].maxHits).toBe(3);
  });

  it('a toast that reaches its enemy deals the ★3 damage with a push of 60 along its heading', () => {
    const { a, fake } = arsenal([at('toaster', 3)], P);
    const e = fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.run(60, 0.02);
    const [hit] = fake.callsOf('damage');
    expect(hit).toMatchObject({ enemy: e.id, dmg: 18, opts: { kb: 60, kbX: 1, kbY: 0 } });
  });

  it('Multipack adds toasts to the volley, fanned 12° apart around the aim when no recipe set a spread', () => {
    const { a, fake, b } = arsenal([at('toaster', 3), at('multipack', 1)], P);
    const st = b.weapons[0];
    expect(st.count).toBe(2);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.run(25, 0.02);
    const [s1, s2] = a.spawned;
    expect(s1.at).toBe(s2.at);
    const aim = Math.atan2(0, 300 - 18), spread = degToRad(st.spreadDeg || 12);
    expect([s1.angle, s2.angle]).toEqual([aim + (0 - 0.5) * spread, aim + (1 - 0.5) * spread]);
    expect(a.sounds.filter((s) => s === 'toast_pop@1')).toHaveLength(1); // one pop per volley
  });

  it('the pop plays at rate 1 without a look (Toast Mode restyles it to 0.85)', () => {
    const { a, fake } = arsenal([at('toaster', 3)], P);
    fake.spawnEnemy({ x: 400, y: 400, hp: 1000 });
    a.run(25, 0.02);
    expect(a.looks.size).toBe(0);
    expect(a.sounds[0]).toBe('toast_pop@1');
    expect(a.fake.callsOf('sound')[0].opts).toEqual({ rate: 1 });
  });
});
