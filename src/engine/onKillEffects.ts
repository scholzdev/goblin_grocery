import type { RuntimeCtx } from './ctx';
import type { HitEvent } from './hooks';

// Stats-driven on-kill behavior (docs/item-hooks-refactor.md). `WeaponStats.popper` is set by Party Popper, Jelly Beans (blast)
// and the Blast set's radius, so the blast belongs to the engine, not to the item. The arena calls this right after the lethal hit's
// `killEnemy` + `onKill` hooks and the Kitchen / Blast-set kill rolls (it was the last line of damageEnemy). No rng.

/** Party Popper: a kill by a weapon with `popper` explodes in confetti; popper blasts themselves never chain. */
export function applyKillEffects(hit: HitEvent, ctx: RuntimeCtx): void {
  const { stats, opts: o, enemy } = hit;
  if (stats?.popper && !o.fromPopper) ctx.popperBlast(enemy, stats.popper);
}
