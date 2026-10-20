import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import goldstar from '../../../src/content/items/goldstar';
import { tierBoostOf } from '../../../src/engine/build';
import { contentItem, contentSetTune, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { computeBuild, describeBuffs, tierScaling } from '../../../src/systems/synergies';
import { build } from '../../golden/carts';
import { around, at, corner, full, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

const BUNDLE = 0.06; // Bundle Deal: +6% damage per distinct touching type
const STAR = { type: 'goldstar' } as const; // touches the weapon (item 0)

// Legacy: a legendary. Modules and passives touching it count one effective tier higher (so a ★3 works at ★4; no chaining: one lift however many
// stars touch it; never weapons or legendaries). Weapons touching it also count one more item for Bundle Deal. Declared with `tierBoost`
// on the content file and read by `eff()` in computeBuild (a hook cannot do it: the tier feeds every other hook).
describe('Gold Star Sticker: tier lift', () => {
  it('lifts a touching module one tier (Hot Sauce ★3 -> effective ★4: +62.5% instead of +50%)', () => {
    const BASE = 3; // Nail Gun
    const plain = stats([at('nailgun'), at('hotsauce', 3)]).damage, lifted = stats([at('nailgun'), at('hotsauce', 3), gilded(1)]).damage;
    expect(plain).toBeCloseTo(BASE * 1.5 * (1 + BUNDLE));
    expect(lifted).toBeCloseTo(BASE * (1 + 0.25 * TIER.mult(4)) * (1 + BUNDLE));
    expect(lifted).toBeCloseTo(BASE * 1.625 * (1 + BUNDLE));
  });

  it('lifts a touching passive one tier (Fortune Cookie ★3 -> effective ★4: +12.5% crit instead of +10%)', () => {
    const crit = (specs: Parameters<typeof full>[0]) => full(specs).weapons[0].critChance;
    expect(crit([at('toaster'), corner('fortune', 3)])).toBeCloseTo(0.1, 12);
    expect(crit([at('toaster'), corner('fortune', 3), gilded(1)])).toBeCloseTo(0.125, 12);
    expect(crit([at('toaster'), corner('fortune', 1), gilded(1)])).toBeCloseTo(0.075, 12); // ★1 -> effective ★2
  });

  it('lifts a touching passive that only changes the player (Lunchbox ★3: 30 -> 37.5 -> 38 max HP), and its set points (Snacks L2 -> L3)', () => {
    expect(full([at('toaster'), corner('lunchbox', 3)]).maxHp).toBe(40 + 30 + contentSetTune('snacks', 2).maxHp);
    expect(full([at('toaster'), corner('lunchbox', 3), gilded(1)]).maxHp).toBe(40 + 38 + contentSetTune('snacks', 3).maxHp);
  });

  it('only lifts what it touches', () => {
    const far = at('hotsauce', 3, { near: [0] });
    const star = (i: number) => ({ type: 'goldstar' as const, near: [i], apart: [0] });
    const base = stats([at('nailgun'), far]).damage;
    expect(stats([at('nailgun'), far, { type: 'goldstar', near: [], apart: [0, 1] }]).damage).toBeCloseTo(base);
    expect(stats([at('nailgun'), far, star(1)]).damage).toBeGreaterThan(base);
  });

  it('does not chain: a second star adds nothing, and a lifted module lifts nothing', () => {
    // Fan ★3 at (3,1)-(3,2) touches the Toaster; the stars sit at (4,1) and (3,3), away from the Toaster.
    const fan = at('fan', 3, { at: [3, 1] });
    const starA = { type: 'goldstar' as const, at: [4, 1] as [number, number] }, starB = { type: 'goldstar' as const, at: [3, 3] as [number, number] };
    const range = (specs: Parameters<typeof full>[0]) => full(specs).weapons[0].range;
    const base = ITEMS.toaster.weapon!.range;
    expect(range([at('toaster'), fan])).toBeCloseTo(base * 1.6, 12); // ★3: +60%
    expect(range([at('toaster'), fan, starA])).toBeCloseTo(base * 1.75, 12); // effective ★4: +75%
    expect(range([at('toaster'), fan, starA, starB])).toBeCloseTo(base * 1.75, 12); // two stars: still ★4, not ★5
    // A ★3 Hot Sauce at (2,2) touches the Toaster and the lifted fan but no star: it keeps its own tier
    const sauce = at('hotsauce', 3, { at: [2, 2] });
    const damage = (specs: Parameters<typeof full>[0]) => full(specs).weapons[0].damage;
    expect(full([at('toaster'), fan, starA, sauce]).weapons[0].buffs).toEqual(['fan', 'hotsauce']); // both touch the Toaster
    expect(damage([at('toaster'), fan, starA, sauce])).toBeCloseTo(damage([at('toaster'), fan, sauce]), 12);
  });

  it('never lifts a weapon (its tier and stats stay)', () => {
    const w = stats([at('toaster', 2), STAR]);
    expect(w.tier).toBe(2);
    const base = ITEMS.toaster.weapon!;
    expect(w.damage).toBeCloseTo(base.damage * TIER.weaponDamage(2) * (1 + BUNDLE * 2) * contentSetTune('kitchen', 1).damageMult, 12); // its own ★2: 2 Kitchen points, not 3
    expect(w.cooldown).toBeCloseTo(base.cooldown * TIER.weaponCooldown(2), 12);
  });

  it('never lifts a legendary (Power Strip, Snack Bag, another Gold Star)', () => {
    const T = ITEMS.toaster.weapon!.cooldown;
    expect(full([at('toaster'), at('powerstrip'), { type: 'goldstar', near: [1], apart: [0] }]).weapons[0].cooldown).toBeCloseTo(T / 1.4, 12);
    expect(full([at('toaster'), corner('snackbag'), gilded(1)]).maxHp).toBe(40 + 20);
    const inv = build([at('toaster'), STAR, { type: 'goldstar', near: [1], apart: [0] }], 8, 6);
    const boost = tierBoostOf(inv.placed);
    expect(inv.placed.map((p) => boost(p))).toEqual([0, 0, 0]); // the weapon and both stars
  });

  it('exposes the lift per instance (tierBoostOf)', () => {
    const inv = build([at('nailgun'), at('hotsauce', 3), gilded(1)], 8, 6);
    const boost = tierBoostOf(inv.placed);
    expect(boost(inv.placed[1])).toBe(1);
    expect(boost(inv.placed[0])).toBe(0);
    expect(tierBoostOf(build([at('nailgun'), at('hotsauce')]).placed)(inv.placed[1])).toBe(0); // no star in the cart
  });

  it('is shown in the weapon\'s buff lines (Fuel Can ★3 + star -> ★4)', () => {
    const inv = build([at('toaster'), at('fuel', 3), gilded(1)], 8, 6);
    const [w] = computeBuild(inv).weapons;
    expect(describeBuffs(w, inv)[0]).toMatch(/\(Fuel Can ★4\)$/);
    expect(describeBuffs(w, build([at('toaster'), at('fuel', 3)], 8, 6))[0]).toMatch(/\(Fuel Can ★3\)$/);
  });
});

describe('Gold Star Sticker: Bundle Deal', () => {
  it('a touching weapon counts one more item (the star itself + 1) and gains +6% each', () => {
    const w = stats([at('pan'), STAR]);
    expect(w.bundle).toBe(2);
    expect(w.damage).toBeCloseTo(ITEMS.pan.weapon!.damage * (1 + BUNDLE * 2), 12);
  });

  it('adds on top of the other touching types', () => {
    const w = stats([at('pan'), at('fan'), STAR]);
    expect(w.bundle).toBe(3);
  });

  it('counts once however many stars touch the weapon', () => {
    expect(stats([at('pan'), STAR, { type: 'goldstar', near: [0] }]).bundle).toBe(2);
  });

  it('does nothing for a weapon it does not touch', () => {
    expect(stats([at('pan'), { type: 'goldstar', near: [], apart: [0] }]).bundle).toBe(0);
  });

  it('applies per weapon', () => {
    const b = full([at('pan'), STAR, at('toaster', 1, { near: [1], apart: [0] })]).weapons;
    expect(b.find((w) => w.type === 'pan')!.bundle).toBe(2);
    expect(b.find((w) => w.type === 'toaster')!.bundle).toBe(2);
    const apart = full([at('pan'), STAR, at('toaster', 1, { near: [], apart: [0, 1] })]).weapons;
    expect(apart.find((w) => w.type === 'toaster')!.bundle).toBe(0);
  });

  it('records no buff', () => {
    expect(stats([at('pan'), STAR]).buffs).toEqual([]);
  });

  it('is a checkout item', () => {
    expect(ITEMS.goldstar.family).toBe('checkout');
    expect(full([at('pan'), STAR, corner('bell')]).sets.checkout).toBe(1); // a bell it does not touch: 1 + 1 set points
  });
});

describe('Gold Star Sticker: content', () => {
  it('is the registered content file with the tierBoost declaration', () => {
    expect(contentItem('goldstar')).toBe(goldstar);
    expect(goldstar.tierBoost).toEqual({ key: 'tiers', excludes: ['weapon', 'legendary'] });
    expect(ITEMS.goldstar).toMatchObject({ id: 'goldstar', family: 'checkout', kind: 'module', price: 28, electrical: false, legendary: true });
    expect(ITEMS.goldstar.element).toBeUndefined();
    expect(ITEMS.goldstar.buff).toBeUndefined();
    expect(ITEMS.goldstar.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps its tune in one place (scalars: a legendary has one tier)', () => {
    expect(contentTune('goldstar', 1)).toEqual({ tiers: 1, maxTier: 4, bundle: 1 });
    expect(contentTune('goldstar', 1).maxTier).toBe(TIER.max + contentTune('goldstar', 1).tiers);
  });

  it('keeps its position in the item order', () => {
    expect(around('goldstar', 1, 1)).toEqual(['powerstrip', 'goldstar', 'laser']);
  });

  it('renders its text (the same at every level), EN and DE', () => {
    const en = 'Modules and passives touching it work one tier higher (up to ★4 strength). Weapons touching it get +1 Bundle Deal item.';
    expect([1, 2, 3].map((t) => itemRules('goldstar', t))).toEqual([en, en, en]);
    setLang('de');
    expect(itemRules('goldstar', 1)).toBe('Module und Passive, die ihn berühren, wirken eine Stufe höher (bis zu ★4 Stärke). Waffen, die ihn berühren, erhalten +1 Sparpaket-Gegenstand.');
    expect(itemT('goldstar')).toMatchObject({ name: 'Goldstern-Sticker', blurb: 'Lehrers Liebling. Alles in der Nähe gibt sich mehr Mühe.' });
  });

  it('has no scaling rows (legendary)', () => {
    expect(tierScaling('goldstar')).toEqual([]);
  });
});
