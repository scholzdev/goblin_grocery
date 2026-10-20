import type { DepartmentId, ItemTypeId, RecipeId, SetId, StarterId, StarterWeapon } from '../types';
import type { DamageType } from '../engine/damageType';
import type { ReactionId } from '../engine/define';

// Meta-progression: everything here persists across runs (see src/state/profile.ts).

/** Items available from the very first run. Everything else unlocks via UNLOCKS below. */
export const STARTING_ITEMS: ItemTypeId[] = [
  'toaster', 'pan', 'nailgun', 'vacuum', 'fan', 'fuel', 'battery', 'magnet', 'ice', 'hotsauce', 'lunchbox', 'bell', 'fortune', 'sample', 'piggy',
  'popcorn', 'sparklers', 'expiredcoupon',
  'spentkey', // never offered (noShop), listed so every item is reachable for the catalog
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

/** One finished run, as goal unlocks measure it (`runSummary` in state/profile). The cart fields describe the cart at run end. */
export interface RunSummary {
  won: boolean;
  wave: number;
  starter: StarterId;
  weapon: StarterWeapon;
  theme: DepartmentId;
  shift: number;
  daily: boolean;
  kills: number;
  coins: number;
  sets: Record<SetId, 0 | 1 | 2 | 3>;
  /** Distinct combos active. */
  combos: RecipeId[];
  /** Weapons in the cart. */
  weapons: number;
  /** Highest tier among the cart's items. */
  maxTier: number;
  reactions: Record<ReactionId, number>;
  damageByType: Record<DamageType, number>;
  damageByWeapon: Record<string, number>;
}

type Reward =
  | { kind: 'item'; item: ItemTypeId }
  | { kind: 'goblin'; skin: GoblinSkin }
  | { kind: 'starter'; starter: StarterId }
  | { kind: 'cart'; skin: CartSkin };

/** A milestone reads the lifetime stats. A goal asks for something within one run: the best `measure` of any run (`Profile.goalBest`) has to reach `target`. */
type Condition =
  | { type?: 'milestone'; check: (s: ProfileStats) => boolean; progress: (s: ProfileStats) => [number, number] }
  | { type: 'goal'; measure: (r: RunSummary) => number; target: number };

/** `need` is the condition as EN text. */
export type Unlock = { id: string; need: string } & Reward & Condition;

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
  { id: 'pricegun', kind: 'item', item: 'pricegun', need: 'Win a run with the Checkout set at level 2', type: 'goal', target: 2, measure: (r) => (r.won ? r.sets.checkout : 0) },
  { id: 'coupon', kind: 'item', item: 'coupon', need: 'Clear 3 Checkout Lanes aisles', check: (s) => dept(s, 'checkout') >= 3, progress: (s) => at(3)(dept(s, 'checkout')) },
  { id: 'bubblewrap', kind: 'item', item: 'bubblewrap', need: 'Get wiped out once', check: (s) => s.losses >= 1, progress: (s) => at(1)(s.losses) },
  { id: 'expiredmilk', kind: 'item', item: 'expiredmilk', need: 'Get wiped out 3 times', check: (s) => s.losses >= 3, progress: (s) => at(3)(s.losses) },
  { id: 'tinfoilhat', kind: 'item', item: 'tinfoilhat', need: 'Reach aisle 5', check: (s) => s.bestWave >= 5, progress: (s) => at(5)(s.bestWave) },
  { id: 'jellybeans', kind: 'item', item: 'jellybeans', need: 'Discover 3 combos', check: (s) => s.combos >= 3, progress: (s) => at(3)(s.combos) },
  { id: 'leafblower', kind: 'item', item: 'leafblower', need: 'Finish a run on aisle 6 or later with only one weapon', type: 'goal', target: 6, measure: (r) => (r.weapons === 1 ? r.wave : 0) },
  { id: 'sourdough', kind: 'item', item: 'sourdough', need: 'Finish a run', check: (s) => s.runs >= 1, progress: (s) => at(1)(s.runs) },
  { id: 'energy', kind: 'item', item: 'energy', need: 'Return 250 groceries in one run', type: 'goal', target: 250, measure: (r) => r.kills },
  { id: 'cooker', kind: 'item', item: 'cooker', need: 'Clear 3 Electronics aisles', check: (s) => dept(s, 'electronics') >= 3, progress: (s) => at(3)(dept(s, 'electronics')) },
  { id: 'popper', kind: 'item', item: 'popper', need: 'Reach aisle 6', check: (s) => s.bestWave >= 6, progress: (s) => at(6)(s.bestWave) },
  { id: 'doublebag', kind: 'item', item: 'doublebag', need: 'Finish a run with 3 combos active', type: 'goal', target: 3, measure: (r) => r.combos.length },
  { id: 'multipack', kind: 'item', item: 'multipack', need: 'Reach the Store Manager', check: (s) => s.bestWave >= 8, progress: (s) => at(8)(s.bestWave) },
  { id: 'powerstrip', kind: 'item', item: 'powerstrip', need: 'Defeat the Store Manager', check: (s) => s.wins >= 1, progress: (s) => at(1)(s.wins) },
  { id: 'snackbag', kind: 'item', item: 'snackbag', need: 'Defeat the Store Manager', check: (s) => s.wins >= 1, progress: (s) => at(1)(s.wins) },
  { id: 'goldstar', kind: 'item', item: 'goldstar', need: 'Finish a run with a ★3 item in the cart', type: 'goal', target: 3, measure: (r) => r.maxTier },
  { id: 'boot', kind: 'item', item: 'boot', need: 'Finish 3 runs', check: (s) => s.runs >= 3, progress: (s) => at(3)(s.runs) },
  { id: 'sparewheel', kind: 'item', item: 'sparewheel', need: 'Finish 4 runs', check: (s) => s.runs >= 4, progress: (s) => at(4)(s.runs) },
  { id: 'tipjar', kind: 'item', item: 'tipjar', need: 'Earn 250 coins (lifetime)', check: (s) => s.coins >= 250, progress: (s) => at(250)(s.coins) },
  { id: 'bumper', kind: 'item', item: 'bumper', need: 'Reach aisle 5', check: (s) => s.bestWave >= 5, progress: (s) => at(5)(s.bestWave) },
  { id: 'flag', kind: 'item', item: 'flag', need: 'Clear 2 Frozen Foods aisles', check: (s) => dept(s, 'frozen') >= 2, progress: (s) => at(2)(dept(s, 'frozen')) },
  { id: 'canopener', kind: 'item', item: 'canopener', need: 'Reach aisle 3', check: (s) => s.bestWave >= 3, progress: (s) => at(3)(s.bestWave) },
  { id: 'avocado', kind: 'item', item: 'avocado', need: 'Reach aisle 3', check: (s) => s.bestWave >= 3, progress: (s) => at(3)(s.bestWave) },
  { id: 'fish', kind: 'item', item: 'fish', need: 'Clear 2 Frozen Foods aisles', check: (s) => dept(s, 'frozen') >= 2, progress: (s) => at(2)(dept(s, 'frozen')) },
  { id: 'basil', kind: 'item', item: 'basil', need: 'Finish 2 runs', check: (s) => s.runs >= 2, progress: (s) => at(2)(s.runs) },
  { id: 'scoby', kind: 'item', item: 'scoby', need: 'Deal 1000 poison damage in one run', type: 'goal', target: 1000, measure: (r) => Math.floor(r.damageByType.poison) },
  { id: 'decaf', kind: 'item', item: 'decaf', need: 'Reach aisle 4', check: (s) => s.bestWave >= 4, progress: (s) => at(4)(s.bestWave) },
  { id: 'barter', kind: 'item', item: 'barter', need: 'Earn 300 coins in one run', type: 'goal', target: 300, measure: (r) => r.coins },
  { id: 'binder', kind: 'item', item: 'binder', need: 'Finish a run with a set at level 3', type: 'goal', target: 3, measure: (r) => Math.max(...Object.values(r.sets)) },
  { id: 'fireextinguisher', kind: 'item', item: 'fireextinguisher', need: 'Reach aisle 3', check: (s) => s.bestWave >= 3, progress: (s) => at(3)(s.bestWave) },
  { id: 'airhorn', kind: 'item', item: 'airhorn', need: 'Earn 150 coins (lifetime)', check: (s) => s.coins >= 150, progress: (s) => at(150)(s.coins) },
  { id: 'balloon', kind: 'item', item: 'balloon', need: 'Finish 2 runs', check: (s) => s.runs >= 2, progress: (s) => at(2)(s.runs) },
  { id: 'bowlingball', kind: 'item', item: 'bowlingball', need: 'Trigger 50 Shatters in one run', type: 'goal', target: 50, measure: (r) => r.reactions.shatter },
  { id: 'ghostpepper', kind: 'item', item: 'ghostpepper', need: 'Reach aisle 4', check: (s) => s.bestWave >= 4, progress: (s) => at(4)(s.bestWave) },
  { id: 'scratchticket', kind: 'item', item: 'scratchticket', need: 'Earn 150 coins (lifetime)', check: (s) => s.coins >= 150, progress: (s) => at(150)(s.coins) },
  { id: 'laser', kind: 'item', item: 'laser', need: 'Win a run with 3 weapons in the cart', type: 'goal', target: 3, measure: (r) => (r.won ? r.weapons : 0) },
  { id: 'snowcone', kind: 'item', item: 'snowcone', need: 'Win a run with the Frost set at level 2', type: 'goal', target: 2, measure: (r) => (r.won ? r.sets.frost : 0) },
  { id: 'moldybread', kind: 'item', item: 'moldybread', need: 'Trigger 10 Detonates in one run', type: 'goal', target: 10, measure: (r) => r.reactions.detonate },
  { id: 'punchcard', kind: 'item', item: 'punchcard', need: 'Earn 150 coins (lifetime)', check: (s) => s.coins >= 150, progress: (s) => at(150)(s.coins) },
  { id: 'shortcut', kind: 'item', item: 'shortcut', need: 'Get wiped out twice', check: (s) => s.losses >= 2, progress: (s) => at(2)(s.losses) },
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
