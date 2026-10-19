import type { Inventory, ItemInstance } from '../types';
import { footprint } from '../systems/inventory';
import { tierBoostOf } from './build';
import { resolveTune } from './define';
import { contentItem } from './registry';
import type { RuntimeCtx } from './ctx';

// Active items ("spells"): the cart's actives take up to three slots in reading order (top-left-most footprint cell, then row by row) unless the player picked one by clicking the shop badge (`ItemInstance.slot`), and
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
  // Slots the player picked by hand win (the first in reading order if two claim the same one); the rest fill the free slots in reading order.
  const slotOf = new Map<ItemInstance, number | null>();
  const taken = new Set<number>();
  for (const { inst } of found) {
    if (inst.slot && inst.slot >= 1 && inst.slot <= MAX_ACTIVE_SLOTS && !taken.has(inst.slot)) { taken.add(inst.slot); slotOf.set(inst, inst.slot); }
  }
  let next = 1;
  for (const { inst } of found) {
    if (slotOf.has(inst)) continue;
    while (taken.has(next)) next++;
    if (next > MAX_ACTIVE_SLOTS) { slotOf.set(inst, null); continue; }
    taken.add(next);
    slotOf.set(inst, next);
  }
  return found.map(({ inst }) => {
    const tier = (inst.tier ?? 1) + boost(inst);
    const max = Math.max(0, Math.round(resolveTune(contentItem(inst.type)!.tune, tier).charges ?? 0));
    return { slot: slotOf.get(inst)!, inst, tier, max, left: Math.min(max, inst.charges ?? max) };
  });
}

/** Click on a slot badge: picks slot 1, 2, 3 in turn and then goes back to automatic (from automatic it starts at 1). A slot another active held by hand goes back to automatic. */
export function cycleSlot(cart: Inventory, uid: string): void {
  const inst = cart.placed.find((p) => p.uid === uid);
  if (!inst || !contentItem(inst.type)?.active) return;
  const n = (inst.slot ?? 0) + 1;
  if (n > MAX_ACTIVE_SLOTS) { delete inst.slot; return; }
  for (const o of cart.placed) if (o !== inst && o.slot === n) delete o.slot;
  inst.slot = n;
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
