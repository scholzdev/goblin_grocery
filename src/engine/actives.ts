import type { Inventory, ItemInstance } from '../types';
import { tierBoostOf } from './build';
import { resolveTune } from './define';
import { contentItem } from './registry';
import type { RuntimeCtx } from './ctx';

// Active items ("spells"): the E key spends one charge of every placed instance whose item has an `active` and a charge left. Charges are
// per instance (`ItemInstance.charges`, missing = full) and refill when an aisle starts (`startNextWave`). Pure: no Phaser; the arena passes its ctx.

export interface ActiveSlot {
  inst: ItemInstance;
  /** Effective tier (Gold Star included). */
  tier: number;
  max: number;
  left: number;
}

/** Placed instances of active items, in cart order. */
export function activeSlots(cart: Inventory): ActiveSlot[] {
  const placed = cart.placed, boost = tierBoostOf(placed);
  const out: ActiveSlot[] = [];
  for (const inst of placed) {
    const c = contentItem(inst.type);
    if (!c?.active) continue;
    const tier = (inst.tier ?? 1) + boost(inst);
    const max = Math.max(0, Math.round(resolveTune(c.tune, tier).charges ?? 0));
    out.push({ inst, tier, max, left: Math.min(max, inst.charges ?? max) });
  }
  return out;
}

/** Aisle start: every active in the cart is full again. */
export function refillCharges(cart: Inventory): void {
  for (const s of activeSlots(cart)) s.inst.charges = s.max;
}

/** The E key: fires every active that has a charge, spending one each. Returns how many fired. */
export function fireActives(cart: Inventory, ctx: RuntimeCtx): number {
  let fired = 0;
  for (const s of activeSlots(cart)) {
    if (s.left <= 0) continue;
    s.inst.charges = s.left - 1;
    const c = contentItem(s.inst.type)!;
    const tune = Object.freeze(resolveTune(c.tune, s.tier));
    c.active!.use(ctx, { tier: s.tier, tune: () => tune as never, uid: s.inst.uid });
    fired++;
  }
  return fired;
}
