import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import doublebag from '../../../src/content/items/doublebag';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { arena, around, at, stats } from '../helpers';
import type { Spec } from '../../golden/carts';

afterEach(() => setLang('en'));

// Legacy: the second strike deals 50% of the hit at ★1 x TIER.mult (max 100%), 0.12 s later; not for auras or puddles (no direct hits). The buff id is
// `echo`. Toaster (kitchen / heat / electric), Blender (aura) and Mop (puddle) share no set with the bag (checkout / blast) and have no combo with it.
describe('Double Bag: build', () => {
  it('repeats direct hits for 50% / 75% / 100% damage at ★1 / ★2 / ★3', () => {
    expect([1, 2, 3].map((t) => stats([at('toaster'), at('doublebag', t)]).echo)).toEqual([0.5, 0.75, 1]);
  });

  it('records the buff under its legacy id `echo`', () => {
    const [w] = computeBuild(cart('toaster', ['doublebag'])).weapons;
    const [plain] = computeBuild(cart('toaster', [])).weapons;
    expect(w.buffs).toEqual(['echo']);
    expect(w.cooldown).toBe(plain.cooldown);
    expect(w.range).toBe(plain.range);
    expect(w.burn).toBeNull();
  });

  it('skips auras and puddles: no echo, and the buff is not recorded', () => {
    for (const id of ['blender', 'mop'] as const) {
      const w = stats([at(id), at('doublebag', 3)]);
      expect(w.echo).toBe(0);
      expect(w.buffs).toEqual([]);
    }
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([at('toaster'), at('doublebag', 3, { near: [], apart: [0] })]);
    expect(w.echo).toBe(0);
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([at('toaster'), at('doublebag', 1), at('doublebag', 3, { near: [0] })]).echo).toBe(1);
  });

  it('Gold Star lifts it one tier, but the second strike never exceeds the original hit (effective ★4 would be 125%)', () => {
    expect(0.5 * TIER.mult(4)).toBe(1.25);
    const star: Spec = { type: 'goldstar', near: [1] }; // (it may touch the toaster too: only the bag's tier matters for the echo)
    expect(stats([at('toaster'), at('doublebag', 3), star]).echo).toBe(1);
    expect(stats([at('toaster'), at('doublebag', 2), star]).echo).toBeCloseTo(0.5 * TIER.mult(3)); // effective ★3: 100%
  });

  it('keeps the strike delay in its tune (read by the arena at runtime)', () => {
    expect(contentTune('doublebag', 1).delay).toBe(0.12);
  });
});

describe('Double Bag: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('doublebag')).toBe(doublebag);
    const def = ITEMS.doublebag;
    expect(def).toMatchObject({ id: 'doublebag', family: 'checkout', element: 'blast', kind: 'module', price: 12, electrical: false, buff: 'echo' });
    expect(def.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('doublebag', 1, 1)).toEqual(['popper', 'doublebag', 'multipack']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('doublebag', t))).toEqual([
      'Direct hits from adjacent weapons strike a second time 0.12 s later for 50% damage.',
      'Direct hits from adjacent weapons strike a second time 0.12 s later for 75% damage.',
      'Direct hits from adjacent weapons strike a second time 0.12 s later for 100% damage.',
    ]);
    setLang('de');
    expect(itemRules('doublebag', 1)).toBe('Direkte Treffer angrenzender Waffen schlagen 0,12 s später ein zweites Mal zu, für 50% Schaden.');
    expect(itemT('doublebag').name).toBe('Doppeltüte');
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('doublebag')).toEqual([{ label: 'Double hit', values: ['50%', '75%', '100%'] }]);
    setLang('de');
    expect(tierScaling('doublebag')).toEqual([{ label: 'Doppeltreffer', values: ['50%', '75%', '100%'] }]);
  });

  it('shows its buff line with the right percentage per tier', () => {
    const line = (tier: number) => {
      const inv = cart('toaster', ['doublebag']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line(1)).toBe('Hits repeat for 50% damage (Double Bag)');
    expect(line(3)).toBe('Hits repeat for 100% damage (Double Bag ★3)');
  });
});

// Phase 4: Double Bag has no runtime hook. It sets `WeaponStats.echo`; the second strike is the engine's job (src/engine/onHitStatuses.ts
// `scheduleEcho`, tested in tests/engine/onHitStatuses.test.ts). The 0.12 s delay is this file's flat tune, read by the engine.
describe('Double Bag: runtime', () => {
  it('has no runtime hooks of its own', () => {
    expect(doublebag.hooks).toBeUndefined();
  });

  it('its second strike lands through the engine after the tune\'s delay, for the tier\'s share', () => {
    for (const [tier, share] of [[1, 0.5], [2, 0.75], [3, 1]] as const) {
      const { fake, stats: w } = arena([at('nailgun'), at('doublebag', tier)]);
      const e = fake.spawnEnemy({ hp: 100 });
      fake.hit(e, 10, w);
      fake.advance(contentTune('doublebag', 1).delay);
      expect(e.hp).toBe(100 - 10 - 10 * share);
    }
  });
});
