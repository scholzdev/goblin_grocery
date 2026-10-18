import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, PLAYER } from '../../../src/data/items';
import bowlingball from '../../../src/content/items/bowlingball';
import { contentItem } from '../../../src/engine/registry';
import { itemRules } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { cartWeight, slowWeight } from '../../../src/systems/weight';
import { build } from '../../golden/carts';
import { at, far, full } from '../helpers';

afterEach(() => setLang('en'));

const BASE = PLAYER.shove.damage; // 6
const cells = (...types: (keyof typeof ITEMS)[]) => types.reduce((n, t) => n + ITEMS[t].cells.length, 0);

describe('Cart weight', () => {
  it('is the number of occupied cart cells, whatever the shape and rotation', () => {
    const inv = build([at('toaster'), far('bowlingball'), far('fuel'), far('lunchbox')], 8, 6);
    expect(cartWeight(inv)).toBe(cells('toaster', 'bowlingball', 'fuel', 'lunchbox'));
    expect(cartWeight(build([], 8, 6))).toBe(0);
    expect(ITEMS.bowlingball.cells.length).toBe(4);
  });

  it('ignores the shelf', () => {
    const inv = build([at('toaster')], 8, 6);
    inv.shelf[0] = { uid: 's0', type: 'bowlingball', x: 0, y: 0, rot: 0 };
    expect(cartWeight(inv)).toBe(cells('toaster'));
  });
});

describe('Bowling Ball: dash damage', () => {
  it('adds 1 / 1.5 / 2 damage per occupied cell at ★1 / ★2 / ★3, the ball\'s own 4 cells included', () => {
    const cellCount = cells('toaster', 'bowlingball');
    [1, 1.5, 2].forEach((per, i) => {
      const b = full([at('toaster'), far('bowlingball', i + 1)]);
      expect(b.shoveDamage).toBeCloseTo(BASE + per * cellCount, 12);
    });
  });

  it('grows with the cart: a 20-cell cart at ★1 dashes for 26 (the spec\'s check)', () => {
    const fill = [at('toaster'), far('bowlingball'), far('fuel'), far('fuel'), far('lunchbox'), far('lunchbox'), far('lunchbox')];
    const b = full(fill);
    expect(b.shoveDamage).toBe(BASE + cartWeight(build(fill, 8, 6)));
  });

  it('raises dash knockback by 50% and changes nothing else on the dash', () => {
    const plain = full([at('toaster')]), ball = full([at('toaster'), far('bowlingball')]);
    expect(plain.shoveKnockMult).toBe(1);
    expect(ball.shoveKnockMult).toBe(1.5);
    expect(ball.shoveDistMult).toBe(plain.shoveDistMult);
    expect(ball.shoveCooldown).toBe(plain.shoveCooldown);
  });

  it('adds to Boot; the Tools set multiplies the dash damage before the ball\'s weight damage, so the weight is not doubled', () => {
    const tools = full([at('nailgun'), far('tape'), far('boot'), far('bowlingball')]);
    const mult = [1, 1, 2, 3][tools.sets.tools]; // Tools L2 doubles the dash damage, L3 triples it
    expect(mult).toBeGreaterThan(1);
    expect(tools.shoveDamage).toBe((BASE + 6) * mult + cartWeight(build([at('nailgun'), far('tape'), far('boot'), far('bowlingball')], 8, 6)));
  });

  it('does not stack: a second ball changes nothing but the weight it adds itself', () => {
    const one = full([at('toaster'), far('bowlingball', 1)]);
    const two = full([at('toaster'), far('bowlingball', 1), far('bowlingball', 3)]);
    expect(two.shoveKnockMult).toBe(one.shoveKnockMult);
    expect(two.shoveDamage).toBe(BASE + 2 * cells('toaster', 'bowlingball', 'bowlingball')); // best tier (★3) x all cells, once
  });
});

describe('Bowling Ball: slow', () => {
  it('is 0.5% of move speed per occupied cell', () => {
    const b = full([at('toaster'), far('bowlingball')]);
    expect(b.moveSpeedMult).toBeCloseTo(1 - 0.005 * cells('toaster', 'bowlingball'), 12);
    expect(full([at('toaster')]).moveSpeedMult).toBe(1);
  });

  it('multiplies with the starter perk\'s speed', () => {
    const b = full([at('toaster'), far('bowlingball')], { moveSpeedMult: 1.08 });
    expect(b.moveSpeedMult).toBeCloseTo(1.08 * (1 - 0.005 * cells('toaster', 'bowlingball')), 12);
  });
});

describe('Bowling Ball: content', () => {
  it('registers as a 2x2 blast tool, price 18', () => {
    expect(contentItem('bowlingball')).toBe(bowlingball);
    expect(ITEMS.bowlingball).toMatchObject({ id: 'bowlingball', family: 'tools', kind: 'passive', price: 18 });
  });
  it('renders its text for every level, EN and DE, with no unfilled placeholder', () => {
    for (const lang of ['en', 'de'] as const) {
      setLang(lang);
      for (const t of [1, 2, 3]) expect(itemRules('bowlingball', t)).not.toMatch(/[{}]/);
    }
    setLang('en');
    expect(itemRules('bowlingball', 2)).toContain('+1.5 damage per occupied cart cell');
  });
});

describe('slowWeight without a balloon', () => {
  it('equals the weight', () => {
    const inv = build([at('toaster'), far('bowlingball')], 8, 6);
    expect(slowWeight(inv)).toBe(cartWeight(inv));
  });
});
