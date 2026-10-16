import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS } from '../../../src/data/items';
import powerstrip from '../../../src/content/items/powerstrip';
import { contentItem, contentSetTune, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { tierScaling } from '../../../src/systems/synergies';
import { around, at, full, stats } from '../helpers';

afterEach(() => setLang('en'));

const T = ITEMS.toaster.weapon!.cooldown; // 1.0 (electrical)
const PAN = ITEMS.pan.weapon!.cooldown; // 1.15 (not electrical)
const ALL = contentTune('powerstrip', 1).all, ADJ = contentTune('powerstrip', 1).adjacent;
const cooldown = (specs: Parameters<typeof stats>[0], i = 0) => full(specs).weapons[i].cooldown;
/** A strip anywhere in the cart, not touching the weapon. */
const stripFar = at('powerstrip', 1, { near: [], apart: [0] });

// Legacy: a legendary (tools, electrical, 3x1) that divides the cooldown of every electrical weapon by 1.2, and of the ones touching it by 1.4 instead.
describe('Power Strip: build', () => {
  it('speeds up every electrical weapon in the cart by 20% (cooldown / 1.2), touching or not', () => {
    expect(ALL).toBe(1.2);
    expect(cooldown([at('toaster'), stripFar])).toBeCloseTo(T / 1.2, 12);
  });

  it('speeds up an electrical weapon touching it by 40% instead (cooldown / 1.4), not both', () => {
    expect(ADJ).toBe(1.4);
    expect(cooldown([at('toaster'), at('powerstrip')])).toBeCloseTo(T / 1.4, 12);
  });

  it('leaves non-electrical weapons alone, touching or not', () => {
    expect(cooldown([at('pan'), at('powerstrip')])).toBeCloseTo(PAN, 12);
    expect(cooldown([at('pan'), stripFar])).toBeCloseTo(PAN, 12);
  });

  it('is cart-wide per weapon: one touches, the other does not', () => {
    const b = full([at('toaster'), at('powerstrip'), at('microwave', 1, { near: [], apart: [0, 1] })]);
    expect(b.weapons.find((w) => w.type === 'toaster')!.cooldown).toBeCloseTo(T / 1.4, 12);
    expect(b.weapons.find((w) => w.type === 'microwave')!.cooldown).toBeCloseTo(ITEMS.microwave.weapon!.cooldown / 1.2, 12);
  });

  it('does not stack: two strips give the same as one (touching one is the better case)', () => {
    expect(cooldown([at('toaster'), stripFar, at('powerstrip', 1, { near: [], apart: [0, 1] })])).toBeCloseTo(T / 1.2, 12);
    expect(cooldown([at('toaster'), at('powerstrip'), at('powerstrip', 1, { near: [0] })])).toBeCloseTo(T / 1.4, 12);
    expect(cooldown([at('toaster'), at('powerstrip'), stripFar])).toBeCloseTo(T / 1.4, 12);
  });

  it('records no buff and changes nothing but the cooldown (and Bundle Deal / sets)', () => {
    const plain = stats([at('toaster')]), w = stats([at('toaster'), at('powerstrip')]);
    expect(w.buffs).toEqual([]);
    const neutral = { cooldown: 0, damage: 0, bundle: 0, chainChance: 0, chainJumps: 0 }; // the strip is electrical: Bundle Deal and the Electric set arcs
    expect({ ...w, ...neutral }).toEqual({ ...plain, ...neutral });
  });

  it('stacks with Battery (rate), then the tools set divides last (two tools types = L1: /1.08)', () => {
    const batE = 1 + contentTune('battery', 1).electric;
    const w = stats([at('toaster'), at('powerstrip'), at('battery')]);
    expect(w.cooldown).toBeCloseTo(T / batE / 1.4 / contentSetTune('tools', 1).cooldownDiv, 12);
    expect(w.cooldown).toBeCloseTo(T / batE / ADJ / 1.08, 12);
  });

  it('is itself a tools + electrical item: it counts toward the tools and electric sets', () => {
    const b = full([at('toaster'), at('powerstrip')]);
    expect(b.sets.tools).toBe(0); // one tools type
    expect(b.sets.electric).toBeGreaterThanOrEqual(1);
    expect(full([at('toaster'), at('powerstrip'), at('battery', 1, { near: [1], apart: [0] })]).sets.tools).toBe(1);
  });

  it('is never lifted by a Gold Star (legendary)', () => {
    expect(cooldown([at('toaster'), at('powerstrip'), { type: 'goldstar', near: [1], apart: [0] }])).toBeCloseTo(T / 1.4, 12);
    expect(cooldown([at('toaster'), stripFar, { type: 'goldstar', near: [1], apart: [0] }])).toBeCloseTo(T / 1.2, 12);
  });

  it('stays unchanged when a Gold Star touches the weapon (bundle only)', () => {
    const w = stats([at('toaster'), at('powerstrip'), { type: 'goldstar' }]);
    expect(w.cooldown).toBeCloseTo(T / 1.4, 12);
  });

  it('is applied after Sourdough in the same phase (damage and cooldown are independent stats)', () => {
    const w = stats([at('toaster'), at('powerstrip'), at('sourdough')]);
    expect(w.cooldown).toBeCloseTo(T / 1.4, 12);
    expect(w.damage).toBeGreaterThan(stats([at('toaster'), at('powerstrip')]).damage);
  });
});

describe('Power Strip: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('powerstrip')).toBe(powerstrip);
    expect(ITEMS.powerstrip).toMatchObject({ id: 'powerstrip', family: 'tools', name: 'Power Strip', kind: 'module', price: 32, electrical: true, legendary: true });
    expect(ITEMS.powerstrip.element).toBeUndefined();
    expect(ITEMS.powerstrip.buff).toBeUndefined();
    expect(ITEMS.powerstrip.cells).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    expect(ITEMS.powerstrip.rules).toBe('Every electrical weapon in the cart gains +20% attack rate; electrical weapons touching it gain +40% instead.');
  });

  it('keeps its tune in one place: the text gains match the divisors (1 + gain = divisor)', () => {
    const t = contentTune('powerstrip', 1);
    expect(1 + t.allGain).toBeCloseTo(t.all, 12);
    expect(1 + t.adjacentGain).toBeCloseTo(t.adjacent, 12);
  });

  it('keeps its position in the item order', () => {
    expect(around('powerstrip', 1, 1)).toEqual(['sourdough', 'powerstrip', 'goldstar']);
  });

  it('renders its text (the same at every level), EN and DE', () => {
    const en = 'Every electrical weapon in the cart gains +20% attack rate; electrical weapons touching it gain +40% instead.';
    expect([1, 2, 3].map((t) => itemRules('powerstrip', t))).toEqual([en, en, en]);
    setLang('de');
    expect(itemRules('powerstrip', 1)).toBe('Jede elektrische Waffe im Wagen erhält +20% Angriffstempo; elektrische Waffen, die sie berühren, stattdessen +40%.');
    expect(itemT('powerstrip')).toMatchObject({ name: 'Steckdosenleiste', blurb: 'Steckt den ganzen Wagen auf einmal ein.' });
  });

  it('has no scaling rows (legendary)', () => {
    expect(tierScaling('powerstrip')).toEqual([]);
  });
});
