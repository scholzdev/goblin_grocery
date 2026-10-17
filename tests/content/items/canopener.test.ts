import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import canopener from '../../../src/content/items/canopener';
import { SHRED } from '../../../src/engine/define';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { arena, at, far } from '../helpers';
import { draws } from '../sets/helpers';

afterEach(() => setLang('en'));

// Can Opener: a module with no build effect. Direct hits of an adjacent weapon roll (50% / 75% / 100% at ★1 / ★2 / ★3) to leave one Shred stack.
const TOASTER = at('toaster');
const run = (tier: number, seed: number, dmg = 9) => {
  const a = arena([TOASTER, at('canopener', tier)], { seed });
  const e = a.fake.spawnEnemy({ hp: 1000 });
  return { ...a, e, hit: (opts = {}) => a.fake.hit(e, dmg, a.stats, opts) };
};
/** First seed whose first draw lies in [lo, hi). */
const seedIn = (lo: number, hi: number): number => { for (let s = 1; s < 5000; s++) { const r = draws(s, 1)[0]; if (r >= lo && r < hi) return s; } throw new Error('no seed'); };

describe('Can Opener: content', () => {
  it('is the registered content file; a Tools module with no buff, a 1x2 footprint and the Shred flag', () => {
    expect(contentItem('canopener')).toBe(canopener);
    const def = ITEMS.canopener;
    expect(def).toMatchObject({ id: 'canopener', family: 'tools', kind: 'module', price: 9, electrical: false, shreds: true });
    expect(def.element).toBeUndefined();
    expect(def.buff).toBeUndefined();
    expect(def.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
  });

  it('tunes 50 / 75 / 100% per tier, one stack, and the engine\'s Shred duration and cap', () => {
    expect([1, 2, 3].map((t) => contentTune('canopener', t))).toEqual([1, 2, 3].map((t) => ({ chance: [0.5, 0.75, 1][t - 1], stacks: 1, duration: SHRED.duration, cap: SHRED.cap })));
  });

  it('adds no buff and no status to the adjacent weapon (only the usual bundle bonus of any touching item)', () => {
    const [w] = computeBuild(cart('toaster', ['canopener'])).weapons, [plain] = computeBuild(cart('toaster', [])).weapons;
    expect(w.buffs).toEqual([]);
    expect({ ...w, uid: '', bundle: 0, damage: 0 }).toEqual({ ...plain, uid: '', bundle: 0, damage: 0 });
    expect(w.bundle).toBe(1);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('canopener', t))).toEqual([50, 75, 100].map((p) => `Direct hits of an adjacent weapon have a ${p}% chance to Shred: each stack strips a point of armor for 4 s, up to 3 stacks. With no armor left, Shred adds a little damage.`));
    expect(itemT('canopener')).toEqual({ name: 'Can Opener', blurb: 'Armor is just a lid.' });
    expect(tierScaling('canopener')).toEqual([{ label: 'Shred chance', values: ['50%', '75%', '100%'] }]);
    setLang('de');
    expect(itemRules('canopener', 2)).toBe('Direkte Treffer der angrenzenden Waffe reißen mit 75% Chance auf: Jeder Stapel nimmt 4 s lang einen Punkt Panzerung, bis zu 3 Stapel. Ohne Panzerung macht Aufreißen etwas Zusatzschaden.');
    expect(itemT('canopener').name).toBe('Dosenöffner');
    expect(tierScaling('canopener')[0].label).toBe('Aufreiß-Chance');
  });
});

describe('Can Opener: runtime', () => {
  it('rolls the chance per tier on the seeded combat rng: a draw below it shreds, one above does not', () => {
    for (const [tier, chance] of [[1, 0.5], [2, 0.75], [3, 1]] as const) {
      const hitSeed = seedIn(0, chance), a = run(tier, hitSeed);
      a.hit();
      expect(a.e.status.shredStacks, `★${tier} below ${chance}`).toBe(1);
      expect(a.fake.callsOf('shred')).toEqual([{ at: 0, kind: 'shred', enemy: a.e.id, stacks: 1, seconds: SHRED.duration }]);
      if (chance < 1) {
        const missSeed = seedIn(chance, 1), b = run(tier, missSeed);
        b.hit();
        expect(b.e.status.shredStacks, `★${tier} above ${chance}`).toBe(0);
      }
    }
  });

  it('the thresholds: ★1 shreds on 0.49 and not on 0.51, ★2 on 0.74 and not on 0.76, ★3 always', () => {
    const t1 = [seedIn(0.45, 0.5), seedIn(0.5, 0.55)], t2 = [seedIn(0.7, 0.75), seedIn(0.75, 0.8)];
    expect(t1.map((s) => { const a = run(1, s); a.hit(); return a.e.status.shredStacks; })).toEqual([1, 0]);
    expect(t2.map((s) => { const a = run(2, s); a.hit(); return a.e.status.shredStacks; })).toEqual([1, 0]);
    for (const s of [seedIn(0.95, 1), seedIn(0, 0.05)]) { const a = run(3, s); a.hit(); expect(a.e.status.shredStacks).toBe(1); }
  });

  it('observed over many seeds the rate matches the tier (50 / 75 / 100%)', () => {
    for (const [tier, chance] of [[1, 0.5], [2, 0.75], [3, 1]] as const) {
      let n = 0;
      for (let s = 1; s <= 400; s++) { const a = run(tier, s); a.hit(); n += a.e.status.shredStacks; }
      expect(n / 400, `★${tier}`).toBeGreaterThan(chance - 0.08);
      expect(n / 400, `★${tier}`).toBeLessThanOrEqual(chance + 0.08);
    }
  });

  it('stacks to the cap of 3 on repeated hits (★3) and the hit that opens the enemy is still soaked by its armor', () => {
    const a = arena([TOASTER, at('canopener', 3)]);
    const beans = a.fake.spawnReal('beans', { hp: 1000 });
    const dealt: number[] = [];
    for (let i = 0; i < 5; i++) { const before = beans.hp; a.fake.hit(beans, 9, a.stats); dealt.push(before - beans.hp); }
    expect(dealt).toEqual([6, 7, 8, 9, 9]);
    expect(beans.status.shredStacks).toBe(SHRED.cap);
  });

  it('draws exactly one number per eligible hit, whatever the tier', () => {
    for (const tier of [1, 2, 3]) {
      const a = run(tier, 7);
      a.hit(); a.hit();
      expect(a.fake.rng()).toBe(draws(7, 3)[2]);
    }
  });

  it('shreds only direct weapon hits: not burn or poison ticks, quiet area ticks, echoes, chained hits, pops, the dash, or a weapon it does not touch', () => {
    const a = run(3, 1);
    for (const o of [{ isDot: true }, { isDot: true, poison: true }, { quiet: true }, { echo: true }, { chained: true }, { fromPopper: true }]) {
      a.fake.hit(a.e, 9, a.stats, o);
      // a pop is an explosion (it shreds by itself): count only what the Can Opener's own roll added
      expect(a.fake.callsOf('shred').length, JSON.stringify(o)).toBe(o.fromPopper ? 1 : 0);
    }
    const dash = arena([TOASTER, at('canopener', 3)]);
    const e = dash.fake.spawnEnemy({ hp: 1000 });
    dash.fake.hit(e, 6, null, { label: 'shove' });
    expect(dash.fake.callsOf('shred')).toEqual([]);
    const apart = arena([TOASTER, far('canopener', 3)]);
    const f = apart.fake.spawnEnemy({ hp: 1000 });
    apart.fake.hit(f, 9, apart.stats);
    expect(apart.fake.callsOf('shred')).toEqual([]);
  });

  it('draws nothing for the ineligible hits either (the roll is only made when the hit can shred)', () => {
    const a = run(3, 5);
    a.hit({ isDot: true }); a.hit({ quiet: true }); a.hit({ echo: true });
    expect(a.fake.rng()).toBe(draws(5, 1)[0]);
  });
});
