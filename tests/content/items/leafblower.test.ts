import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import leafblower from '../../../src/content/items/leafblower';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Cone: a blast toward the nearest enemy, every enemy in it once (engine/patterns/cone.ts). The leaf blower's push (300), sprite (fx_gust) and slam damage come from its content; the spray bottle shares the pattern.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Leaf Blower: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('leafblower')).toBe(leafblower);
    const def = ITEMS.leafblower;
    expect(def).toMatchObject({ id: 'leafblower', family: 'cleaning', kind: 'weapon', price: 14, electrical: false });
    expect(def.element).toBeUndefined();
    expect(def.tags).toEqual(['area']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 1, y: 0}]);
    expect(def.weapon).toEqual({ pattern: 'cone', damage: 3, cooldown: 0.9, range: 220, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 50, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0, knockback: 300, fx: 'fx_gust' });
  });

  it('keeps its position in the item order', () => {
    expect(around('leafblower', 1, 1)).toEqual(['jellybeans', 'leafblower', 'sourdough']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('leafblower', t))).toEqual([
      'Every 0.9 s blasts a 50° cone (220 reach) for 3 damage and a heavy push. Blown groceries that hit a wall or prop take 8 slam damage (scales with level).',
      'Every 0.81 s blasts a 50° cone (220 reach) for 4.5 damage and a heavy push. Blown groceries that hit a wall or prop take 8 slam damage (scales with level).',
      'Every 0.72 s blasts a 50° cone (220 reach) for 6 damage and a heavy push. Blown groceries that hit a wall or prop take 8 slam damage (scales with level).',
    ]);
    expect(itemT('leafblower')).toMatchObject({ name: 'Leaf Blower', blurb: 'Huff and puff. Slams groceries into things.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('leafblower', t))).toEqual(['Bläst alle 0,9 s einen 50°-Kegel (220 Reichweite) für 3 Schaden und einen kräftigen Stoß. Weggeblasene Gegner, die gegen eine Wand oder Deko prallen, erleiden 8 Aufprallschaden (skaliert mit der Stufe).', 'Bläst alle 0,72 s einen 50°-Kegel (220 Reichweite) für 6 Schaden und einen kräftigen Stoß. Weggeblasene Gegner, die gegen eine Wand oder Deko prallen, erleiden 8 Aufprallschaden (skaliert mit der Stufe).']);
    expect(itemT('leafblower')).toMatchObject({ name: 'Laubbläser', blurb: 'Puff puff. Schleudert Gegner gegen Sachen.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('leafblower')).toEqual([
      { label: 'Damage', values: ['3', '4.5', '6'] },
      { label: 'Interval', values: ['0.9 s', '0.81 s', '0.72 s'] },
    ]);
    setLang('de');
    expect(tierScaling('leafblower')).toEqual([
      { label: 'Schaden', values: ['3', '4,5', '6'] },
      { label: 'Intervall', values: ['0,9 s', '0,81 s', '0,72 s'] },
    ]);
  });
});

describe('Leaf Blower: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.leafblower.weapon!;
    const tune = contentItem('leafblower')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('leafblower', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('leafblower', t)]).damage)).toEqual([3.0, 4.5, 6.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('leafblower')])).toMatchObject({ pattern: 'cone', range: 220, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 50, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

describe('Leaf Blower: pattern cone', () => {
  it('blasts a 50° cone at the nearest enemy: a heavy push of 300, quiet, with slam damage 8 x the tier multiplier', () => {
    const { a, fake } = arsenal([at('leafblower', 3)]);
    const aimed = fake.spawnEnemy({ x: 100, hp: 1000 });
    const inside = fake.spawnEnemy({ x: 150 * Math.cos(0.4), y: 150 * Math.sin(0.4), hp: 1000 });   // 22.9° of 25
    const outside = fake.spawnEnemy({ x: 150 * Math.cos(0.5), y: 150 * Math.sin(0.5), hp: 1000 });  // 28.6°
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([aimed.id, inside.id]);
    expect(hits.some((c) => c.enemy === outside.id)).toBe(false);
    expect(hits[0]).toMatchObject({ dmg: 6, opts: { kb: 300, kbX: 1, kbY: 0, quiet: true, blow: 16 } });
    expect(a.sounds).toEqual(['spray']);
  });

  it('the slam damage scales with the weapon tier: 8 / 12 / 16', () => {
    const blows = [1, 2, 3].map((t) => {
      const { a, fake } = arsenal([at('leafblower', t)]);
      fake.spawnEnemy({ x: 200, hp: 1000 });
      a.step(0.5);
      return fake.callsOf('damage')[0].opts.blow;
    });
    expect(blows).toEqual([8, 12, 16]);
  });

  it('draws the gust sprite (not the spray) at the nose, sized to the cone', () => {
    const { a, fake } = arsenal([at('leafblower', 3)]);
    fake.spawnEnemy({ x: 200, hp: 1000 });
    a.step(0.5);
    const gust = a.sprites[0];
    expect(gust.key).toBe('fx_gust');
    expect(gust.log).toContain('setOrigin(0,0.5)');
    expect(a.tweens[0]).toMatchObject({ displayWidth: 220 * 1.05, alpha: 0, duration: 260 });
  });

  it('fires only for an enemy inside 220, but aims at the nearest one up to 40 farther', () => {
    const { a, fake } = arsenal([at('leafblower', 3)]);
    fake.spawnEnemy({ x: 230, hp: 1000 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0);
    fake.enemies[0].x = 215;
    a.step(0.05);
    expect(fake.callsOf('damage')).toHaveLength(1);
  });

  it('Multipack blasts a second time, 0.18 s later', () => {
    const { a, fake } = arsenal([at('leafblower', 3), at('multipack', 1)]);
    fake.spawnEnemy({ x: 200, hp: 100000 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(1);
    fake.advance(0.2);
    expect(fake.callsOf('damage')).toHaveLength(2);
  });

  it('Duct Tape widens the cone (+60° at ★3)', () => {
    const wide = { x: 150 * Math.cos(0.9), y: 150 * Math.sin(0.9), hp: 1000 }; // 51.6°
    const plain = arsenal([at('leafblower', 3)]);
    plain.fake.spawnEnemy({ x: 100, hp: 1000 });
    const p = plain.fake.spawnEnemy(wide);
    plain.a.step(0.5);
    expect(plain.fake.callsOf('damage').some((c) => c.enemy === p.id)).toBe(false);
    const taped = arsenal([at('leafblower', 3), at('tape', 3)]);
    taped.fake.spawnEnemy({ x: 100, hp: 1000 });
    const t = taped.fake.spawnEnemy(wide);
    taped.a.step(0.5);
    expect(taped.fake.callsOf('damage').some((c) => c.enemy === t.id)).toBe(true);
  });
});
