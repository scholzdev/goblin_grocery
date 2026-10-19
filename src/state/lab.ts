import { PLAYER, STARTER_WEAPONS } from '../data/items';
import { THEMES } from '../data/departments';
import { MODIFIERS, type ModifierId } from '../data/modifiers';
import { SET_EVENT_KINDS } from '../data/events';
import { ECONOMY, SHIFTS, SHOP_LEVELS } from '../data/waves';
import type { Inventory, ItemInstance, LabOpts, OpResult, RunState, StarterId, StarterWeapon } from '../types';
import { newUid, recomputeBuild } from './run';

export const LAB_EVENTS = ['random', 'none', 'wetFloor', 'outage', ...SET_EVENT_KINDS] as const;

export const LAB_DEFAULTS: LabOpts = { aisle: 1, dept: 'main', shift: 0, starter: 'toaster', weapon: 'toaster', money: 999, cart: [4, 4], shelf: ECONOMY.shelfSlots, shopLevel: 1, god: false, event: 'random', mod: 'none', sandbox: true };

const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list as readonly unknown[]).includes(v) ? (v as T) : fallback;
const int = (v: unknown, lo: number, hi: number, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback);

/**
 * The stored setup (localStorage) -> a valid `LabOpts`: every field is checked and an unknown id, an out-of-range number or a size the cart
 * does not come in falls back to its default, so a stale or hand-edited save never breaks a start. Only the storage boundary calls it.
 */
export function normalizeSetup(raw: unknown): LabOpts {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const D = LAB_DEFAULTS;
  const cartIn = Array.isArray(r.cart) ? r.cart : [];
  const cart = ([[4, 4], ...ECONOMY.cartSizes] as [number, number][]).find(([c, rw]) => c === cartIn[0] && rw === cartIn[1]) ?? D.cart;
  const shelves = [ECONOMY.shelfSlots, ...ECONOMY.shelfSizes];
  return {
    aisle: int(r.aisle, 1, 15, D.aisle),
    dept: pick(r.dept, THEMES, D.dept),
    shift: int(r.shift, 0, SHIFTS.length - 1, D.shift),
    starter: pick(r.starter, Object.keys(PLAYER.starters) as StarterId[], D.starter),
    weapon: pick(r.weapon, Object.keys(STARTER_WEAPONS) as StarterWeapon[], D.weapon),
    money: int(r.money, 0, 99999, D.money),
    cart,
    shelf: shelves.includes(r.shelf as number) ? (r.shelf as number) : D.shelf,
    shopLevel: int(r.shopLevel, 1, SHOP_LEVELS.length, D.shopLevel),
    god: typeof r.god === 'boolean' ? r.god : D.god,
    event: pick(r.event, LAB_EVENTS, D.event!),
    mod: pick(r.mod, Object.keys(MODIFIERS) as ModifierId[], D.mod!),
    sandbox: typeof r.sandbox === 'boolean' ? r.sandbox : D.sandbox,
  };
}

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
