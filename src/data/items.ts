import type { Cell, ItemDef, ItemTypeId, Perk, StarterId, StarterWeapon, WeaponBase } from '../types';
import { PROJECTILE_PATTERNS, resolveShape, tierMult } from '../engine/define';
import { itemDefOf } from '../engine/legacy';
import { contentItem } from '../engine/registry';

const rect = (w: number, h: number): Cell[] => {
  const cells: Cell[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ x, y });
  return cells;
};

const shape = (...rows: string[]): Cell[] => rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === '#' ? [{ x, y }] : [])));

const weapon = (w: Partial<WeaponBase> & Pick<WeaponBase, 'pattern' | 'damage' | 'cooldown' | 'range'>): WeaponBase => ({
  projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0, ...w,
});

/** Items still defined here. An item moves to src/content/items/<id>.ts by deleting its entry (and its other legacy branches). */
const LEGACY_ITEMS: Partial<Record<ItemTypeId, ItemDef>> = {
  toaster: {
    id: 'toaster', family: 'kitchen', element: 'heat', tags: ['ranged'], name: 'Toaster', kind: 'weapon', cells: rect(2, 1), price: 12, electrical: true,
    blurb: 'Lobs hot toast at the nearest grocery.',
    rules: 'Fires toast for {0} damage every {1}. 455 range. Each toast hits one enemy.',
    weapon: weapon({ pattern: 'toast', damage: 9, cooldown: 1.0, range: 455, projectileSpeed: 540 }),
  },
  pan: {
    id: 'pan', family: 'kitchen', element: 'heat', tags: ['melee'], name: 'Frying Pan', kind: 'weapon', cells: rect(1, 3), price: 10, electrical: false,
    blurb: 'Big clangy sweep around the cart.',
    rules: 'Sweeps toward nearby enemies for {0} damage every {1}. 150 reach. Hits each enemy once per swing.',
    weapon: weapon({ pattern: 'sweep', damage: 9, cooldown: 1.15, range: 150, arcDeg: 150 }),
  },
  nailgun: {
    id: 'nailgun', family: 'tools', element: 'blast', tags: ['ranged'], name: 'Nail Gun', kind: 'weapon', cells: rect(2, 1), price: 16, electrical: true,
    blurb: 'Rat-a-tat three-nail bursts.',
    rules: 'Fires a three-nail burst every {1}. {0} damage per nail. 480 range.',
    weapon: weapon({ pattern: 'burst', damage: 3, cooldown: 1.1, range: 480, projectileSpeed: 760, count: 3, burstInterval: 0.08 }),
  },
  vacuum: {
    id: 'vacuum', family: 'cleaning', tags: ['area'], name: 'Vacuum', kind: 'weapon', cells: shape('###', '.#.'), price: 18, electrical: true,
    blurb: 'Sucks groceries closer. Sucks coins closer too.',
    rules: 'Constantly pulls nearby enemies toward the cart. Every {1}, enemies in range take {0} damage. +60 coin pickup radius.',
    weapon: weapon({ pattern: 'pulse', damage: 2, cooldown: 0.65, range: 150, pull: 70 }),
  },
  boot: {
    id: 'boot', family: 'tools', name: 'Running Boot', kind: 'passive', cells: rect(1, 1), price: 9, electrical: false,
    blurb: 'Clearance-rack sprinter. Dash like you stole it.',
    rules: 'Space dash: {0} distance and {1} damage.',
  },
  bumper: {
    id: 'bumper', family: 'tools', element: 'blast', name: 'Slam Bumper', kind: 'passive', cells: rect(1, 1), price: 11, electrical: false,
    blurb: 'Land the dash with a bang.',
    rules: 'The Space dash ends in a shockwave: {0} damage within 90 and knockback (does not stack). Enables Pot Slam next to a Pressure Cooker.',
  },
  sparewheel: {
    id: 'sparewheel', family: 'tools', name: 'Spare Wheel', kind: 'passive', cells: rect(1, 1), price: 10, electrical: false,
    blurb: 'Two dashes for the price of one.',
    rules: 'After a dash, one more dash within {0} is free: it skips the cooldown (does not stack).',
  },
  tipjar: {
    id: 'tipjar', family: 'checkout', name: 'Tip Jar', kind: 'passive', cells: rect(1, 1), price: 9, electrical: false,
    blurb: 'Bump them. They tip.',
    rules: 'Each grocery the Space dash hits has a {0} chance to drop a coin (does not stack).',
  },
  flag: {
    id: 'flag', family: 'checkout', name: 'Sale Flag', kind: 'passive', cells: rect(1, 1), price: 10, electrical: false,
    blurb: 'Plant it in their back. Everything is 20% off.',
    rules: 'Groceries hit by the Space dash are marked for {0}: they take +20% damage from everything (does not stack).',
  },
  microwave: {
    id: 'microwave', family: 'kitchen', element: 'heat', tags: ['area'], name: 'Microwave', kind: 'weapon', cells: shape('.##', '##.'), price: 20, electrical: true,
    blurb: 'Ding! Nukes a grocery from across the aisle.',
    rules: 'Every {1} zaps the toughest enemy within 380 (Elites first, then most HP) for {0} damage, splashing everything within 70. Electrical.',
    weapon: weapon({ pattern: 'zap', damage: 24, cooldown: 2.4, range: 380, aoe: 70 }),
  },
  blender: {
    id: 'blender', family: 'kitchen', tags: ['melee', 'area'], name: 'Blender', kind: 'weapon', cells: rect(1, 2), price: 15, electrical: true,
    blurb: 'Whirring blades around the cart.',
    rules: 'Shreds every enemy within 85 for {0} damage every {1} (each enemy once per tick). Electrical.',
    weapon: weapon({ pattern: 'aura', damage: 2, cooldown: 0.3, range: 85 }),
  },
  fizz: {
    id: 'fizz', family: 'snacks', element: 'frost', tags: ['ranged'], name: 'Fizz Cannon', kind: 'weapon', cells: rect(2, 1), price: 14, electrical: false,
    blurb: 'Shaken soda fires ricocheting bottle caps.',
    rules: 'Fires a bottle cap for {0} damage every {1} that bounces to 2 more enemies (never the same one twice). 420 range.',
    weapon: weapon({ pattern: 'ricochet', damage: 6, cooldown: 1.0, range: 420, projectileSpeed: 620, bounces: 2 }),
  },
  mop: {
    id: 'mop', family: 'cleaning', element: 'frost', tags: ['area'], name: 'Mop', kind: 'weapon', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }], price: 11, electrical: false,
    blurb: 'Leaves slippery soap puddles behind you.',
    rules: 'Every {1} drops a soap puddle (radius 60, lasts 3 s). Enemies inside slip: 25% slow and {0} damage every 0.5 s.',
    weapon: weapon({ pattern: 'puddle', damage: 3, cooldown: 1.6, range: 60, tick: 0.5, duration: 3 }),
  },
  bubblewrap: {
    id: 'bubblewrap', family: 'checkout', name: 'Bubble Wrap', kind: 'passive', cells: rect(3, 1), price: 10, electrical: false,
    blurb: 'Pop-proof padding for your cart.',
    rules: 'Take {0} less damage from every hit (minimum 1) and +0.25 s invulnerability after being hit (does not stack).',
  },
  expiredmilk: {
    id: 'expiredmilk', family: 'snacks', name: 'Expired Milk', kind: 'passive', cells: rect(1, 2), price: 7, electrical: false,
    blurb: 'Cursed. Smells like a bad decision.',
    rules: 'Cursed: poisons enemies within 110 of the cart: {0} poison damage (refreshes every 0.5 s, does not stack). Your max HP is reduced by 10%. Combo: Sour Mist with Spray Bottle + Desk Fan.',
  },
  tinfoilhat: {
    id: 'tinfoilhat', family: 'tools', name: 'Tin Foil Hat', kind: 'passive', cells: rect(1, 1), price: 9, electrical: false,
    blurb: 'Blocks the signal. And the soda.',
    rules: 'While dashing (and 0.1 s after), enemy shots that touch you are reflected back at the groceries for {0} of their damage instead of hurting you. Combos: Sparks Fly with Microwave + Battery; Ray Gun with Nail Gun + Battery + Magnet.',
  },
  leafblower: {
    id: 'leafblower', family: 'cleaning', tags: ['area'], name: 'Leaf Blower', kind: 'weapon', cells: rect(2, 1), price: 14, electrical: false,
    blurb: 'Huff and puff. Slams groceries into things.',
    rules: 'Every {1} blasts a 50° cone (220 reach) for {0} damage and a heavy push. Blown groceries that hit a wall or prop take 8 slam damage (scales with level).',
    weapon: weapon({ pattern: 'cone', damage: 3, cooldown: 0.9, range: 220, arcDeg: 50, knockback: 300 }),
  },
  laser: {
    id: 'laser', family: 'checkout', tags: ['ranged'], name: 'Self-Checkout Laser', kind: 'weapon', cells: shape('.#.', '###', '.#.'), price: 40, electrical: true, legendary: true,
    blurb: 'Unexpected item in the bagging area. ZAP.',
    rules: 'Every 1.6 s fires a barcode beam (620 long) that hits every enemy in the line once for 20 damage. Electrical.',
    weapon: weapon({ pattern: 'laser', damage: 20, cooldown: 1.6, range: 620 }),
  },
  cooker: {
    id: 'cooker', family: 'kitchen', element: 'heat', tags: ['area'], name: 'Pressure Cooker', kind: 'weapon', cells: shape('##.', '.##'), price: 18, electrical: false,
    blurb: 'Lobs a whistling pot. KABOOM.',
    rules: 'Every {1} lobs a pot at the densest group within 420. It explodes for {0} damage to everything within 90, with knockback.',
    weapon: weapon({ pattern: 'mortar', damage: 16, cooldown: 2.6, range: 420, aoe: 90, projectileSpeed: 380 }),
  },
  spray: {
    id: 'spray', family: 'cleaning', element: 'frost', tags: ['melee'], name: 'Spray Bottle', kind: 'weapon', cells: rect(1, 2), price: 12, electrical: false,
    blurb: 'Pssht pssht pssht. Hits everything in front.',
    rules: 'Every {1} sprays a 70° cone (170 reach) for {0} damage to every enemy inside (each once per spray).',
    weapon: weapon({ pattern: 'cone', damage: 3, cooldown: 0.55, range: 170, arcDeg: 70 }),
  },
};

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

export const BUFFS = {
  vacuumPickup: 60,
  bootDistance: 0.35,
  bootDamage: 6,
  bumperDamage: 8,
  bumperRadius: 90,
  wheelWindow: 1.0,   // seconds (x tier mult)
  tipChance: 0.4,     // per enemy hit by the dash (x tier mult, max 1)
  flagMark: 2,        // seconds (x tier mult)
  bubbleArmor: 1,
  bubbleInvuln: 0.25,
};

/** Expired Milk curse: toxic aura around the cart (dps scales with tier), and a multiplicative max HP penalty. */
export const EXPIRED_MILK = { radius: 110, interval: 0.5, dps: 3, duration: 1, hpMult: 0.9 };

/** Tin Foil Hat: dash-reflect grace window after a dash ends (s) and the reflected-damage multiplier (x tier mult). */
export const TINFOIL = { grace: 0.1, reflectMult: 1.5 };

/** Bundle Deal: each weapon gains +6% damage per distinct item type touching it. */
export const BUNDLE = { perItem: 0.06 };

/** Rarity is shown by border color: ★1 common, ★2 rare, ★3 epic, legendary unique items. */
export const RARITY_COLORS = { 1: '#30203F', 2: '#2FA597', 3: '#8A5CD6', legendary: '#F5BD45' } as const;

/** Item tiers (★1..★3). Percent-style bonuses scale by tierMult; weapons get damage + rate. */
export const TIER = {
  max: 3,
  /** Multiplier applied to the bonus part of a module/passive effect (e.g. +30% → +45% at ★2). */
  mult: tierMult,
  weaponDamage: (t: number) => 1 + 0.5 * (t - 1),
  weaponCooldown: (t: number) => 1 - 0.1 * (t - 1),
  /** Total coin value of an item at tier t (★2 = two copies). Sell = floor(value / 2). */
  value: (price: number, t: number) => price * 2 ** (t - 1),
  /** Cost to buy the next tier directly: equals the current value. */
  upgradeCost: (price: number, t: number) => price * 2 ** (t - 1),
};

export const CRIT = { mult: 2 };
export const PUDDLE = { slow: { pct: 0.25, duration: 0.5 } };

export { PROJECTILE_PATTERNS };
