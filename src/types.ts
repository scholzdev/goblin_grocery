// Shared contracts. Pure data shapes only — no Phaser, no DOM.
import type { DoorId, ModifierId } from './data/modifiers';
import type { PunchCard } from './systems/contracts';
import type { EventKind } from './data/events';
import type { ZoneId } from './data/zones';
import type { DamageStats } from './systems/damageStats';
import type { AffinityMap, AffinityTag, BUFF_ORDER, ELEMENTS, ENEMY_BEHAVIORS, ENEMY_ORDER, FAMILIES, ITEM_ORDER, RECIPE_ORDER, SET_ORDER, STARTER_ORDER, THEME_ORDER } from './engine/define';

/** The id unions are derived from the order lists of engine/define.ts (which the registry checks against the content files). */
export type ItemTypeId = (typeof ITEM_ORDER)[number];

export type WeaponPattern = 'toast' | 'sweep' | 'burst' | 'pulse' | 'zap' | 'aura' | 'ricochet' | 'puddle' | 'laser' | 'mortar' | 'cone' | 'popcorn';
export type ItemKind = 'weapon' | 'module' | 'passive';
export type Rotation = 0 | 1 | 2 | 3;
export type RecipeId = (typeof RECIPE_ORDER)[number];
/** Set-bonus tags: one family per item, optional element; 'electric' = the `electrical` flag. See engine/define.ts (the lists) and data/sets.ts (the counting). */
export type FamilyTag = (typeof FAMILIES)[number];
export type ElementTag = (typeof ELEMENTS)[number];
export type SetId = (typeof SET_ORDER)[number];
/** Weapon role tags (shown on cards; Electric is the separate `electrical` flag). */
export type WeaponTag = 'ranged' | 'melee' | 'area';
export type BuffId = (typeof BUFF_ORDER)[number];
export type EnemyId = (typeof ENEMY_ORDER)[number];

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
  knockback?: number;      // cone: per-weapon knockback (default: the spray's 40)
  fx?: string;             // cone: texture of the spray/gust sprite (default 'fx_spray')
}

export interface ItemDef {
  id: ItemTypeId;
  kind: ItemKind;
  /** Base footprint, pre-rotation, as integer cells relative to origin (0,0). */
  cells: Cell[];
  price: number;
  electrical: boolean;
  family: FamilyTag;
  element?: ElementTag;
  weapon?: WeaponBase;
  /** Weapons only: role tag(s). */
  tags?: WeaponTag[];
  /** Legendary: unique effect, gold border, rare in shops, cannot be upgraded or merged. */
  legendary?: boolean;
  /** Never offered by a shop or crate (the Spent Key). */
  noShop?: boolean;
  /** Modules only: the elements its effect deals or applies (see `ItemContent.elements`). */
  elements?: readonly AffinityTag[];
  /** The item's hits shred armor (see `ItemContent.shreds`). */
  shreds?: boolean;
  /** Buff this module grants to adjacent weapons (if any). */
  buff?: BuffId;
  /** Jelly Beans: the instance's flavor is its element for set counting (`setsOf`). */
  flavored?: boolean;
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
  /** Jelly Beans only: current flavor (= which element set it counts for). Missing = heat. */
  flavor?: ElementTag;
  /** Sourdough Starter only: completed waves since bought / last rise (grows at 2). */
  rise?: number;
  /** Collector's Binder only: the family it was bought for, and how many of that family were sold since. */
  binderFamily?: FamilyTag;
  binderSold?: number;
  /** Active items only: uses left this aisle. Missing = full (`engine/actives.ts`); refilled by `startNextWave`. */
  charges?: number;
  /** Active items only: the key slot (1..3) the player picked by clicking the slot badge. Missing = automatic, by cart reading order. */
  slot?: number;
  /** Aisles completed since bought (placed only, or placed + shelf with `ItemContent.age: 'owned'`); Sourdough resets it on each rise. See `ageItems` (state/run.ts). */
  age?: number;
  /** Potted Basil: kills made by adjacent weapons. Persists across aisles, gone when the instance is sold. */
  kills?: number;
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
  bundle: number;          // distinct item types touching this weapon (Bundle Deal damage bonus)
  /** Party Popper: kills by this weapon explode (never chains from popper kills). */
  popper: { damage: number; radius: number } | null;
  /** Double Bag: each direct hit strikes again after the `delay` tune (src/content/items/doublebag.ts) for this fraction of the damage (0 = none). */
  echo: number;
  pierce: number;          // extra enemies a projectile may pass through (0 = hits one)
  burn: BurnEffect | null;
  /** Heat L2: chance to set a non-burning weapon's hit on fire. */
  ignite: { chance: number; burn: BurnEffect } | null;
  /** Electric set: chance per hit to arc to `chainJumps` nearby enemies (chained hits never re-chain). */
  chainChance: number;
  chainJumps: number;
  slow: SlowEffect | null;
  frostRing: boolean;
  buffs: BuffId[];         // distinct buffs applied (each at most once)
  /** Active combos on this weapon (a weapon can have several possible combos; all matching ones are active). */
  recipes: RecipeId[];
}

export interface ActiveRecipe {
  id: RecipeId;
  /** null for weaponless cart combos. */
  weaponUid: string | null;
  supportUids: string[];
}

export type StarterId = (typeof STARTER_ORDER)[number];
/** A goblin's passive signature (data/items `SIGNATURE`). */
export type SignatureId = 'firstCrit' | 'mergeHeal' | 'freeReroll' | 'dashCooldown';
/** Starting weapons selectable independently of the character. */
export type StarterWeapon = 'toaster' | 'pan' | 'nailgun';

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
  shoveKnockMult: number;  // bowling ball: dash knockback multiplier
  moveSpeedMult: number;   // energy drink
  stinkDps: number;        // expired milk: poison dps of the toxic aura around the cart (0 = off)
  regen: number;           // HP per second during combat (snack bag)
  killCoinMult: number;    // piggy bank: multiplier on regular kill coins
  recipes: ActiveRecipe[];
  /** Set-bonus level per set (0/1/2), counted over distinct placed types. */
  sets: Record<SetId, 0 | 1 | 2 | 3>;
  priceMult: number;       // checkout L1: shop price multiplier
  sellRate: number;        // share of an item's value a sale pays (0.5; Barter Stamp raises it)
  sellFullFamilies: FamilyTag[]; // families that sell at full value (Collector's Binder)
  /** Deduplicated adjacent pairs, uid order a < b. */
  adjacency: [string, string][];
}

/** What the game needs of a combo besides its text (`recipeT`): which items it takes. Derived from the content file by data/recipes. */
export interface RecipeDef {
  id: RecipeId;
  /** Omitted for cart combos: active when every other support touches the first one. */
  weapon?: ItemTypeId;
  supports: ItemTypeId[];
  /** Recipes this one overrides on the same weapon (they never apply while this one is active). */
  replaces?: RecipeId[];
  /** Module buffs this combo switches off on its weapon. */
  suppresses?: BuffId[];
}

export type EnemyBehavior = (typeof ENEMY_BEHAVIORS)[number];

export interface EnemyDef {
  id: EnemyId;
  name: string;            // English; the language-aware text is `enemyT` (i18n/data)
  blurb: string;           // English codex flavour + what it does
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
  /** Sprite scale on the field. */
  scale: number;
  /** The enemy's own behavior numbers (content `tune`): Spitter fan, Honey heal, egg blast ... Scalars. */
  tune: Readonly<Record<string, number>>;
  /** Affinity magnitudes per tag (engine/define.ts `AffinityMap`; the rules are in engine/affinity.ts). */
  weak?: AffinityMap;
  resist?: AffinityMap;
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
  /** Sourdough could not rise this shop visit (no room): shown once as a toast. */
  riseWait?: boolean;
  /** Shop lock: unsold offers carry over to the next shop at their price; reroll is refused. */
  locked: boolean;
}

export type Phase = 'title' | 'combat' | 'checkout' | 'shop' | 'route' | 'victory' | 'defeat';

/** The run themes (derived from `THEME_ORDER`); a department is a theme or the Manager's own `'boss'` one. */
export type ThemeId = (typeof THEME_ORDER)[number];
export type DepartmentId = ThemeId | 'boss';
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
  theme: { floor: string; walls: string[]; sides: string[]; props: string[]; icon: string };
}

export interface CoinLogEntry { label: string; amount: number }

export interface RunStats {
  kills: number;
  coinsEarned: number;
  damageByWeapon: Record<string, number>;
  /** Lab meter only: the HP each source actually took off enemies (`damageByWeapon` counts overkill). Set where the scene writes enemy HP. */
  removedByWeapon?: Record<string, number>;
  /** The rest of the run's damage breakdown (`systems/damageStats`). */
  damage: DamageStats;
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
  /** Offers of a locked shop, waiting for the next `openShop` (set by `startNextWave`). */
  shopLock?: ShopOffer[];
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
  /** Played by the dev autoplayer (src/bot): never touches the profile or the best receipts, like `lab`. */
  bot?: boolean;
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
  /** This aisle's Punch Card goal (systems/contracts); rolled when the aisle starts, a completed one pays the next shop a free reroll. */
  punch?: PunchCard;
  /** Aisle skipped through the Staff Only door, until the next aisle announces it. */
  skipped?: number;
  /** Aisles skipped through the Staff Only door, for the run's records (`route` / `mods` hold a placeholder for each). */
  skippedAisles?: number[];
  /** Lab dummy sandbox: no waves or timer, dummies spawned from a panel, shop ↔ arena on demand. */
  labSandbox?: boolean;
}

/** Test Lab setup: the title form, then the bench's Setup tab edits it live (`labApply`); `aisle` 1..BOSS_WAVE, then overtime. */
export interface LabOpts {
  aisle: number; dept: DepartmentId; shift: number; starter: StarterId; weapon: StarterWeapon; money: number;
  cart: [number, number]; shelf: number; shopLevel: number; god: boolean;
  event?: 'random' | 'none' | EventKind;
  mod?: ModifierId;
  sandbox?: boolean;
}

/** Result of a mutating rules operation. Never throws for gameplay-invalid input. */
export type OpResult = { ok: true } | { ok: false; reason: string };
