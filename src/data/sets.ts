import { ITEMS } from './items';
import type { ElementTag, ItemInstance, ItemTypeId, SetId } from '../types';

/** Set-bonus tuning. Level 1/2/3 = thresholds[0/1/2] distinct item types in the cart (each level includes the lower ones). Level 3 values live in SET_L3 (use setCfg). */
export const SETS = {
  thresholds: [2, 3, 4],
  kitchen: { damageMult: 1.1, healChance: 0.05, heal: 3 },
  cleaning: { rangeMult: 1.15, aoeMult: 1.15, knockbackMult: 1.4, puddleExtra: 1 },
  tools: { cooldownDiv: 1.08, shoveDamageMult: 2, shoveStun: 0.3 },
  snacks: { maxHp: 10, regen: 0.3 },
  checkout: { priceMult: 0.92, interestPer: 10, interestCap: 5 },
  heat: { burnExtra: 1, burnMult: 1.4, igniteChance: 0.15, igniteDpsMult: 1.4, igniteExtra: 1 },
  frost: { slowBonus: 0.1, slowCap: 0.6, stunMinSlow: 0.35, stunChance: 0.1, stun: 0.5 },
  // Frost stun and electric arcs skip aura/puddle ticks (0.3–0.5 s, too many rolls). Zap (microwave) never arcs: it already chains.
  electric: { chance: [0.1, 0.2, 0.3], jumps: [1, 2, 3], range: 120, damageMult: 0.5 },
  blast: { radiusMult: 1.15, killChance: 0.1, damage: 6, radius: 60 },
};

/** Level-3 replacement values (same shape as the SETS entry; electric uses the arrays above). Strengthens L1+L2 effects. */
export const SET_L3 = {
  kitchen: { damageMult: 1.2, healChance: 0.1, heal: 4 },
  cleaning: { rangeMult: 1.25, aoeMult: 1.25, knockbackMult: 1.8, puddleExtra: 2 },
  tools: { cooldownDiv: 1.15, shoveDamageMult: 3, shoveStun: 0.45 },
  snacks: { maxHp: 20, regen: 0.6 },
  checkout: { priceMult: 0.85, interestPer: 10, interestCap: 8 },
  heat: { burnExtra: 2, burnMult: 1.8, igniteChance: 0.25, igniteDpsMult: 1.4, igniteExtra: 2 },
  frost: { slowBonus: 0.15, slowCap: 0.7, stunMinSlow: 0.35, stunChance: 0.2, stun: 0.7 },
  blast: { radiusMult: 1.25, killChance: 0.2, damage: 10, radius: 75 },
};

/** Tuning for a set at the given level: level 3 swaps in SET_L3 (when present), otherwise the base SETS entry. */
export function setCfg<K extends keyof typeof SET_L3>(id: K, lv: number): (typeof SETS)[K] {
  return (lv >= 3 ? SET_L3[id] : SETS[id]) as (typeof SETS)[K];
}

/** Every set an item type counts toward: its family, its element, and 'electric' for electrical items. */
export function setsOf(type: ItemTypeId, flavor?: ElementTag): SetId[] {
  const d = ITEMS[type];
  const el = d.element ?? (type === 'jellybeans' ? flavor : undefined); // Jelly Beans: the current flavor is the element
  return [d.family, ...(el ? [el] : []), ...(d.electrical ? ['electric' as const] : [])];
}

export const lvOf = (n: number): 0 | 1 | 2 | 3 => (n >= SETS.thresholds[2] ? 3 : n >= SETS.thresholds[1] ? 2 : n >= SETS.thresholds[0] ? 1 : 0);

/** Jelly Beans flavor of an instance (missing = heat). */
export const flavorOf = (p: ItemInstance): ElementTag => p.flavor ?? 'heat';

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
  const types: Record<SetId, Map<ItemTypeId, number>> = { kitchen: new Map(), cleaning: new Map(), tools: new Map(), snacks: new Map(), checkout: new Map(), heat: new Map(), frost: new Map(), blast: new Map(), electric: new Map() };
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
    if (have >= SETS.thresholds[2]) continue;
    const to = have + (seen.has(type) ? 1 : add);
    out.push({ id, from: have, to, levelUp: lvOf(to) > lvOf(have) });
  }
  return out;
}

/** Sets whose level rose from prev to next. */
export function newSetLevels(prev: Record<SetId, number>, next: Record<SetId, number>): { id: SetId; lv: number }[] {
  return (Object.keys(next) as SetId[]).filter((id) => next[id] > (prev[id] ?? 0)).map((id) => ({ id, lv: next[id] }));
}
