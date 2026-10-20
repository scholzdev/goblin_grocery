import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import ice from '../../../src/content/items/ice';
import { contentComboTune, contentItem, contentSetTune, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { arena, around, at, stats } from '../helpers';
import { build, type Spec } from '../../golden/carts';

afterEach(() => setLang('en'));

// Legacy: 25% slow for 1 s at ★1 (x TIER.mult), capped at 60%. Pan (kitchen / heat) has no combo with the pack; the Kitchen set only touches damage.
// A ★2 / ★3 pack is 2 / 3 Frost set points on its own: Frost L1 / L2 add 10 points of slow (capped at 60%).
const FROST = (lv: number) => contentSetTune('frost', lv);
const withFrost = (pct: number, lv: number) => Math.min(FROST(lv).slowCap, pct + FROST(lv).slowBonus);
describe('Ice Pack: build', () => {
  it('slows by 25% / 37.5% / 50% for 1 s at ★1 / ★2 / ★3, plus the Frost level its own set points reach', () => {
    expect(stats([at('pan'), at('ice')]).slow).toEqual({ pct: 0.25, duration: 1 });
    expect(stats([at('pan'), at('ice', 2)]).slow).toEqual({ pct: withFrost(0.375, 1), duration: 1 });
    expect(stats([at('pan'), at('ice', 3)]).slow).toEqual({ pct: withFrost(0.5, 2), duration: 1 });
  });

  it('records the buff, and leaves damage-free stats alone', () => {
    const [w] = computeBuild(cart('pan', ['ice'])).weapons;
    const [plain] = computeBuild(cart('pan', [])).weapons;
    expect(w.buffs).toEqual(['ice']);
    expect(w.range).toBe(plain.range);
    expect(w.cooldown).toBe(plain.cooldown);
    expect(w.burn).toBeNull();
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([at('pan'), at('ice', 3, { near: [], apart: [0] })]);
    expect(w.slow).toBeNull();
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([at('pan'), at('ice', 1), at('ice', 3, { near: [0] })]).slow?.pct).toBe(withFrost(0.5, 2)); // 3 Frost points, not 4
  });

  it('Gold Star lifts it one tier, and the 60% cap bites (★3 -> effective ★4 would be 62.5%); its set points rise with it', () => {
    expect(0.25 * TIER.mult(4)).toBe(0.625);
    // (the sticker may touch the pan too here: only the pack's tier matters for the slow)
    const star: Spec = { type: 'goldstar', near: [1] };
    expect(stats([at('pan'), at('ice', 3), star]).slow?.pct).toBe(withFrost(0.6, 3)); // 4 Frost points: L3
    expect(stats([at('pan'), at('ice', 2), star]).slow?.pct).toBeCloseTo(withFrost(0.25 * TIER.mult(3), 2)); // ★2 -> effective ★3: 50%, 3 Frost points
  });

  it('stays legacy-compatible with the Frost set (+10% on top, capped by the set), which reads s.slow afterwards', () => {
    // Fizz Cannon (snacks / frost) + Ice Pack (kitchen / frost) = 2 Frost points: L1. With a ★3 pack 4 points: L3 (+15, capped at 70%).
    expect(stats([at('fizz'), at('ice')]).slow?.pct).toBeCloseTo(0.35);
    expect(stats([at('fizz'), at('ice', 3)]).slow?.pct).toBeCloseTo(0.65);
  });

  it('is overridden by Cold Storage on a Vacuum', () => {
    const w = stats([at('vacuum'), at('ice')]);
    expect(w.recipes).toEqual(['coldStorage']);
    expect(w.slow).toEqual({ pct: contentComboTune('coldStorage').pct, duration: contentComboTune('coldStorage').duration });
  });

  it('is what Jelly Beans (frost) scales: 70% of the ★1 slow', () => {
    expect(contentTune('ice', 1)).toEqual({ pct: 0.25, duration: 1, cap: 0.6 });
    expect(stats([at('pan'), at('jellybeans', 1, { flavor: 'frost' })]).slow).toEqual({ pct: 0.25 * 0.7, duration: 1 });
  });
});

describe('Ice Pack: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('ice')).toBe(ice);
    const def = ITEMS.ice;
    expect(def).toMatchObject({ id: 'ice', family: 'kitchen', element: 'frost', kind: 'module', price: 8, electrical: false, buff: 'ice' });
    expect(def.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('ice', 1, 1)).toEqual(['magnet', 'ice', 'hotsauce']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('ice', t))).toEqual([
      'Adjacent weapon hits slow enemies by 25% for 1 s. Repeated hits refresh.',
      'Adjacent weapon hits slow enemies by 38% for 1 s. Repeated hits refresh.',
      'Adjacent weapon hits slow enemies by 50% for 1 s. Repeated hits refresh.',
    ]);
    setLang('de');
    expect(itemRules('ice', 2)).toBe('Treffer der angrenzenden Waffe verlangsamen Gegner um 38% für 1 s. Wiederholte Treffer erneuern den Effekt.');
    expect(itemT('ice').name).toBe('Kühlakku');
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('ice')).toEqual([{ label: 'Slow', values: ['25%', '38%', '50%'] }]);
    setLang('de');
    expect(tierScaling('ice')).toEqual([{ label: 'Verlangsamung', values: ['25%', '38%', '50%'] }]);
  });

  it('shows its buff line with the right numbers per tier ', () => {
    const line = (tier: number) => {
      const inv = cart('pan', ['ice']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line(1)).toBe('Slow 25% for 1s (Ice Pack)');
    expect(line(3)).toBe('Slow 50% for 1s (Ice Pack ★3)');
    const inv = build([at('pan'), at('ice', 3), { type: 'goldstar', near: [1] }]);
    expect(describeBuffs(computeBuild(inv).weapons[0], inv)[0]).toBe('Slow 60% for 1s (Ice Pack ★4)'); // Gold Star: capped
  });
});

// Phase 4: Ice Pack has no runtime hook. It sets `WeaponStats.slow` (so do Jelly Beans, Cold Storage, Brain Freeze and the Frost set);
// applying the slow on hit is the engine's job (src/engine/onHitStatuses.ts, tested in tests/engine/onHitStatuses.test.ts).
describe('Ice Pack: runtime', () => {
  it('has no runtime hooks of its own', () => {
    expect(ice.hooks).toBeUndefined();
  });

  it('its slow lands on a hit through the engine: the tier\'s pct for 1 s, refreshing', () => {
    for (const [tier, pct] of [[1, 0.25], [2, withFrost(0.375, 1)], [3, withFrost(0.5, 2)]] as const) {
      const { fake, stats: w } = arena([at('nailgun'), at('ice', tier)]);
      const e = fake.spawnEnemy({ hp: 100 });
      fake.hit(e, 3, w);
      expect(e.status).toMatchObject({ slowPct: pct, slowUntil: 1 });
    }
  });
});
