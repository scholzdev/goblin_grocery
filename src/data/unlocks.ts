import type { DepartmentId, ItemTypeId, StarterId } from '../types';

// Meta-progression: everything here persists across runs (see src/state/profile.ts).

/** Items available from the very first run. Everything else unlocks via UNLOCKS below. */
export const STARTING_ITEMS: ItemTypeId[] = [
  'toaster', 'pan', 'nailgun', 'vacuum', 'fan', 'fuel', 'battery', 'magnet', 'ice', 'hotsauce', 'lunchbox', 'bell', 'fortune', 'sample', 'piggy',
  'popcorn', 'sparklers', 'expiredcoupon',
];

export type GoblinSkin = 'classic' | 'night' | 'frost' | 'gold';
export type CartSkin = 'chrome' | 'coral' | 'gold';

export const GOBLIN_SKINS: Record<GoblinSkin, { name: string; blurb: string }> = {
  classic: { name: 'Classic Goblin', blurb: 'Fresh green, fresh out of the dumpster.' },
  night: { name: 'Night Shift', blurb: 'Purple-skinned closer. Has seen things in aisle 9.' },
  frost: { name: 'Freezer Burn', blurb: 'Spent one too many shifts in Frozen Foods.' },
  gold: { name: 'Employee of the Month', blurb: 'Gleaming. Insufferable about it.' },
};

export const CART_SKINS: Record<CartSkin, { name: string; blurb: string }> = {
  chrome: { name: 'Store Cart', blurb: 'Squeaky front wheel included.' },
  coral: { name: 'Sale Cart', blurb: 'Painted in clearance-sticker coral.' },
  gold: { name: 'Golden Cart', blurb: 'For goblins who have beaten the Manager.' },
};

/** Lifetime stats tracked by the profile; unlock requirements read these. */
export interface ProfileStats {
  runs: number;
  wins: number;
  losses: number;
  kills: number;
  coins: number;
  bestWave: number;
  combos: number;          // distinct combos discovered
  bestShift: Partial<Record<string, number>>; // starter id -> highest shift index won
  bestOvertime: number;    // most aisles survived past the boss
  deptClears: Partial<Record<DepartmentId | 'clearance', number>>; // 'clearance' = cleared Clearance Sale aisles (the door modifier, not a department)
}

export type Unlock =
  | { id: string; kind: 'item'; item: ItemTypeId; need: string; check: (s: ProfileStats) => boolean; progress: (s: ProfileStats) => [number, number] }
  | { id: string; kind: 'goblin'; skin: GoblinSkin; need: string; check: (s: ProfileStats) => boolean; progress: (s: ProfileStats) => [number, number] }
  | { id: string; kind: 'starter'; starter: StarterId; need: string; check: (s: ProfileStats) => boolean; progress: (s: ProfileStats) => [number, number] }
  | { id: string; kind: 'cart'; skin: CartSkin; need: string; check: (s: ProfileStats) => boolean; progress: (s: ProfileStats) => [number, number] };

const at = (n: number) => (v: number) => [Math.min(v, n), n] as [number, number];
const dept = (s: ProfileStats, d: DepartmentId | 'clearance') => s.deptClears[d] ?? 0;

/** Ordered roughly by how soon a typical player earns them. */
export const UNLOCKS: Unlock[] = [
  { id: 'microwave', kind: 'item', item: 'microwave', need: 'Reach aisle 4', check: (s) => s.bestWave >= 4, progress: (s) => at(4)(s.bestWave) },
  { id: 'spray', kind: 'item', item: 'spray', need: 'Return 150 groceries (lifetime)', check: (s) => s.kills >= 150, progress: (s) => at(150)(s.kills) },
  { id: 'fizz', kind: 'item', item: 'fizz', need: 'Discover 2 combos', check: (s) => s.combos >= 2, progress: (s) => at(2)(s.combos) },
  { id: 'mop', kind: 'item', item: 'mop', need: 'Clear 3 Bakery aisles', check: (s) => dept(s, 'bakery') >= 3, progress: (s) => at(3)(dept(s, 'bakery')) },
  { id: 'blender', kind: 'item', item: 'blender', need: 'Clear 3 Frozen Foods aisles', check: (s) => dept(s, 'frozen') >= 3, progress: (s) => at(3)(dept(s, 'frozen')) },
  { id: 'tape', kind: 'item', item: 'tape', need: 'Finish 2 runs', check: (s) => s.runs >= 2, progress: (s) => at(2)(s.runs) },
  { id: 'pricegun', kind: 'item', item: 'pricegun', need: 'Earn 400 coins (lifetime)', check: (s) => s.coins >= 400, progress: (s) => at(400)(s.coins) },
  { id: 'coupon', kind: 'item', item: 'coupon', need: 'Clear 3 Checkout Lanes aisles', check: (s) => dept(s, 'checkout') >= 3, progress: (s) => at(3)(dept(s, 'checkout')) },
  { id: 'bubblewrap', kind: 'item', item: 'bubblewrap', need: 'Get wiped out once', check: (s) => s.losses >= 1, progress: (s) => at(1)(s.losses) },
  { id: 'expiredmilk', kind: 'item', item: 'expiredmilk', need: 'Get wiped out 3 times', check: (s) => s.losses >= 3, progress: (s) => at(3)(s.losses) },
  { id: 'tinfoilhat', kind: 'item', item: 'tinfoilhat', need: 'Reach aisle 5', check: (s) => s.bestWave >= 5, progress: (s) => at(5)(s.bestWave) },
  { id: 'jellybeans', kind: 'item', item: 'jellybeans', need: 'Discover 3 combos', check: (s) => s.combos >= 3, progress: (s) => at(3)(s.combos) },
  { id: 'leafblower', kind: 'item', item: 'leafblower', need: 'Return 300 groceries (lifetime)', check: (s) => s.kills >= 300, progress: (s) => at(300)(s.kills) },
  { id: 'sourdough', kind: 'item', item: 'sourdough', need: 'Finish a run', check: (s) => s.runs >= 1, progress: (s) => at(1)(s.runs) },
  { id: 'energy', kind: 'item', item: 'energy', need: 'Return 500 groceries (lifetime)', check: (s) => s.kills >= 500, progress: (s) => at(500)(s.kills) },
  { id: 'cooker', kind: 'item', item: 'cooker', need: 'Clear 3 Electronics aisles', check: (s) => dept(s, 'electronics') >= 3, progress: (s) => at(3)(dept(s, 'electronics')) },
  { id: 'popper', kind: 'item', item: 'popper', need: 'Reach aisle 6', check: (s) => s.bestWave >= 6, progress: (s) => at(6)(s.bestWave) },
  { id: 'doublebag', kind: 'item', item: 'doublebag', need: 'Discover 4 combos', check: (s) => s.combos >= 4, progress: (s) => at(4)(s.combos) },
  { id: 'multipack', kind: 'item', item: 'multipack', need: 'Reach the Store Manager', check: (s) => s.bestWave >= 8, progress: (s) => at(8)(s.bestWave) },
  { id: 'powerstrip', kind: 'item', item: 'powerstrip', need: 'Defeat the Store Manager', check: (s) => s.wins >= 1, progress: (s) => at(1)(s.wins) },
  { id: 'snackbag', kind: 'item', item: 'snackbag', need: 'Defeat the Store Manager', check: (s) => s.wins >= 1, progress: (s) => at(1)(s.wins) },
  { id: 'goldstar', kind: 'item', item: 'goldstar', need: 'Discover 7 combos', check: (s) => s.combos >= 7, progress: (s) => at(7)(s.combos) },
  { id: 'boot', kind: 'item', item: 'boot', need: 'Finish 3 runs', check: (s) => s.runs >= 3, progress: (s) => at(3)(s.runs) },
  { id: 'sparewheel', kind: 'item', item: 'sparewheel', need: 'Finish 4 runs', check: (s) => s.runs >= 4, progress: (s) => at(4)(s.runs) },
  { id: 'tipjar', kind: 'item', item: 'tipjar', need: 'Earn 250 coins (lifetime)', check: (s) => s.coins >= 250, progress: (s) => at(250)(s.coins) },
  { id: 'bumper', kind: 'item', item: 'bumper', need: 'Reach aisle 5', check: (s) => s.bestWave >= 5, progress: (s) => at(5)(s.bestWave) },
  { id: 'flag', kind: 'item', item: 'flag', need: 'Clear 2 Frozen Foods aisles', check: (s) => dept(s, 'frozen') >= 2, progress: (s) => at(2)(dept(s, 'frozen')) },
  { id: 'canopener', kind: 'item', item: 'canopener', need: 'Reach aisle 3', check: (s) => s.bestWave >= 3, progress: (s) => at(3)(s.bestWave) },
  { id: 'decaf', kind: 'item', item: 'decaf', need: 'Reach aisle 4', check: (s) => s.bestWave >= 4, progress: (s) => at(4)(s.bestWave) },
  { id: 'laser', kind: 'item', item: 'laser', need: 'Win 3 runs', check: (s) => s.wins >= 3, progress: (s) => at(3)(s.wins) },
  { id: 'snowcone', kind: 'item', item: 'snowcone', need: 'Clear 5 Frozen Foods aisles', check: (s) => dept(s, 'frozen') >= 5, progress: (s) => at(5)(dept(s, 'frozen')) },
  { id: 'moldybread', kind: 'item', item: 'moldybread', need: 'Discover 5 combos', check: (s) => s.combos >= 5, progress: (s) => at(5)(s.combos) },
  { id: 'starter-coupon', kind: 'starter', starter: 'coupon', need: 'Earn 400 coins (lifetime)', check: (s) => s.coins >= 400, progress: (s) => at(400)(s.coins) },
  { id: 'starter-night', kind: 'starter', starter: 'night', need: 'Reach aisle 6', check: (s) => s.bestWave >= 6, progress: (s) => at(6)(s.bestWave) },
  { id: 'skin-night', kind: 'goblin', skin: 'night', need: 'Finish 5 runs', check: (s) => s.runs >= 5, progress: (s) => at(5)(s.runs) },
  { id: 'skin-frost', kind: 'goblin', skin: 'frost', need: 'Clear 12 Frozen Foods aisles', check: (s) => dept(s, 'frozen') >= 12, progress: (s) => at(12)(dept(s, 'frozen')) },
  { id: 'skin-gold', kind: 'goblin', skin: 'gold', need: 'Discover 15 combos', check: (s) => s.combos >= 15, progress: (s) => at(15)(s.combos) },
  { id: 'cart-coral', kind: 'cart', skin: 'coral', need: 'Clear a Clearance aisle', check: (s) => dept(s, 'clearance') >= 1, progress: (s) => at(1)(dept(s, 'clearance')) },
  { id: 'cart-gold', kind: 'cart', skin: 'gold', need: 'Defeat the Store Manager', check: (s) => s.wins >= 1, progress: (s) => at(1)(s.wins) },
];

/** Asset keys of the goblin/cart layers that get skin variants (`<key>__<skin>`). */
export const GOBLIN_PARTS = ['goblin_legs_a', 'goblin_legs_b', 'goblin_torso', 'goblin_head', 'goblin_head_hurt', 'goblin_head_shove', 'goblin_arm'];
export const CART_PARTS = ['cart_back', 'cart_front', 'cart_wheel'];
