import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import spray from '../../../src/content/items/spray';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Cone: the same pattern as the Leaf Blower with the spray's own numbers (engine/patterns/cone.ts): a wider cone, a light push (40), the spray sprite, no slam.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Spray Bottle: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('spray')).toBe(spray);
    const def = ITEMS.spray;
    expect(def).toMatchObject({ id: 'spray', family: 'cleaning', kind: 'weapon', price: 12, electrical: false });
    expect(def.element).toBe('frost');
    expect(def.tags).toEqual(['melee']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 0, y: 1}]);
    expect(def.weapon).toEqual({ pattern: 'cone', damage: 3, cooldown: 0.55, range: 170, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 70, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('spray', 1, 1)).toEqual(['cooker', 'spray', 'popper']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('spray', t))).toEqual([
      'Every 0.55 s sprays a 70° cone (170 reach) for 3 damage to every enemy inside (each once per spray).',
      'Every 0.5 s sprays a 70° cone (170 reach) for 4.5 damage to every enemy inside (each once per spray).',
      'Every 0.44 s sprays a 70° cone (170 reach) for 6 damage to every enemy inside (each once per spray).',
    ]);
    expect(itemT('spray')).toMatchObject({ name: 'Spray Bottle', blurb: 'Pssht pssht pssht. Hits everything in front.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('spray', t))).toEqual(['Sprüht alle 0,55 s einen 70°-Kegel (170 Reichweite) und macht 3 Schaden an jedem Gegner darin (je einmal pro Sprühstoß).', 'Sprüht alle 0,44 s einen 70°-Kegel (170 Reichweite) und macht 6 Schaden an jedem Gegner darin (je einmal pro Sprühstoß).']);
    expect(itemT('spray')).toMatchObject({ name: 'Sprühflasche', blurb: 'Pssht pssht pssht. Trifft alles davor.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('spray')).toEqual([
      { label: 'Damage', values: ['3', '4.5', '6'] },
      { label: 'Interval', values: ['0.55 s', '0.5 s', '0.44 s'] },
    ]);
    setLang('de');
    expect(tierScaling('spray')).toEqual([
      { label: 'Schaden', values: ['3', '4,5', '6'] },
      { label: 'Intervall', values: ['0,55 s', '0,5 s', '0,44 s'] },
    ]);
  });
});

describe('Spray Bottle: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.spray.weapon!;
    const tune = contentItem('spray')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('spray', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('spray', t)]).damage)).toEqual([3.0, 4.5, 6.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('spray')])).toMatchObject({ pattern: 'cone', range: 170, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 70, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

describe('Spray Bottle: pattern cone', () => {
  it('sprays a 70° cone at the nearest enemy: every enemy inside once, a light quiet push of 40, no slam damage', () => {
    const { a, fake } = arsenal([at('spray', 3)]);
    const aimed = fake.spawnEnemy({ x: 100, hp: 1000 });
    const inside = fake.spawnEnemy({ x: 120 * Math.cos(0.58), y: 120 * Math.sin(0.58), hp: 1000 });   // 33.2° of 35
    const outside = fake.spawnEnemy({ x: 120 * Math.cos(0.66), y: 120 * Math.sin(0.66), hp: 1000 });  // 37.8°
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([aimed.id, inside.id]);
    expect(hits.some((c) => c.enemy === outside.id)).toBe(false);
    expect(hits[0]).toMatchObject({ dmg: 6, opts: { kb: 40, kbX: 1, kbY: 0, quiet: true } });
    expect(hits[0].opts.blow).toBeUndefined();
    expect(a.sounds).toEqual(['spray']);
  });

  it('draws the spray sprite, not the gust', () => {
    const { a, fake } = arsenal([at('spray', 3)]);
    fake.spawnEnemy({ x: 100, hp: 1000 });
    a.step(0.5);
    expect(a.sprites[0].key).toBe('fx_spray');
    expect(a.tweens[0]).toMatchObject({ displayWidth: 170 * 1.05 });
  });

  it('cools down in 0.44 s at ★3 and reaches 170 + radius', () => {
    const { a, fake } = arsenal([at('spray', 3)]);
    const trigger = fake.spawnEnemy({ x: 160, hp: 100000 }); // inside 170: the spray fires
    const reach = fake.spawnEnemy({ x: 188, hp: 100000 });   // beyond 170, inside 170 + radius: still caught
    a.run(40, 0.05);
    const hits = fake.callsOf('damage');
    expect(hits.filter((c) => c.enemy === reach.id).length).toBe(hits.filter((c) => c.enemy === trigger.id).length);
    const mine = hits.filter((c) => c.enemy === trigger.id);
    expect(mine.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(mine[1].at - mine[0].at - 0.44)).toBeLessThan(0.06);
  });
});
