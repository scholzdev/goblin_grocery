import { MODIFIERS, type DoorId } from '../data/modifiers';
import { ITEM_ORDER, RECIPE_ORDER, SET_ORDER } from '../engine/define';
import { cartUpgradeCost, shelfUpgradeCost, shopUpgradeCost } from '../state/run';
import { currentRerollCost, repairCost, sellPrice } from '../systems/shop';
import type { Rng } from '../systems/rng';
import type { Build, ItemInstance, ItemTypeId, RunState, ShopOffer } from '../types';
import { bestPlacement, mergePairs, type Policy, type PolicyFactory, type PolicyView, type ShopAction } from './policy';

// The parameterized policy of Phase 1b (docs/buildlab.md "Genome"): every number a shop policy decides with, as a flat JSON object, so an
// optimizer can mutate it. `greedyGenome()` is the Phase 1a greedy policy written as one genome (tests/buildlab/genome.test.ts checks that
// both play identical runs).

/** One tunable number: its bounds, its greedy value, and whether it is rounded to a whole number. */
export interface ParamSpec { key: string; min: number; max: number; greedy: number; int?: boolean; group: 'item' | 'combo' | 'set' | 'door' | 'rule' }

/** The doors a policy can prefer (the boss door is forced, never chosen). */
export const DOOR_KINDS = (Object.keys(MODIFIERS) as DoorId[]).filter((d) => d !== 'boss');

const spec = (group: ParamSpec['group'], key: string, min: number, max: number, greedy: number, int = false): ParamSpec => ({ key, min, max, greedy, int, group });

/**
 * The parameters, in a fixed order. Keys: `item.<id>` (how much the policy wants the item: buy order, what is sold first, placement order),
 * `combo.<id>` and `set.<id>` (what a combo / a set level is worth when scoring a placement), `door.<id>` (relative odds of a door), `rule.*` (thresholds).
 */
export const GENOME_SPEC: readonly ParamSpec[] = [
  ...ITEM_ORDER.map((id) => spec('item', `item.${id}`, 0, 3, 1)),
  ...RECIPE_ORDER.map((id) => spec('combo', `combo.${id}`, 0, 30, 10)),
  ...SET_ORDER.map((id) => spec('set', `set.${id}`, 0, 10, 0)),
  ...DOOR_KINDS.map((id) => spec('door', `door.${id}`, 0, 3, 1)),
  spec('rule', 'rule.buffWeight', 0, 5, 1),
  spec('rule', 'rule.tierBonus', 0, 2, 0),
  spec('rule', 'rule.repairMargin', 0, 40, 9),
  spec('rule', 'rule.upgradeShopAbove', 0, 120, 45),
  spec('rule', 'rule.upgradeCartAbove', 0, 120, 30),
  spec('rule', 'rule.upgradeShelfAbove', 0, 120, 25),
  spec('rule', 'rule.buyReserve', 0, 40, 0),
  spec('rule', 'rule.maxRerolls', 0, 6, 0, true),
  spec('rule', 'rule.rerollWant', 0, 3, 1),
  spec('rule', 'rule.rerollReserve', 0, 40, 0),
  spec('rule', 'rule.sellOn', 0, 1, 0, true),
  spec('rule', 'rule.sellMargin', 0, 2, 0.25),
  spec('rule', 'rule.pickItem', 0, 10, 0),
  spec('rule', 'rule.rushAvoidHpFrac', 0, 1, 0.6),
  spec('rule', 'rule.rushAvoidUntilWave', 0, 7, 3, true),
];

/** Plain JSON: `{ p: { 'item.fan': 1.2, 'rule.repairMargin': 9, ... } }`. Every key of `GENOME_SPEC` is present. */
export interface Genome { p: Record<string, number> }

const clampTo = (s: ParamSpec, v: number): number => {
  const c = Math.max(s.min, Math.min(s.max, Number.isFinite(v) ? v : s.greedy));
  return s.int ? Math.round(c) : Math.round(c * 1e4) / 1e4;
};

/** The greedy policy (Phase 1a, botrun's shop) as a genome. */
export function greedyGenome(): Genome {
  return { p: Object.fromEntries(GENOME_SPEC.map((s) => [s.key, s.greedy])) };
}

/** A genome from parsed JSON: unknown keys dropped, missing ones greedy, everything clamped to its bounds. */
export function genomeFromJSON(json: unknown): Genome {
  const src = (json && typeof json === 'object' ? (json as { p?: Record<string, number> }).p : undefined) ?? {};
  return { p: Object.fromEntries(GENOME_SPEC.map((s) => [s.key, clampTo(s, typeof src[s.key] === 'number' ? src[s.key] : s.greedy)])) };
}

/** Every parameter uniform in its bounds: the control population. */
export function randomGenome(rng: Rng): Genome {
  return { p: Object.fromEntries(GENOME_SPEC.map((s) => [s.key, clampTo(s, s.min + rng() * (s.max - s.min))])) };
}

const gauss = (rng: Rng): number => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

/**
 * Gaussian mutation on the normalized value ((v - min) / (max - min), so every parameter moves on the same scale): each parameter is hit with
 * probability `rate`, at least one is always changed. The result is clamped to the bounds (integers rounded).
 */
export function mutate(g: Genome, rng: Rng, sigma: number, rate: number): Genome {
  const p = { ...g.p };
  const hit = GENOME_SPEC.filter(() => rng() < rate);
  if (!hit.length) hit.push(GENOME_SPEC[Math.floor(rng() * GENOME_SPEC.length)]);
  for (const s of hit) {
    const n = (p[s.key] - s.min) / (s.max - s.min) + gauss(rng) * sigma;
    p[s.key] = clampTo(s, s.min + Math.max(0, Math.min(1, n)) * (s.max - s.min));
  }
  return { p };
}

/** Uniform crossover. */
export function crossover(a: Genome, b: Genome, rng: Rng): Genome {
  return { p: Object.fromEntries(GENOME_SPEC.map((s) => [s.key, rng() < 0.5 ? a.p[s.key] : b.p[s.key]])) };
}

/** Root-mean-square difference of the normalized parameters (0 = identical, ~0.4 = two random genomes). */
export function distance(a: Genome, b: Genome): number {
  let t = 0;
  for (const s of GENOME_SPEC) { const d = (a.p[s.key] - b.p[s.key]) / (s.max - s.min); t += d * d; }
  return Math.sqrt(t / GENOME_SPEC.length);
}

// ───────────────────────────── the policy ─────────────────────────────

type Stage = 'buy' | 'reroll' | 'buy2' | 'merge' | 'place' | 'services' | 'merge2' | 'place2' | 'leave';

/** The shop policy a genome describes. Same stages as the greedy policy; with the greedy genome the two play identical runs. */
export function createGenomePolicy(genome: Genome, name = 'genome'): Policy {
  const g = genomeFromJSON(genome).p;
  const w = (k: string): number => g[k];
  const value = (type: ItemTypeId, tier: number): number => g[`item.${type}`] * (1 + w('rule.tierBonus') * (tier - 1));
  const scorer = (b: Build): number => {
    let s = 0;
    for (const r of b.recipes) s += g[`combo.${r.id}`];
    for (const id of SET_ORDER) s += g[`set.${id}`] * b.sets[id];
    for (const x of b.weapons) s += w('rule.buffWeight') * x.buffs.length;
    return s;
  };
  let stage: Stage = 'buy', rerolls = 0;

  const placement = (state: RunState, it: { type: ItemTypeId; tier?: number; uid?: string; double?: boolean; flavor?: ItemInstance['flavor'] }) => bestPlacement(state, it, scorer);

  const buys = (state: RunState, pre: boolean): ShopAction[] => {
    const out: ShopAction[] = [];
    let money = state.money;
    const sh = state.shop!;
    if (pre) {
      if (state.hp < state.build.maxHp - w('rule.repairMargin') && !sh.repairUsed) { out.push({ kind: 'repair' }); money -= repairCost(state); }
      if (money > w('rule.upgradeShopAbove') && shopUpgradeCost(state) !== null) { out.push({ kind: 'upgradeShop' }); money -= shopUpgradeCost(state) ?? 0; }
    }
    const shelf = state.inventory.shelf;
    let free = shelf.filter((s) => !s).length;
    const sellable = shelf.filter((s): s is ItemInstance => !!s).sort((a, b) => value(a.type, a.tier ?? 1) - value(b.type, b.tier ?? 1) || (a.uid < b.uid ? -1 : 1));
    const ranked = sh.offers.filter((x) => !x.sold).map((x) => ({ x, v: value(x.type, x.tier) })).filter((r) => r.v > 0);
    ranked.sort((a, b) => b.v - a.v || a.x.slot - b.x.slot);
    for (const { x, v } of ranked) {
      let spend = x.price, sale: ItemInstance | undefined;
      if (free <= 0) { // shelf full: sell its least valuable item if this offer is clearly better
        if (w('rule.sellOn') < 1) continue;
        sale = sellable.find((s) => s.type !== x.type && value(s.type, s.tier ?? 1) + w('rule.sellMargin') < v);
        if (!sale) continue;
        spend -= sellPrice(sale.type, sale.tier ?? 1, state.build);
      }
      if (spend > money - w('rule.buyReserve')) continue;
      if (sale) { out.push({ kind: 'sell', uid: sale.uid }); sellable.splice(sellable.indexOf(sale), 1); free++; }
      money -= spend; free--;
      out.push({ kind: 'buy', slot: x.slot });
    }
    return out;
  };

  const placeBatch = (state: RunState): ShopAction[] => {
    const items = state.inventory.shelf.filter((s): s is ItemInstance => !!s).map((it) => ({ it, v: value(it.type, it.tier ?? 1) })).filter((r) => r.v > 0);
    items.sort((a, b) => b.v - a.v); // stable: ties keep slot order
    for (const { it } of items) {
      const p = placement(state, it);
      if (p) return [{ kind: 'move', uid: it.uid, target: { where: 'grid', x: p.x, y: p.y, rot: p.rot } }];
    }
    return [];
  };

  const pickScore = (state: RunState, x: ShopOffer): number => {
    const p = placement(state, { type: x.type, tier: x.tier, double: x.double });
    return (p ? p.score : -1) + w('rule.pickItem') * value(x.type, x.tier);
  };
  const pickBest = (options: ShopOffer[], state: RunState): number => {
    let best = 0, bs = -Infinity;
    options.forEach((x, i) => { const s = pickScore(state, x); if (s > bs) { bs = s; best = i; } });
    return best;
  };

  return {
    name,
    decideShop(state, view) {
      if (view.round === 0) { stage = 'buy'; rerolls = 0; }
      for (;;) {
        switch (stage) {
          case 'buy': { stage = 'reroll'; const a = buys(state, true); if (a.length) return a; break; }
          case 'reroll': {
            const sh = state.shop!, cost = currentRerollCost(state);
            const bestOnTable = Math.max(0, ...sh.offers.map((x) => value(x.type, x.tier)));
            if (rerolls < Math.round(w('rule.maxRerolls')) && bestOnTable < w('rule.rerollWant') && cost <= state.money - w('rule.rerollReserve')) { rerolls++; stage = 'buy2'; return [{ kind: 'reroll' }]; }
            stage = 'merge';
            break;
          }
          case 'buy2': { stage = 'reroll'; const a = buys(state, false); if (a.length) return a; break; }
          case 'merge': case 'merge2': { const a = mergePairs(state); if (a.length) return a; stage = stage === 'merge' ? 'place' : 'place2'; break; }
          case 'place': case 'place2': { const a = placeBatch(state); if (a.length) return a; stage = stage === 'place' ? 'services' : 'leave'; break; }
          case 'services': {
            const acts: ShopAction[] = [];
            const cart = cartUpgradeCost(state), shelf = shelfUpgradeCost(state);
            let m = state.money;
            if (m > w('rule.upgradeCartAbove') && cart !== null && cart <= m) { acts.push({ kind: 'upgradeCart' }); m -= cart; }
            if (m > w('rule.upgradeShelfAbove') && shelf !== null && shelf <= m) acts.push({ kind: 'upgradeShelf' });
            stage = 'merge2';
            if (acts.length) return acts;
            break;
          }
          case 'leave': return [{ kind: 'leave' }];
        }
      }
    },
    chooseDoor(doors, state, view: PolicyView) {
      const rushOk = !(state.hp < state.build.maxHp * w('rule.rushAvoidHpFrac') || state.wave <= Math.round(w('rule.rushAvoidUntilWave')));
      let pick = doors;
      if (doors.length > 1 && !rushOk) { const safe = doors.filter((d) => d !== 'rush'); if (safe.length) pick = safe; }
      const ws = pick.map((d) => (d === 'boss' ? 1 : g[`door.${d}`]));
      const total = ws.reduce((a, b) => a + b, 0);
      if (total <= 0) return pick[Math.floor(view.rng() * pick.length)];
      let r = view.rng() * total;
      for (let i = 0; i < pick.length; i++) if ((r -= ws[i]) < 0) return pick[i];
      return pick[pick.length - 1];
    },
    pickCrate: (options, state) => pickBest(options, state),
    pickStockroom: (options, state) => pickBest(options, state),
    placeItem(state, item) {
      const p = placement(state, item);
      return p ? { x: p.x, y: p.y, rot: p.rot } : null;
    },
  };
}

/** A policy factory for a genome (a fresh policy per run). */
export const genomePolicy = (genome: Genome, name = 'genome'): PolicyFactory => () => createGenomePolicy(genome, name);
