import { describe, expect, it } from 'vitest';
import { bestPlacement, createGreedyPolicy, mergePairs, scoreBuild } from '../../src/buildlab/policy';
import { Combo, Item } from '../../src/engine/ids';
import { canPlace } from '../../src/systems/inventory';
import { buyOffer, createRun, mergeItems, moveItem, newUid, openShop, recomputeBuild, repair, upgradeCart, upgradeShelf, acceptCustomer } from '../../src/state/run';
import { rollMiniCrates, rollStockroom } from '../../src/systems/shop';
import { mulberry32 } from '../../src/systems/rng';
import { ITEM_IDS } from '../../src/data/items';
import type { ItemInstance, RunState } from '../../src/types';
import { stateWith } from './helpers';

const view = (seed = 1) => ({ rng: mulberry32(seed), round: 0 });
const shelf = (s: RunState, type: ItemInstance['type'], tier = 1): ItemInstance => {
  const it: ItemInstance = { uid: newUid(s), type, x: 0, y: 0, rot: 0, tier };
  s.inventory.shelf[s.inventory.shelf.indexOf(null)] = it;
  return it;
};

describe('greedy policy', () => {
  it('searches the whole cart: a module goes next to the weapon in a big cart (not just the first 5x4)', () => {
    const s = stateWith([{ type: Item.toaster, at: [5, 3] }], { cols: 7, rows: 5 }); // the weapon sits far from the old 5x4 corner
    const fan = shelf(s, Item.fan);
    const p = bestPlacement(s, fan)!;
    expect(p).not.toBeNull();
    expect(p.score).toBeGreaterThan(0); // the fan touches the toaster: a buff
    expect(canPlace(s.inventory, Item.fan, p.x, p.y, p.rot, undefined, 1).ok).toBe(true);
    const pol = createGreedyPolicy();
    const t = pol.placeItem(s, fan, view())!;
    expect(t).toMatchObject({ x: p.x, y: p.y, rot: p.rot });
    // the placed cart really scores the buff
    s.inventory.shelf[0] = null;
    s.inventory.placed.push({ ...fan, ...t });
    recomputeBuild(s);
    expect(scoreBuild(s.build, s.inventory.placed)).toBe(p.score);
  });

  it('places a passive combo part next to its weapon before the last part arrives: Nailstorm forms whichever part comes first', () => {
    for (const order of [[Item.magnet, Item.battery], [Item.battery, Item.magnet]]) {
      const s = stateWith([{ type: Item.nailgun, at: [5, 3] }], { cols: 7, rows: 5 }); // far from the first free cell
      s.phase = 'shop';
      const pol = createGreedyPolicy();
      for (const type of order) {
        const it = shelf(s, type);
        const t = pol.placeItem(s, it, view())!;
        expect(moveItem(s, it.uid, { where: 'grid', ...t }).ok, `${type} placed`).toBe(true);
      }
      expect(s.build.recipes.map((r) => r.id), `${order.join(' then ')}`).toContain(Combo.nailstorm);
    }
  });

  it('takes the bigger combo the last part completes: a Tin Foil Hat turns Nailstorm into Ray Gun', () => {
    const s = stateWith([{ type: Item.nailgun, at: [5, 3] }, { type: Item.magnet }, { type: Item.battery }], { cols: 7, rows: 5 });
    expect(s.build.recipes.map((r) => r.id)).toContain(Combo.nailstorm);
    s.phase = 'shop';
    const hat = shelf(s, Item.tinfoilhat);
    const t = createGreedyPolicy().placeItem(s, hat, view())!;
    expect(moveItem(s, hat.uid, { where: 'grid', ...t }).ok).toBe(true);
    expect(s.build.recipes.map((r) => r.id)).toContain(Combo.rayGun);
  });

  it('returns null when nothing fits', () => {
    const s = stateWith([{ type: Item.toaster }]);
    s.inventory.cols = 1; s.inventory.rows = 1; // a 2-cell toaster cannot fit a 1x1 cart
    expect(bestPlacement(s, { type: Item.toaster })).toBeNull();
  });

  it('merges identical pairs, consuming the shelf copy into the cart copy', () => {
    const s = stateWith([{ type: Item.toaster }, { type: Item.fan }]);
    const spare = shelf(s, Item.fan);
    const [m] = mergePairs(s);
    expect(m).toMatchObject({ kind: 'merge', uid: spare.uid });
  });

  it('a shop visit: every move it asks for is valid, and it ends by leaving', () => {
    const s = createRun(7, 'toaster', 0, 'toaster', 'main');
    s.pool = [...ITEM_IDS];
    s.money = 80;
    const rng = mulberry32(7);
    s.wave = 2;
    openShop(s, rng);
    const pol = createGreedyPolicy(), v = view();
    let left = false;
    for (let round = 0; round < 40 && !left; round++) {
      v.round = round;
      const acts = pol.decideShop(s, v);
      expect(acts.length).toBeGreaterThan(0);
      for (const a of acts) {
        if (a.kind === 'leave') { left = true; break; }
        if (a.kind === 'move' && a.target.where === 'grid') {
          const it = [...s.inventory.placed, ...s.inventory.shelf].find((i) => i?.uid === a.uid)!;
          expect(canPlace(s.inventory, it.type, a.target.x, a.target.y, a.target.rot, it.uid, it.tier ?? 1).ok).toBe(true);
        }
        // apply through the real rules, as the lab does
        if (a.kind === 'buy') buyOffer(s, a.slot);
        else if (a.kind === 'move') moveItem(s, a.uid, a.target);
        else if (a.kind === 'merge') mergeItems(s, a.uid, a.targetUid);
        else if (a.kind === 'repair') repair(s);
        else if (a.kind === 'acceptCustomer') acceptCustomer(s);
        else if (a.kind === 'upgradeCart') upgradeCart(s);
        else if (a.kind === 'upgradeShelf') upgradeShelf(s);
      }
    }
    expect(left).toBe(true);
    expect(s.inventory.placed.length).toBeGreaterThan(1);
  });

  it('avoids the rush door when weak or early, and always returns one of the doors', () => {
    const s = createRun(1);
    const pol = createGreedyPolicy();
    s.wave = 2;
    for (let i = 0; i < 20; i++) expect(pol.chooseDoor(['rush', 'quiet'], s, view(i))).toBe('quiet');
    s.wave = 5; s.hp = s.build.maxHp;
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pol.chooseDoor(['rush', 'quiet'], s, view(i))));
    expect(seen).toEqual(new Set(['rush', 'quiet']));
    expect(pol.chooseDoor(['boss'], s, view())).toBe('boss');
  });

  it('crate and stockroom picks resolve to a valid option, the one that builds the best cart', () => {
    const s = stateWith([{ type: Item.toaster }], { cols: 7, rows: 5 });
    s.pool = [...ITEM_IDS];
    const pol = createGreedyPolicy();
    const crates = rollMiniCrates(s, mulberry32(3));
    const ci = pol.pickCrate(crates, s, view());
    expect(ci).toBeGreaterThanOrEqual(0);
    expect(ci).toBeLessThan(crates.length);
    const room = rollStockroom(s, mulberry32(4));
    const ri = pol.pickStockroom(room, s, view());
    expect(ri).toBeGreaterThanOrEqual(0);
    expect(ri).toBeLessThan(room.length);
    // a fan (touches the toaster: a buff) beats a Piggy Bank (a passive that gives nothing here)
    const fan = { slot: 0, type: Item.fan, tier: 1, price: 0, sold: false }, piggy = { slot: 1, type: Item.piggy, tier: 1, price: 0, sold: false };
    expect(pol.pickStockroom([piggy, fan], s, view())).toBe(1);
  });
});
