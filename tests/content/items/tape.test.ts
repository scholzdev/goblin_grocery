import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import tape from '../../../src/content/items/tape';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { around, at, gilded, stats } from '../helpers';
import type { ItemTypeId } from '../../../src/types';

afterEach(() => setLang('en'));

// Legacy: pierce +1 (+1 more at ★3), +30° arc, +20% radius/length at ★1; arc and radius x TIER.mult. Each weapon below shares no set with the tape
// (tools) and has no combo with it.
const base = (id: ItemTypeId) => ITEMS[id].weapon!;

describe('Duct Tape: build per pattern', () => {
  it('projectiles (toast, burst, ricochet) pierce +1 / +1 / +2 at ★1 / ★2 / ★3', () => {
    for (const id of ['toaster', 'fizz'] as const) {
      expect([1, 2, 3].map((t) => stats([at(id), at('tape', t)]).pierce)).toEqual([1, 1, 2]);
      expect(stats([at(id), at('tape', 3)]).range).toBe(base(id).range);
    }
  });

  it('sweeps and cones gain +30° / +45° / +60° of arc', () => {
    for (const id of ['pan', 'leafblower'] as const) {
      expect([1, 2, 3].map((t) => stats([at(id), at('tape', t)]).arcDeg)).toEqual([30, 45, 60].map((a) => base(id).arcDeg + a));
      expect(stats([at(id), at('tape', 3)]).range).toBe(base(id).range);
    }
  });

  it('zaps (and mortars) grow their blast radius +20% / +30% / +40%', () => {
    expect([1, 2, 3].map((t) => stats([at('microwave'), at('tape', t)]).aoe)).toEqual([1.2, 1.3, 1.4].map((m) => expect.closeTo(base('microwave').aoe * m)));
    expect(stats([at('microwave'), at('tape', 3)]).range).toBe(base('microwave').range);
  });

  it('pulses, auras, puddles and lasers grow their range +20% / +30% / +40%', () => {
    for (const id of ['vacuum', 'blender', 'mop', 'laser'] as const) {
      expect([1, 2, 3].map((t) => stats([at(id), at('tape', t)]).range)).toEqual([1.2, 1.3, 1.4].map((m) => expect.closeTo(base(id).range * m)));
    }
  });

  it('records the buff on every kind of weapon, and nothing else changes', () => {
    const [w] = computeBuild(cart('pan', ['tape'])).weapons;
    expect(w.buffs).toEqual(['tape']);
    expect(w.pierce).toBe(0);
    expect(w.aoe).toBe(0);
    expect(w.cooldown).toBe(base('pan').cooldown);
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([at('toaster'), at('tape', 3, { near: [], apart: [0] })]);
    expect(w.pierce).toBe(0);
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([at('toaster'), at('tape', 1), at('tape', 3, { near: [0] })]).pierce).toBe(2);
  });
});

describe('Duct Tape: Gold Star (effective ★4)', () => {
  it('keeps the pierce at +2 (a threshold, not linear), but arc and radius continue linearly (x2.5)', () => {
    expect(stats([at('toaster'), at('tape', 3), gilded(1)]).pierce).toBe(2);
    expect(stats([at('pan'), at('tape', 3), gilded(1)]).arcDeg).toBeCloseTo(base('pan').arcDeg + 30 * TIER.mult(4));
    expect(stats([at('vacuum'), at('tape', 3), gilded(1)]).range).toBeCloseTo(base('vacuum').range * (1 + 0.2 * TIER.mult(4)));
    expect(stats([at('microwave'), at('tape', 3), gilded(1)]).aoe).toBeCloseTo(base('microwave').aoe * 1.5);
  });

  it('lifts a ★2 tape to effective ★3: +2 pierce', () => {
    expect(stats([at('toaster'), at('tape', 2), gilded(1)]).pierce).toBe(2);
  });
});

describe('Duct Tape: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('tape')).toBe(tape);
    const def = ITEMS.tape;
    expect(def).toMatchObject({ id: 'tape', family: 'tools', name: 'Duct Tape', kind: 'module', price: 9, electrical: false, buff: 'tape' });
    expect(def.element).toBeUndefined();
    expect(def.cells).toEqual([{ x: 0, y: 0 }]);
    expect(def.rules).toBe('Any adjacent weapon: projectiles pierce {0}, sweeps and cones {1} arc, areas {2} radius, beams {2} length.');
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('tape', 1, 1)).toEqual(['pricegun', 'tape', 'coupon']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('tape', t))).toEqual([
      'Any adjacent weapon: projectiles pierce +1, sweeps and cones +30° arc, areas +20% radius, beams +20% length.',
      'Any adjacent weapon: projectiles pierce +1, sweeps and cones +45° arc, areas +30% radius, beams +30% length.',
      'Any adjacent weapon: projectiles pierce +2, sweeps and cones +60° arc, areas +40% radius, beams +40% length.',
    ]);
    setLang('de');
    expect(itemRules('tape', 3)).toBe('Jede angrenzende Waffe: Projektile durchschlagen +2, Schwünge und Kegel +60° Bogen, Flächen +40% Radius, Strahlen +40% Länge.');
    expect(itemT('tape').name).toBe('Panzertape');
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('tape')).toEqual([
      { label: 'Pierce', values: ['+1', '+1', '+2'] },
      { label: 'Swing arc', values: ['+30°', '+45°', '+60°'] },
      { label: 'Radius', values: ['+20%', '+30%', '+40%'] },
    ]);
    setLang('de');
    expect(tierScaling('tape').map((r) => r.label)).toEqual(['Durchschlag', 'Schwungbogen', 'Radius']);
  });

  it('shows its (number-free) buff line, starred above ★1', () => {
    const line = (tier: number) => {
      const inv = cart('pan', ['tape']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line(1)).toBe('Bigger reach / extra pierce (Duct Tape)');
    expect(line(3)).toBe('Bigger reach / extra pierce (Duct Tape ★3)');
  });
});
