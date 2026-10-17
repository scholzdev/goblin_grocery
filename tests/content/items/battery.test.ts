import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import battery from '../../../src/content/items/battery';
import { contentItem } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { cart } from '../../cart';
import { around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: +12% attack speed at ★1 (x TIER.mult), electric weapons get 1.5x of the bonus. Toaster is electric (Electric set L1 only adds arcs),
// Pan is not; neither shares a set with the battery (tools) and neither has a combo with it.
const toaster = ITEMS.toaster.weapon!, pan = ITEMS.pan.weapon!;

describe('Battery: build', () => {
  it('speeds a non-electric weapon up by 12% / 18% / 24% at ★1 / ★2 / ★3', () => {
    expect(stats([at('pan'), at('battery')]).cooldown).toBeCloseTo(pan.cooldown / 1.12);
    expect(stats([at('pan'), at('battery', 2)]).cooldown).toBeCloseTo(pan.cooldown / 1.18);
    expect(stats([at('pan'), at('battery', 3)]).cooldown).toBeCloseTo(pan.cooldown / 1.24);
  });

  it('speeds an electric weapon up by 1.5x the bonus: 18% / 27% / 36%', () => {
    expect(stats([at('toaster'), at('battery')]).cooldown).toBeCloseTo(toaster.cooldown / 1.18);
    expect(stats([at('toaster'), at('battery', 2)]).cooldown).toBeCloseTo(toaster.cooldown / 1.27);
    expect(stats([at('toaster'), at('battery', 3)]).cooldown).toBeCloseTo(toaster.cooldown / 1.36);
  });

  it('records the buff, and nothing else changes', () => {
    const [w] = computeBuild(cart('pan', ['battery'])).weapons;
    const [plain] = computeBuild(cart('pan', [])).weapons;
    expect(w.buffs).toEqual(['battery']);
    expect(w.range).toBe(plain.range);
    expect(w.burn).toBeNull();
    expect(w.recipes).toEqual([]);
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([at('pan'), at('battery', 3, { near: [], apart: [0] })]);
    expect(w.cooldown).toBe(pan.cooldown);
    expect(w.buffs).toEqual([]);
  });

  it('does not stack: the highest touching tier counts once', () => {
    expect(stats([at('pan'), at('battery', 1), at('battery', 3, { near: [0] })]).cooldown).toBeCloseTo(pan.cooldown / 1.24);
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4 = +30% / +45% electric)', () => {
    expect(stats([at('pan'), at('battery', 3), gilded(1)]).cooldown).toBeCloseTo(pan.cooldown / (1 + 0.12 * TIER.mult(4)));
    expect(stats([at('toaster'), at('battery', 3), gilded(1)]).cooldown).toBeCloseTo(toaster.cooldown / (1 + 0.12 * 1.5 * TIER.mult(4)));
    expect(1 + 0.12 * 1.5 * TIER.mult(4)).toBeCloseTo(1.45);
  });
});

describe('Battery: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('battery')).toBe(battery);
    const def = ITEMS.battery;
    expect(def).toMatchObject({ id: 'battery', family: 'tools', kind: 'module', price: 8, electrical: true, buff: 'battery' });
    expect(def.element).toBeUndefined();
    expect(def.cells).toEqual([{ x: 0, y: 0 }]);
    expect(def.legendary).toBeUndefined();
    expect(def.weapon).toBeUndefined();
  });

  it('keeps its position in the item order', () => {
    expect(around('battery', 1, 1)).toEqual(['fuel', 'battery', 'magnet']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('battery', t))).toEqual([
      'Any adjacent weapon gets +12% attack speed; Electric weapons +18%.',
      'Any adjacent weapon gets +18% attack speed; Electric weapons +27%.',
      'Any adjacent weapon gets +24% attack speed; Electric weapons +36%.',
    ]);
    setLang('de');
    expect(itemRules('battery', 3)).toBe('Jede angrenzende Waffe erhält +24% Angriffstempo; elektrische Waffen +36%.');
    expect(itemT('battery').name).toBe('Batterie');
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('battery')).toEqual([
      { label: 'Attack speed', values: ['+12%', '+18%', '+24%'] },
      { label: 'Electric', values: ['+18%', '+27%', '+36%'] },
    ]);
    setLang('de');
    expect(tierScaling('battery').map((r) => r.label)).toEqual(['Angriffstempo', 'Elektrisch']);
  });

  it('shows its buff line: the electric bonus for electric weapons, the plain one otherwise', () => {
    const line = (weapon: 'toaster' | 'pan', tier: number) => {
      const inv = cart(weapon, ['battery']);
      inv.placed[1].tier = tier;
      return describeBuffs(computeBuild(inv).weapons[0], inv)[0];
    };
    expect(line('pan', 1)).toBe('+12% attack rate (Battery)');
    expect(line('toaster', 1)).toBe('+18% attack rate (Battery)');
    expect(line('toaster', 3)).toBe('+36% attack rate (Battery ★3)');
  });
});
