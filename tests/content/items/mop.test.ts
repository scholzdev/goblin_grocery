import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import mop from '../../../src/content/items/mop';
import { weaponCooldownMult, weaponDamageMult } from '../../../src/engine/define';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { contentSetTune } from '../../../src/engine/registry';
import { around, arsenal, at, far, setTuneAt, stats } from '../helpers';

afterEach(() => setLang('en'));

// A lone ★3 mop is 3 Cleaning and 3 Frost set points: Cleaning L1 (area x1.15) and Frost L1 (+10 points of slow).
const CLEANING = setTuneAt('cleaning', 3)!, FROST = setTuneAt('frost', 3)!;
const R = 60 * CLEANING.aoeMult;

// Puddle: a soap puddle behind the cart every cooldown, no target needed (engine/patterns/puddle.ts). Grease Fire's burning slick is in tests/content/combos/greaseFire.test.ts.
// Pattern behaviour runs headless through the FakeArsenal (src/engine/patterns/fakeHost.ts): the cart's real build, the compiled hooks, a fake clock.

describe('Mop: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('mop')).toBe(mop);
    const def = ITEMS.mop;
    expect(def).toMatchObject({ id: 'mop', family: 'cleaning', kind: 'weapon', price: 11, electrical: false });
    expect(def.element).toBe('frost');
    expect(def.tags).toEqual(['area']);
    expect(def.legendary).toBeUndefined();
    expect(def.cells).toEqual([{x: 0, y: 0}, {x: 0, y: 1}, {x: 0, y: 2}, {x: 1, y: 2}]);
    expect(def.weapon).toEqual({ pattern: 'puddle', damage: 3, cooldown: 1.6, range: 60, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0.5, duration: 3, bounces: 0, chain: 0, aoe: 0 });
  });

  it('keeps its position in the item order', () => {
    expect(around('mop', 1, 1)).toEqual(['fizz', 'mop', 'pricegun']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('mop', t))).toEqual([
      'Every 1.6 s drops a soap puddle (radius 60, lasts 3 s). Enemies inside slip and get Wet (3 s): 25% slow and 3 damage every 0.5 s.',
      'Every 1.44 s drops a soap puddle (radius 60, lasts 3 s). Enemies inside slip and get Wet (3 s): 25% slow and 4.5 damage every 0.5 s.',
      'Every 1.28 s drops a soap puddle (radius 60, lasts 3 s). Enemies inside slip and get Wet (3 s): 25% slow and 6 damage every 0.5 s. ★3: Puddles last 2× as long.',
    ]);
    expect(itemT('mop')).toMatchObject({ name: 'Mop', blurb: 'Leaves slippery soap puddles behind you.' });
    setLang('de');
    expect([1, 3].map((t) => itemRules('mop', t))).toEqual(['Hinterlässt alle 1,6 s eine Seifenpfütze (Radius 60, hält 3 s). Gegner darin rutschen und werden nass (3 s): 25% langsamer und 3 Schaden alle 0,5 s.', 'Hinterlässt alle 1,28 s eine Seifenpfütze (Radius 60, hält 3 s). Gegner darin rutschen und werden nass (3 s): 25% langsamer und 6 Schaden alle 0,5 s. ★3: Pfützen halten 2× so lange.']);
    expect(itemT('mop')).toMatchObject({ name: 'Wischmopp', blurb: 'Hinterlässt rutschige Seifenpfützen.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('mop')).toEqual([
      { label: 'Damage', values: ['3', '4.5', '6'] },
      { label: 'Interval', values: ['1.6 s', '1.44 s', '1.28 s'] },
    ]);
    setLang('de');
    expect(tierScaling('mop')).toEqual([
      { label: 'Schaden', values: ['3', '4,5', '6'] },
      { label: 'Intervall', values: ['1,6 s', '1,44 s', '1,28 s'] },
    ]);
  });
});

describe('Mop: build', () => {
  it('damage grows +50% and the interval shrinks -10% per ★ (to the bit), as the content tune says', () => {
    const base = ITEMS.mop.weapon!;
    const tune = contentItem('mop')!.tune as unknown as Record<string, readonly number[]>;
    for (const t of [1, 2, 3]) {
      const w = stats([at('mop', t)]);
      expect(w.tier).toBe(t);
      expect(w.damage).toBe(base.damage * weaponDamageMult(t));
      expect(w.cooldown).toBe(base.cooldown * weaponCooldownMult(t));
      expect(w.damage).toBe(tune.damage[t - 1]);
      expect(w.cooldown).toBe(tune.cooldown[t - 1]);
    }
    expect([1, 2, 3].map((t) => stats([at('mop', t)]).damage)).toEqual([3.0, 4.5, 6.0]);
  });

  it('carries the base shape of the pattern into the build', () => {
    expect(stats([at('mop')])).toMatchObject({ pattern: 'puddle', range: 60, projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0.5, duration: 3, bounces: 0, chain: 0, aoe: 0 });
  });
});

describe('Mop: pattern puddle', () => {
  it('drops a puddle 40 px behind the goblin (and 4 below) with nobody around, without recoil', () => {
    const { a } = arsenal([at('mop', 3)], { player: { x: 300, y: 200, facing: 1 } });
    a.step(0.5);
    const [pd] = a.puddles;
    expect([pd.x, pd.y, pd.r]).toEqual([260, 204, R]);
    expect(a.recoils).toEqual([]);
    expect(a.sounds).toEqual(['splash']);
    expect(a.weapons[0].cd).toBeCloseTo(1.28);
  });

  it('drops it behind a goblin that faces left too', () => {
    const { a } = arsenal([at('mop', 3)], { player: { x: 300, y: 200, facing: -1 } });
    a.step(0.5);
    expect([a.puddles[0].x, a.puddles[0].y]).toEqual([340, 204]);
  });

  it('draws the puddle flattened (0.6 x 0.4 of the radius), popping out to 2.2 x 1.36 in 200 ms', () => {
    const { a } = arsenal([at('mop', 3)]);
    a.step(0.5);
    const img = a.sprites[0];
    expect(img.key).toBe('fx_puddle');
    expect(img.log).toContain(`setDisplaySize(${R * 0.6},${R * 0.4})`);
    expect(a.tweens[0]).toMatchObject({ displayWidth: R * 2.2, displayHeight: R * 1.36, duration: 200, ease: 'Back.Out' });
  });

  it('slows 25% for 0.5 s (from its tune), and the next puddle comes a ★3 interval later', () => {
    const { a } = arsenal([at('mop', 3)]);
    a.step(0.5);
    expect(a.puddles[0].slow).toEqual({ pct: 0.25, duration: 0.5 });
    a.run(26, 0.05); // ~1.8 s later
    expect(a.puddles).toHaveLength(2);
  });

  it('a puddle lasts 3 s below ★3 and twice as long from ★3 (★4 too), the Cleaning set\'s extra seconds included; the Snow Cone keeps its 4 s', () => {
    const life = (specs: Parameters<typeof arsenal>[0]) => {
      const { a } = arsenal(specs);
      a.step(0.5);
      return +(a.puddles[0].until - 0.5).toFixed(6);
    };
    expect([2, 3, 4].map((t) => life([at('mop', t)]))).toEqual([3, 3 * 2, (3 + 1) * 2]); // its own Cleaning points: L1 (2 and 3) adds no time, L2 (4) +1 s
    expect(life([at('mop', 3), far('fan'), far('spray'), far('vacuum')])).toBe((3 + 2) * 2); // Cleaning L3: +2 s
    expect(life([at('snowcone', 3)])).toBe(4);
  });

  it('every 0.5 s each enemy inside the ellipse takes 6 quiet damage and a slow (25%, plus Frost L1); outside the flattened ellipse nothing', () => {
    const { a, fake } = arsenal([at('mop', 3)]);
    const inside = fake.spawnEnemy({ x: -40, y: 34, hp: 100000 });   // 30 below the center: inside r x 0.62 = 37
    const outside = fake.spawnEnemy({ x: -40, y: 50, hp: 100000 });  // 46 below: outside
    a.run(33, 0.05); // to ~1.65 s: the first puddle (dropped at ~0.4) ticked three times, the second puddle is not there yet
    const mine = fake.callsOf('damage').filter((c) => c.enemy === inside.id && c.at < 1.65);
    expect(mine).toHaveLength(3);
    expect(mine.every((c) => c.dmg === 6 && c.opts.quiet === true)).toBe(true);
    expect(fake.callsOf('damage').some((c) => c.enemy === outside.id)).toBe(false);
    expect(inside.status.slowPct).toBe(0.25 + FROST.slowBonus);
  });

  it('Frost sets make the slip stronger: base + bonus, up to the cap (from the Frost set tune)', () => {
    const { a, fake, b } = arsenal([at('mop', 3), far('ice', 3)]); // mop ★3 + ★3 ice pack: 6 Frost points, L3
    expect(b.sets.frost).toBe(3);
    const e = fake.spawnEnemy({ x: -40, y: 4, hp: 100000 });
    a.run(15, 0.05);
    const f = contentSetTune('frost', 3);
    expect(e.status.slowPct).toBe(Math.min(f.slowCap, 0.25 + f.slowBonus));
    expect(e.status.slowPct).toBeGreaterThan(0.25);
  });

  it('keeps at most 14 puddles: a new one replaces the oldest', () => {
    const { a } = arsenal([at('mop', 3)]);
    a.weapons[0].stats = { ...a.weapons[0].stats, duration: 1000 };
    a.run(500, 0.05);
    expect(a.puddles.length).toBe(14);
  });
});
