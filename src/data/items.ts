import type { Cell, ItemDef, ItemTypeId, Perk, StarterId, StarterWeapon, WeaponBase } from '../types';

const rect = (w: number, h: number): Cell[] => {
  const cells: Cell[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ x, y });
  return cells;
};

const shape = (...rows: string[]): Cell[] => rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === '#' ? [{ x, y }] : [])));

const weapon = (w: Partial<WeaponBase> & Pick<WeaponBase, 'pattern' | 'damage' | 'cooldown' | 'range'>): WeaponBase => ({
  projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0, ...w,
});

export const ITEMS: Record<ItemTypeId, ItemDef> = {
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
  fan: {
    id: 'fan', family: 'cleaning', name: 'Desk Fan', kind: 'module', cells: rect(1, 2), price: 9, electrical: false, buff: 'fan',
    blurb: 'Whoosh. More range for whatever it touches.',
    rules: 'Any adjacent weapon gains {0} range or reach and {1} projectile speed.',
  },
  fuel: {
    id: 'fuel', family: 'tools', element: 'heat', name: 'Fuel Can', kind: 'module', cells: rect(1, 2), price: 11, electrical: false, buff: 'fuel',
    blurb: 'Questionable. Sets every hit on fire.',
    rules: 'Any adjacent weapon sets enemies on fire: {0} burn damage for 2 s (refreshes, never stacks).',
  },
  battery: {
    id: 'battery', family: 'tools', name: 'Battery', kind: 'module', cells: rect(1, 1), price: 8, electrical: true, buff: 'battery',
    blurb: 'Zap! Faster attacks, electric gadgets most of all.',
    rules: 'Any adjacent weapon gets {0} attack speed; Electric weapons {1}.',
  },
  magnet: {
    id: 'magnet', family: 'tools', name: 'Magnet', kind: 'passive', cells: rect(1, 1), price: 7, electrical: false,
    blurb: 'Coins come to you.',
    rules: '{0} coin pickup radius (does not stack). Enables Nailstorm next to a Nail Gun.',
  },
  ice: {
    id: 'ice', family: 'kitchen', element: 'frost', name: 'Ice Pack', kind: 'module', cells: rect(1, 2), price: 8, electrical: false, buff: 'ice',
    blurb: 'Chilly hits slow groceries down.',
    rules: 'Adjacent weapon hits slow enemies by {0} for 1 s. Repeated hits refresh.',
  },
  hotsauce: {
    id: 'hotsauce', family: 'kitchen', element: 'heat', name: 'Hot Sauce', kind: 'module', cells: rect(1, 1), price: 7, electrical: false, buff: 'hotsauce',
    blurb: 'Extra spicy damage.',
    rules: 'Adjacent weapons gain {0} hit damage.',
  },
  lunchbox: {
    id: 'lunchbox', family: 'snacks', name: 'Lunchbox', kind: 'passive', cells: rect(2, 1), price: 9, electrical: false,
    blurb: 'A packed lunch. +15 max HP.',
    rules: '{0} maximum HP while equipped (does not stack, does not heal). Enables TV Dinner.',
  },
  bell: {
    id: 'bell', family: 'checkout', name: 'Shopping Bell', kind: 'passive', cells: rect(1, 1), price: 7, electrical: false,
    blurb: 'Ding! Shove more often.',
    rules: 'Shove cooldown {0} (does not stack). Enables Express Checkout next to a Frying Pan.',
  },
  boot: {
    id: 'boot', family: 'tools', name: 'Running Boot', kind: 'passive', cells: rect(1, 1), price: 9, electrical: false,
    blurb: 'Clearance-rack sprinter. Dash like you stole it.',
    rules: 'Space dash: {0} distance and {1} damage.',
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
  pricegun: {
    id: 'pricegun', family: 'checkout', name: 'Price Gun', kind: 'module', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], price: 12, electrical: false, buff: 'pricegun',
    blurb: 'Marks groceries 50% OFF. Critical hits!',
    rules: 'Adjacent weapons gain a {0} chance to crit for double damage (not burn). Enables Clearance Sale.',
  },
  tape: {
    id: 'tape', family: 'tools', name: 'Duct Tape', kind: 'module', cells: rect(1, 1), price: 9, electrical: false, buff: 'tape',
    blurb: 'Fixes everything. Makes it bigger, too.',
    rules: 'Any adjacent weapon: projectiles pierce {0}, sweeps and cones {1} arc, areas {2} radius, beams {2} length.',
  },
  coupon: {
    id: 'coupon', family: 'checkout', name: 'Coupon Book', kind: 'passive', cells: rect(1, 1), price: 8, electrical: false,
    blurb: 'Extra savings on every kill.',
    rules: 'Kills have a {0} chance to drop +1 coin (does not stack). Enables Clearance Sale.',
  },
  bubblewrap: {
    id: 'bubblewrap', family: 'checkout', name: 'Bubble Wrap', kind: 'passive', cells: rect(3, 1), price: 10, electrical: false,
    blurb: 'Pop-proof padding for your cart.',
    rules: 'Take {0} less damage from every hit (minimum 1) and +0.25 s invulnerability after being hit (does not stack).',
  },
  energy: {
    id: 'energy', family: 'snacks', name: 'Energy Drink', kind: 'passive', cells: rect(1, 1), price: 8, electrical: false,
    blurb: 'Zoom zoom. Faster cart.',
    rules: '{0} movement speed (does not stack).',
  },
  fortune: {
    id: 'fortune', family: 'snacks', name: 'Fortune Cookie', kind: 'passive', cells: rect(1, 1), price: 8, electrical: false,
    blurb: 'Your lucky numbers: 2, 2, 2.',
    rules: 'Every weapon gains {0} chance to crit for double damage (adds to the Price Gun, does not stack).',
  },
  sample: {
    id: 'sample', family: 'kitchen', name: 'Free Sample', kind: 'passive', cells: rect(1, 1), price: 10, electrical: false,
    blurb: 'Just a taste. Every crit is a snack.',
    rules: 'Every crit heals {0} HP, at most 2 HP per second (does not stack). Needs a crit source like the Price Gun or Fortune Cookie.',
  },
  piggy: {
    id: 'piggy', family: 'checkout', name: 'Piggy Bank', kind: 'passive', cells: rect(1, 1), price: 10, electrical: false,
    blurb: 'Oink. Every grocery chips in.',
    rules: 'Groceries drop {0} coins (does not stack).',
  },
  expiredmilk: {
    id: 'expiredmilk', family: 'snacks', name: 'Expired Milk', kind: 'passive', cells: rect(1, 2), price: 7, electrical: false,
    blurb: 'Cursed. Smells like a bad decision.',
    rules: 'Cursed: poisons enemies within 110 of the cart for {0} damage/s (refreshes every 0.5 s, does not stack). Your max HP is reduced by 10%. Enables Sour Mist.',
  },
  tinfoilhat: {
    id: 'tinfoilhat', family: 'tools', name: 'Tin Foil Hat', kind: 'passive', cells: rect(1, 1), price: 9, electrical: false,
    blurb: 'Blocks the signal. And the soda.',
    rules: 'While dashing (and 0.1 s after), enemy shots that touch you are reflected back at the groceries for {0} of their damage instead of hurting you. Enables Sparks Fly and Ray Gun.',
  },
  jellybeans: {
    id: 'jellybeans', family: 'snacks', name: 'Jelly Beans', kind: 'module', cells: rect(1, 1), price: 10, electrical: false,
    blurb: 'Every shop visit, a new flavor.',
    rules: 'The flavor changes every shop visit: Heat (Fuel Can burn), Frost (Ice Pack slow) or Blast (Party Popper blast). Adjacent weapons get that effect at {0} strength, and the beans count toward that flavor\'s set.',
  },
  leafblower: {
    id: 'leafblower', family: 'cleaning', tags: ['area'], name: 'Leaf Blower', kind: 'weapon', cells: rect(2, 1), price: 14, electrical: false,
    blurb: 'Huff and puff. Slams groceries into things.',
    rules: 'Every {1} blasts a 50° cone (220 reach) for {0} damage and a heavy shove. Blown groceries that hit a wall or prop take 8 slam damage (scales with level).',
    weapon: weapon({ pattern: 'cone', damage: 3, cooldown: 0.9, range: 220, arcDeg: 50, knockback: 300 }),
  },
  sourdough: {
    id: 'sourdough', family: 'kitchen', name: 'Sourdough Starter', kind: 'passive', cells: rect(1, 1), price: 6, electrical: false,
    blurb: 'Feed it and it grows. Bubbles with potential.',
    rules: 'Weapons touching it gain {0} damage. Grows one level every 2 aisles (needs room to rise): 2 cells at ★2, 3 cells at ★3.',
  },
  powerstrip: {
    id: 'powerstrip', family: 'tools', name: 'Power Strip', kind: 'module', cells: rect(3, 1), price: 32, electrical: true, legendary: true,
    blurb: 'Plugs the whole cart in at once.',
    rules: 'Every electrical weapon in the cart gains +20% attack rate; electrical weapons touching it gain +40% instead.',
  },
  goldstar: {
    id: 'goldstar', family: 'checkout', name: 'Gold Star Sticker', kind: 'module', cells: rect(1, 1), price: 28, electrical: false, legendary: true,
    blurb: 'Teacher\'s pet. Everything nearby tries harder.',
    rules: 'Modules and passives touching it work one tier higher (up to ★4 strength). Weapons touching it get +1 Bundle Deal item.',
  },
  laser: {
    id: 'laser', family: 'checkout', tags: ['ranged'], name: 'Self-Checkout Laser', kind: 'weapon', cells: shape('.#.', '###', '.#.'), price: 40, electrical: true, legendary: true,
    blurb: 'Unexpected item in the bagging area. ZAP.',
    rules: 'Every 1.6 s fires a barcode beam (620 long) that hits every enemy in the line once for 20 damage. Electrical.',
    weapon: weapon({ pattern: 'laser', damage: 20, cooldown: 1.6, range: 620 }),
  },
  snackbag: {
    id: 'snackbag', family: 'snacks', name: 'Family-Size Snack Bag', kind: 'passive', cells: rect(2, 2), price: 30, electrical: false, legendary: true,
    blurb: 'Bottomless. Probably.',
    rules: '+20 max HP and regenerate 1 HP every 4 s during combat (does not stack).',
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
  popper: {
    id: 'popper', family: 'snacks', element: 'blast', name: 'Party Popper', kind: 'module', cells: rect(1, 1), price: 10, electrical: false, buff: 'popper',
    blurb: 'Every kill is a celebration.',
    rules: 'Enemies killed by adjacent weapons explode in confetti: {0} damage within 70. Popper explosions never chain.',
  },
  doublebag: {
    id: 'doublebag', family: 'checkout', element: 'blast', name: 'Double Bag', kind: 'module', cells: rect(2, 1), price: 12, electrical: false, buff: 'echo',
    blurb: 'Twice the bag, twice the whack.',
    rules: 'Direct hits from adjacent weapons strike a second time 0.12 s later for {0} damage.',
  },
  multipack: {
    id: 'multipack', family: 'snacks', element: 'blast', name: 'Multipack', kind: 'module', cells: rect(1, 1), price: 13, electrical: false, buff: 'multipack',
    blurb: 'Buy one, fire two.',
    rules: 'Any adjacent weapon: projectiles {0}, sweeps/cones/mortars attack one extra time, other weapons {1} damage.',
  },
};

/** Sourdough Starter grows with its tier: 1 cell, 2 cells, then an L of 3. Everything else keeps its def footprint. */
const SOURDOUGH_CELLS: Cell[][] = [rect(1, 1), rect(2, 1), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]];
export const cellsFor = (type: ItemTypeId, tier = 1): Cell[] => (type === 'sourdough' ? SOURDOUGH_CELLS[Math.min(Math.max(tier, 1), 3) - 1] : ITEMS[type].cells);
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
  fan: { speedMult: 1.3, rangeMult: 1.3 },
  fuel: { dps: 2.5, duration: 2, tick: 0.5 },
  battery: { rateMult: 1.12, electricMult: 1.5 }, // electric weapons get 1.5x the bonus
  ice: { pct: 0.25, duration: 1 },
  hotsauce: { damageMult: 1.25 },
  pricegun: { critChance: 0.15 },
  tape: { pierce: 1, arcDeg: 30, radiusMult: 1.2 },
  magnetPickup: 60,
  vacuumPickup: 60,
  lunchboxHp: 15,
  bellShove: 0.5,
  bootDistance: 0.35,
  bootDamage: 6,
  energySpeed: 0.12,
  couponChance: 0.3,
  bubbleArmor: 1,
  bubbleInvuln: 0.25,
  powerstripAll: 1.2,
  powerstripAdjacent: 1.4,
  snackHp: 20,
  snackRegen: 0.25, // HP per second
  fortuneCrit: 0.05, // crit chance for every weapon
  sampleHeal: 1,     // HP per crit
  sampleHealCap: 2,  // HP per second at most
  piggyCoins: 0.15,  // extra kill coins (x tier mult)
};

/** Expired Milk curse: toxic aura around the cart (dps scales with tier), and a multiplicative max HP penalty. */
export const EXPIRED_MILK = { radius: 110, interval: 0.5, dps: 3, duration: 1, hpMult: 0.9 };

/** Tin Foil Hat: dash-reflect grace window after a dash ends (s) and the reflected-damage multiplier (x tier mult). */
export const TINFOIL = { grace: 0.1, reflectMult: 1.5 };
/** Jelly Beans: strength of the flavor effect relative to the full Fuel Can / Ice Pack / Party Popper (x tier mult). */
export const JELLY = { strength: 0.7 };

/** Sourdough Starter: weapon damage bonus per effective star, and the aisles between rises. */
export const SOURDOUGH = { perStar: 0.06, every: 2 };

/** Bundle Deal: each weapon gains +6% damage per distinct item type touching it. */
export const BUNDLE = { perItem: 0.06 };

/** Rarity is shown by border color: ★1 common, ★2 rare, ★3 epic, legendary unique items. */
export const RARITY_COLORS = { 1: '#30203F', 2: '#2FA597', 3: '#8A5CD6', legendary: '#F5BD45' } as const;

/** Item tiers (★1..★3). Percent-style bonuses scale by tierMult; weapons get damage + rate. */
export const TIER = {
  max: 3,
  /** Multiplier applied to the bonus part of a module/passive effect (e.g. +30% → +45% at ★2). */
  mult: (t: number) => 1 + 0.5 * (t - 1),
  weaponDamage: (t: number) => 1 + 0.5 * (t - 1),
  weaponCooldown: (t: number) => 1 - 0.1 * (t - 1),
  /** Total coin value of an item at tier t (★2 = two copies). Sell = floor(value / 2). */
  value: (price: number, t: number) => price * 2 ** (t - 1),
  /** Cost to buy the next tier directly: equals the current value. */
  upgradeCost: (price: number, t: number) => price * 2 ** (t - 1),
};

export const CRIT = { mult: 2 };
/** Party Popper explosion (scales with module tier via TIER.mult on damage). */
export const POPPER = { damage: 6, radius: 70 };
/** Double Bag second strike. */
export const ECHO = { fraction: 0.5, delay: 0.12 };
/** Multipack: extra projectile, or one extra repeat for non-projectile attacks. */
export const MULTIPACK = { extra: 1, repeatDelay: 0.18 };
export const PUDDLE = { slow: { pct: 0.25, duration: 0.5 } };

export const PROJECTILE_PATTERNS = new Set(['toast', 'burst', 'ricochet']);
