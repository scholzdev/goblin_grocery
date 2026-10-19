import type { Inventory, ItemInstance } from '../types';
import { footprint } from '../systems/inventory';
import { tierBoostOf } from './build';
import { resolveTune } from './define';
import { contentItem } from './registry';
import type { RuntimeCtx } from './ctx';

// Active items ("spells"): the cart's actives take up to three slots in reading order (top-left-most footprint cell, then row by row), and
// key 1/2/3 fires only its slot, spending one charge. Charges are per instance (`ItemInstance.charges`, missing = full) and refill when an aisle starts (`startNextWave`). Pure: no Phaser; the arena passes its ctx.

export const MAX_ACTIVE_SLOTS = 3;

export interface ActiveSlot {
  /** 1..3 = fires from that key; null = the cart holds more than three actives and this one never fires. */
  slot: number | null;
  inst: ItemInstance;
  /** Effective tier (Gold Star included). */
  tier: number;
  max: number;
  left: number;
}

/** Board position of an instance's top-left-most footprint cell, as a reading-order key. */
function readingKey(inst: ItemInstance): [number, number] {
  const cs = footprint(inst).map((c) => [c.y, c.x] as [number, number]);
  return cs.reduce((a, b) => (b[0] < a[0] || (b[0] === a[0] && b[1] < a[1]) ? b : a));
}

/** Placed instances of active items in reading order (independent of `placed` array order); the first three carry slot 1..3. */
export function activeSlots(cart: Inventory): ActiveSlot[] {
  const placed = cart.placed, boost = tierBoostOf(placed);
  const found: { inst: ItemInstance; key: [number, number] }[] = [];
  for (const inst of placed) if (contentItem(inst.type)?.active) found.push({ inst, key: readingKey(inst) });
  found.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);
  return found.map(({ inst }, i) => {
    const tier = (inst.tier ?? 1) + boost(inst);
    const max = Math.max(0, Math.round(resolveTune(contentItem(inst.type)!.tune, tier).charges ?? 0));
    return { slot: i < MAX_ACTIVE_SLOTS ? i + 1 : null, inst, tier, max, left: Math.min(max, inst.charges ?? max) };
  });
}

/** Slot of one placed item: 1..3, null when it is an active without a slot, undefined when it is not an active. */
export function slotOfUid(cart: Inventory, uid: string): number | null | undefined {
  return activeSlots(cart).find((s) => s.inst.uid === uid)?.slot;
}

/** Aisle start: every active in the cart is full again. */
export function refillCharges(cart: Inventory): void {
  for (const s of activeSlots(cart)) s.inst.charges = s.max;
}

/** Key press for one slot (1..3): fires that slot's active if it has a charge left. Returns whether it fired. */
export function fireActive(cart: Inventory, ctx: RuntimeCtx, slot: number): boolean {
  const s = activeSlots(cart).find((x) => x.slot === slot);
  if (!s || s.left <= 0) return false;
  s.inst.charges = s.left - 1;
  const c = contentItem(s.inst.type)!;
  const tune = Object.freeze(resolveTune(c.tune, s.tier));
  c.active!.use(ctx, { tier: s.tier, tune: () => tune as never, uid: s.inst.uid });
  return true;
}
