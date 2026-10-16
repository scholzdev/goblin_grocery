import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import tipjar from '../../../src/content/items/tipjar';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { combatRng } from '../../../src/systems/rng';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: each enemy the dash hits has a 40% chance (x TIER.mult, max 100%) to drop a coin; the best copy counts once.
describe('Tip Jar: build field', () => {
  it('sets dashCoinChance to 0.4 / 0.6 / 0.8 at ★1 / ★2 / ★3, 0 without the item', () => {
    expect(full([at('toaster')]).dashCoinChance).toBe(0);
    [0.4, 0.6, 0.8].forEach((c, i) => expect(full([at('toaster'), far('tipjar', i + 1)]).dashCoinChance).toBeCloseTo(c, 12));
  });

  it('matches the legacy formula min(1, 0.4 x TIER.mult) to the bit, and Gold Star\'s effective ★4 hits the 100% cap', () => {
    for (const t of [1, 2, 3]) expect(full([at('toaster'), far('tipjar', t)]).dashCoinChance).toBe(Math.min(1, 0.4 * TIER.mult(t)));
    expect(Math.min(1, 0.4 * TIER.mult(4))).toBe(1);
    expect(full([at('toaster'), corner('tipjar', 3), gilded(1)]).dashCoinChance).toBe(1);
  });

  it('does not stack: the best copy counts once', () => {
    expect(full([at('toaster'), far('tipjar', 1), far('tipjar', 3)]).dashCoinChance).toBeCloseTo(0.8, 12);
  });
});

// The roll is an `onDashHit` hook: one combat-rng draw per enemy the dash hits, then a coin at that enemy.
describe('Tip Jar: runtime', () => {
  const ev = (enemy: ReturnType<ReturnType<typeof arena>['fake']['spawnEnemy']>) => ({ enemy, dx: 1, dy: 0, dmg: 6 });
  /** The same draws the arena makes: one per dash hit. */
  const expected = (chance: number, n: number, seed = 5) => { const r = combatRng(seed, 0); return Array.from({ length: n }, () => r() < chance); };

  it('rolls once per enemy hit and drops a coin at it when the roll is under the chance (seeded, ★1 / ★2 / ★3)', () => {
    for (const [tier, chance] of [[1, 0.4], [2, 0.4 * 1.5], [3, 0.8]] as const) {
      const { fake } = arena([at('toaster'), far('tipjar', tier)], { seed: 5 });
      const want = expected(chance, 40);
      for (let i = 0; i < 40; i++) {
        const before = fake.callsOf('dropCoin').length;
        const e = fake.spawnEnemy({ x: 10 + i, y: 20 + i });
        fake.hooks.emit('onDashHit', ev(e));
        const drops = fake.callsOf('dropCoin');
        expect(drops.length - before, `tier ${tier} #${i}`).toBe(want[i] ? 1 : 0);
        if (want[i]) expect(drops.at(-1)).toMatchObject({ x: 10 + i, y: 20 + i });
      }
      expect(want.some(Boolean) && want.some((x) => !x)).toBe(true); // the seed exercises both outcomes
    }
  });

  it('labels the coin with the Tip Jar (EN and DE) and draws exactly one number per hit', () => {
    const { fake } = arena([at('toaster'), far('tipjar', 3)], { seed: 5 });
    for (let i = 0; i < 12; i++) fake.hooks.emit('onDashHit', ev(fake.spawnEnemy()));
    const r = combatRng(5, 0);
    for (let i = 0; i < 12; i++) r();
    expect(fake.rng()).toBe(r());
    expect(new Set(fake.callsOf('dropCoin').map((c) => c.label))).toEqual(new Set(['Tip Jar']));
    setLang('de');
    for (let i = 0; i < 40; i++) fake.hooks.emit('onDashHit', ev(fake.spawnEnemy()));
    expect(fake.callsOf('dropCoin').some((c) => c.label === 'Trinkgeldglas')).toBe(true);
  });

  it('Gold Star\'s effective ★4 always drops (chance 100%, the roll is under 1)', () => {
    const { fake } = arena([at('toaster'), corner('tipjar', 3), gilded(1)], { seed: 5 });
    for (let i = 0; i < 30; i++) fake.hooks.emit('onDashHit', ev(fake.spawnEnemy()));
    expect(fake.callsOf('dropCoin')).toHaveLength(30);
  });

  it('a second copy does not add a second roll', () => {
    const { fake } = arena([at('toaster'), far('tipjar', 1), far('tipjar', 3)], { seed: 5 });
    fake.hooks.emit('onDashHit', ev(fake.spawnEnemy()));
    const r = combatRng(5, 0); r();
    expect(fake.rng()).toBe(r());
  });

  it('still pays for an enemy the dash just killed (the coin is dropped where it fell)', () => {
    const { fake } = arena([at('toaster'), corner('tipjar', 3), gilded(1)]);
    const e = fake.spawnEnemy({ x: 7, y: 8 }); e.hp = 0; e.alive = false;
    fake.hooks.emit('onDashHit', ev(e));
    expect(fake.callsOf('dropCoin')).toMatchObject([{ x: 7, y: 8 }]);
  });

  it('is inactive without the item: no coins and no draw', () => {
    const { fake } = arena([at('toaster')], { seed: 5 });
    for (let i = 0; i < 30; i++) fake.hooks.emit('onDashHit', ev(fake.spawnEnemy()));
    expect(fake.callsOf('dropCoin')).toEqual([]);
    expect(fake.rng()).toBe(combatRng(5, 0)());
  });
});

describe('Tip Jar: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('tipjar')).toBe(tipjar);
    expect(ITEMS.tipjar).toMatchObject({ id: 'tipjar', family: 'checkout', name: 'Tip Jar', kind: 'passive', price: 9, electrical: false });
    expect(ITEMS.tipjar.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.tipjar.rules).toBe('Each grocery the Space dash hits has a {0} chance to drop a coin (does not stack).');
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('tipjar', t).chance)).toEqual([0.4, 0.4 * 1.5, 0.8, 1]);
    expect(contentTune('tipjar', 1).cap).toBe(1);
  });

  it('keeps its position in the item order', () => {
    expect(around('tipjar', 1, 1)).toEqual(['sparewheel', 'tipjar', 'flag']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('tipjar', t))).toEqual([
      'Each grocery the Space dash hits has a 40% chance to drop a coin (does not stack).',
      'Each grocery the Space dash hits has a 60% chance to drop a coin (does not stack).',
      'Each grocery the Space dash hits has a 80% chance to drop a coin (does not stack).',
    ]);
    setLang('de');
    expect(itemRules('tipjar', 2)).toBe('Jeder Gegner, den der Leertasten-Dash trifft, lässt mit 60% Chance eine Münze fallen (stapelt sich nicht).');
    expect(itemT('tipjar')).toMatchObject({ name: 'Trinkgeldglas', blurb: 'Anrempeln. Sie geben Trinkgeld.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('tipjar')).toEqual([{ label: 'Tip chance', values: ['40%', '60%', '80%'] }]);
    setLang('de');
    expect(tierScaling('tipjar')).toEqual([{ label: 'Trinkgeldchance', values: ['40%', '60%', '80%'] }]);
  });
});
