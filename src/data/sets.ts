import { ITEMS } from './items';
import type { ItemInstance, ItemTypeId, SetId } from '../types';

/** Set-bonus tuning. Level 1 = thresholds[0] distinct item types in the cart, level 2 = thresholds[1] (includes level 1). */
export const SETS = {
  thresholds: [2, 3],
  kitchen: { damageMult: 1.1, healChance: 0.05, heal: 3 },
  cleaning: { rangeMult: 1.15, aoeMult: 1.15, knockbackMult: 1.4, puddleExtra: 1 },
  tools: { cooldownDiv: 1.08, shoveDamageMult: 2, shoveStun: 0.3 },
  snacks: { maxHp: 10, regen: 0.3 },
  checkout: { priceMult: 0.92, interestPer: 10, interestCap: 5 },
  heat: { burnExtra: 1, burnMult: 1.4, igniteChance: 0.15, igniteDpsMult: 1.4, igniteExtra: 1 },
  frost: { slowBonus: 0.1, slowCap: 0.6, stunMinSlow: 0.35, stunChance: 0.1, stun: 0.5 },
  // Frost stun and electric arcs skip aura/puddle ticks (0.3–0.5 s, too many rolls). Zap (microwave) never arcs: it already chains.
  electric: { chance: [0.1, 0.2], jumps: [1, 2], range: 120, damageMult: 0.5 },
  blast: { radiusMult: 1.15, killChance: 0.1, damage: 6, radius: 60 },
};

/** Every set an item type counts toward: its family, its element, and 'electric' for electrical items. */
export function setsOf(type: ItemTypeId): SetId[] {
  const d = ITEMS[type];
  return [d.family, ...(d.element ? [d.element] : []), ...(d.electrical ? ['electric' as const] : [])];
}

/** Distinct item types per set among placed items (shelf excluded): >=3 -> 2, >=2 -> 1, else 0. */
export function setLevels(placed: ItemInstance[]): Record<SetId, 0 | 1 | 2> {
  const types: Record<SetId, Set<ItemTypeId>> = { kitchen: new Set(), cleaning: new Set(), tools: new Set(), snacks: new Set(), checkout: new Set(), heat: new Set(), frost: new Set(), blast: new Set(), electric: new Set() };
  for (const p of placed) for (const s of setsOf(p.type)) types[s].add(p.type);
  const lv = {} as Record<SetId, 0 | 1 | 2>;
  for (const s of Object.keys(types) as SetId[]) lv[s] = types[s].size >= SETS.thresholds[1] ? 2 : types[s].size >= SETS.thresholds[0] ? 1 : 0;
  return lv;
}
