import type { BurnEffect, SlowEffect } from '../types';
import type { StatusFx } from '../systems/combat';
import { WET_STATUS, type AffinityTag } from './define';

// Wet (docs/item-hooks-refactor.md "Wet"): the enemy status that makes the elements react. Pure rules over a `StatusFx`, no Phaser and no rng; a leaf module
// (types only from systems/combat) so content files can import it. The numbers are `WET_STATUS` (engine/define.ts). The pipeline slots: `wetElectricMult` next to the
// affinity in `damageEnemy` / `FakeCtx.runHit`, `slowVsWet` / `burnVsWet` in `ctx.slow` / `ctx.ignite`, `wetChainBonus` in the Electric chain and the Microwave zap,
// `wetFreezeChance` in the Frost freeze.

/** Wet (docs/item-hooks-refactor.md "Wet"): until = the later of the running end and now + duration. It never stacks and has no strength. */
export function applyWet(s: StatusFx, duration: number, now: number): void {
  s.wetUntil = Math.max(s.wetUntil, now + duration);
}

/** Is the enemy wet right now. */
export const isWet = (s: StatusFx, now: number): boolean => s.wetUntil > now;

/** Electric on wet: the damage multiplier of a hit with these tags (x`WET_STATUS.electricMult` for an `electric` hit on a wet enemy, else 1). */
export const wetElectricMult = (s: StatusFx, tags: readonly AffinityTag[], now: number): number => (isWet(s, now) && tags.includes('electric') ? WET_STATUS.electricMult : 1);

/** Chain hops a wet origin enemy adds to an Electric chain / Microwave zap: `WET_STATUS.chainBonus`, once per chain (0 when dry). */
export const wetChainBonus = (s: StatusFx, now: number): number => (isWet(s, now) ? WET_STATUS.chainBonus : 0);

/** Frost on wet: the Frost freeze chance, x`WET_STATUS.freezeChanceMult` on a wet enemy (at most 1). */
export const wetFreezeChance = (s: StatusFx, chance: number, now: number): number => (isWet(s, now) ? Math.min(1, chance * WET_STATUS.freezeChanceMult) : chance);

/** Frost on wet: a slow with +`frostSlowBonus` points on a wet enemy, never past `slowCap` and never below what it was (the same object when dry). */
export function slowVsWet(s: StatusFx, slow: SlowEffect, now: number): SlowEffect {
  if (!isWet(s, now)) return slow;
  return { ...slow, pct: Math.max(slow.pct, Math.min(WET_STATUS.slowCap, slow.pct + WET_STATUS.frostSlowBonus)) };
}

/** Heat on wet (steam): a burn applied to a wet enemy lasts x`burnDurationMult` and DRIES it (this mutates the status). The same object when dry. Existing burn ticks never come through here. */
export function burnVsWet(s: StatusFx, burn: BurnEffect, now: number): BurnEffect {
  if (!isWet(s, now)) return burn;
  s.wetUntil = 0;
  return { ...burn, duration: burn.duration * WET_STATUS.burnDurationMult };
}
