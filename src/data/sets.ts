import { ITEMS } from './items';
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

/** Set-membership weight of a placed item: a double pack counts as 2 distinct types for its family set only. */
const weightIn = (p: ItemInstance, id: SetId): number => (p.double && ITEMS[p.type].family === id ? 2 : 1);

/** Effective type count in one set (double packs count 2 in their family set). */
export function setCount(placed: ItemInstance[], id: SetId): number {
  const best = new Map<ItemTypeId, number>();
  for (const p of placed) if (setsOf(p.type, flavorOf(p)).includes(id)) best.set(p.type, Math.max(best.get(p.type) ?? 0, weightIn(p, id)));
  return [...best.values()].reduce((a, b) => a + b, 0);
}

/** Distinct item types per set among placed items (shelf excluded), level via thresholds. A double pack counts +1 in its family set. */
export function setLevels(placed: ItemInstance[]): Record<SetId, 0 | 1 | 2 | 3> {
  const types = Object.fromEntries(SET_ORDER.map((id) => [id, new Map<ItemTypeId, number>()])) as Record<SetId, Map<ItemTypeId, number>>;
  for (const p of placed) for (const s of setsOf(p.type, flavorOf(p))) types[s].set(p.type, Math.max(types[s].get(p.type) ?? 0, weightIn(p, s)));
  const lv = {} as Record<SetId, 0 | 1 | 2 | 3>;
  for (const s of Object.keys(types) as SetId[]) lv[s] = lvOf([...types[s].values()].reduce((a, b) => a + b, 0));
  return lv;
}

/** What buying `type` (optionally as a double pack) would add to each of its sets (cart only): sets it's new to and that aren't maxed yet. */
export function setGains(placed: ItemInstance[], type: ItemTypeId, double = false): { id: SetId; from: number; to: number; levelUp: boolean }[] {
  const out: { id: SetId; from: number; to: number; levelUp: boolean }[] = [];
  for (const id of setsOf(type)) {
    let have = 0;
    const seen = new Set<ItemTypeId>();
    for (const p of placed) if (setsOf(p.type, flavorOf(p)).includes(id) && !seen.has(p.type)) { seen.add(p.type); have += weightIn(p, id); }
    const add = double && ITEMS[type].family === id ? 2 : 1;
    if (seen.has(type) && !(double && add === 2)) continue;
    if (have >= SET_THRESHOLDS[2]) continue;
    const to = have + (seen.has(type) ? 1 : add);
    out.push({ id, from: have, to, levelUp: lvOf(to) > lvOf(have) });
  }
  return out;
}

/** Sets whose level rose from prev to next. */
export function newSetLevels(prev: Record<SetId, number>, next: Record<SetId, number>): { id: SetId; lv: number }[] {
  return (Object.keys(next) as SetId[]).filter((id) => next[id] > (prev[id] ?? 0)).map((id) => ({ id, lv: next[id] }));
}
