import { DAMAGE_TYPES, type DamageType } from '../engine/damageType';
import { REACTION_IDS, type ReactionId } from '../engine/define';

// The run's damage breakdown (docs/item-hooks-refactor.md "Damage breakdown"). A small pure accumulator, fed by `ArenaScene.damageEnemy` and
// `FakeCtx.runHit` at the one point where the final damage of a hit is known (what is subtracted from hp, overkill included, exactly like the old
// `damageByWeapon`). It only reads numbers the pipeline already has: it never changes a damage value and draws no rng.

/** The per-run totals besides the per-source map (`RunStats.damageByWeapon`, keyed like `HitEvent.source`). */
export interface DamageStats {
  /** Damage per display type (`damageType`), every type present. `reaction` is the burst damage of the element reactions (engine/reactions.ts). */
  byType: Record<DamageType, number>;
  /** Burn and poison ticks. */
  dot: number;
  /** The final damage of hits whose affinity multiplier was above 1 (the enemy is weak to a tag of the hit). */
  weak: number;
  /** The final damage of hits whose multiplier was below 1. */
  resisted: number;
  /** Extra damage Shred gave: what its hits dealt minus what the same hits would have dealt with no Shred stacks (stripped armor and the exposed bonus). */
  shred: number;
  /** Extra damage of the mark: damage after the mark multiplier minus before it (pre-crit, pre-armor, like the pipeline slot). */
  mark: number;
  /** How often each element reaction went off (Toxic Fumes has no burst of its own, so its count is the only trace it leaves). */
  reactions: Record<ReactionId, number>;
}

/** Where a hit is recorded: `RunStats` and the FakeCtx's own log both fit. */
export interface DamageSink { damageByWeapon: Record<string, number>; damage: DamageStats }

/** One hit as the breakdown sees it. */
export interface DamageRecord {
  /** The `damageByWeapon` key. */
  source: string;
  /** Final damage (after armor). */
  dmg: number;
  type: DamageType;
  isDot: boolean;
  /** Affinity multiplier above 1 / below 1. */
  weak: boolean;
  resisted: boolean;
  /** The Shred and mark bonuses inside `dmg`'s pipeline (0 for none). */
  shred: number;
  mark: number;
}

export const newDamageStats = (): DamageStats => ({ byType: Object.fromEntries(DAMAGE_TYPES.map((t) => [t, 0])) as Record<DamageType, number>, dot: 0, weak: 0, resisted: 0, shred: 0, mark: 0, reactions: Object.fromEntries(REACTION_IDS.map((r) => [r, 0])) as Record<ReactionId, number> });

export function recordDamage(sink: DamageSink, h: DamageRecord): void {
  const d = sink.damage;
  sink.damageByWeapon[h.source] = (sink.damageByWeapon[h.source] ?? 0) + h.dmg;
  d.byType[h.type] += h.dmg;
  if (h.isDot) d.dot += h.dmg;
  if (h.weak) d.weak += h.dmg;
  else if (h.resisted) d.resisted += h.dmg;
  d.shred += h.shred;
  d.mark += h.mark;
}

/** One element reaction went off. */
export function recordReaction(sink: Pick<DamageSink, 'damage'>, id: ReactionId): void {
  sink.damage.reactions[id] += 1;
}

/** All damage dealt (the sum of the types). */
export const totalDamage = (d: DamageStats): number => DAMAGE_TYPES.reduce((a, t) => a + d.byType[t], 0);
