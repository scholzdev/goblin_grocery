import type { Inventory, ItemInstance, OpResult, RunState } from '../types';
import { newUid, recomputeBuild } from './run';

// Test Lab loadout slots: a copy of the cart and shelf (with their sizes) that can be put back later, also in another lab session.

export const LAB_SLOT_COUNT = 3;

/** A saved cart + shelf. Plain data, so it round-trips through JSON (localStorage). */
export type LabSlot = Inventory;

export const captureSlot = (s: RunState): LabSlot => structuredClone(s.inventory);

export const slotItems = (slot: LabSlot | null): number => (slot ? slot.placed.length + slot.shelf.filter(Boolean).length : 0);

/** Puts the slot's cart and shelf in place of the current ones (fresh uids, so a slot saved in an older session cannot clash). Shop only. */
export function restoreSlot(s: RunState, slot: LabSlot): OpResult {
  if (s.phase !== 'shop') return { ok: false, reason: '' };
  const fresh = (i: ItemInstance): ItemInstance => ({ ...i, uid: newUid(s) });
  s.inventory = { cols: slot.cols, rows: slot.rows, placed: slot.placed.map(fresh), shelf: slot.shelf.map((i) => (i ? fresh(i) : null)) };
  recomputeBuild(s);
  return { ok: true };
}

/** Parses what localStorage returned: always `LAB_SLOT_COUNT` entries, a damaged entry is an empty slot. */
export function parseSlots(raw: string | null): (LabSlot | null)[] {
  let list: unknown;
  try { list = JSON.parse(raw ?? '[]'); } catch { list = []; }
  return Array.from({ length: LAB_SLOT_COUNT }, (_, i) => {
    const e = Array.isArray(list) ? (list[i] as Partial<LabSlot> | null) : null;
    const ok = e && Number.isInteger(e.cols) && Number.isInteger(e.rows) && Array.isArray(e.placed) && Array.isArray(e.shelf);
    return ok ? (e as LabSlot) : null;
  });
}
