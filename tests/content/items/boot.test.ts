import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER, TIER } from '../../../src/data/items';
import boot from '../../../src/content/items/boot';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, arena, at, corner, far, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

const BASE = PLAYER.shove.damage; // 6

// Legacy: dash distance +35% and dash damage +6 at ★1 (x TIER.mult); the best copy counts once; the Tools set (L2+) multiplies the total.
describe('Running Boot: build', () => {
  it('sets the dash reach x1.35 / x1.525 / x1.7 and the dash damage 12 / 15 / 18 at ★1 / ★2 / ★3', () => {
    const plain = full([at('toaster')]);
    expect([plain.shoveDistMult, plain.shoveDamage]).toEqual([1, BASE]);
    [[1.35, 12], [1 + 0.35 * 1.5, 15], [1.7, 18]].forEach(([dist, dmg], i) => {
      const b = full([at('toaster'), far('boot', i + 1)]);
      expect(b.shoveDistMult).toBeCloseTo(dist, 12);
      expect(b.shoveDamage).toBe(dmg);
    });
  });

  it('matches the legacy formulas to the bit (1 + 0.35 x TIER.mult, 6 + 6 x TIER.mult), also at Gold Star\'s effective ★4', () => {
    for (const t of [1, 2, 3]) {
      const b = full([at('toaster'), far('boot', t)]);
      expect(b.shoveDistMult).toBe(1 + 0.35 * TIER.mult(t));
      expect(b.shoveDamage).toBe(BASE + 6 * TIER.mult(t));
    }
    const lifted = full([at('toaster'), corner('boot', 3), gilded(1)]);
    expect(lifted.shoveDistMult).toBe(1 + 0.35 * TIER.mult(4));
    expect(lifted.shoveDamage).toBe(BASE + 6 * TIER.mult(4)); // 21
  });

  it('changes nothing but the two dash fields', () => {
    const plain = full([at('toaster')]), withBoot = full([at('toaster'), far('boot', 3)]);
    expect(withBoot.weapons).toEqual(plain.weapons);
    expect({ ...withBoot, shoveDistMult: 0, shoveDamage: 0 }).toEqual({ ...plain, shoveDistMult: 0, shoveDamage: 0 });
  });

  it('does not stack: the best copy in the cart counts once', () => {
    expect(full([at('toaster'), far('boot', 1), far('boot', 3)]).shoveDamage).toBe(BASE + 12);
    expect(full([at('toaster'), far('boot', 2), at('boot', 1, { near: [0] })]).shoveDistMult).toBe(1 + 0.35 * 1.5);
  });

  it('adds to the perk\'s flat dash damage, and the Tools set\'s multiplier applies to the finished total (boot included)', () => {
    expect(full([at('toaster'), far('boot')], { shoveDamage: 2 }).shoveDamage).toBe(BASE + 6 + 2);
    // Nail Gun + Duct Tape + Boot = 3 tools types: Tools L2 (dash damage x2, dash stun 0.3 s)
    const tools = full([at('nailgun'), far('tape'), far('boot', 2)], { shoveDamage: 2 });
    expect(tools.sets.tools).toBe(2);
    expect(tools.shoveStun).toBe(0.3);
    expect(tools.shoveDamage).toBe((BASE + 9 + 2) * 2); // the legacy (base + boot + perk) x mult
    expect(full([at('nailgun'), far('tape')]).shoveDamage).toBe(BASE); // no boot, Tools L1: nothing multiplies
  });
});

// Boot has no runtime hook on purpose: the dash itself reads shoveDistMult / shoveDamage (the contract), nothing item-specific happens in combat.
describe('Running Boot: runtime', () => {
  it('has no combat hooks, and compiles none', () => {
    expect(boot.hooks).toBeUndefined();
    const { fake } = arena([at('toaster'), far('boot', 3)]);
    expect(fake.hooks.size).toBe(0);
  });
});

describe('Running Boot: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('boot')).toBe(boot);
    expect(ITEMS.boot).toMatchObject({ id: 'boot', family: 'tools', name: 'Running Boot', kind: 'passive', price: 9, electrical: false });
    expect(ITEMS.boot.element).toBeUndefined();
    expect(ITEMS.boot.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.boot.rules).toBe('Space dash: {0} distance and {1} damage.');
  });

  it('keeps its tune in one place', () => {
    expect([1, 2, 3, 4].map((t) => contentTune('boot', t).distance)).toEqual([0.35, 0.35 * 1.5, 0.7, 0.35 * 2.5]);
    expect([1, 2, 3, 4].map((t) => contentTune('boot', t).damage)).toEqual([6, 9, 12, 15]);
  });

  it('keeps its position in the item order', () => {
    expect(around('boot', 1, 1)).toEqual(['bell', 'boot', 'bumper']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('boot', t))).toEqual([
      'Space dash: +35% distance and +6 damage.',
      'Space dash: +52% distance and +9 damage.',
      'Space dash: +70% distance and +12 damage.',
    ]);
    setLang('de');
    expect(itemRules('boot', 3)).toBe('Leertasten-Dash: +70% Distanz und +12 Schaden.');
    expect(itemT('boot')).toMatchObject({ name: 'Rennstiefel', blurb: 'Sprinter aus dem Wühltisch. Dash, als hättest du ihn geklaut.' });
  });

  it('generates the shop scaling rows', () => {
    expect(tierScaling('boot')).toEqual([
      { label: 'Dash distance', values: ['+35%', '+52%', '+70%'] },
      { label: 'Dash damage', values: ['+6', '+9', '+12'] },
    ]);
    setLang('de');
    expect(tierScaling('boot')[0].label).toBe('Dash-Distanz');
  });
});
