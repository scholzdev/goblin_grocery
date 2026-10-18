import type { AffinityTag } from '../engine/define';

// Punch Card goals (docs/new-items-plan.md "Contracts"). One goal per aisle, drawn from this table after filtering by the cart and the aisle
// (systems/contracts `eligibleGoals`), so the player is never handed a goal they cannot meet. Every number is a first guess.

/** What a kill must be to count toward a `kills` goal. */
export type KillMatch = AffinityTag | 'dash' | 'elite' | 'any';

export interface KillGoal {
  id: string;
  kind: 'kills';
  match: KillMatch;
  /** Tag the cart must be able to deal (elemental goals only). */
  needs?: AffinityTag;
  /** Elites do not show up before this aisle. */
  minAisle?: number;
  /** Target = round(share x the aisle's grocery count), clamped to [min, max]. Share is sized so ~55 groceries (aisle 4) gives the plan's number. */
  share: number;
  min: number;
  max: number;
}
export interface TimedGoal { id: string; kind: 'nohit'; seconds: number }
export type GoalDef = KillGoal | TimedGoal;

export const GOALS = [
  { id: 'heat', kind: 'kills', match: 'heat', needs: 'heat', share: 0.36, min: 8, max: 30 },
  { id: 'frost', kind: 'kills', match: 'frost', needs: 'frost', share: 0.3, min: 6, max: 26 },
  { id: 'electric', kind: 'kills', match: 'electric', needs: 'electric', share: 0.3, min: 6, max: 26 },
  { id: 'blast', kind: 'kills', match: 'blast', needs: 'blast', share: 0.25, min: 5, max: 22 },
  { id: 'dash', kind: 'kills', match: 'dash', share: 0.09, min: 3, max: 8 },
  { id: 'elite', kind: 'kills', match: 'elite', minAisle: 4, share: 0.055, min: 2, max: 4 },
  { id: 'any', kind: 'kills', match: 'any', share: 0.6, min: 15, max: 50 },
  { id: 'nohit', kind: 'nohit', seconds: 20 },
] as const satisfies readonly GoalDef[];

export type GoalId = (typeof GOALS)[number]['id'];
