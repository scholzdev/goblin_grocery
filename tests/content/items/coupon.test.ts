import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import coupon from '../../../src/content/items/coupon';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { combatRng } from '../../../src/systems/rng';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, far } from '../helpers';

afterEach(() => setLang('en'));

// The roll is a runtime hook: `onKill` in the content file. One combat-rng draw per credited kill, then a coin with the Coupon Book label.
describe('Coupon Book: runtime', () => {
  const kills = (tier: number, n: number, seed = 7) => {
    const { fake, stats } = arena([at('toaster'), far('coupon', tier)], { seed });
    for (let i = 0; i < n; i++) fake.hit(fake.spawnEnemy({ hp: 1, x: i * 10, y: 5 }), 5, stats);
    return fake;
  };
  /** The same draws the arena makes: one per kill. */
  const expected = (chance: number, n: number, seed = 7) => { const r = combatRng(seed, 0); return Array.from({ length: n }, () => r() < chance); };

  it('rolls once per kill and drops a coin when the roll is under the chance (seeded, ★1 / ★2 / ★3)', () => {
    for (const [tier, chance] of [[1, 0.3], [2, 0.3 * 1.5], [3, 0.6]] as const) {
      const fake = kills(tier, 40);
      const want = expected(chance, 40);
      expect(fake.callsOf('dropCoin')).toHaveLength(want.filter(Boolean).length);
      expect(want.some(Boolean) && want.some((x) => !x)).toBe(true); // the seed exercises both outcomes
    }
  });

  it('drops the coin at the enemy that died, labelled with the Coupon Book (EN and DE)', () => {
    const { fake, stats } = arena([at('toaster'), far('coupon', 3)], { seed: 7 });
    const r = combatRng(7, 0);
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const win = r() < 0.6;
      const e = fake.spawnEnemy({ hp: 1, x: 100 + i, y: 50 + i });
      const before = fake.callsOf('dropCoin').length;
      fake.hit(e, 5, stats);
      const drops = fake.callsOf('dropCoin');
      expect(drops.length - before).toBe(win ? 1 : 0);
      if (win) { wins++; expect(drops.at(-1)).toMatchObject({ x: 100 + i, y: 50 + i, label: 'Coupon Book' }); }
    }
    expect(wins).toBeGreaterThan(0);
    setLang('de');
    for (let i = 0; i < 40; i++) fake.hit(fake.spawnEnemy({ hp: 1 }), 5, stats);
    expect(fake.callsOf('dropCoin').some((c) => c.label === 'Gutscheinheft')).toBe(true);
  });

  it('draws exactly one number per kill: the rng stream after n kills is n draws further', () => {
    const fake = kills(2, 12);
    const r = combatRng(7, 0);
    for (let i = 0; i < 12; i++) r();
    expect(fake.rng()).toBe(r());
  });

  it('non-lethal hits and uncredited deaths neither roll nor drop', () => {
    const { fake, stats } = arena([at('toaster'), far('coupon', 3)], { seed: 7 });
    const tough = fake.spawnEnemy({ hp: 1000 });
    for (let i = 0; i < 10; i++) fake.hit(tough, 5, stats);
    const gone = fake.spawnEnemy({ hp: 5 });
    gone.hp = 0; gone.alive = false; // escaped / end-of-aisle cleanup: killEnemy(e, false) never emits onKill
    expect(fake.callsOf('dropCoin')).toEqual([]);
    expect(fake.rng()).toBe(combatRng(7, 0)()); // nothing was drawn
  });

  it('a second copy does not add a second roll', () => {
    const { fake, stats } = arena([at('toaster'), far('coupon', 1), far('coupon', 3)], { seed: 7 });
    fake.hit(fake.spawnEnemy({ hp: 1 }), 5, stats);
    const r = combatRng(7, 0); r();
    expect(fake.rng()).toBe(r());
  });

  it('is inactive without the item', () => {
    const { fake, stats } = arena([at('toaster')], { seed: 7 });
    for (let i = 0; i < 30; i++) fake.hit(fake.spawnEnemy({ hp: 1 }), 5, stats);
    expect(fake.callsOf('dropCoin')).toEqual([]);
  });
});

describe('Coupon Book: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('coupon')).toBe(coupon);
    expect(ITEMS.coupon).toMatchObject({ id: 'coupon', family: 'checkout', kind: 'passive', price: 8, electrical: false });
    expect(ITEMS.coupon.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('coupon', t).chance)).toEqual([0.3, 0.3 * 1.5, 0.6, 0.75]);
    expect(contentTune('coupon', 1).cap).toBe(0.9);
  });

  it('keeps its position in the item order', () => {
    expect(around('coupon', 1, 1)).toEqual(['tape', 'coupon', 'bubblewrap']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('coupon', t))).toEqual([
      'Kills have a 30% chance to drop +1 coin (does not stack). Combo: Clearance Sale with Fizz Cannon + Price Gun.',
      'Kills have a 45% chance to drop +1 coin (does not stack). Combo: Clearance Sale with Fizz Cannon + Price Gun.',
      'Kills have a 60% chance to drop +1 coin (does not stack). Combo: Clearance Sale with Fizz Cannon + Price Gun.',
    ]);
    setLang('de');
    expect(itemRules('coupon', 2)).toBe('Abschüsse lassen mit 45% Chance +1 Münze fallen (stapelt sich nicht). Combo: Räumungsverkauf mit Sprudelkanone + Preisauszeichner.');
    expect(itemT('coupon')).toMatchObject({ name: 'Couponheft', blurb: 'Extra Ersparnis bei jedem Abschuss.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('coupon')).toEqual([{ label: 'Coin chance', values: ['30%', '45%', '60%'] }]);
    setLang('de');
    expect(tierScaling('coupon')).toEqual([{ label: 'Münzchance', values: ['30%', '45%', '60%'] }]);
  });
});
