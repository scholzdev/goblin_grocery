import { describe, expect, it } from 'vitest';
import { computeBuild, tierScaling } from '../src/systems/synergies';
import { rollOffers } from '../src/systems/shop';
import { mulberry32 } from '../src/systems/rng';
import { inLane } from '../src/systems/obstacles';
import { createRun } from '../src/state/run';
import { cart } from './cart';
import { ITEM_IDS, PLAYER } from '../src/data/items';
import { contentItem } from '../src/engine/registry';
import { RECIPES } from '../src/data/recipes';
import { UNLOCKS } from '../src/data/unlocks';
import { DASH_PROPS, OBSTACLES, OBSTACLE_KINDS } from '../src/data/obstacles';
import { ZONES } from '../src/data/zones';
import { SVG_ASSETS } from '../src/data/assets';
import type { ItemTypeId } from '../src/types';

const DASH_ITEMS: ItemTypeId[] = ['bumper', 'sparewheel', 'tipjar', 'flag'];
const build = (item: ItemTypeId, tier = 1) => {
  const inv = cart('toaster', [item]);
  inv.placed.find((p) => p.type === item)!.tier = tier;
  return computeBuild(inv);
};

describe('dash items', () => {
  it('they leave the plain dash alone', () => {
    const b = build('bumper');
    expect(b.shoveCooldown).toBe(PLAYER.shove.cooldown);
    expect(b.shoveDamage).toBe(PLAYER.shove.damage);
  });
  it('have scaling rows, unlock entries and German text', () => {
    for (const id of DASH_ITEMS) {
      expect(tierScaling(id), id).not.toHaveLength(0);
      expect(UNLOCKS.some((u) => u.kind === 'item' && u.item === id), id).toBe(true);
      expect(contentItem(id)?.text.de.rules, id).toBeTruthy();
    }
  });
  it('show up in the shop once unlocked, and never while locked', () => {
    const seen = new Set<ItemTypeId>();
    const s = createRun(1);
    s.unlocked = [...ITEM_IDS];
    for (let seed = 0; seed < 300; seed++) for (const o of rollOffers(s, mulberry32(seed), 2 + (seed % 5))) seen.add(o.type);
    for (const id of DASH_ITEMS) expect(seen.has(id), id).toBe(true);
    s.unlocked = s.unlocked.filter((t) => !DASH_ITEMS.includes(t));
    for (let seed = 0; seed < 100; seed++) for (const o of rollOffers(s, mulberry32(seed), 3)) expect(DASH_ITEMS).not.toContain(o.type);
  });
  it('shop leans towards them when the cart has a Bell', () => {
    const count = (own: ItemTypeId[]) => {
      const s = createRun(1);
      s.unlocked = undefined;
      for (const t of own) s.inventory.shelf[own.indexOf(t)] = { uid: `u${t}`, type: t, x: 0, y: 0, rot: 0 } as never;
      let n = 0;
      for (let seed = 0; seed < 400; seed++) for (const o of rollOffers(s, mulberry32(seed), 3)) if (o.type === 'flag') n++;
      return n;
    };
    expect(count(['bell'])).toBeGreaterThan(count(['fan']));
  });
});

describe('Pot Slam', () => {
  it('needs both Pressure Cooker and Slam Bumper touching', () => {
    expect(RECIPES.potSlam.weapon).toBe('cooker');
    expect(computeBuild(cart('cooker', ['bumper'])).weapons[0].recipes).toContain('potSlam');
    expect(computeBuild(cart('cooker', [])).weapons[0].recipes).not.toContain('potSlam');
    expect(computeBuild(cart('microwave', ['bumper'])).weapons[0].recipes).not.toContain('potSlam');
  });
});

describe('dash props', () => {
  it('every kind has art and is placed in at least one layout', () => {
    const placed = new Set([...Object.values(ZONES).flatMap((z) => z.layouts.flat()), ...Object.values(OBSTACLES).flatMap((l) => l!.flat())].map((o) => o.kind));
    for (const kind of Object.keys(DASH_PROPS) as (keyof typeof DASH_PROPS)[]) {
      expect(placed.has(kind), kind).toBe(true);
      expect(SVG_ASSETS.some((a) => a.key === OBSTACLE_KINDS[kind!].tex), kind).toBe(true);
    }
  });
  it('the topple lane covers things ahead of the prop inside its width and nothing behind or beside', () => {
    expect(inLane(100, 100, 1, 0, 300, 60, 300, 130)).toBe(true);
    expect(inLane(100, 100, 1, 0, 300, 60, 450, 100)).toBe(false); // beyond the length
    expect(inLane(100, 100, 1, 0, 300, 60, 300, 200)).toBe(false); // beside
    expect(inLane(100, 100, 1, 0, 300, 60, 40, 100)).toBe(false);  // behind
    expect(inLane(100, 100, 0, 1, 300, 60, 120, 300)).toBe(true);  // vertical dash
    expect(inLane(100, 100, 1, 0, 300, 60, 300, 170, 15)).toBe(true); // radius widens the lane
  });
});
