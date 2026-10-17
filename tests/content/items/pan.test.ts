import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import pan from '../../../src/content/items/pan';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, stats } from '../helpers';

afterEach(() => setLang('en'));

// Sweep: an arc toward the nearest enemy, every enemy in it once per swing (engine/patterns/sweep.ts).
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Frying Pan: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('pan')).toBe(pan);
    const def = ITEMS.pan;
    expect(def).toMatchObject({ id: 'pan', family: 'kitchen', kind: 'weapon', price: 10, electrical: false });
    expect(def.element).toBe('heat');
    expect(def.tags).toEqual(['melee']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 0, y: 1}, {x: 0, y: 2}]);
    expect(def.weapon).toEqual({ pattern: 'sweep', damage: 9, cooldown: 1.15, range: 150, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 150, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('pan', 1, 1)).toEqual(['toaster', 'pan', 'nailgun']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('pan', t))).toEqual([
      'Sweeps toward nearby enemies for 9 damage every 1.15 s. 150 reach. Hits each enemy once per swing.',
      'Sweeps toward nearby enemies for 13.5 damage every 1.03 s. 150 reach. Hits each enemy once per swing.',
      'Sweeps toward nearby enemies for 18 damage every 0.92 s. 150 reach. Hits each enemy once per swing.',
    ]);
    expect(itemT('pan')).toMatchObject({ name: 'Frying Pan', blurb: 'Big clangy sweep around the cart.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('pan', t))).toEqual(['Schwingt alle 1,15 s auf Gegner in der Nähe für 9 Schaden. 150 Reichweite. Trifft jeden Gegner einmal pro Schwung.', 'Schwingt alle 0,92 s auf Gegner in der Nähe für 18 Schaden. 150 Reichweite. Trifft jeden Gegner einmal pro Schwung.']);
    expect(itemT('pan')).toMatchObject({ name: 'Bratpfanne', blurb: 'Großer, scheppernder Schwung um den Wagen.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('pan')).toEqual([
      { label: 'Damage', values: ['9', '13.5', '18'] },
      { label: 'Interval', values: ['1.15 s', '1.03 s', '0.92 s'] },
    ]);
    setLang('de');
    expect(tierScaling('pan')).toEqual([
      { label: 'Schaden', values: ['9', '13,5', '18'] },
      { label: 'Intervall', values: ['1,15 s', '1,03 s', '0,92 s'] },
    ]);
  });
});

describe('Frying Pan: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.pan.weapon!;
    const tune = contentItem('pan')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('pan', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('pan', t)]).damage)).toEqual([9.0, 13.5, 18.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('pan')])).toMatchObject({ pattern: 'sweep', range: 150, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 150, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

describe('Frying Pan: pattern sweep', () => {
  it('swings at the nearest enemy: hits what is in the 150° arc and the reach, once, with a push of 150', () => {
    const { a, fake } = arsenal([at('pan', 3)]);
    const near = fake.spawnEnemy({ x: 100, hp: 1000 });
    const behind = fake.spawnEnemy({ x: -100, hp: 1000 });
    const far = fake.spawnEnemy({ x: 200, y: 20, hp: 1000 });
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ enemy: near.id, dmg: 18, source: 'u0', opts: { kb: 150, kbX: 1, kbY: 0 } });
    expect([behind, far].every((e) => !hits.some((h) => h.enemy === e.id))).toBe(true);
    expect(a.sounds).toEqual(['pan_clang@1']);
    expect(a.sprites.map((s) => s.key)).toEqual(['fx_sweep']);
  });

  it('the arc is 150° (±75° around the aim); an enemy beyond reach (150 + its radius) is safe', () => {
    const { a, fake } = arsenal([at('pan', 3)]);
    const aimed = fake.spawnEnemy({ x: 100, hp: 1000 });
    const inside = fake.spawnEnemy({ x: 120 * Math.cos(1.29), y: 120 * Math.sin(1.29), hp: 1000 }); // 73.9°
    const outside = fake.spawnEnemy({ x: 120 * Math.cos(1.33), y: 120 * Math.sin(1.33), hp: 1000 }); // 76.2°
    const tooFar = fake.spawnEnemy({ x: 171, hp: 1000 });
    a.step(0.5);
    const ids = fake.callsOf('damage').map((c) => c.enemy);
    expect(ids).toEqual([aimed.id, inside.id]);
    expect(ids).not.toContain(outside.id);
    expect(ids).not.toContain(tooFar.id);
  });

  it('Duct Tape widens the arc (+60° at ★3) so the same enemy at 100° is caught', () => {
    const at100 = { x: 120 * Math.cos(1.75), y: 120 * Math.sin(1.75), hp: 1000 };
    const plain = arsenal([at('pan', 3)]);
    plain.fake.spawnEnemy({ x: 100, hp: 1000 });
    const p100 = plain.fake.spawnEnemy(at100);
    plain.a.step(0.5);
    expect(plain.fake.callsOf('damage').some((c) => c.enemy === p100.id)).toBe(false);
    const taped = arsenal([at('pan', 3), at('tape', 3)]);
    taped.fake.spawnEnemy({ x: 100, hp: 1000 });
    const t100 = taped.fake.spawnEnemy(at100);
    taped.a.step(0.5);
    expect(taped.fake.callsOf('damage').some((c) => c.enemy === t100.id)).toBe(true);
  });

  it('Multipack swings once more, 0.18 s later, while the aisle is fought', () => {
    const { a, fake } = arsenal([at('pan', 3), at('multipack', 1)]);
    fake.spawnEnemy({ x: 100, hp: 1000 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(1);
    fake.advance(0.2);
    expect(fake.callsOf('damage')).toHaveLength(2);
    expect(a.sounds).toEqual(['pan_clang@1', 'pan_clang@1']);
  });

  it('with nobody in reach it does not swing: the cooldown retries every 0.05 s', () => {
    const { a, fake } = arsenal([at('pan', 3)]);
    fake.spawnEnemy({ x: 400, hp: 1000 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0);
    expect(a.weapons[0].cd).toBe(0.05);
  });
});
