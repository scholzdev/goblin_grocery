import type { BurnEffect, SlowEffect } from '../types';
import { AFFINITY, AFFINITY_TAGS, type AffinityMap, type AffinityTag } from './define';
import { MARK_MULT } from './marks';

// Element soft counters (docs/item-hooks-refactor.md "Affinity"). Pure rules over an enemy's `weak` / `resist` (content `defineEnemy`), no Phaser and
// no rng. The numbers are `AFFINITY` (engine/define.ts); the hit's tags come from `engine/hitTags.ts`.
//
//   damage      `affinityMult(def, tags)`: the single BEST weak among the hit's tags, minus the single best resist, added into ONE multiplier
//               (1 + weak - resist, never below 0). A heat + frost hit on a turkey (weak heat 0.3, resist frost 0.3) is therefore x1.
//   status time `statusDurationMult(def, tag)`: burn (heat), slow (frost), poison (poison), frost and electric stuns. x1.5 weak, x0.5 resist.
//               Only the duration scales, never the dps or the slow percentage. Stagger and the dash stun are not an element: no tag, x1.
//   mark        `markMult(def)`: the mark's own bonus scaled, so a weak mark (the Manager) is x1.4 where everyone else takes x1.2.
//   stagger     `tryStagger`: a boss or mini-boss hit on its weak tag may be knocked out of its walk for a moment.

/** The part of an enemy def the rules read. The real `EnemyDef` and `CombatEnemy.def` satisfy it. */
export interface AffinityDef { weak?: AffinityMap; resist?: AffinityMap }

/** Damage multiplier of a hit with these tags against `def`: 1 + (best weak magnitude) - (best resist magnitude), floored at 0. `mark` is not a hit tag and is skipped. */
export function affinityMult(def: AffinityDef, tags: readonly AffinityTag[]): number {
  const weak = def.weak, resist = def.resist;
  if (!weak && !resist) return 1;
  let w = 0, r = 0;
  for (const tag of tags) {
    if (tag === 'mark') continue;
    const a = weak?.[tag] ?? 0, b = resist?.[tag] ?? 0;
    if (a > w) w = a;
    if (b > r) r = b;
  }
  return Math.max(0, 1 + (w - r));
}

/** Time multiplier of a status of `tag` on `def`: `AFFINITY.weakDuration` when weak to it, `AFFINITY.resistDuration` when resisting it, else 1 (also without a tag). */
export function statusDurationMult(def: AffinityDef, tag?: AffinityTag): number {
  if (!tag) return 1;
  if ((def.weak?.[tag] ?? 0) > 0) return AFFINITY.weakDuration;
  if ((def.resist?.[tag] ?? 0) > 0) return AFFINITY.resistDuration;
  return 1;
}

/** The damage multiplier of a marked enemy: Price Check's `MARK_MULT` (x1.2) with its bonus scaled by `1 + weak.mark - resist.mark` (the Manager: x1.4). */
export function markMult(def: AffinityDef): number {
  const w = def.weak?.mark ?? 0, r = def.resist?.mark ?? 0;
  if (!w && !r) return MARK_MULT;
  return 1 + (MARK_MULT - 1) * Math.max(0, 1 + (w - r));
}

/** The strongest weak tag among `tags` (and `mark`, when `marked`), or null: what a feedback tint and the boss stagger key on. */
export function weakTag(def: AffinityDef, tags: readonly AffinityTag[], marked = false): AffinityTag | null {
  const weak = def.weak;
  if (!weak) return null;
  let best: AffinityTag | null = null, bv = 0;
  for (const tag of tags) { const v = weak[tag] ?? 0; if (v > bv) { bv = v; best = tag; } }
  if (marked && (weak.mark ?? 0) > bv) best = 'mark';
  return best;
}

/** The strongest resisted tag among `tags`, or null. */
export function resistTag(def: AffinityDef, tags: readonly AffinityTag[]): AffinityTag | null {
  const resist = def.resist;
  if (!resist) return null;
  let best: AffinityTag | null = null, bv = 0;
  for (const tag of tags) { const v = resist[tag] ?? 0; if (v > bv) { bv = v; best = tag; } }
  return best;
}

/** A burn with its duration scaled by the enemy's heat affinity (the same object when neutral). The dps and the tick stay. */
export const burnFor = (def: AffinityDef, burn: BurnEffect): BurnEffect => {
  const m = statusDurationMult(def, 'heat');
  return m === 1 ? burn : { ...burn, duration: burn.duration * m };
};
/** A slow with its duration scaled by the enemy's frost affinity (the same object when neutral). The percentage stays. */
export const slowFor = (def: AffinityDef, slow: SlowEffect): SlowEffect => {
  const m = statusDurationMult(def, 'frost');
  return m === 1 ? slow : { ...slow, duration: slow.duration * m };
};
/** A poison duration scaled by the enemy's poison affinity. */
export const poisonTimeFor = (def: AffinityDef, duration: number): number => duration * statusDurationMult(def, 'poison');

/** The part of an enemy the stagger reads (`state`, the boss's `staggerAt`). */
export interface StaggerSubject { state: string; staggerAt?: number; def: AffinityDef & { behavior: string } }

/**
 * Should this boss (or mini-boss: both have behavior 'boss') stagger from a hit with `tags`? Yes when the hit matches its weak tag (a marked
 * boss counts for a weak `mark`), it is walking (never interrupting a tell, attack, recovery or stun) and its last stagger was at least
 * `AFFINITY.stagger.cooldown` seconds ago. On yes the cooldown starts (`staggerAt = now`); the caller does the stun (`ArenaScene.staggerEnemy`).
 */
export function tryStagger(e: StaggerSubject, tags: readonly AffinityTag[], marked: boolean, now: number): boolean {
  if (e.def.behavior !== 'boss' || e.state !== 'walk') return false;
  if (e.staggerAt !== undefined && now - e.staggerAt < AFFINITY.stagger.cooldown) return false;
  if (!weakTag(e.def, tags, marked)) return false;
  e.staggerAt = now;
  return true;
}

/** `AFFINITY_TAGS` that a weapon or hit can carry (everything but `mark`). */
export const HIT_TAGS: readonly AffinityTag[] = AFFINITY_TAGS.filter((t) => t !== 'mark');
