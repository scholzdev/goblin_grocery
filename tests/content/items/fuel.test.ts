import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import fuel from '../../../src/content/items/fuel';
import { contentItem, contentSetTune, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { arena, around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

// Burn: 3 / 5 / 7 dps at ★1 / ★2 / ★3, 3 s, 0.5 s ticks. Nail Gun (tools / blast / electric) shares only Tools with the can (cooldown, not burn)
// and has no combo with it. A ★2 / ★3 can is 2 / 3 Heat set points on its own: Heat L1 (burns +1 s); Gold Star's effective ★4 is 4 points:
// L2 (also x1.4 dps).
const gun = at('nailgun');
const HEAT = (lv: number) => contentSetTune('heat', lv);

describe('Fuel Can: build', () => {
  it('sets enemies on fire for 3 / 5 / 7 dps at ★1 / ★2 / ★3 (3 s, 0.5 s ticks), plus the Heat level its own set points reach', () => {
    expect(stats([gun, at('fuel')]).burn).toEqual({ dps: 3, duration: 3, tick: 0.5 });
    expect(stats([gun, at('fuel', 2)]).burn).toEqual({ dps: 5, duration: 3 + HEAT(1).burnExtra, tick: 0.5 });
    expect(stats([gun, at('fuel', 3)]).burn).toEqual({ dps: 7, duration: 3 + HEAT(1).burnExtra, tick: 0.5 });
  });

  it('records the buff, and leaves damage, range and speed alone (only the Tools set speeds the nail gun up)', () => {
    const [w] = computeBuild(cart('nailgun', ['fuel'])).weapons;
    const [plain] = computeBuild(cart('nailgun', [])).weapons;
    expect(w.buffs).toEqual(['fuel']);
    expect(w.range).toBe(plain.range);
    expect(w.pierce).toBe(0);
    expect(w.slow).toBeNull();
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([gun, at('fuel', 3, { near: [], apart: [0] })]);
    expect(w.burn).toBeNull();
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([gun, at('fuel', 1), at('fuel', 3, { near: [0] })]).burn?.dps).toBe(7); // 3 Heat points, not 4: L1, no dps multiplier
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4 = 9 dps)', () => {
    const w = stats([gun, at('fuel', 3), gilded(1)]);
    expect(w.burn?.dps).toBeCloseTo(9 * HEAT(2).burnMult); // 4 Heat points: L2
    expect(contentTune('fuel', 4).dps).toBe(9);
  });

  it('is what Jelly Beans (heat) scales: 70% of the ★1 burn at ★1', () => {
    expect(contentTune('fuel', 1)).toEqual({ dps: 3, duration: 3, tick: 0.5 });
    const w = stats([gun, at('jellybeans', 1, { flavor: 'heat' })]);
    expect(w.burn?.dps).toBeCloseTo(3 * 0.7);
    expect(w.burn?.duration).toBe(3);
  });
});

describe('Fuel Can: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('fuel')).toBe(fuel);
    const def = ITEMS.fuel;
    expect(def).toMatchObject({ id: 'fuel', family: 'tools', element: 'heat', kind: 'module', price: 11, electrical: false, buff: 'fuel' });
    expect(def.cells).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('fuel', 1, 1)).toEqual(['fan', 'fuel', 'battery']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('fuel', t))).toEqual([
      'Any adjacent weapon sets enemies on fire: 3/s burn damage for 3 s (refreshes, never stacks).',
      'Any adjacent weapon sets enemies on fire: 5/s burn damage for 3 s (refreshes, never stacks).',
      'Any adjacent weapon sets enemies on fire: 7/s burn damage for 3 s (refreshes, never stacks).',
    ]);
    setLang('de');
    expect([1, 2, 3].map((t) => itemRules('fuel', t))).toEqual([
      'Jede angrenzende Waffe setzt Gegner in Brand: 3/s Brandschaden für 3 s (erneuert sich, stapelt sich nie).',
      'Jede angrenzende Waffe setzt Gegner in Brand: 5/s Brandschaden für 3 s (erneuert sich, stapelt sich nie).',
      'Jede angrenzende Waffe setzt Gegner in Brand: 7/s Brandschaden für 3 s (erneuert sich, stapelt sich nie).',
    ]);
    expect(itemT('fuel').name).toBe('Benzinkanister');
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('fuel')).toEqual([{ label: 'Burn', values: ['3/s', '5/s', '7/s'] }]);
    setLang('de');
    expect(tierScaling('fuel')).toEqual([{ label: 'Brand', values: ['3/s', '5/s', '7/s'] }]);
  });

  it('shows its buff line with the right numbers per tier', () => {
    const line = (tier: number) => {
      const inv = cart('nailgun', ['fuel']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line(1)).toBe('Burn 3/s for 3s (Fuel Can)');
    expect(line(3)).toBe('Burn 7/s for 3s (Fuel Can ★3)');
  });
});


// Phase 4: Fuel Can has no runtime hook. It sets `WeaponStats.burn` (so do Jelly Beans, the Heat set and Grease Fire), and applying the
// burn on hit is the engine's job (src/engine/onHitStatuses.ts, tested in tests/engine/onHitStatuses.test.ts). No item-id branch exists.
describe('Fuel Can: runtime', () => {
  it('has no runtime hooks of its own', () => {
    expect(fuel.hooks).toBeUndefined();
  });

  it('its burn lands on a hit through the engine: dps / duration / tick of the tier, refreshing', () => {
    for (const [tier, dps, until] of [[1, 3, 3], [2, 5, 3 + HEAT(1).burnExtra], [3, 7, 3 + HEAT(1).burnExtra]] as const) {
      const { fake, stats: w } = arena([at('nailgun'), at('fuel', tier)]);
      const e = fake.spawnEnemy({ hp: 100 });
      fake.hit(e, 3, w);
      expect(e.status).toMatchObject({ burnDps: dps, burnUntil: until, burnTick: 0.5 });
    }
  });
});
