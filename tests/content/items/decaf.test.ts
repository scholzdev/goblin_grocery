import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import decaf from '../../../src/content/items/decaf';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { weakenMult } from '../../../src/systems/combat';
import { computeBuild, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { arena, at, far } from '../helpers';
import { draws } from '../sets/helpers';

afterEach(() => setLang('en'));

// Decaf: a Kitchen module with no build effect. Direct hits of an adjacent weapon weaken the enemy by 15% / 20% / 25% (★1 / ★2 / ★3) for 3 s. Nothing is rolled.
const TOASTER = at('toaster');
const run = (tier: number, seed = 1) => {
  const a = arena([TOASTER, at('decaf', tier)], { seed });
  const e = a.fake.spawnEnemy({ hp: 1000 });
  return { ...a, e, hit: (opts = {}) => a.fake.hit(e, 9, a.stats, opts) };
};

describe('Decaf: content', () => {
  it('is the registered content file; a 1x1 Kitchen module with no buff, no element and no Shred flag', () => {
    expect(contentItem('decaf')).toBe(decaf);
    const def = ITEMS.decaf;
    expect(def).toMatchObject({ id: 'decaf', family: 'kitchen', kind: 'module', price: 9, electrical: false });
    expect(def.element).toBeUndefined();
    expect(def.buff).toBeUndefined();
    expect(def.shreds).toBeUndefined();
    expect(def.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('tunes 15 / 20 / 25% per tier for a flat 3 s', () => {
    expect([1, 2, 3].map((t) => contentTune('decaf', t))).toEqual([{ pct: 0.15, duration: 3 }, { pct: 0.2, duration: 3 }, { pct: 0.25, duration: 3 }]);
  });

  it('adds no buff and no status to the adjacent weapon (only the usual bundle bonus of any touching item)', () => {
    const [w] = computeBuild(cart('toaster', ['decaf'])).weapons, [plain] = computeBuild(cart('toaster', [])).weapons;
    expect(w.buffs).toEqual([]);
    expect({ ...w, uid: '', bundle: 0, damage: 0 }).toEqual({ ...plain, uid: '', bundle: 0, damage: 0 });
    expect(w.bundle).toBe(1);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('decaf', t))).toEqual([15, 20, 25].map((p) => `Direct hits of an adjacent weapon weaken enemies: they deal ${p}% less damage to you for 3 s. The stronger weakening wins, repeated hits refresh.`));
    expect(itemT('decaf')).toEqual({ name: 'Decaf', blurb: 'No kick, no fight.' });
    expect(tierScaling('decaf')).toEqual([{ label: 'Weaken', values: ['15%', '20%', '25%'] }]);
    setLang('de');
    expect(itemRules('decaf', 3)).toBe('Direkte Treffer der angrenzenden Waffe schwächen Gegner: Sie richten 3 s lang 25% weniger Schaden bei dir an. Die stärkere Schwächung gilt, wiederholte Treffer erneuern sie.');
    expect(itemT('decaf')).toEqual({ name: 'Koffeinfrei', blurb: 'Kein Kick, kein Kampfgeist.' });
    expect(tierScaling('decaf')[0].label).toBe('Schwächung');
  });
});

describe('Decaf: runtime', () => {
  it('a direct hit weakens by the tier\'s percentage for 3 s: ★1 15%, ★2 20%, ★3 25%', () => {
    for (const [tier, pct] of [[1, 0.15], [2, 0.2], [3, 0.25]] as const) {
      const a = run(tier);
      a.hit();
      expect(a.fake.callsOf('weaken'), `★${tier}`).toEqual([{ at: 0, kind: 'weaken', enemy: a.e.id, pct, seconds: 3 }]);
      expect(weakenMult(a.e.status, 0), `★${tier}`).toBeCloseTo(1 - pct, 12);
      expect(weakenMult(a.e.status, 2.9)).toBeCloseTo(1 - pct, 12);
      expect(weakenMult(a.e.status, 3)).toBe(1); // over after 3 s
    }
  });

  it('every hit applies it, so repeated hits keep it up (refresh to the later end)', () => {
    const a = run(1);
    a.hit(); a.fake.advance(2); a.hit();
    expect(a.e.status.weakenUntil).toBe(5);
    expect(weakenMult(a.e.status, 4.9)).toBeCloseTo(0.85, 12);
  });

  it('weakens only direct weapon hits: not burn or poison ticks, quiet area ticks, echoes, chained hits, pops, the dash, or a weapon it does not touch', () => {
    const a = run(3);
    for (const o of [{ isDot: true }, { isDot: true, poison: true }, { quiet: true }, { echo: true }, { chained: true }, { fromPopper: true }]) {
      a.fake.hit(a.e, 9, a.stats, o);
      expect(a.fake.callsOf('weaken'), JSON.stringify(o)).toEqual([]);
    }
    const dash = arena([TOASTER, at('decaf', 3)]);
    const e = dash.fake.spawnEnemy({ hp: 1000 });
    dash.fake.hit(e, 6, null, { label: 'shove' });
    expect(dash.fake.callsOf('weaken')).toEqual([]);
    const apart = arena([TOASTER, far('decaf', 3)]);
    const f = apart.fake.spawnEnemy({ hp: 1000 });
    apart.fake.hit(f, 9, apart.stats);
    expect(apart.fake.callsOf('weaken')).toEqual([]);
  });

  it('bosses are weakened too', () => {
    const a = arena([TOASTER, at('decaf', 3)]);
    const boss = a.fake.spawnReal('boss_frozen', { hp: 5000 });
    a.fake.hit(boss, 9, a.stats);
    expect(weakenMult(boss.status, 0)).toBe(0.75);
  });

  it('draws no random numbers (the roll-free module leaves the combat stream alone)', () => {
    const a = run(3, 7);
    a.hit(); a.hit();
    expect(a.fake.rng()).toBe(draws(7, 1)[0]);
  });
});
