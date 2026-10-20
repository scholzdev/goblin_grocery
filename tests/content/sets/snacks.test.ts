import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER } from '../../../src/data/items';
import snacks from '../../../src/content/sets/snacks';
import { contentSet, contentSetTune, contentTune } from '../../../src/engine/registry';
import { setLang } from '../../../src/i18n/lang';
import { at, far, full } from '../helpers';
import { expectSetText } from './helpers';

afterEach(() => setLang('en'));

const FIZZ = at('fizz'); // a snacks weapon
// Snacks members with no HP or regen of their own: Energy Drink and Fortune Cookie (passives), Multipack (a module not next to the weapon).
const MEMBERS = [far('energy'), far('fortune'), far('multipack')];
const cart = (n: number) => [FIZZ, ...MEMBERS.slice(0, n)];

describe('Snacks set: thresholds', () => {
  it('2 / 3 / 4 set points (one per ★1 snacks type) give L1 / L2 / L3; the weapon alone is 1', () => {
    expect([0, 1, 2, 3].map((n) => full(cart(n)).sets.snacks)).toEqual([0, 1, 2, 3]);
  });

  it('no bonus below the threshold: base max HP, no regen', () => {
    const b = full(cart(0));
    expect(b.maxHp).toBe(PLAYER.maxHp);
    expect(b.regen).toBe(0);
  });

  it('L1 +10 max HP', () => {
    const b = full(cart(1));
    expect(b.maxHp).toBe(PLAYER.maxHp + 10);
    expect(b.regen).toBe(0);
  });

  it('L2 adds 0.3 HP/s of regen on top', () => {
    const b = full(cart(2));
    expect(b.maxHp).toBe(PLAYER.maxHp + 10);
    expect(b.regen).toBe(0.3);
  });

  it('L3 replaces the numbers: +20 max HP and 0.6 HP/s', () => {
    const b = full(cart(3));
    expect(b.maxHp).toBe(PLAYER.maxHp + 20);
    expect(b.regen).toBe(0.6);
  });

  it('adds to the perk\'s max HP', () => {
    expect(full(cart(1), { maxHp: 5 }).maxHp).toBe(PLAYER.maxHp + 5 + 10);
    expect(full(cart(0), { maxHp: -8 }).maxHp).toBe(PLAYER.maxHp - 8);
  });

  it('adds to the items\' own HP and regen: Lunchbox, Snack Bag (their regen 0.25 plus the set\'s, either order)', () => {
    const lunch = contentTune('lunchbox', 1).hp;
    expect(full([FIZZ, far('lunchbox'), far('energy')]).maxHp).toBe(PLAYER.maxHp + Math.round(lunch) + 10);
    const bag = full([FIZZ, far('snackbag'), far('energy'), far('fortune')]); // L3: fizz, snackbag, energy, fortune
    expect(bag.sets.snacks).toBe(3);
    expect(bag.regen).toBeCloseTo(0.25 + 0.6, 12);
  });

  it('comes before Expired Milk\'s x0.9: the curse multiplies the finished total, rounded once', () => {
    // Expired Milk is a snacks passive itself: fizz + energy + milk = L2 (+10 HP), + fortune = L3 (+20 HP).
    expect(full([FIZZ, far('energy'), far('expiredmilk')]).maxHp).toBe(Math.round((PLAYER.maxHp + 10) * 0.9));
    expect(full([FIZZ, far('energy'), far('fortune'), far('expiredmilk')]).maxHp).toBe(Math.round((PLAYER.maxHp + 20) * 0.9));
  });
});

describe('Snacks set: content', () => {
  it('is registered with its tune (arrays are L1/L2/L3), and has no combat hooks (the arena reads Build.regen)', () => {
    expect(contentSet('snacks')).toBe(snacks);
    expect(contentSetTune('snacks', 1)).toEqual({ maxHp: 10, regen: 0.3 });
    expect(contentSetTune('snacks', 2)).toEqual({ maxHp: 10, regen: 0.3 });
    expect(contentSetTune('snacks', 3)).toEqual({ maxHp: 20, regen: 0.6 });
    expect(snacks.hooks).toBeUndefined();
  });

  it('is a final-phase player hook before Expired Milk\'s', () => {
    expect(snacks.build).toMatchObject({ phase: 'final', order: 10 });
    expect(snacks.build?.weapon).toBeUndefined();
  });

  it('renders EN and DE bonus lines from the tune', () => {
    expectSetText('snacks', {
      en: { name: 'Snacks', bonus: ['+10 max HP', '+0.3 HP/s regen in combat', '+20 max HP, +0.6 HP/s regen in combat'] },
      de: { name: 'Snacks', bonus: ['+10 max. LP', '+0,3 LP/s Regeneration im Kampf', '+20 max. LP, +0,6 LP/s Regeneration im Kampf'] },
    });
  });
});
