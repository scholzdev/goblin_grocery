import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// flow reads `location` when src/lab.ts loads, and vitest runs in node.
vi.hoisted(() => { (globalThis as { location?: unknown }).location = { search: '' }; });

import { flow } from '../src/flow';
import { store } from '../src/state/store';
import { profile } from '../src/state/profile';
import { createLabRun, createRun, openShop, reroll } from '../src/state/run';
import { createSimRun } from '../src/state/sim';
import { defineSim } from '../src/sims/_sim';
import { drawStock, applyStock } from '../src/systems/stock';
import { rollMiniCrates, rollOffers, rollStockroom } from '../src/systems/shop';
import { mulberry32, stockRng } from '../src/systems/rng';
import { ITEMS, ITEM_IDS, STARTER_WEAPONS } from '../src/data/items';
import { RECIPES, recipeParts } from '../src/data/recipes';
import { DEPARTMENTS, THEMES } from '../src/data/departments';
import { STARTING_ITEMS, UNLOCKS } from '../src/data/unlocks';
import { STOCK } from '../src/data/stock';
import { RECIPE_ORDER } from '../src/engine/define';
import type { ItemTypeId, LabOpts, RecipeDef, RunState, StarterWeapon } from '../src/types';

const WEAPONS = Object.keys(STARTER_WEAPONS) as StarterWeapon[];
const shopItems = (ids: readonly ItemTypeId[]) => ids.filter((t) => !ITEMS[t].noShop);
const ALL = shopItems(ITEM_IDS);
const legendary = (t: ItemTypeId) => !!ITEMS[t].legendary;
const recipesWith = (t: ItemTypeId): RecipeDef[] => RECIPE_ORDER.map((id) => RECIPES[id]).filter((r) => recipeParts(r).includes(t));
const sorted = (ts: readonly ItemTypeId[]) => [...ts].sort();

/** Most openers that can each be matched to a different combo with the weapon. */
function distinctRecipes(openers: ItemTypeId[], weapon: ItemTypeId): number {
  const rs = recipesWith(weapon);
  const best = (i: number, used: Set<RecipeDef>): number => {
    if (i === openers.length) return 0;
    let n = best(i + 1, used);
    for (const r of rs) if (!used.has(r) && r.supports.includes(openers[i])) n = Math.max(n, 1 + best(i + 1, new Set([...used, r])));
    return n;
  };
  return best(0, new Set());
}

const fakeGame = { scene: { getScene: () => ({ scene: { restart: () => {} } }) } };
const unlockAll = () => { profile.unlocked = UNLOCKS.map((u) => u.id); };
const seeAll = () => { profile.seen = UNLOCKS.flatMap((u) => (u.kind === 'item' ? [`item:${u.item}`] : [])); };

describe('run stock: what flow.startRun puts in the run', () => {
  const saved = { unlocked: [...profile.unlocked], seen: [...profile.seen] };
  beforeEach(() => {
    flow.init(fakeGame as never);
    profile.unlocked = [];
    profile.seen = [];
    vi.spyOn(Date, 'now').mockReturnValue(424242);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => { profile.unlocked = saved.unlocked; profile.seen = saved.seen; vi.restoreAllMocks(); });

  it('a fresh profile keeps every starting shop item', () => {
    for (const weapon of WEAPONS) {
      flow.startRun('toaster', 0, weapon, 'main');
      expect(sorted(store.state.pool!), weapon).toEqual(sorted(shopItems(STARTING_ITEMS)));
    }
  });

  it('with everything unlocked and seen, the pool holds STOCK.size regular items and one legendary', () => {
    unlockAll(); seeAll();
    flow.startRun('toaster', 0, 'pan', 'bakery');
    const pool = store.state.pool!;
    expect(pool.filter((t) => !legendary(t))).toHaveLength(STOCK.size);
    expect(pool.filter(legendary)).toHaveLength(1);
    expect(store.state.featured).toHaveLength(STOCK.featuredCombos);
  });

  it('fresh unlocks the player has not viewed go into the next run, a legendary one as its legendary', () => {
    unlockAll(); seeAll();
    profile.seen = profile.seen.filter((k) => k !== 'item:avocado' && k !== 'item:laser');
    flow.startRun('toaster', 0, 'toaster', 'main');
    expect(store.state.pool).toContain('avocado');
    expect(store.state.pool!.filter(legendary)).toEqual(['laser']);
  });

  it('the daily stock is the same for every unlock set and draws from every shop item', () => {
    const daily = () => { flow.startRun('toaster', 0, 'toaster', 'main', { daily: true }); const s = store.state; return { pool: s.pool, featured: s.featured, openers: s.openers }; };
    const fresh = daily();
    unlockAll();
    profile.seen = [];
    const veteran = daily();
    expect(veteran).toEqual(fresh);
    expect(fresh.pool!.filter((t) => !legendary(t))).toHaveLength(STOCK.size);
    expect(fresh.pool!.some((t) => !STARTING_ITEMS.includes(t))).toBe(true);
  });

  it('shop 1 leads with the openers: parts of at least 2 different combos with the starting weapon', () => {
    for (const unlocked of [false, true]) for (const weapon of WEAPONS) for (let i = 0; i < 10; i++) {
      if (unlocked) { unlockAll(); seeAll(); }
      vi.spyOn(Date, 'now').mockReturnValue(1000 + i);
      flow.startRun('toaster', 0, weapon, 'main');
      const s = store.state;
      openShop(s, flow.rng);
      const openers = s.openers!;
      expect(s.shop!.offers.slice(0, openers.length).map((o) => [o.type, o.tier])).toEqual(openers.map((t) => [t, 1]));
      expect(distinctRecipes(openers, weapon), `${weapon}: ${openers}`).toBe(openers.length);
      if (weapon === 'tomato') expect(openers).toEqual([]);
      else expect(openers.length).toBeGreaterThanOrEqual(2);
      for (const t of openers) expect(s.pool).toContain(t);
    }
  });

  it('drawing the stock leaves flow.rng alone: shops 2+ roll the same with or without an extra stock draw', () => {
    unlockAll(); seeAll();
    const shops = (extraDraw: boolean) => {
      flow.startRun('toaster', 0, 'nailgun', 'electronics');
      const s = store.state;
      if (extraDraw) drawStock({ source: ALL, weapon: s.weapon, theme: s.theme, fresh: [] }, stockRng(s.seed));
      return [1, 2, 3, 4, 5].map((idx) => rollOffers(s, flow.rng, idx).map((o) => o.type));
    };
    const plain = shops(false), extra = shops(true);
    expect(extra.slice(1)).toEqual(plain.slice(1));
    const fromSeed = createRun(store.state.seed, 'toaster', 0, 'nailgun', 'electronics');
    Object.assign(fromSeed, { pool: store.state.pool, openers: store.state.openers });
    const rng = mulberry32(store.state.seed);
    expect([1, 2, 3, 4, 5].map((idx) => rollOffers(fromSeed, rng, idx).map((o) => o.type)), 'startRun made no flow.rng draws').toEqual(plain);
  });
});

describe('drawStock with every item in the source', () => {
  const draws = WEAPONS.flatMap((weapon) => THEMES.flatMap((theme) => Array.from({ length: 8 }, (_, seed) => ({ weapon, theme, seed, stock: drawStock({ source: ALL, weapon, theme, fresh: [] }, stockRng(seed)) }))));

  it('holds STOCK.size regular items, one legendary and at least STOCK.minWeapons weapons', () => {
    for (const { stock } of draws) {
      expect(stock.pool.filter((t) => !legendary(t))).toHaveLength(STOCK.size);
      expect(stock.pool.filter(legendary)).toHaveLength(1);
      expect(stock.pool.filter((t) => ITEMS[t].kind === 'weapon' && !legendary(t)).length).toBeGreaterThanOrEqual(STOCK.minWeapons);
    }
  });

  it('holds the starting weapon, every part of its combos, the theme\'s regular bias items and the staples', () => {
    for (const { weapon, theme, stock } of draws) {
      const want = [weapon, ...recipesWith(weapon).flatMap(recipeParts), ...DEPARTMENTS[theme].shopBias.filter((t) => !legendary(t)), ...STOCK.staples];
      for (const t of want) expect(stock.pool, `${weapon}/${theme}: ${t}`).toContain(t);
    }
  });

  it('features STOCK.featuredCombos combos, each complete inside the pool', () => {
    for (const { stock } of draws) {
      expect(stock.featured).toHaveLength(STOCK.featuredCombos);
      expect(new Set(stock.featured).size).toBe(STOCK.featuredCombos);
      for (const id of stock.featured) for (const t of recipeParts(RECIPES[id])) expect(stock.pool, `${id}: ${t}`).toContain(t);
    }
  });

  it('the same seed and source give the same stock; another seed another one', () => {
    const a = drawStock({ source: ALL, weapon: 'pan', theme: 'frozen', fresh: [] }, stockRng(7));
    expect(drawStock({ source: [...ALL].reverse(), weapon: 'pan', theme: 'frozen', fresh: [] }, stockRng(7))).toEqual(a);
    expect(drawStock({ source: ALL, weapon: 'pan', theme: 'frozen', fresh: [] }, stockRng(8)).pool).not.toEqual(a.pool);
  });
});

describe('shops offer only the run\'s pool', () => {
  it('offers, rerolls, stockroom and mini-boss crates stay inside a drawn stock', () => {
    for (let seed = 0; seed < 60; seed++) {
      const s = createRun(seed, 'toaster', 0, WEAPONS[seed % WEAPONS.length], THEMES[seed % THEMES.length]);
      applyStock(s, ALL, []);
      const pool = new Set(s.pool);
      const seen: ItemTypeId[] = [];
      const rng = mulberry32(seed);
      for (const wave of [1, 2, 4, 6]) {
        s.wave = wave;
        s.department = wave === 4 ? 'electronics' : s.theme;
        s.modifier = wave === 6 ? 'clearance' : 'none';
        s.money = 999;
        openShop(s, rng);
        seen.push(...s.shop!.offers.map((o) => o.type));
        for (let k = 0; k < 3; k++) { reroll(s, rng); seen.push(...s.shop!.offers.map((o) => o.type)); }
        seen.push(...rollStockroom(s, rng).map((o) => o.type), ...rollMiniCrates(s, rng).map((o) => o.type));
      }
      for (const t of seen) expect(pool.has(t), `seed ${seed}: ${t}`).toBe(true);
    }
  });
});

describe('runs without a stock keep every item', () => {
  const lab: LabOpts = { aisle: 3, dept: 'main', shift: 0, starter: 'toaster', weapon: 'toaster', money: 500, cart: [4, 4], shelf: 4, shopLevel: 4, god: false, event: 'random', mod: 'none', sandbox: false };
  const offeredOver = (make: (seed: number) => RunState) => {
    const got = new Set<ItemTypeId>();
    for (let seed = 0; seed < 400; seed++) for (const o of rollOffers(make(seed), mulberry32(seed), 4, false, { forceLegendary: true })) got.add(o.type);
    return got;
  };

  it('a Test Lab run and a sim run offer every shop item', () => {
    for (const make of [(seed: number) => createLabRun(seed, lab), (seed: number) => createSimRun(defineSim({ id: 'tmp', cart: [{ id: 'toaster' }], start: 'shop', seed, shopLevel: 4 }))]) {
      expect(make(1).pool).toEqual(ITEM_IDS);
      expect(sorted([...offeredOver(make)])).toEqual(sorted(ALL));
    }
  });
});

describe('owned items come back more often (merge targets)', () => {
  const rate = (shelf: { type: ItemTypeId; tier: number }, a: ItemTypeId, b: ItemTypeId) => {
    const s = createRun(1);
    s.inventory.shelf[0] = { uid: 'own', type: shelf.type, x: 0, y: 0, rot: 0, tier: shelf.tier };
    let na = 0, nb = 0;
    for (let seed = 0; seed < 1500; seed++) for (const o of rollOffers(s, mulberry32(seed), 3)) { if (o.type === a) na++; if (o.type === b) nb++; }
    return na / nb;
  };

  it('an owned non-weapon below ★3 beats an unowned one of equal base weight; at ★3 it does not', () => {
    expect(rate({ type: 'fortune', tier: 1 }, 'fortune', 'sample')).toBeGreaterThan(1.1);
    expect(rate({ type: 'fortune', tier: 1 }, 'fortune', 'sample')).toBeLessThan(1.7);
    expect(rate({ type: 'fortune', tier: 2 }, 'fortune', 'sample')).toBeGreaterThan(1.1);
    expect(rate({ type: 'fortune', tier: 3 }, 'fortune', 'sample')).toBeLessThan(1.3);
  }, 20_000);

  it('an owned weapon below ★3 gets the same pull', () => {
    expect(rate({ type: 'nailgun', tier: 1 }, 'nailgun', 'vacuum')).toBeGreaterThan(1.1);
    expect(rate({ type: 'nailgun', tier: 1 }, 'nailgun', 'vacuum')).toBeLessThan(1.7);
  }, 20_000);
});
