import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER } from '../../../src/data/items';
import jellybeans from '../../../src/content/items/jellybeans';
import { setsOf } from '../../../src/data/sets';
import { flavorOf } from '../../../src/engine/define';
import { FLAVORS } from '../../../src/engine/define';
import { contentItem, contentSetTune, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { createRun, labAddItem, rollFlavors } from '../../../src/state/run';
import { computeBuild, tierScaling } from '../../../src/systems/synergies';
import type { ElementTag, ItemInstance } from '../../../src/types';
import { around, at, gilded, stats } from '../helpers';

afterEach(() => setLang('en'));

const fuel = contentTune('fuel', 1), ice = contentTune('ice', 1), popper = contentTune('popper', 1);
const STRENGTH = 0.7;
// Lone beans are ★t set points of their flavor's element: ★3 heat beans reach Heat L2 (burn x1.4), ★2 / ★3 frost beans Frost L1 / L2 (+10 points).
const HEAT = (lv: number) => contentSetTune('heat', lv), FROST = (lv: number) => contentSetTune('frost', lv);
const withFrost = (pct: number, lv: number) => Math.min(FROST(lv).slowCap, pct + FROST(lv).slowBonus);
const beans = (flavor?: ElementTag, tier?: number, extra = {}) => at('jellybeans', tier, { ...(flavor ? { flavor } : {}), ...extra });
// Vacuum (cleaning, no element, no fuel/popper combo) for heat; Nail Gun (tools / blast) for frost and blast.
const vac = at('vacuum'), gun = at('nailgun');

// Legacy: each touching bag adds its flavor's real module effect at 70% x TIER.mult of its own effective tier, never weaker than what a real
// Fuel Can / Ice Pack / Party Popper already gave. No flavor = heat. The bags also count toward the flavor's set.
describe('Jelly Beans: flavors', () => {
  it('heat burns like a Fuel Can at 70%', () => {
    const w = stats([vac, beans('heat')]);
    expect(w.burn).toEqual({ dps: fuel.dps * STRENGTH, duration: fuel.duration, tick: fuel.tick });
  });

  it('frost slows like an Ice Pack at 70%', () => {
    const w = stats([gun, beans('frost')]);
    expect(w.slow).toEqual({ pct: ice.pct * STRENGTH, duration: ice.duration });
  });

  it('blast pops like a Party Popper at 70%', () => {
    const w = stats([gun, beans('blast')]);
    // Blast set (Nail Gun is blast, the beans are blast) is L1: popper radius x1.15
    expect(w.popper).toEqual({ damage: popper.damage * STRENGTH, radius: popper.radius * contentSetTune('blast', 1).radiusMult });
  });

  it('a flavor adds nothing of the other two', () => {
    const heat = stats([vac, beans('heat')]);
    expect(heat.slow).toBeNull();
    expect(heat.popper).toBeNull();
    const frost = stats([gun, beans('frost')]);
    expect(frost.burn).toBeNull();
    expect(frost.popper).toBeNull();
    const blast = stats([gun, beans('blast')]);
    expect(blast.burn).toBeNull();
    expect(blast.slow).toBeNull();
  });

  it('a missing flavor is heat (flavorOf)', () => {
    expect(flavorOf({})).toBe('heat');
    expect(flavorOf({ flavor: 'frost' })).toBe('frost');
    expect(stats([vac, beans()]).burn).toEqual(stats([vac, beans('heat')]).burn);
  });

  it('records no buff (it is not a BUFF_ORDER module) and touches nothing else', () => {
    const plain = stats([vac]), w = stats([vac, beans('heat')]);
    expect(w.buffs).toEqual([]);
    expect({ ...w, burn: null, bundle: 0, damage: 0 }).toEqual({ ...plain, burn: null, bundle: 0, damage: 0 });
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = stats([vac, beans('heat', 3, { near: [], apart: [0] })]);
    expect(w.burn).toBeNull();
  });
});

describe('Jelly Beans: 70% x tier', () => {
  it('scales with the tier: 70% / 105% / 140% of the full module at ★1, plus the element level its own set points reach', () => {
    const frost = [(pct: number) => pct, (pct: number) => withFrost(pct, 1), (pct: number) => withFrost(pct, 1)]; // a lone ★2 / ★3 is L1
    for (const tier of [1, 2, 3]) {
      expect(stats([vac, beans('heat', tier)]).burn!.dps).toBe(fuel.dps * (TIER.mult(tier) * STRENGTH)); // Heat L1 adds no dps multiplier
      expect(stats([gun, beans('frost', tier)]).slow!.pct).toBe(frost[tier - 1](ice.pct * (TIER.mult(tier) * STRENGTH)));
      expect(stats([gun, beans('blast', tier)]).popper!.damage).toBe(popper.damage * (TIER.mult(tier) * STRENGTH));
    }
    [1.75, 2.625, 3.5].forEach((dps, i) => expect(stats([vac, beans('heat', i + 1)]).burn!.dps).toBeCloseTo(dps, 12));
  });

  it('Gold Star lifts it (★3 -> effective ★4: 175%, 4 set points: L2); the Ice Pack slow stays under its cap', () => {
    expect(stats([vac, beans('heat', 3), gilded(1)]).burn!.dps).toBeCloseTo(fuel.dps * STRENGTH * 2.5 * HEAT(2).burnMult, 12);
    expect(stats([gun, beans('frost', 3), gilded(1)]).slow!.pct).toBeCloseTo(withFrost(ice.pct * STRENGTH * 2.5, 2), 12);
    expect(ice.pct * STRENGTH * 2.5).toBeLessThan(ice.cap);
  });

  it('frost is capped at the Ice Pack cap (60%)', () => {
    const w = stats([gun, beans('frost', 3), beans('frost', 3, { near: [0] }), gilded(1)]);
    expect(w.slow!.pct).toBeLessThanOrEqual(ice.cap);
  });

  it('each instance uses its own tier (not the best copy in the cart)', () => {
    const w = stats([vac, beans('heat', 1), beans('heat', 3, { near: [], apart: [0] })]);
    expect(w.burn!.dps).toBe(fuel.dps * STRENGTH); // the far ★3 copy still sets the Heat level (3 points: L1, no dps multiplier)
  });
});

describe('Jelly Beans: never weaker than the real module (max)', () => {
  it('a stronger Fuel Can keeps its burn; weaker beans do not replace it', () => {
    const w = stats([vac, at('fuel', 3), beans('heat', 1)]);
    expect(w.burn!.dps).toBe(contentTune('fuel', 3).dps * HEAT(2).burnMult); // 5 > 1.75; 4 Heat points: L2
    expect(w.buffs).toEqual(['fuel']);
  });

  it('stronger beans replace a weaker Fuel Can (and keep the Fuel Can buff)', () => {
    const w = stats([vac, at('fuel', 1), beans('heat', 3)]);
    expect(w.burn!.dps).toBe(fuel.dps * (TIER.mult(3) * STRENGTH) * HEAT(2).burnMult); // 3.5 > 2.5; 4 Heat points: L2
    expect(w.buffs).toEqual(['fuel']);
  });

  it('equal strength keeps the Fuel Can\'s burn', () => {
    // beans never equal exactly (1.75 vs 2.5 vs 3.75 ...): a Fuel Can ★1 against ★1 beans is the strictly stronger one
    expect(stats([vac, at('fuel', 1), beans('heat', 1)]).burn!.dps).toBe(fuel.dps);
  });

  it('frost: a stronger Ice Pack wins, a weaker one is raised to the beans', () => {
    // ★3 Ice Pack + ★1 frost beans (or the other way round) = 4 Frost points: L2, +10% (capped) after the combos
    const strong = stats([gun, at('ice', 3), beans('frost', 1)]).slow!;
    expect(strong.pct).toBeCloseTo(withFrost(contentTune('ice', 3).pct, 2), 12);
    const weak = stats([gun, at('ice', 1), beans('frost', 3)]).slow!;
    expect(weak.pct).toBeCloseTo(withFrost(ice.pct * TIER.mult(3) * STRENGTH, 2), 12);
  });

  it('blast: a stronger Party Popper keeps its blast, stronger beans replace it', () => {
    // Popper + blast beans + Nail Gun (blast) = three blast types, 5 points with the ★3 one: Blast L2
    const strong = stats([gun, at('popper', 3), beans('blast', 1)]).popper!;
    expect(strong.damage).toBe(contentTune('popper', 3).damage);
    const weak = stats([gun, at('popper', 1), beans('blast', 3)]).popper!;
    expect(weak.damage).toBe(popper.damage * (TIER.mult(3) * STRENGTH)); // 8.4 > 6
  });

  it('two bags: the stronger one decides, in any order; different flavors both apply', () => {
    expect(stats([vac, beans('heat', 1), beans('heat', 3, { near: [0] })]).burn!.dps).toBe(fuel.dps * (TIER.mult(3) * STRENGTH)); // 3 Heat points: L1
    expect(stats([vac, beans('heat', 3), beans('heat', 1, { near: [0] })]).burn!.dps).toBe(fuel.dps * (TIER.mult(3) * STRENGTH));
    const mixed = stats([gun, beans('frost', 2), beans('blast', 1, { near: [0] })]);
    expect(mixed.slow!.pct).toBe(withFrost(ice.pct * (TIER.mult(2) * STRENGTH), 1));
    expect(mixed.popper!.damage).toBe(popper.damage * STRENGTH);
  });
});

describe('Jelly Beans: sets', () => {
  const setsFor = (weapon: Parameters<typeof at>[0], flavor?: ElementTag) => computeBuild(cartOf(weapon, flavor)).sets;
  const cartOf = (weapon: Parameters<typeof at>[0], flavor?: ElementTag) => {
    const inv = { cols: 5, rows: 4, shelf: [], placed: [] as ItemInstance[] };
    inv.placed.push({ uid: 'u0', type: weapon, x: 1, y: 1, rot: 0 }, { uid: 'u1', type: 'jellybeans', x: 4, y: 3, rot: 0, ...(flavor ? { flavor } : {}) });
    return inv;
  };

  it('counts toward the snacks set and the flavor\'s set (setsOf)', () => {
    expect(setsOf('jellybeans', 'heat')).toEqual(['snacks', 'heat']);
    expect(setsOf('jellybeans', 'frost')).toEqual(['snacks', 'frost']);
    expect(setsOf('jellybeans', 'blast')).toEqual(['snacks', 'blast']);
    expect(setsOf('jellybeans')).toEqual(['snacks']); // no flavor given: only the family
  });

  it('each flavor gives its set a type (Pan is heat, Mop is frost, Nail Gun is blast)', () => {
    expect(setsFor('pan', 'heat').heat).toBe(1);
    expect(setsFor('pan', 'frost').heat).toBe(0);
    expect(setsFor('mop', 'frost').frost).toBe(1);
    expect(setsFor('mop', 'heat').frost).toBe(0);
    expect(setsFor('nailgun', 'blast').blast).toBe(1);
    expect(setsFor('nailgun', 'frost').blast).toBe(0);
  });

  it('a missing flavor counts for heat', () => {
    expect(setsFor('pan').heat).toBe(1);
  });

  it('is a snacks item that is not electrical', () => {
    expect(ITEMS.jellybeans.family).toBe('snacks');
    expect(ITEMS.jellybeans.electrical).toBe(false);
    expect(ITEMS.jellybeans.element).toBeUndefined(); // the element is the instance's flavor
  });
});

describe('Jelly Beans: flavor reroll (state/run.ts)', () => {
  const run = () => {
    const s = createRun(3);
    s.phase = 'shop';
    const placed: ItemInstance = { uid: 'jp', type: 'jellybeans', x: 1, y: 2, rot: 0, flavor: 'heat' }; // touches the toaster at (1,1)-(2,1)
    const shelved: ItemInstance = { uid: 'js', type: 'jellybeans', x: 0, y: 0, rot: 0, flavor: 'heat' };
    s.inventory.placed.push(placed);
    s.inventory.shelf[0] = shelved;
    return { s, placed, shelved };
  };

  it('rerolls the cart and the shelf from the content flavor list: rng 0 / .5 / .99 = heat / frost / blast', () => {
    expect(FLAVORS).toEqual(['heat', 'frost', 'blast']);
    for (const [r, f] of [[0, 'heat'], [0.5, 'frost'], [0.99, 'blast']] as const) {
      const { s, placed, shelved } = run();
      rollFlavors(s, () => r);
      expect(placed.flavor).toBe(f);
      expect(shelved.flavor).toBe(f);
    }
  });

  it('only touches Jelly Beans', () => {
    const { s } = run();
    rollFlavors(s, () => 0.99);
    expect(s.inventory.placed.filter((p) => p.type !== 'jellybeans').every((p) => p.flavor === undefined)).toBe(true);
  });

  it('recomputes the build: the touching bag\'s new flavor shows in the weapon', () => {
    const { s } = run();
    rollFlavors(s, () => 0); // heat
    expect(s.build.weapons[0].burn).not.toBeNull();
    expect(s.build.weapons[0].slow).toBeNull();
    rollFlavors(s, () => 0.5); // frost
    expect(s.build.weapons[0].slow!.pct).toBeCloseTo(ice.pct * STRENGTH, 12);
    expect(s.build.weapons[0].burn).toBeNull();
  });

  it('a Lab-added bag starts with a flavor from the list', () => {
    const s = createRun(3);
    s.phase = 'shop';
    expect(labAddItem(s, 'jellybeans', 1).ok).toBe(true);
    const bag = s.inventory.shelf.find((i) => i?.type === 'jellybeans')!;
    expect(FLAVORS).toContain(bag.flavor);
  });
});

describe('Jelly Beans: content', () => {
  it('is the registered content file, and the item table is derived from it', () => {
    expect(contentItem('jellybeans')).toBe(jellybeans);
    expect(ITEMS.jellybeans).toMatchObject({ id: 'jellybeans', family: 'snacks', kind: 'module', price: 10, electrical: false });
    expect(ITEMS.jellybeans.cells).toEqual([{ x: 0, y: 0 }]);
    expect(ITEMS.jellybeans.legendary).toBeUndefined();
    expect(ITEMS.jellybeans.buff).toBeUndefined();
  });

  it('keeps its tune in one place (the row is the base strength x TIER.mult)', () => {
    expect(contentTune('jellybeans', 1).base).toBe(0.7);
    for (const tier of [1, 2, 3]) expect(contentTune('jellybeans', tier).strength).toBeCloseTo(0.7 * TIER.mult(tier), 12);
  });

  it('keeps its position in the item order', () => {
    expect(around('jellybeans', 1, 1)).toEqual(['tinfoilhat', 'jellybeans', 'leafblower']);
  });

  it('renders its text for every level, EN and DE', () => {
    const en = (s: string) => `The flavor changes every shop visit: Heat (Fuel Can burn), Frost (Ice Pack slow) or Blast (Party Popper blast). Adjacent weapons get that effect at ${s} strength, and the beans count toward that flavor's set.`;
    expect([1, 2, 3].map((t) => itemRules('jellybeans', t))).toEqual([en('70%'), en('105%'), en('140%')]);
    setLang('de');
    expect(itemRules('jellybeans', 2)).toBe('Die Sorte wechselt bei jedem Einkauf: Hitze (Brand des Benzinkanisters), Frost (Verlangsamung des Kühlakkus) oder Wumms (Explosion des Partyknallers). Angrenzende Waffen erhalten diesen Effekt mit 105% Stärke, und die Bohnen zählen für das Set dieser Sorte.');
    expect(itemT('jellybeans')).toMatchObject({ name: 'Gummibohnen', blurb: 'Bei jedem Einkauf eine neue Sorte.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('jellybeans')).toEqual([{ label: 'Flavor strength', values: ['70%', '105%', '140%'] }]);
    setLang('de');
    expect(tierScaling('jellybeans')).toEqual([{ label: 'Geschmacksstärke', values: ['70%', '105%', '140%'] }]);
  });
});
