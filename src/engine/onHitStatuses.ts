import type { RuntimeCtx } from './ctx';
import type { HitEvent } from './hooks';
import { contentTune } from './registry';

// Stats-driven on-hit behavior (docs/item-hooks-refactor.md). `WeaponStats.burn` / `slow` / `ignite` / `echo` are a contract
// that several sources set (burn: Fuel Can, Jelly Beans heat, Grease Fire ...; slow: Ice Pack, Jelly frost, Cold Storage ...), so applying
// them belongs to the engine, not to any one item. The arena calls these at the damage pipeline's step 7, after the `onHit` hooks, in
// this order: `applyHitStatuses` (burn, Heat L2 ignite, slow), the `afterHit` hooks (Frost L2 freeze, Cleaning, Electric chain: the sets),
// knockback / flash / numbers (still in the scene), then `scheduleEcho`. Pure: everything goes through `RuntimeCtx`, so `FakeCtx` runs the
// same code as the scene.
//
// Rng: `applyHitStatuses` makes at most one draw (the Heat L2 ignite roll, only when its condition holds); the Frost freeze roll and the
// Electric chain roll follow in the `afterHit` hooks, in that order. Do not reorder: combat is seeded per aisle. The ignite roll stays here
// because `WeaponStats.ignite` is a plain stats contract (chance + burn) like `burn`; nothing in it reads a set.

/** Double Bag's second strike comes this long after the hit (its flat tune). */
const ECHO_DELAY = contentTune('doublebag', 1).delay;

export function applyHitStatuses(hit: HitEvent, ctx: RuntimeCtx): void {
  const { enemy: e, stats, opts: o } = hit;
  if (!stats) return;
  if (stats.burn) ctx.ignite(e, stats.burn); // refreshes, never stacks (applyBurn); the aisle's burn modifier is applied by ctx
  // Heat L2: direct hits without a burn of their own sometimes ignite (not DoT ticks).
  if (!o.isDot && stats.ignite && !stats.burn && ctx.rng() < stats.ignite.chance) {
    ctx.ignite(e, stats.ignite.burn);
    for (let i = 0; i < 3; i++) ctx.fx.flame(e.x + Math.round(Math.random() * 28) - 14, e.y - 20 - i * 10);
    ctx.fx.ring('fx_pulse', e.x, e.y, 60, 200, 0xff7a3d);
  }
  if (stats.slow) ctx.slow(e, stats.slow); // keeps the stronger slow, refreshes the timer (applySlow)
}

/** Double Bag: one delayed second strike per direct hit (echoes, popper blasts and chained hits never echo). No rng. */
export function scheduleEcho(hit: HitEvent, ctx: RuntimeCtx): void {
  const { enemy: e, stats, opts: o } = hit;
  if (!stats || !(stats.echo > 0) || !hit.direct) return;
  const base = hit.base;
  ctx.delay(ECHO_DELAY, () => {
    if (!e.alive || !ctx.combatActive()) return;
    ctx.fx.popImage('fx_echo', e.x + Math.round(Math.random() * 24) - 12, e.y - 40, 0.6);
    ctx.damage(e, base * stats.echo, stats, { echo: true, quiet: o.quiet });
  });
}
