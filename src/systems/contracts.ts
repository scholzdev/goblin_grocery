import { GOALS, type GoalDef, type GoalId, type KillGoal } from '../data/contracts';
import { itemTags } from '../engine/hitTags';
import type { AffinityTag } from '../engine/define';
import type { Inventory, ItemTypeId } from '../types';
import { contentTune } from '../engine/registry';
import { mulberry32 } from './rng';

// Punch Card (docs/new-items-plan.md "Contracts"): the aisle's goal and its progress. Pure: the arena feeds it kills, hits and time,
// the run state owns the card (`RunState.punch`), the HUD (`ui/hud` `contract`) draws a `PunchView`.

export type PunchStatus = 'active' | 'done' | 'failed';

export interface PunchCard {
  goal: GoalId;
  /** Kills needed, or seconds without a hit. */
  target: number;
  /** Kills so far, or the current hit-free streak in seconds. */
  progress: number;
  status: PunchStatus;
  /** Coins paid on completion (the Punch Card's tier). */
  coins: number;
}

/** What one credited kill was. */
export interface PunchKill { tags: readonly AffinityTag[]; dash: boolean; elite: boolean }

export const PUNCH_ITEM: ItemTypeId = 'punchcard';

const goalDef = (id: GoalId): GoalDef => GOALS.find((g) => g.id === id)!;

/** The elemental tags the cart can put on a hit: its weapons' and modules' (`itemTags`), plus a Jelly Beans flavor. */
export function cartTags(inv: Pick<Inventory, 'placed'>): Set<AffinityTag> {
  const out = new Set<AffinityTag>();
  for (const i of inv.placed) {
    for (const tag of itemTags(i.type)) out.add(tag);
    if (i.flavor) out.add(i.flavor);
  }
  return out;
}

/** Highest tier of a Punch Card in the cart, or 0 when there is none (a card on the shelf does nothing). */
export const punchTier = (inv: Pick<Inventory, 'placed'>): number =>
  inv.placed.reduce((m, i) => (i.type === PUNCH_ITEM ? Math.max(m, i.tier ?? 1) : m), 0);

export interface AisleFacts {
  aisle: number;
  boss: boolean;
  /** Groceries the aisle spawns (`waveSpawnPlan(...).total`). */
  total: number;
  /** The aisle is a fight with a timer and groceries (false in the stockroom and the lab sandbox). */
  fight: boolean;
}

const targetOf = (g: KillGoal, total: number): number => Math.min(g.max, Math.max(g.min, Math.round(g.share * total)));

/** The goals this cart and aisle can actually meet, with their targets. Elites need a later aisle and are not on the boss aisle. */
export function eligibleGoals(tags: ReadonlySet<AffinityTag>, a: AisleFacts): { id: GoalId; target: number }[] {
  if (!a.fight) return [];
  const out: { id: GoalId; target: number }[] = [];
  for (const g of GOALS) {
    if (g.kind === 'nohit') { out.push({ id: g.id, target: g.seconds }); continue; }
    if ('needs' in g && g.needs && !tags.has(g.needs)) continue;
    if ('minAisle' in g && g.minAisle && a.aisle < g.minAisle) continue;
    if (a.boss) continue; // the boss aisle has six groceries and the boss: only the hit-free goal fits
    out.push({ id: g.id, target: targetOf(g, a.total) });
  }
  return out;
}

/** The aisle's card, drawn from a stream of its own (run seed + aisle) so the run's rng is not touched; null without a Punch Card or a fight. */
export function rollPunchCard(seed: number, inv: Pick<Inventory, 'placed'>, a: AisleFacts): PunchCard | null {
  const tier = punchTier(inv);
  if (tier === 0) return null;
  const pool = eligibleGoals(cartTags(inv), a);
  if (!pool.length) return null;
  const pick = pool[Math.floor(mulberry32(seed ^ Math.imul(a.aisle, 0x85ebca6b) ^ 0x70c4)() * pool.length)];
  return { goal: pick.id, target: pick.target, progress: 0, status: 'active', coins: contentTune(PUNCH_ITEM, tier).coins };
}

/** Does this kill count toward the card's goal? */
export function killCounts(goal: GoalId, k: PunchKill): boolean {
  const g = goalDef(goal);
  if (g.kind !== 'kills') return false;
  switch (g.match) {
    case 'any': return true;
    case 'dash': return k.dash;
    case 'elite': return k.elite;
    default: return k.tags.includes(g.match);
  }
}

const settle = (p: PunchCard): 'done' | null => {
  if (p.progress < p.target) return null;
  p.progress = p.target;
  p.status = 'done';
  return 'done';
};

/** A credited kill. Returns 'done' on the kill that completes the card. */
export function punchKill(p: PunchCard, k: PunchKill): 'done' | null {
  if (p.status !== 'active' || !killCounts(p.goal, k)) return null;
  p.progress++;
  return settle(p);
}

/** The goblin took a hit: a hit-free streak starts over. */
export function punchHit(p: PunchCard): void {
  if (p.status === 'active' && goalDef(p.goal).kind === 'nohit') p.progress = 0;
}

/** Advance time. `timeLeft` is the aisle clock (< 0: no clock). A streak that can no longer reach the target fails the card. Returns 'done' or 'failed' on a change. */
export function punchTick(p: PunchCard, dt: number, timeLeft: number): 'done' | 'failed' | null {
  if (p.status !== 'active' || goalDef(p.goal).kind !== 'nohit') return null;
  p.progress += dt;
  const done = settle(p);
  if (done) return done;
  if (timeLeft >= 0 && p.progress + timeLeft < p.target) { p.status = 'failed'; return 'failed'; }
  return null;
}

/** Everything the HUD sticker shows. */
export interface PunchView { goal: GoalId; status: PunchStatus; progress: number; target: number; coins: number; shown: number; frac: number }

export function punchView(p: PunchCard): PunchView {
  const shown = goalDef(p.goal).kind === 'nohit' ? Math.floor(p.progress) : p.progress;
  return { goal: p.goal, status: p.status, progress: p.progress, target: p.target, coins: p.coins, shown, frac: Math.min(1, p.progress / p.target) };
}

/** Free reroll the next shop gets for a completed card; the coins are paid at completion (`payPunchCard`). */
export const PUNCH_REROLLS = 1;
