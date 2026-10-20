import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import microwave from '../../../src/content/items/microwave';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arsenal, at, setTuneAt, stats } from '../helpers';

afterEach(() => setLang('en'));

// Zap: strikes the toughest enemy in range and splashes around it (engine/patterns/zap.ts); chains are Static Cling / TV Dinner territory.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Microwave: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('microwave')).toBe(microwave);
    const def = ITEMS.microwave;
    expect(def).toMatchObject({ id: 'microwave', family: 'kitchen', kind: 'weapon', price: 20, electrical: true });
    expect(def.element).toBe('heat');
    expect(def.tags).toEqual(['area']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 1, y: 0}, {x: 2, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}]);
    expect(def.weapon).toEqual({ pattern: 'zap', damage: 24, cooldown: 2.4, range: 380, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 70 });
  });

  it('keeps its position in the item order', () => {
    expect(around('microwave', 1, 1)).toEqual(['flag', 'microwave', 'blender']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('microwave', t))).toEqual([
      'Every 2.4 s zaps the toughest enemy within 380 (Elites first, then most HP) for 24 damage, splashing everything within 70. Electrical.',
      'Every 2.16 s zaps the toughest enemy within 380 (Elites first, then most HP) for 36 damage, splashing everything within 70. Electrical.',
      'Every 1.92 s zaps the toughest enemy within 380 (Elites first, then most HP) for 48 damage, splashing everything within 70. Electrical. ★3: When a zap knocks out its target, the next one charges in 50% of the time.',
    ]);
    expect(itemT('microwave')).toMatchObject({ name: 'Microwave', blurb: 'Ding! Nukes a grocery from across the aisle.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('microwave', t))).toEqual(['Zappt alle 2,4 s den zähsten Gegner im Umkreis von 380 (zuerst Elite, dann meiste LP) für 24 Schaden, mit Flächenschaden im Umkreis von 70. Elektrisch.', 'Zappt alle 1,92 s den zähsten Gegner im Umkreis von 380 (zuerst Elite, dann meiste LP) für 48 Schaden, mit Flächenschaden im Umkreis von 70. Elektrisch. ★3: Schaltet ein Zap sein Ziel aus, lädt der nächste in 50% der Zeit.']);
    expect(itemT('microwave')).toMatchObject({ name: 'Mikrowelle', blurb: 'Kling! Beamt einen Gegner quer durch den Gang.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('microwave')).toEqual([
      { label: 'Damage', values: ['24', '36', '48'] },
      { label: 'Interval', values: ['2.4 s', '2.16 s', '1.92 s'] },
    ]);
    setLang('de');
    expect(tierScaling('microwave')).toEqual([
      { label: 'Schaden', values: ['24', '36', '48'] },
      { label: 'Intervall', values: ['2,4 s', '2,16 s', '1,92 s'] },
    ]);
  });
});

describe('Microwave: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says, times the Kitchen bonus its own set points reach', () => {
    const base = ITEMS.microwave.weapon!;
    const tune = contentItem('microwave')!.tune as unknown as Record<string, readonly number[]>;
    const kitchen = (t: number) => setTuneAt('kitchen', t)?.damageMult ?? 1;
    for (const t of [1, 2, 3]) {
      const w = stats([at('microwave', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t) * kitchen(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1] * kitchen(t));
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('microwave', t)]).damage)).toEqual([24.0, 36.0, 48.0].map((d, i) => d * kitchen(i + 1)));
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('microwave')])).toMatchObject({ pattern: 'zap', range: 380, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 70 });
  });
});

describe('Microwave: pattern zap', () => {
  it('zaps the toughest enemy within 380 (most HP) and splashes everything within 70 + radius of it, once each', () => {
    const { a, fake } = arsenal([at('microwave', 3)]);
    const weak = fake.spawnEnemy({ x: 100, y: -200, hp: 50 });
    const tank = fake.spawnEnemy({ x: 200, y: 200, hp: 400 });
    const next = fake.spawnEnemy({ x: 260, y: 200, hp: 30 });   // 60 px from the tank: inside the splash
    const outside = fake.spawnEnemy({ x: 200, y: 300, hp: 30 }); // 100 px: outside 70 + 20
    a.step(0.5);
    const hits = fake.callsOf('damage');
    expect(hits.map((c) => c.enemy)).toEqual([tank.id, next.id]);
    expect(hits.every((c) => c.dmg === 48 * setTuneAt('kitchen', 3)!.damageMult && c.source === 'u0')).toBe(true); // its 3 set points: Kitchen L2
    expect(hits.map((c) => c.opts)).toEqual([{ kb: 80, kbX: 0, kbY: 0 }, { kb: 80, kbX: 1, kbY: 0 }]);
    expect([weak, outside].some((e) => hits.some((c) => c.enemy === e.id))).toBe(false);
    expect(a.sounds).toEqual(['zap']);
  });

  // Seconds between the first two zaps. A is the toughest (the first target); B stands 150 px from it, outside the splash.
  const zapGap = (tier: number, a: { hp: number; x?: number }, b: { hp: number; x?: number; y?: number }) => {
    const r = arsenal([at('microwave', tier)]);
    r.fake.spawnEnemy({ x: a.x ?? 200, y: 0, hp: a.hp });
    r.fake.spawnEnemy({ x: b.x ?? 200, y: b.y ?? 150, hp: b.hp });
    const zaps: number[] = [];
    for (let i = 0; i < 500 && zaps.length < 2; i++) {
      const n = r.a.sounds.length;
      r.a.step(0.01);
      if (r.a.sounds.length > n) zaps.push(r.fake.time);
    }
    return zaps[1] - zaps[0];
  };

  it('from ★3 knocking out the zapped target (not one only splashed) charges the next zap in half the cooldown; ★2 waits the full cooldown', () => {
    expect(zapGap(2, { hp: 30 }, { hp: 20 })).toBeCloseTo(2.4 * 0.9, 1);
    expect(zapGap(3, { hp: 30 }, { hp: 20 })).toBeCloseTo(2.4 * 0.8 * 0.5, 1);
    expect(zapGap(4, { hp: 30 }, { hp: 20 })).toBeCloseTo(2.4 * 0.7 * 0.5, 1);
    expect(zapGap(3, { hp: 1000 }, { hp: 20 })).toBeCloseTo(2.4 * 0.8, 1);
    expect(zapGap(3, { hp: 1000 }, { hp: 1, x: 240, y: 0 }), 'B dies in the splash only').toBeCloseTo(2.4 * 0.8, 1);
  });

  it('an Elite comes first, whatever the HP of the others', () => {
    const { a, fake } = arsenal([at('microwave', 3)]);
    fake.spawnEnemy({ x: 100, y: -200, hp: 900 });
    const elite = fake.spawnEnemy({ x: -250, y: 0, hp: 20, elite: true });
    a.step(0.5);
    expect(fake.callsOf('damage')[0].enemy).toBe(elite.id);
  });

  it('on equal HP the first enemy of the arena wins', () => {
    const { a, fake } = arsenal([at('microwave', 3)]);
    const first = fake.spawnEnemy({ x: 300, y: 0, hp: 100 });
    fake.spawnEnemy({ x: -300, y: 0, hp: 100 });
    a.step(0.5);
    expect(fake.callsOf('damage')[0].enemy).toBe(first.id);
  });

  it('draws the bolt on the target (a zap sprite and a burst ring) and ignores what is beyond 380', () => {
    const { a, fake } = arsenal([at('microwave', 3)]);
    fake.spawnEnemy({ x: 390, hp: 100 });
    a.step(0.5);
    expect(fake.callsOf('damage')).toHaveLength(0);
    fake.enemies[0].x = 300;
    a.step(0.05);
    expect(a.sprites.map((s) => s.key)).toEqual(['fx_zap']);
    expect(fake.callsOf('fx').find((c) => c.method === 'ring')!.args.slice(0, 5)).toEqual(['fx_zap_burst', 300, 0, 170, 260]);
  });

  it('is electrical: the department rate speeds its cooldown up', () => {
    const { a } = arsenal([at('microwave', 3)]);
    a.electricalRate = 2;
    a.step(0.1);
    expect(a.weapons[0].cd).toBeCloseTo(0.4 - 0.2);
  });

  it('Duct Tape grows the splash radius (+40% at ★3): 70 -> 98', () => {
    const { a, fake } = arsenal([at('microwave', 3), at('tape', 3)]);
    const tank = fake.spawnEnemy({ x: 200, y: 200, hp: 400 });
    const near = fake.spawnEnemy({ x: 200, y: 310, hp: 30 }); // 110 px: inside 98 + 20, outside 70 + 20
    a.step(0.5);
    expect(fake.callsOf('damage').map((c) => c.enemy)).toEqual([tank.id, near.id]);
  });
});
