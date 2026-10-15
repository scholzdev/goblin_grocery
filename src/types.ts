// Shared contracts. Pure data shapes only — no Phaser, no DOM.
import type { DoorId, ModifierId } from './data/modifiers';
import type { EventKind } from './data/events';
import type { ZoneId } from './data/zones';

export type ItemTypeId =
  | 'toaster' | 'pan' | 'nailgun' | 'vacuum'
  | 'fan' | 'fuel' | 'battery' | 'magnet' | 'ice' | 'hotsauce' | 'lunchbox' | 'bell' | 'boot'
  | 'microwave' | 'blender' | 'fizz' | 'mop'
  | 'pricegun' | 'tape' | 'coupon' | 'bubblewrap' | 'energy'
  | 'powerstrip' | 'goldstar' | 'laser' | 'snackbag'
  | 'cooker' | 'spray' | 'popper' | 'doublebag' | 'multipack'
  | 'fortune' | 'sample' | 'piggy';

export type WeaponPattern = 'toast' | 'sweep' | 'burst' | 'pulse' | 'zap' | 'aura' | 'ricochet' | 'puddle' | 'laser' | 'mortar' | 'cone';
export type ItemKind = 'weapon' | 'module' | 'passive';
export type Rotation = 0 | 1 | 2 | 3;
export type RecipeId = 'toastMode' | 'nailstorm' | 'coldStorage' | 'expressCheckout' | 'brainFreeze' | 'tvDinner' | 'clearanceSale' | 'greaseFire' | 'pressurePoint' | 'mistMachine'
  | 'fiveAlarm' | 'sizzlingSkillet' | 'frostbiteNails' | 'staticCling' | 'reheat' | 'smoothieShield'
  | 'confettiCannon' | 'blackIce' | 'shrapnel' | 'pressureWasher' | 'powerSurge' | 'priceCheck';
/** Set-bonus tags: one family per item, optional element; 'electric' = the `electrical` flag. See data/sets.ts. */
export type FamilyTag = 'kitchen' | 'cleaning' | 'tools' | 'snacks' | 'checkout';
export type ElementTag = 'heat' | 'frost' | 'blast';
export type SetId = FamilyTag | ElementTag | 'electric';
/** Weapon role tags (shown on cards; Electric is the separate `electrical` flag). */
export type WeaponTag = 'ranged' | 'melee' | 'area';
export type BuffId = 'fan' | 'fuel' | 'battery' | 'ice' | 'hotsauce' | 'pricegun' | 'tape' | 'popper' | 'echo' | 'multipack';
export type EnemyId = 'milk' | 'banana' | 'soda' | 'spitter' | 'baguette' | 'egg' | 'melon' | 'slice' | 'turkey' | 'beans' | 'cereal' | 'honey' | 'giftcard' | 'expired' | 'gum' | 'boss' | 'boss_frozen' | 'boss_bakery' | 'boss_electronics' | 'boss_checkout';

export interface Cell { x: number; y: number }

export interface WeaponBase {
  pattern: WeaponPattern;
  damage: number;          // per hit (per projectile / per nail / per sweep / per pulse)
  cooldown: number;        // seconds between attacks
  range: number;           // acquisition range (projectile travel range / sweep reach / pulse radius)
  projectileSpeed: number; // 0 for non-projectile patterns
  count: number;           // projectiles per attack (burst nails, toast count)
  burstInterval: number;   // seconds between burst projectiles
  arcDeg: number;          // sweep arc width
  pull: number;            // vacuum suction speed (px/s)
  tick: number;            // aura/puddle damage tick interval (s)
  duration: number;        // puddle lifetime (s)
  bounces: number;         // ricochet: extra enemies after the first
  chain: number;           // zap: extra chained targets
  aoe: number;             // zap: splash radius around the target
}

export interface ItemDef {
  id: ItemTypeId;
  name: string;
  kind: ItemKind;
  /** Base footprint, pre-rotation, as integer cells relative to origin (0,0). */
  cells: Cell[];
  price: number;
  electrical: boolean;
  family: FamilyTag;
  element?: ElementTag;
  /** Short one-line description for cards. */
  blurb: string;
  /** Longer rules text for tooltips. */
  rules: string;
  weapon?: WeaponBase;
  /** Weapons only: role tag(s). */
  tags?: WeaponTag[];
  /** Legendary: unique effect, gold border, rare in shops, cannot be upgraded or merged. */
  legendary?: boolean;
  /** Buff this module grants to adjacent weapons (if any). */
  buff?: BuffId;
}

export interface ItemInstance {
  uid: string;
  type: ItemTypeId;
  /** Grid origin (only meaningful when placed in the cart). */
  x: number;
  y: number;
  rot: Rotation;
  /** 1..MAX_TIER. Missing = 1. Raised by merging duplicates or buying an upgrade. */
  tier?: number;
  /** Bought as a double pack: counts as 2 distinct types toward its family set. */
  double?: boolean;
}

export interface Inventory {
  cols: number; // 4
  rows: number; // 4
  placed: ItemInstance[];
  /** Fixed-length staging shelf; null = empty slot. */
  shelf: (ItemInstance | null)[];
}

export interface BurnEffect { dps: number; duration: number; tick: number }
export interface SlowEffect { pct: number; duration: number }

/** Fully-derived stats for one equipped weapon. Recomputed from defs every inventory change. */
export interface WeaponStats {
  uid: string;
  type: ItemTypeId;
  pattern: WeaponPattern;
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed: number;
  count: number;
  burstInterval: number;
  spreadDeg: number;
  arcDeg: number;
  pull: number;
  tick: number;
  duration: number;
  bounces: number;
  chain: number;
  aoe: number;
  tier: number;
  critChance: number;      // 0..1, crits deal CRIT.mult damage (direct hits only)
  critCoin: boolean;       // clearanceSale: crits drop a coin (once per enemy)
  bundle: number;          // distinct item types touching this weapon (Bundle Deal damage bonus)
  /** Party Popper: kills by this weapon explode (never chains from popper kills). */
  popper: { damage: number; radius: number } | null;
  /** Double Bag: each direct hit strikes again after ECHO.delay for this fraction of the damage (0 = none). */
  echo: number;
  /** Pressure Point: mortar blasts leave a burning pool. */
  firePool: boolean;
  pierce: number;          // extra enemies a projectile may pass through (0 = hits one)
  homing: boolean;         // curve toward nearby target after first hit
  burn: BurnEffect | null;
  /** Heat L2: chance to set a non-burning weapon's hit on fire. */
  ignite: { chance: number; burn: BurnEffect } | null;
  /** Electric set: chance per hit to arc to `chainJumps` nearby enemies (chained hits never re-chain). */
  chainChance: number;
  chainJumps: number;
  slow: SlowEffect | null;
  frostRing: boolean;
  expressSweep: boolean;   // pan: extra sweep on successful shove
  buffs: BuffId[];         // distinct buffs applied (each at most once)
  /** Active combos on this weapon (each weapon has exactly 2 possible combos; both can be active). */
  recipes: RecipeId[];
}

export interface ActiveRecipe {
  id: RecipeId;
  weaponUid: string;
  supportUids: string[];
}

export type StarterId = 'toaster' | 'pan' | 'coupon' | 'night';
/** Starting weapons selectable independently of the character. */
export type StarterWeapon = 'toaster' | 'pan';

/** Run-wide modifiers a starter goblin brings (all optional; see PLAYER.starters). */
export interface Perk {
  priceMult?: number;      // shop prices
  startMoney?: number;     // extra coins at run start
  maxHp?: number;          // flat
  shoveCooldown?: number;  // flat seconds
  shoveDamage?: number;    // flat
  moveSpeedMult?: number;
  damageMult?: number;     // every weapon
  pickupRadius?: number;   // flat
}

export interface Build {
  weapons: WeaponStats[];
  maxHp: number;
  pickupRadius: number;
  shoveCooldown: number;
  shoveDistMult: number;   // running boot: dash distance multiplier
  shoveDamage: number;     // dash hit damage (running boot adds)
  moveSpeedMult: number;   // energy drink
  coinChance: number;      // coupon: chance of +1 coin per kill
  armor: number;           // bubble wrap: flat damage reduction (min 1 damage taken)
  invulnBonus: number;     // bubble wrap: extra seconds of post-hit invulnerability
  regen: number;           // HP per second during combat (snack bag)
  critHeal: number;        // free sample: HP healed per crit (capped per second)
  killCoinMult: number;    // piggy bank: multiplier on regular kill coins
  recipes: ActiveRecipe[];
  /** Set-bonus level per set (0/1/2), counted over distinct placed types. */
  sets: Record<SetId, 0 | 1 | 2 | 3>;
  priceMult: number;       // checkout L1: shop price multiplier
  shoveStun: number;       // tools L2: seconds the dash stuns (0 = off)
  /** Deduplicated adjacent pairs, uid order a < b. */
  adjacency: [string, string][];
}

export interface RecipeDef {
  id: RecipeId;
  name: string;
  weapon: ItemTypeId;
  supports: ItemTypeId[];
  short: string;     // one-line effect for compact combo cards
  summary: string;   // badge hover text
  detail: string;    // full shop explanation
}

export type EnemyBehavior = 'chase' | 'charger' | 'tank' | 'spitter' | 'swiper' | 'exploder' | 'splitter' | 'healer' | 'thief' | 'teleporter' | 'boss';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  blurb: string;           // Codex flavour + what it does
  behavior: EnemyBehavior;
  hp: number;
  speed: number;
  contactDamage: number;
  coins: number;
  radius: number;          // collision radius (smaller than art)
  knockbackResist: number; // 0..1
  /** Behavior tuning (seconds / world units). */
  tell: number;
  attackCooldown: number;
  attackRange: number;
  attackDamage: number;
  projectileSpeed: number;
  projectileLife: number;
  lungeSpeed: number;
  lungeTime: number;
  preferredDistance: number;
  arcDeg: number;
  /** Flat damage soaked off direct hits (Canned Beans). */
  armor?: number;
  /** Blocks player projectiles from the front (Cereal Box). */
  shield?: boolean;
  /** Leaves sticky puddles while walking (Bubble Gum). */
  trail?: boolean;
}

export interface WaveDef {
  index: number;        // 1-based
  duration: number;     // seconds; boss wave enrages after this
  boss: boolean;
  total: number;        // regular spawns this wave (boss wave: initial escort)
  mix: Partial<Record<EnemyId, number>>; // weights
  group: [number, number];
  hpScale: number;
  speedScale: number;
  /** Enemy contact/attack damage multiplier for this aisle. */
  dmgScale: number;
}

export interface ShopOffer {
  slot: number;
  type: ItemTypeId;
  price: number;
  sold: boolean;
  /** Offers can come pre-upgraded at higher shop levels. */
  tier: number;
  /** Double pack: price x1.5, counts twice for its family set. */
  double?: boolean;
}

export interface ShopState {
  offers: ShopOffer[];
  rerolls: number;       // rerolls done this shop
  repairUsed: boolean;
  freeRerollUsed: boolean;
  /** Carried over from the department just fought. */
  bias: ItemTypeId[];
  legendaryBonus: number;
  forceLegendary: boolean;
  /** Free rerolls granted by the aisle modifier (event). */
  bonusFreeRerolls: number;
  shopIndex: number;     // 1-based (after wave N)
}

export type Phase = 'title' | 'combat' | 'checkout' | 'shop' | 'route' | 'victory' | 'defeat';

export type DepartmentId = 'main' | 'frozen' | 'bakery' | 'electronics' | 'checkout' | 'clearance' | 'boss';
export type HazardKind = 'none' | 'ice' | 'vents' | 'cables' | 'conveyor';

export interface DepartmentDef {
  id: DepartmentId;
  name: string;
  short: string;            // HUD label, <= 11 chars
  danger: 0 | 1 | 2 | 3;
  hazard: HazardKind;
  blurb: string;            // door card: hazard line
  enemiesText: string;      // door card: enemy line
  rewardText: string;       // door card: reward line
  mix: Partial<Record<EnemyId, number>>; // multipliers on the wave mix weights
  hpMult: number;
  speedMult: number;
  countMult: number;
  coinMult: number;
  shopBias: ItemTypeId[];   // next shop: weight x DEPT_TUNING.biasWeight
  legendaryBonus: number;   // next shop: added to the loyalty legendary chance
  forceLegendary: boolean;  // next shop: at least one legendary offer, guaranteed
  electricalRate: number;   // in-fight attack-rate multiplier for electrical weapons (1 = none)
  breadHeal: boolean;
  theme: { floor: string; walls: string[]; sides: string[]; props: string[]; tint?: number; icon: string };
}

export interface CoinLogEntry { label: string; amount: number }

export interface RunStats {
  kills: number;
  coinsEarned: number;
  damageByWeapon: Record<string, number>;
  wavesCleared: number;
  timeSeconds: number;
  bossDefeated: boolean;
}

export interface RunState {
  phase: Phase;
  wave: number;            // current/last wave (1-based)
  hp: number;
  money: number;
  inventory: Inventory;
  build: Build;
  shop: ShopState | null;
  /** Loyalty Card level 1..4 — better offers; persists for the run. */
  shopLevel: number;
  /** Items allowed in this run's shops (meta-progression). Undefined = everything. */
  unlocked?: ItemTypeId[];
  /** Character chosen on the title screen. */
  starter: StarterId;
  weapon: StarterWeapon;
  /** Difficulty (0-based index into SHIFTS). */
  shift: number;
  /** Set when the player keeps going after beating the boss (endless aisles). */
  overtime?: boolean;
  /** Daily run (date-seeded, no voucher). */
  daily?: boolean;
  /** A loyalty voucher (+20 coins) was spent on this run. */
  voucher?: boolean;
  /** Theme (department) chosen on the start screen; fixed per run. */
  theme: DepartmentId;
  /** Department of the current / last aisle: the theme, or 'boss' on the boss aisle. */
  department: DepartmentId;
  /** Modifier of the current / last aisle (aisle 1 = 'none'). */
  modifier: ModifierId;
  /** Departments visited, in order (index 0 = aisle 1). */
  route: DepartmentId[];
  /** Modifiers per aisle, parallel to `route`. */
  mods: ModifierId[];
  /** Doors offered on the route screen, or null outside it. */
  doors: DoorId[] | null;
  /** Zone of the current / last aisle (null on clearance / boss). */
  zone: ZoneId | null;
  /** Zones per aisle, parallel to `route`. */
  zones: (ZoneId | null)[];
  /** Zone behind each offered door, parallel to `doors`. */
  doorZones: (ZoneId | null)[] | null;
  stats: RunStats;
  /** Itemized coin sources since last shop opened, for the receipt. */
  coinLog: CoinLogEntry[];
  nextUid: number;
  seed: number;
  /** Test Lab run (`?lab=1`): hand-built loadout, never touches meta progression. */
  lab?: boolean;
  /** Enemy types first met this run (for the end card). */
  labGod?: boolean;
  /** Department every lab aisle is forced into. */
  labDept?: DepartmentId;
  /** Modifier every lab aisle gets. */
  labMod?: ModifierId;
  /** Aisle event forced in every lab aisle ('random' = normal roll). */
  labEvent?: 'random' | 'none' | EventKind;
}

/** Test Lab setup (title menu); `aisle` 1..BOSS_WAVE, then overtime. */
export interface LabOpts {
  aisle: number; dept: DepartmentId; shift: number; starter: StarterId; weapon: StarterWeapon; money: number;
  cart: [number, number]; shelf: number; shopLevel: number; god: boolean; keep: boolean;
  event?: 'random' | 'none' | EventKind;
  mod?: ModifierId;
}

/** Result of a mutating rules operation. Never throws for gameplay-invalid input. */
export type OpResult = { ok: true } | { ok: false; reason: string };
