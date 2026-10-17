import { contentComboTune } from './registry';

// The mark multiplier (docs/item-hooks-refactor.md). A mark has two writers, the Space dash (Sale Flag, `onDashHit`) and the
// Self-Checkout beam (Price Check, `pattern:beam`), but one rule: a marked enemy takes extra damage from every source. So the rule is engine
// behavior, like `burn` and `slow`, and the number lives with Price Check (`tune.damageMult`, the combo that introduced marks). The arena
// calls `markMult` in `damageEnemy` right after the `modifyDamage` hooks, so the multiplication order is unchanged: Five-Alarm (a
// `modifyDamage` hook, order 10), then the mark, then the crit roll. `FakeCtx.runHit` does the same.

/** Damage multiplier of a marked enemy (Price Check's `damageMult`; Sale Flag's text shows `1 + bonus` and a test pins them equal). */
export const MARK_MULT = contentComboTune('priceCheck').damageMult;

/** Mark `e` for `seconds` from `now`. A re-mark only extends: a shorter one (Price Check 3 s) never cuts a longer one (Sale Flag up to 4 s), like `applyBurn` / `applyPoison`. */
export const applyMark = (e: { markedUntil?: number }, now: number, seconds: number): void => { e.markedUntil = Math.max(e.markedUntil ?? 0, now + seconds); };

/** `dmg` after the mark: ×`mult` (default `MARK_MULT`; callers pass `markMult(e.def)`) while `markedUntil` is in the future, untouched otherwise. */
export const markedDamage = (dmg: number, markedUntil: number | undefined, now: number, mult: number = MARK_MULT): number => ((markedUntil ?? 0) > now ? dmg * mult : dmg);
