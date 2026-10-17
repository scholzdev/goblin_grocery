import { ITEMS, PLAYER, TIER } from '../data/items';
import type { DoorId } from '../data/modifiers';
import { cellsFor } from '../data/items';
import type { Build, Inventory, ItemInstance, ItemTypeId, Rotation, RunState, ShopOffer } from '../types';
import { footprint, normalizeRotation, rotateCells } from '../systems/inventory';
import { computeBuild } from '../systems/synergies';
import { cartUpgradeCost, mergeTargetFor, shelfUpgradeCost, shopUpgradeCost, type MoveTarget } from '../state/run';
import { repairCost } from '../systems/shop';
import type { Rng } from '../systems/rng';

// The build-lab policies (docs/buildlab.md). A policy is everything the lab asks a player to decide: what to do in the shop, which door,
// which crate. The lab owns the rules (state/run.ts); a policy only returns actions, and the lab applies them with the real rules.
//
// Shop protocol: the lab calls `decideShop(state, view)` repeatedly with the FRESH state. Each call returns the next batch of actions (applied
// in order; one that fails is logged and skipped). The shop ends when a call returns `[]` or a batch containing `leave`, when a whole batch
// fails, or after `SHOP_ROUNDS` calls. A policy therefore never has to guess the result of its own earlier actions.

export type ShopAction =
  | { kind: 'buy'; slot: number }
  | { kind: 'reroll' }
  | { kind: 'merge'; uid: string; targetUid: string }
  | { kind: 'move'; uid: string; target: MoveTarget }
  | { kind: 'rotate'; uid: string; rot: Rotation }
  | { kind: 'upgradeItem'; uid: string }
  | { kind: 'upgradeCart' }
  | { kind: 'upgradeShelf' }
  | { kind: 'upgradeShop' }
  | { kind: 'repair' }
  | { kind: 'sell'; uid: string }
  | { kind: 'leave' };

/** Hard cap on `decideShop` calls per shop visit. */
export const SHOP_ROUNDS = 64;

/** What the lab hands a policy besides the run state. */
export interface PolicyView {
  /** The policy's own seeded rng (separate from every game stream). The only randomness a policy may use. */
  rng: Rng;
  /** 0 on the first `decideShop` call of a shop visit, +1 per call. */
  round: number;
}

export interface Policy {
  readonly name: string;
  /** The next batch of shop actions (see the protocol above). Must not mutate `state`. */
  decideShop(state: RunState, view: PolicyView): ShopAction[];
  /** Which door to take; one of `doors`. */
  chooseDoor(doors: DoorId[], state: RunState, view: PolicyView): DoorId;
  /** The mid-shift boss crates: the index of the offer to take. */
  pickCrate(options: ShopOffer[], state: RunState, view: PolicyView): number;
  /** The stockroom: the index of the offer to take. */
  pickStockroom(options: ShopOffer[], state: RunState, view: PolicyView): number;
  /** Where a shelf item should go in the cart, or null to leave it on the shelf. */
  placeItem(state: RunState, item: ItemInstance, view: PolicyView): { x: number; y: number; rot: Rotation } | null;
}

/** A policy is built fresh for every run (it may keep per-visit memory). */
export type PolicyFactory = () => Policy;

// ───────────────────────────── scoring and placement ─────────────────────────────

export interface ScoreWeights { recipe: number; buff: number }
export const DEFAULT_SCORE: ScoreWeights = { recipe: 10, buff: 1 };

/** botrun's cart score: active combos x10 + module buffs on weapons x1. */
export const scoreBuild = (b: Build, w: ScoreWeights = DEFAULT_SCORE): number => b.recipes.length * w.recipe + b.weapons.reduce((n, x) => n + x.buffs.length, 0) * w.buff;

export interface Placement { x: number; y: number; rot: Rotation; score: number }
/** What `bestPlacement` needs of an item: an owned instance, or just a type and tier (a crate option). */
export interface Probe { type: ItemTypeId; tier?: number; uid?: string; double?: boolean; flavor?: ItemInstance['flavor'] }

const perkOf = (state: RunState) => PLAYER.starters[state.starter ?? 'toaster'].perk;

/**
 * Every free spot of the item in the WHOLE current cart (all canonical rotations, every cell), scored by the build it would give; the first best
 * wins (scan order: rotation, row, column), like botrun. null when it fits nowhere. Does not mutate `state`.
 */
export type Scorer = (b: Build) => number;
export function bestPlacement(state: RunState, probe: Probe, weights: ScoreWeights | Scorer = DEFAULT_SCORE): Placement | null {
  const score: Scorer = typeof weights === 'function' ? weights : (b) => scoreBuild(b, weights);
  const inv = state.inventory, tier = probe.tier ?? 1;
  const occ = new Set<number>();
  for (const p of inv.placed) for (const c of footprint(p)) occ.add(c.y * 64 + c.x);
  const work: Inventory = { cols: inv.cols, rows: inv.rows, placed: [...inv.placed], shelf: [] };
  const inst: ItemInstance = { uid: probe.uid ?? '__probe', type: probe.type, x: 0, y: 0, rot: 0, tier, ...(probe.double ? { double: true } : {}), ...(probe.flavor ? { flavor: probe.flavor } : {}) };
  work.placed.push(inst);
  const base = cellsFor(probe.type, tier);
  let best: Placement | null = null;
  for (const rot of [0, 1, 2, 3] as Rotation[]) {
    if (normalizeRotation(probe.type, rot, tier) !== rot) continue; // a rotation with the same footprint as an earlier one
    const cells = rotateCells(base, rot);
    const w = Math.max(...cells.map((c) => c.x)) + 1, h = Math.max(...cells.map((c) => c.y)) + 1;
    for (let y = 0; y + h <= inv.rows; y++) for (let x = 0; x + w <= inv.cols; x++) {
      if (cells.some((c) => occ.has((c.y + y) * 64 + c.x + x))) continue;
      inst.x = x; inst.y = y; inst.rot = rot;
      const sc = score(computeBuild(work, perkOf(state)));
      if (!best || sc > best.score) best = { x, y, rot, score: sc };
    }
  }
  return best;
}

const owned = (state: RunState): ItemInstance[] => [...state.inventory.placed, ...state.inventory.shelf.filter((s): s is ItemInstance => !!s)];

// ───────────────────────────── the greedy policy (botrun's shop, ported) ─────────────────────────────

export interface GreedyOptions {
  /** Repair when hp < maxHp - this. */
  repairSlack: number;
  /** Buy the next Loyalty level when money is above this. */
  upgradeShopAbove: number;
  upgradeCartAbove: number;
  upgradeShelfAbove: number;
  /** Placement score weights (combo, buff). */
  score: ScoreWeights;
  /** Avoid the rush door when hp is below this share of max HP, or when the aisle just fought is at most `rushAvoidUntilWave`. */
  rushAvoidHpFrac: number;
  rushAvoidUntilWave: number;
  /**
   * Phase 1b hook: how much the policy wants an offer. <= 0 never buys it; higher buys first. Default 1 for everything (buy every affordable offer, in slot order).
   * Parameterized policies set per-item weights here.
   */
  itemWeight?: (type: ItemTypeId, tier: number, state: RunState) => number;
  /** Phase 1b hook: extra score for putting `type` in the cart (added to the build score of a placement or a crate option). */
  placeBonus?: (type: ItemTypeId, tier: number, state: RunState) => number;
  /** Rerolls per shop visit (botrun's default build never rerolls). */
  maxRerolls: number;
}

export const GREEDY_DEFAULTS: GreedyOptions = {
  repairSlack: 9, upgradeShopAbove: 45, upgradeCartAbove: 30, upgradeShelfAbove: 25, score: DEFAULT_SCORE,
  rushAvoidHpFrac: 0.6, rushAvoidUntilWave: 3, maxRerolls: 0,
};

type Stage = 'buy' | 'merge' | 'place' | 'services' | 'merge2' | 'place2' | 'leave';
const STAGES: Stage[] = ['buy', 'merge', 'place', 'services', 'merge2', 'place2', 'leave'];

/** Disjoint pairs of identical (type and tier) mergeable copies: the shelf copy is consumed into the cart copy where there is one. */
export function mergePairs(state: RunState): ShopAction[] {
  const inv = state.inventory, used = new Set<string>(), out: ShopAction[] = [];
  const all = owned(state);
  for (const b of all) { // b = the copy that stays: cart first
    if (used.has(b.uid) || ITEMS[b.type].legendary || (b.tier ?? 1) >= TIER.max) continue;
    const a = mergeTargetFor(inv, b.type, b.tier ?? 1, b);
    if (!a || used.has(a.uid)) continue;
    const consume = !inv.placed.includes(a) ? a : !inv.placed.includes(b) ? b : a; // consume a shelf copy into a cart copy where there is one
    const keep = consume === a ? b : a;
    used.add(a.uid); used.add(b.uid);
    out.push({ kind: 'merge', uid: consume.uid, targetUid: keep.uid });
  }
  return out;
}

export function createGreedyPolicy(opt: Partial<GreedyOptions> = {}): Policy {
  const o: GreedyOptions = { ...GREEDY_DEFAULTS, ...opt };
  let stage = 0, rerolls = 0;
  const bonus = (type: ItemTypeId, tier: number, state: RunState) => o.placeBonus?.(type, tier, state) ?? 0;
  const placementOf = (state: RunState, it: ItemInstance): Placement | null => {
    const p = bestPlacement(state, it, o.score);
    return p ? { ...p, score: p.score + bonus(it.type, it.tier ?? 1, state) } : null;
  };

  const buyBatch = (state: RunState): ShopAction[] => {
    const out: ShopAction[] = [];
    let money = state.money, free = state.inventory.shelf.filter((s) => !s).length;
    const sh = state.shop!;
    // The rules decide whether these two succeed; the money left for offers is the pessimistic (both bought) share.
    if (state.hp < state.build.maxHp - o.repairSlack && !sh.repairUsed) { out.push({ kind: 'repair' }); money -= repairCost(state); }
    if (money > o.upgradeShopAbove && shopUpgradeCost(state) !== null) { out.push({ kind: 'upgradeShop' }); money -= shopUpgradeCost(state) ?? 0; }
    const ranked = sh.offers.filter((x) => !x.sold).map((x) => ({ x, w: o.itemWeight?.(x.type, x.tier, state) ?? 1 })).filter((r) => r.w > 0);
    ranked.sort((a, b) => b.w - a.w || a.x.slot - b.x.slot);
    for (const { x } of ranked) {
      if (free <= 0 || x.price > money) continue;
      money -= x.price; free--;
      out.push({ kind: 'buy', slot: x.slot });
    }
    if (rerolls < o.maxRerolls) { rerolls++; out.push({ kind: 'reroll' }); }
    return out;
  };

  const placeBatch = (state: RunState): ShopAction[] => {
    for (const it of state.inventory.shelf) {
      if (!it) continue;
      const p = placementOf(state, it);
      if (p) return [{ kind: 'move', uid: it.uid, target: { where: 'grid', x: p.x, y: p.y, rot: p.rot } }];
    }
    return [];
  };

  const policy: Policy = {
    name: 'greedy',
    decideShop(state, view) {
      if (view.round === 0) { stage = 0; rerolls = 0; }
      while (stage < STAGES.length) {
        const s = STAGES[stage];
        let acts: ShopAction[] = [];
        if (s === 'buy') { acts = buyBatch(state); stage++; if (acts.length) return acts; continue; }
        if (s === 'merge' || s === 'merge2') acts = mergePairs(state);
        else if (s === 'place' || s === 'place2') acts = placeBatch(state);
        else if (s === 'services') {
          const cart = cartUpgradeCost(state), shelf = shelfUpgradeCost(state);
          let m = state.money;
          if (m > o.upgradeCartAbove && cart !== null && cart <= m) { acts.push({ kind: 'upgradeCart' }); m -= cart; }
          if (m > o.upgradeShelfAbove && shelf !== null && shelf <= m) acts.push({ kind: 'upgradeShelf' });
          stage++;
          if (acts.length) return acts;
          continue;
        } else return [{ kind: 'leave' }];
        if (acts.length) return acts; // stay in the stage: the next call recomputes from the new state
        stage++;
      }
      return [{ kind: 'leave' }];
    },
    chooseDoor(doors, state, view) {
      let pick = doors;
      if (doors.length > 1 && (state.hp < state.build.maxHp * o.rushAvoidHpFrac || state.wave <= o.rushAvoidUntilWave)) {
        const safe = doors.filter((d) => d !== 'rush');
        if (safe.length) pick = safe;
      }
      return pick[Math.floor(view.rng() * pick.length)];
    },
    pickCrate: (options, state) => pickBest(options, state, placementScore),
    pickStockroom: (options, state) => pickBest(options, state, placementScore),
    placeItem: (state, item) => {
      const p = placementOf(state, item);
      return p ? { x: p.x, y: p.y, rot: p.rot } : null;
    },
  };
  function placementScore(state: RunState, x: ShopOffer): number {
    const p = bestPlacement(state, { type: x.type, tier: x.tier, double: x.double }, o.score);
    return p ? p.score + bonus(x.type, x.tier, state) : -1;
  }
  return policy;
}

/** The option with the highest score (the first on ties); the first option when none fits anywhere. */
function pickBest(options: ShopOffer[], state: RunState, score: (state: RunState, o: ShopOffer) => number): number {
  let best = 0, bs = -Infinity;
  options.forEach((x, i) => { const s = score(state, x); if (s > bs) { bs = s; best = i; } });
  return best;
}
