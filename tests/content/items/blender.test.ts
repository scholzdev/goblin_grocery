import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import blender from '../../../src/content/items/blender';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import type { StubSprite } from '../../../src/engine/patterns/fakeHost';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, setTuneAt, stats } from '../helpers';

afterEach(() => setLang('en'));

// Aura: every tick each enemy inside the radius is hit once, quietly (engine/patterns/aura.ts); the blade ring spins while fighting.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Blender: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('blender')).toBe(blender);
    const def = ITEMS.blender;
    expect(def).toMatchObject({ id: 'blender', family: 'kitchen', kind: 'weapon', price: 15, electrical: true });
    expect(def.element).toBeUndefined();
    expect(def.tags).toEqual(['melee', 'area']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 0, y: 1}]);
    expect(def.weapon).toEqual({ pattern: 'aura', damage: 5, cooldown: 0.3, range: 100, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('blender', 1, 1)).toEqual(['microwave', 'blender', 'fizz']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('blender', t))).toEqual([
      'Shreds every enemy within 100 for 5 damage every 0.3 s (each enemy once per tick). Electrical.',
      'Shreds every enemy within 100 for 7.5 damage every 0.27 s (each enemy once per tick). Electrical.',
      'Shreds every enemy within 100 for 10 damage every 0.24 s (each enemy once per tick). Electrical. ★3: The blades pull enemies in instead of pushing them away.',
    ]);
    expect(itemT('blender')).toMatchObject({ name: 'Blender', blurb: 'Whirring blades around the cart.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('blender', t))).toEqual(['Schreddert alle 0,3 s jeden Gegner im Umkreis von 100 für 5 Schaden (jeden Gegner einmal pro Tick). Elektrisch.', 'Schreddert alle 0,24 s jeden Gegner im Umkreis von 100 für 10 Schaden (jeden Gegner einmal pro Tick). Elektrisch. ★3: Die Klingen ziehen Gegner heran, statt sie wegzustoßen.']);
    expect(itemT('blender')).toMatchObject({ name: 'Mixer', blurb: 'Surrende Klingen rund um den Wagen.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('blender')).toEqual([
      { label: 'Damage', values: ['5', '7.5', '10'] },
      { label: 'Interval', values: ['0.3 s', '0.27 s', '0.24 s'] },
    ]);
    setLang('de');
    expect(tierScaling('blender')).toEqual([
      { label: 'Schaden', values: ['5', '7,5', '10'] },
      { label: 'Intervall', values: ['0,3 s', '0,27 s', '0,24 s'] },
    ]);
  });
});

describe('Blender: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says, times the Kitchen bonus its own set points reach', () => {
    const base = ITEMS.blender.weapon!;
    const tune = contentItem('blender')!.tune as unknown as Record<string, readonly number[]>;
    const kitchen = (t: number) => setTuneAt('kitchen', t)?.damageMult ?? 1;
    for (const t of [1, 2, 3]) {
      const w = stats([at('blender', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t) * kitchen(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1] * kitchen(t));
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('blender', t)]).damage)).toEqual([5.0, 7.5, 10.0].map((d, i) => d * kitchen(i + 1)));
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('blender')])).toMatchObject({ pattern: 'aura', range: 100, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0 });
  });
});

describe('Blender: pattern aura', () => {
  it('shreds every enemy within range + radius once per tick (x1.1 from its own Kitchen L1) with a quiet push of 20 (out, below ★3)', () => {
    const { a, fake } = arsenal([at('blender', 2)]);
    const trigger = fake.spawnEnemy({ x: 70, hp: 1000 }); // inside 100, so the blender fires
    const rim = fake.spawnEnemy({ x: 0, y: -115, hp: 1000 }); // beyond 100 but inside 100 + 20
    const out = fake.spawnEnemy({ x: -130, hp: 1000 });
    a.step(0.45);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([trigger.id, rim.id]);
    expect(hits.every((c) => c.dmg === 7.5 * setTuneAt('kitchen', 2)!.damageMult)).toBe(true);
    expect(hits.map((c) => c.opts)).toEqual([{ kb: 20, kbX: 1, kbY: 0, quiet: true }, { kb: 20, kbX: 0, kbY: -1, quiet: true }]);
    expect(hits.some((c) => c.enemy === out.id)).toBe(false);
    expect(a.sounds).toEqual(['blender']);
  });

  it('from ★3 (★4 too) the blades pull enemies in with 20, but push away the ones already touching the cart (closer than 20 + 20 + 12)', () => {
    const push = (tier: number) => {
      const { a, fake } = arsenal([at('blender', tier)]);
      fake.spawnEnemy({ x: 70, hp: 1000 });
      fake.spawnEnemy({ x: 0, y: -100, hp: 1000 });
      fake.spawnEnemy({ x: -50, hp: 1000 });
      a.step(0.45);
      return fake.callsOf('damage').map((c) => c.opts);
    };
    const out = [{ kb: 20, kbX: 1, kbY: 0, quiet: true }, { kb: 20, kbX: 0, kbY: -1, quiet: true }, { kb: 20, kbX: -1, kbY: 0, quiet: true }];
    const pulled = [{ kb: 20, kbX: -1, kbY: 0, quiet: true }, { kb: 20, kbX: 0, kbY: 1, quiet: true }, { kb: 20, kbX: -1, kbY: 0, quiet: true }];
    expect(push(2)).toEqual(out);
    expect(push(3)).toEqual(pulled);
    expect(push(4)).toEqual(pulled);
  });

  it('plays the sound once per tick that hit something, and ticks again every 0.24 s', () => {
    const { a, fake } = arsenal([at('blender', 3)]);
    fake.spawnEnemy({ x: 70, hp: 100000 });
    a.run(40, 0.05);
    const ticks = fake.callsOf('damage');
    expect(ticks.length).toBeGreaterThanOrEqual(7);
    expect(a.sounds.every((s) => s === 'blender')).toBe(true);
    expect(a.sounds).toHaveLength(ticks.length);
  });

  it('does nothing without an enemy inside 85 (the target search uses the stat range)', () => {
    const { a, fake } = arsenal([at('blender', 3)]);
    fake.spawnEnemy({ x: 110, hp: 1000 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0);
  });

  it('keeps a blade ring at the goblin: shown and spun 12 rad/s while fighting, hidden in the shop', () => {
    const { a } = arsenal([at('blender', 3)]);
    const blades = a.weapons[0].blades as StubSprite;
    expect(blades.texture.key).toBe('fx_blades');
    a.step(0.1);
    expect(blades.visible).toBe(true);
    expect(blades.rotation).toBeCloseTo(1.2);
    a.step(0.1, false);
    expect(blades.visible).toBe(false);
    expect(blades.rotation).toBeCloseTo(2.4); // it keeps turning, hidden
  });
});
