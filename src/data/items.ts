import type { Cell, ItemDef, ItemTypeId, Perk, StarterId, StarterWeapon } from '../types';
import { PROJECTILE_PATTERNS, resolveShape, tierMult, weaponCooldownMult, weaponDamageMult } from '../engine/define';
import { itemDefOf } from '../engine/legacy';
import { contentItem } from '../engine/registry';

/** Items still defined here. An item moves to src/content/items/<id>.ts by deleting its entry (and its other legacy branches). Phase 7 moved the last ones (the 12 weapons), so this is empty until phase 8 deletes it with the dual path below. */
const LEGACY_ITEMS: Partial<Record<ItemTypeId, ItemDef>> = {};

/** Order of `ITEMS` / `ITEM_IDS` (shop rolls and UI lists depend on it): fixed here so moving an item to content never reorders anything. */
const ITEM_ORDER: ItemTypeId[] = [
  'toaster', 'pan', 'nailgun', 'vacuum', 'fan', 'fuel', 'battery', 'magnet', 'ice', 'hotsauce', 'lunchbox', 'bell', 'boot', 'bumper', 'sparewheel', 'tipjar', 'flag',
  'microwave', 'blender', 'fizz', 'mop', 'pricegun', 'tape', 'coupon', 'bubblewrap', 'energy', 'fortune', 'sample', 'piggy', 'expiredmilk', 'tinfoilhat', 'jellybeans',
  'leafblower', 'sourdough', 'powerstrip', 'goldstar', 'laser', 'snackbag', 'cooker', 'spray', 'popper', 'doublebag', 'multipack',
];

/** Every item: the content file when there is one (converted to the legacy `ItemDef`), otherwise the legacy entry above. */
export const ITEMS: Record<ItemTypeId, ItemDef> = Object.fromEntries(ITEM_ORDER.map((id) => {
  const c = contentItem(id), def = c ? itemDefOf(c) : LEGACY_ITEMS[id];
  if (!def) throw new Error(`item "${id}" has neither a content file nor a legacy entry`);
  if (c && LEGACY_ITEMS[id]) throw new Error(`item "${id}" is defined twice: delete its legacy entry in data/items.ts`);
  return [id, def];
})) as Record<ItemTypeId, ItemDef>;
for (const id of Object.keys(LEGACY_ITEMS)) if (!ITEM_ORDER.includes(id as ItemTypeId)) throw new Error(`item "${id}" is missing from ITEM_ORDER`);

/** Footprint at a tier: content items with a `shape(tier)` (Sourdough Starter grows 1 -> 2 -> 3 cells) follow it, everything else keeps its def footprint. */
export const cellsFor = (type: ItemTypeId, tier = 1): Cell[] => {
  const shape = contentItem(type)?.shape;
  if (typeof shape === 'function') return resolveShape(shape(Math.min(Math.max(tier, 1), 3)));
  return ITEMS[type].cells;
};
/** Footprint of an item instance (pre-rotation): the one place cells are read from. */
export const cellsOf = (i: { type: ItemTypeId; tier?: number }): Cell[] => cellsFor(i.type, i.tier ?? 1);

export const ITEM_IDS = Object.keys(ITEMS) as ItemTypeId[];
export const WEAPON_IDS = ITEM_IDS.filter((id) => ITEMS[id].kind === 'weapon');

/** Global tuning for the player and build. */
export const PLAYER = {
  maxHp: 40,
  speed: 250,
  radius: 22,
  /** Hitbox is a capsule along the ground from the goblin (back) to the cart nose (front), mirrored with facing. */
  body: { back: 42, front: 46 }, // a bit inside the sprite so near-misses feel fair
  invuln: 0.6,
  pickupRadius: 70,
  shove: { distance: 130, time: 0.16, cooldown: 3, damage: 6, knockback: 160, protect: 0.35 },
  repairBetweenWaves: 6,
  startMoney: 0,
  /** Characters (perks + looks only). The starting weapon is picked separately: see STARTER_WEAPONS. */
  starters: {
    toaster: { name: 'Toast Goblin', blurb: 'The all-rounder. No perks, no downsides.' },
    pan: { name: 'Line Cook', blurb: 'Tough from the kitchen line, a bit slow on the floor.', perk: { maxHp: 5, moveSpeedMult: 0.95 } },
    coupon: { name: 'Coupon Clipper', blurb: 'Haggles everything, but bruises easily.', perk: { priceMult: 0.85, startMoney: 12, maxHp: -8 } },
    night: { name: 'Night Shift', blurb: 'Fast on their feet, tired arms.', perk: { shoveCooldown: -1, moveSpeedMult: 1.08, damageMult: 0.9 } },
  } as Record<StarterId, { name: string; blurb: string; perk?: Perk }>,
};

/** Starting weapons the player can pick for any character. Shop 1 guarantees two items that suit it. */
export const STARTER_WEAPONS: Record<StarterWeapon, { x: number; y: number; rot: 0; guarantee: ItemTypeId[] }> = {
  toaster: { x: 1, y: 1, rot: 0, guarantee: ['fan', 'fuel'] },
  pan: { x: 2, y: 0, rot: 0, guarantee: ['bell', 'hotsauce'] },
  nailgun: { x: 1, y: 1, rot: 0, guarantee: ['magnet', 'battery'] },
};

/** Accessory layers drawn over the goblin head/torso per starter (SVG keys). */
export const STARTER_LOOKS: Record<StarterId, { head?: string; torso?: string }> = {
  toaster: { head: 'acc_toast_hat' },
  pan: { head: 'acc_chef_hat', torso: 'acc_apron' },
  coupon: { head: 'acc_visor' },
  night: { head: 'acc_headlamp' },
};

/** Bundle Deal: each weapon gains +6% damage per distinct item type touching it. */
export const BUNDLE = { perItem: 0.06 };

/** Rarity is shown by border color: ★1 common, ★2 rare, ★3 epic, legendary unique items. */
export const RARITY_COLORS = { 1: '#30203F', 2: '#2FA597', 3: '#8A5CD6', legendary: '#F5BD45' } as const;

/** Item tiers (★1..★3). Percent-style bonuses scale by tierMult; weapons get damage + rate. */
export const TIER = {
  max: 3,
  /** Multiplier applied to the bonus part of a module/passive effect (e.g. +30% → +45% at ★2). */
  mult: tierMult,
  weaponDamage: weaponDamageMult,
  weaponCooldown: weaponCooldownMult,
  /** Total coin value of an item at tier t (★2 = two copies). Sell = floor(value / 2). */
  value: (price: number, t: number) => price * 2 ** (t - 1),
  /** Cost to buy the next tier directly: equals the current value. */
  upgradeCost: (price: number, t: number) => price * 2 ** (t - 1),
};

export const CRIT = { mult: 2 };

export { PROJECTILE_PATTERNS };
