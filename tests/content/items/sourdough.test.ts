import { afterEach, describe, expect, it } from 'vitest';
import { ITEMS, TIER, cellsFor } from '../../../src/data/items';
import sourdough from '../../../src/content/items/sourdough';
import { contentItem, contentTune } from '../../../src/engine/registry';
import { itemRules, itemT } from '../../../src/i18n/data';
import { setLang } from '../../../src/i18n/lang';
import { createRun, openShop, riseSourdough } from '../../../src/state/run';
import { mulberry32 } from '../../../src/systems/rng';
import { computeBuild, tierScaling } from '../../../src/systems/synergies';
import type { ItemInstance, RunState } from '../../../src/types';
import { build } from '../../golden/carts';
import { around, at, full, gilded } from '../helpers';

afterEach(() => setLang('en'));

// Legacy: a passive (kitchen) that adds +6% damage per effective star to every weapon it touches, per instance (two starters multiply).
// The Nail Gun (tools / blast, 3 damage) shares no set and no combo with it, so the only other factor is Bundle Deal (+6% per distinct touching type).
const BASE = 3, BUNDLE_1 = 1.06;
const gun = at('nailgun');
const dmg = (specs: Parameters<typeof full>[0]) => full(specs).weapons[0].damage;
const dough = (tier?: number, extra = {}) => at('sourdough', tier, extra);

describe('Sourdough Starter: footprint', () => {
  it('grows 1 cell -> 2 cells -> an L of 3 with the tier', () => {
    expect(cellsFor('sourdough', 1)).toEqual([{ x: 0, y: 0 }]);
    expect(cellsFor('sourdough', 2)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(cellsFor('sourdough', 3)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  });

  it('clamps the tier (below ★1, above ★3) and the legacy def carries the ★1 footprint', () => {
    expect(cellsFor('sourdough', 0)).toEqual(cellsFor('sourdough', 1));
    expect(cellsFor('sourdough', 4)).toEqual(cellsFor('sourdough', 3));
    expect(ITEMS.sourdough.cells).toEqual([{ x: 0, y: 0 }]);
  });

  it('is a function of the tier in the content file, and every other item keeps its fixed shape', () => {
    expect(typeof sourdough.shape).toBe('function');
    expect(cellsFor('fan', 3)).toEqual(ITEMS.fan.cells);
  });

  it('places with the tier shape (an L cannot stick out of the cart)', () => {
    expect(() => build([gun, dough(3)])).not.toThrow();
    const inv = build([gun, dough(3)]);
    const d = inv.placed[1];
    expect(d.tier).toBe(3);
  });
});

describe('Sourdough Starter: build', () => {
  it('gives a touching weapon +6% / +12% / +18% damage at ★1 / ★2 / ★3', () => {
    expect(dmg([gun, dough(1)])).toBeCloseTo(BASE * 1.06 * BUNDLE_1);
    expect(dmg([gun, dough(2)])).toBeCloseTo(BASE * 1.12 * BUNDLE_1);
    expect(dmg([gun, dough(3)])).toBeCloseTo(BASE * 1.18 * BUNDLE_1);
  });

  it('is +6% per star (linear through zero), the same as the legacy formula', () => {
    for (const t of [1, 2, 3]) expect(dmg([gun, dough(t)])).toBe(BASE * (1 + 0.06 * t) * BUNDLE_1);
  });

  it('does nothing for a weapon it does not touch', () => {
    const w = full([gun, dough(3, { near: [], apart: [0] })]).weapons[0];
    expect(w.damage).toBe(BASE);
    expect(w.bundle).toBe(0);
  });

  it('changes damage only (no buff, no other stat)', () => {
    const plain = full([gun]).weapons[0], w = full([gun, dough(2)]).weapons[0];
    expect(w.buffs).toEqual([]);
    expect({ ...w, damage: 0, bundle: 0 }).toEqual({ ...plain, damage: 0, bundle: 0 });
  });

  it('is per instance: two touching starters multiply, each with its own tier', () => {
    expect(dmg([gun, dough(1), dough(2, { near: [0] })])).toBeCloseTo(BASE * 1.06 * 1.12 * BUNDLE_1);
    expect(dmg([gun, dough(3), dough(3, { near: [0] })])).toBeCloseTo(BASE * 1.18 * 1.18 * BUNDLE_1);
  });

  it('a starter far from the weapon does not count, a touching one does (not the best copy in the cart)', () => {
    const w = full([gun, dough(1), dough(3, { near: [], apart: [0] })]).weapons[0];
    expect(w.damage).toBeCloseTo(BASE * 1.06 * BUNDLE_1);
  });

  it('affects every weapon it touches, each with its own bundle', () => {
    const b = full([gun, dough(2), at('pan', 1, { near: [1] })]);
    const ng = b.weapons.find((w) => w.type === 'nailgun')!, pan = b.weapons.find((w) => w.type === 'pan')!;
    expect(ng.damage).toBeCloseTo(BASE * 1.12 * (1 + 0.06 * ng.bundle));
    expect(pan.damage).toBeCloseTo(ITEMS.pan.weapon!.damage * 1.12 * 1.1 * (1 + 0.06 * pan.bundle)); // pan + sourdough = Kitchen set L1 (x1.1)
  });

  it('Gold Star lifts it one tier (★3 -> effective ★4: +24%)', () => {
    expect(dmg([gun, dough(3), gilded(1)])).toBeCloseTo(BASE * (1 + 0.06 * TIER.max + 0.06) * BUNDLE_1);
    expect(dmg([gun, dough(3), gilded(1)])).toBeCloseTo(BASE * 1.24 * BUNDLE_1);
    expect(dmg([gun, dough(1), gilded(1)])).toBeCloseTo(BASE * 1.12 * BUNDLE_1); // ★1 -> effective ★2
  });

  it('runs before the Bundle Deal multiplier (+6% per distinct touching type) and multiplies with it', () => {
    const w = full([gun, dough(2), at('fan')]).weapons[0];
    expect(w.bundle).toBe(2);
    expect(w.damage).toBeCloseTo(BASE * 1.12 * (1 + 0.06 * 2));
  });
});

describe('Sourdough Starter: growth reads the tune', () => {
  const shopRun = (): RunState => { const s = createRun(3); s.phase = 'shop'; return s; };
  const shelfDough = (s: RunState): ItemInstance => { const d: ItemInstance = { uid: 'sh', type: 'sourdough', x: 0, y: 0, rot: 0 }; s.inventory.shelf[0] = d; return d; };

  it('rises one level after `every` aisles', () => {
    const every = contentTune('sourdough', 1).every, s = shopRun(), d = shelfDough(s);
    for (let i = 1; i < every; i++) riseSourdough(s);
    expect(d.tier ?? 1).toBe(1);
    riseSourdough(s);
    expect(d.tier).toBe(2);
    expect(d.rise).toBe(0);
  });

  it('follows a changed tune (no copy of the interval in run.ts)', () => {
    const tune = sourdough.tune as unknown as { every: number }, was = tune.every;
    try {
      tune.every = 3;
      const s = shopRun(), d = shelfDough(s);
      riseSourdough(s); riseSourdough(s);
      expect(d.tier ?? 1).toBe(1);
      riseSourdough(s);
      expect(d.tier).toBe(2);
    } finally { tune.every = was; }
  });

  it('keeps growing through openShop (every 2 aisles by default, capped at ★3)', () => {
    const s = shopRun(), rng = mulberry32(1), d = shelfDough(s);
    openShop(s, rng); expect(d.tier ?? 1).toBe(1);
    openShop(s, rng); expect(d.tier).toBe(2);
    for (let i = 0; i < 6; i++) openShop(s, rng);
    expect(d.tier).toBe(3);
  });

  it('stays pending (counter kept at `every`) while the grown shape does not fit', () => {
    const s = shopRun(), every = contentTune('sourdough', 1).every;
    const d: ItemInstance = { uid: 'd', type: 'sourdough', x: 0, y: 2, rot: 0 };
    s.inventory.placed.push(d, { uid: 'wall', type: 'battery', x: 1, y: 2, rot: 0 });
    for (let i = 0; i < every; i++) expect(riseSourdough(s)).toBe(i === every - 1);
    expect(d.tier ?? 1).toBe(1);
    expect(d.rise).toBe(every);
  });
});

describe('Sourdough Starter: content', () => {
  it('is the registered content file and the legacy lookups return its converted def', () => {
    expect(contentItem('sourdough')).toBe(sourdough);
    expect(ITEMS.sourdough).toMatchObject({ id: 'sourdough', family: 'kitchen', name: 'Sourdough Starter', kind: 'passive', price: 6, electrical: false });
    expect(ITEMS.sourdough.element).toBeUndefined();
    expect(ITEMS.sourdough.legendary).toBeUndefined();
    expect(ITEMS.sourdough.buff).toBeUndefined();
    expect(ITEMS.sourdough.rules).toBe('Weapons touching it gain {0} damage. Grows one level every 2 aisles (needs room to rise): 2 cells at ★2, 3 cells at ★3.');
  });

  it('keeps its tune in one place (the per-tier damage column is perStar x tier)', () => {
    const t = contentTune('sourdough', 1);
    expect(t).toMatchObject({ perStar: 0.06, every: 2, cellsMid: 2, cellsMax: 3 });
    for (const tier of [1, 2, 3]) expect(contentTune('sourdough', tier).damage).toBeCloseTo(t.perStar * tier, 12);
    expect(cellsFor('sourdough', 2)).toHaveLength(t.cellsMid);
    expect(cellsFor('sourdough', 3)).toHaveLength(t.cellsMax);
  });

  it('keeps its position in the item order', () => {
    expect(around('sourdough', 1, 1)).toEqual(['leafblower', 'sourdough', 'powerstrip']);
  });

  it('renders its text for every level, EN and DE', () => {
    expect([1, 2, 3].map((t) => itemRules('sourdough', t))).toEqual([
      'Weapons touching it gain +6% damage. Grows one level every 2 aisles (needs room to rise): 2 cells at ★2, 3 cells at ★3.',
      'Weapons touching it gain +12% damage. Grows one level every 2 aisles (needs room to rise): 2 cells at ★2, 3 cells at ★3.',
      'Weapons touching it gain +18% damage. Grows one level every 2 aisles (needs room to rise): 2 cells at ★2, 3 cells at ★3.',
    ]);
    setLang('de');
    expect(itemRules('sourdough', 3)).toBe('Angrenzende Waffen erhalten +18% Schaden. Wächst alle 2 Gänge um eine Stufe (braucht Platz zum Aufgehen): 2 Felder bei ★2, 3 Felder bei ★3.');
    expect(itemT('sourdough')).toMatchObject({ name: 'Sauerteig-Ansatz', blurb: 'Füttern, und er wächst. Blubbert vor Potenzial.' });
  });

  it('generates the shop scaling row', () => {
    expect(tierScaling('sourdough')).toEqual([{ label: 'Damage', values: ['+6%', '+12%', '+18%'] }]);
    setLang('de');
    expect(tierScaling('sourdough')).toEqual([{ label: 'Schaden', values: ['+6%', '+12%', '+18%'] }]);
  });

  it('is not a module (no buff line) and builds through computeBuild like any cart', () => {
    expect(computeBuild(build([gun, dough(1)])).weapons[0].buffs).toEqual([]);
  });
});
