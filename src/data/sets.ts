import { ITEMS } from './items';
import { tierBoostOf } from '../engine/build';
import { SET_ORDER, SET_THRESHOLDS, flavorOf } from '../engine/define';
import type { ElementTag, ItemInstance, ItemTypeId, SetId } from '../types';

/**
 * Set tuning, text and behavior live in `src/content/sets/<id>.ts` (docs/item-hooks-refactor.md). What stays here is the counting:
 * which item types belong to a set and the cart-wide levels (`SET_THRESHOLDS`, shared by every set, is in engine/define).
 */

/** Every set an item type counts toward: its family, its element, and 'electric' for electrical items. */
export function setsOf(type: ItemTypeId, flavor?: ElementTag): SetId[] {
  const d = ITEMS[type];
  const el = d.element ?? (d.flavored ? flavor : undefined); // Jelly Beans (content `flavored`): the current flavor is the element
  return [d.family, ...(el ? [el] : []), ...(d.electrical ? ['electric' as const] : [])];
}

export const lvOf = (n: number): 0 | 1 | 2 | 3 => (n >= SET_THRESHOLDS[2] ? 3 : n >= SET_THRESHOLDS[1] ? 2 : n >= SET_THRESHOLDS[0] ? 1 : 0);

/** What `setGains` previews: a shop offer (or any not-yet-placed copy). */
export type SetCandidate = Pick<ItemInstance, 'type' | 'tier' | 'double'>;

/** Set points one copy adds to each of its sets: its tier plus `lift` (Gold Star, placed copies only), +1 for a double pack. */
export const setWeight = (p: SetCandidate, lift = 0): number => (p.tier ?? 1) + lift + (p.double ? 1 : 0);

/** Per set, the set points of each item type among placed items (shelf excluded): the largest weight among its copies. */
function pointsByType(placed: ItemInstance[]): Record<SetId, Map<ItemTypeId, number>> {
  const lift = tierBoostOf(placed);
  const by = Object.fromEntries(SET_ORDER.map((id) => [id, new Map<ItemTypeId, number>()])) as Record<SetId, Map<ItemTypeId, number>>;
  for (const p of placed) {
    const w = setWeight(p, lift(p));
    for (const s of setsOf(p.type, flavorOf(p))) by[s].set(p.type, Math.max(by[s].get(p.type) ?? 0, w));
  }
  return by;
}

const sum = (m: Map<ItemTypeId, number>): number => [...m.values()].reduce((a, b) => a + b, 0);

/** Set points in one set. */
export const setCount = (placed: ItemInstance[], id: SetId): number => sum(pointsByType(placed)[id]);

/** Level of every set, from its set points via the thresholds. */
export function setLevels(placed: ItemInstance[]): Record<SetId, 0 | 1 | 2 | 3> {
  const by = pointsByType(placed);
  return Object.fromEntries(SET_ORDER.map((id) => [id, lvOf(sum(by[id]))])) as Record<SetId, 0 | 1 | 2 | 3>;
}

/**
 * What adding `cand` would do to each of its sets that it raises and that isn't maxed yet: the set points before and after.
 * Its position is unknown, so it gets no Gold Star lift and lifts nothing itself.
 */
export function setGains(placed: ItemInstance[], cand: SetCandidate): { id: SetId; from: number; to: number; levelUp: boolean }[] {
  const by = pointsByType(placed);
  const w = setWeight(cand);
  return setsOf(cand.type).flatMap((id) => {
    const from = sum(by[id]), add = Math.max(0, w - (by[id].get(cand.type) ?? 0));
    if (!add || from >= SET_THRESHOLDS[2]) return [];
    const to = from + add;
    return [{ id, from, to, levelUp: lvOf(to) > lvOf(from) }];
  });
}

/** Sets whose level rose from prev to next. */
export function newSetLevels(prev: Record<SetId, number>, next: Record<SetId, number>): { id: SetId; lv: number }[] {
  return (Object.keys(next) as SetId[]).filter((id) => next[id] > (prev[id] ?? 0)).map((id) => ({ id, lv: next[id] }));
}
