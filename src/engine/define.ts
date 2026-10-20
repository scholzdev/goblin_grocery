import type { Unlock } from '../data/unlocks';
import type { HookName, RuntimeHookMap } from './hooks';
import type { RuntimeCtx } from './ctx';
import type { ActiveRecipe, BuffId, Build, Cell, DepartmentId, ElementTag, EnemyBehavior, EnemyId, FamilyTag, Inventory, ItemDef, ItemInstance, ItemTypeId, Perk, RecipeId, SetId, StarterWeapon, WeaponBase, WeaponStats } from '../types';

// Content definitions for the item-hooks refactor (docs/item-hooks-refactor.md). Types only plus identity `define*` helpers:
// a content file is data (tune, text) and pure build behavior together. No Phaser, no DOM, no imports from data/*.

export type Lang = 'en' | 'de';
export interface Localized<T> { en: T; de: T }

// ---- tune -------------------------------------------------------------------------------------------------------------

/** One value per level (★1/★2/★3, or set level L1/L2/L3). */
export type TierTriple = readonly [number, number, number];
/** A scalar, or a per-tier array of exactly 3. Legendaries and combos are scalar only. */
export type TuneValue = number | TierTriple;
export type Tune = Readonly<Record<string, TuneValue>>;
/** A tune with every per-tier array resolved to one number. */
export type Resolved<T extends Tune> = { readonly [K in keyof T]: number };

/** `TIER.mult`: the multiplier of a ★-scaled bonus, ★1 = 1, +0.5 per tier, also above ★3 (Gold Star's ★4 = 2.5). */
export const tierMult = (tier: number): number => 1 + 0.5 * (tier - 1);

// ---- id lists ---------------------------------------------------------------------------------------------------------
// The registry collects content by filename (src/content/<kind>/<id>.ts), which is not the order the game iterates in. These lists are
// that order, and the id unions of types.ts (ItemTypeId, RecipeId, SetId, ...) are derived from them. The registry fails to load when
// a content file is not listed here, or a listed id has no file: a new item/combo is a file plus one entry.

/** Every item, in the order of the shop's rolls and the UI lists (a shop roll walks this list, so reordering it changes every seeded run). */
export const ITEM_ORDER = [
  'toaster', 'pan', 'nailgun', 'vacuum', 'fan', 'fuel', 'battery', 'magnet', 'ice', 'hotsauce', 'lunchbox', 'bell', 'boot', 'bumper', 'sparewheel', 'tipjar', 'flag',
  'microwave', 'blender', 'fizz', 'mop', 'pricegun', 'tape', 'coupon', 'bubblewrap', 'energy', 'fortune', 'sample', 'piggy', 'expiredmilk', 'tinfoilhat', 'jellybeans',
  'leafblower', 'sourdough', 'powerstrip', 'goldstar', 'laser', 'snackbag', 'cooker', 'spray', 'popper', 'doublebag', 'multipack', 'canopener', 'decaf',
  'expiredcoupon', 'popcorn', 'sparklers', 'barter', 'binder',
  'fireextinguisher', 'airhorn',
  'avocado', 'fish', 'basil', 'scoby',
  'snowcone', 'moldybread',
  'bowlingball', 'balloon', 'ghostpepper', 'scratchticket',
  'punchcard', 'shortcut', 'spentkey',
] as const;

/** Every combo, in the order `computeBuild` applies the matching ones (it decides which combo hook runs first on a weapon) and the codex lists them. */
export const RECIPE_ORDER = [
  'toastMode', 'nailstorm', 'coldStorage', 'expressCheckout', 'brainFreeze', 'tvDinner', 'clearanceSale', 'greaseFire', 'pressurePoint', 'mistMachine',
  'fiveAlarm', 'sizzlingSkillet', 'chickenDinner', 'frostbiteNails', 'staticCling', 'reheat', 'smoothieShield', 'confettiCannon', 'blackIce', 'shrapnel',
  'pressureWasher', 'powerSurge', 'potSlam', 'priceCheck', 'sugarRush', 'smashBank', 'bagIt', 'sourMist', 'sparksFly', 'rayGun', 'tailwind', 'crackOpen',
  'fireworksShow', 'kettleCorn', 'freshBread', 'liveWire', 'thunderstorm', 'slushie',
] as const;

/**
 * Every enemy, in the order of `ENEMIES` (the lab's spawn palette lists it), the regular groceries first, Melon Slice (a spawn of the Watermelon) last of them, then the
 * five bosses. A new enemy is a file `src/content/enemies/<id>.ts` plus one entry here; the registry fails at load if the two disagree.
 */
export const ENEMY_ORDER = [
  'milk', 'banana', 'soda', 'spitter', 'baguette', 'egg', 'melon', 'turkey', 'beans', 'cereal', 'honey', 'giftcard', 'expired', 'gum', 'slice',
  'boss', 'boss_frozen', 'boss_bakery', 'boss_electronics', 'boss_checkout',
  'sanitizer',
] as const;

/** The module buffs, in the order the `module` build phase applies them to a weapon (a module item's `build.order` must follow it: 10, 20, ...). */
export const BUFF_ORDER = ['fan', 'fuel', 'battery', 'ice', 'hotsauce', 'pricegun', 'tape', 'popper', 'echo', 'multipack'] as const;

/** Set-bonus tags: one family per item (its `sets[0]`), an optional element (`sets[1]`); the `electrical` flag adds the 'electric' set. */
export const FAMILIES = ['kitchen', 'cleaning', 'tools', 'snacks', 'checkout'] as const;
export const ELEMENTS = ['heat', 'frost', 'blast'] as const;
/** Every set, in the order the shop lists them and `setLevels` reports them. */
export const SET_ORDER = [...FAMILIES, ...ELEMENTS, 'electric'] as const;
/** The departments a run can be themed after (the boss aisle's own `'boss'` department is not a theme). `ThemeId` / `DepartmentId` of types.ts are derived from this. */
export const THEME_ORDER = ['main', 'frozen', 'bakery', 'electronics', 'checkout'] as const;
/** The starter goblins (`StarterId` of types.ts is derived from this). */
export const STARTER_ORDER = ['toaster', 'pan', 'coupon', 'night'] as const;
/** Pure math the pattern code shares with content (Phaser's `Angle.Wrap`, to the bit: content may not import Phaser). Wraps to [-PI, PI). */
export const wrapAngle = (a: number): number => {
  const min = -Math.PI, range = Math.PI - min;
  return min + ((((a - min) % range) + range) % range);
};

/** Weapon tiers (`TIER.weaponDamage` / `TIER.weaponCooldown`): a ★n weapon deals this x its base damage and waits this x its base cooldown. */
export const weaponDamageMult = (t: number): number => 1 + 0.5 * (t - 1);
export const weaponCooldownMult = (t: number): number => 1 - 0.1 * (t - 1);

/** Distinct item types for set level 1/2/3 (the same for every set; each level includes the lower ones). */
export const SET_THRESHOLDS: readonly [number, number, number] = [2, 3, 4];

/** The flavors a Jelly Beans instance can take (rerolled every shop visit). */
export const FLAVORS: readonly ElementTag[] = ELEMENTS;
/** Flavor of an instance (a missing one = heat). */
export const flavorOf = (p: Pick<ItemInstance, 'flavor'>): ElementTag => p.flavor ?? 'heat';

/**
 * Value of one tune entry at `tier`. Arrays hold ★1..★3. Above ★3 (Gold Star lifts a ★3 module to an effective ★4) the last
 * step is continued linearly, which is exactly what `TIER.mult` does. Below ★1 clamps to ★1.
 */
export function tuneValue(v: TuneValue, tier: number): number {
  if (typeof v === 'number') return v;
  if (tier <= 1) return v[0];
  if (tier <= 3) return v[tier - 1];
  return v[2] + (v[2] - v[1]) * (tier - 3);
}

export function resolveTune<T extends Tune>(tune: T | undefined, tier: number): Resolved<T> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(tune ?? {})) out[k] = tuneValue(v, tier);
  return out as Resolved<T>;
}

// ---- shape ------------------------------------------------------------------------------------------------------------

/** `'2x1'` = a full 2-wide, 1-high rectangle, or explicit cells (see `cells()` for the `shape()` row helper). */
export type Shape = `${number}x${number}` | readonly Cell[];

export function resolveShape(s: Shape): Cell[] {
  if (typeof s !== 'string') return s.map((c) => ({ x: c.x, y: c.y }));
  const [w, h] = s.split('x').map(Number);
  const out: Cell[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x, y });
  return out;
}

/** Same as `shape(...)` in data/items.ts: rows of `#` (filled) and anything else (empty). */
export const cells = (...rows: string[]): Cell[] => rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === '#' ? [{ x, y }] : [])));

// ---- weapons ----------------------------------------------------------------------------------------------------------

/** A weapon's base stats with the defaults every pattern shares. */
export const weaponBase = (w: Partial<WeaponBase> & Pick<WeaponBase, 'pattern' | 'damage' | 'cooldown' | 'range'>): WeaponBase => ({
  projectileSpeed: 0, count: 1, burstInterval: 0, arcDeg: 0, pull: 0, tick: 0, duration: 0, bounces: 0, chain: 0, aoe: 0, ...w,
});

/**
 * The per-tier `damage` / `cooldown` tune entries of a weapon (the shop row and the rules text): the base stat times the tier
 * multiplier, with the exact expression `computeBuild` uses, so the displayed number is the stat. Legendary weapons (one tier) use scalars instead.
 */
export const weaponTiers = (w: Pick<WeaponBase, 'damage' | 'cooldown'>): { damage: TierTriple; cooldown: TierTriple } => ({
  damage: [w.damage * weaponDamageMult(1), w.damage * weaponDamageMult(2), w.damage * weaponDamageMult(3)],
  cooldown: [w.cooldown * weaponCooldownMult(1), w.cooldown * weaponCooldownMult(2), w.cooldown * weaponCooldownMult(3)],
});

// ---- build hooks ------------------------------------------------------------------------------------------------------

/**
 * Pure stat phases, in the order `computeBuild` runs them (docs/item-hooks-refactor.md §4a).
 * Weapon hooks (`weapon`) run once per weapon at the phase's position. `module` is special: it runs inside the BUFF_ORDER loop,
 * per touching buff, with the highest effective tier of that buff. Player hooks (`player`) always run at the very end.
 */
/** Weapon patterns that fire projectiles (Desk Fan speed, Duct Tape pierce, Multipack extra shots). */
export const PROJECTILE_PATTERNS: ReadonlySet<string> = new Set(['toast', 'burst', 'ricochet']);

export type BuildPhase = 'base' | 'module' | 'flavor' | 'global-mod' | 'set' | 'combo' | 'post-combo' | 'final';
export const BUILD_PHASES: readonly BuildPhase[] = ['base', 'module', 'flavor', 'global-mod', 'set', 'combo', 'post-combo', 'final'];

/** What a build hook may read. Built by `engine/build.ts` from the values `computeBuild` already has. */
export interface BuildCtx<T extends Tune = Tune> {
  /** Effective tier of the owner: Gold Star included for modules/passives; the weapon's own tier in `base`; the level for sets; 1 for combos. */
  readonly tier: number;
  /** The owner's `tune` resolved for `tier` (arrays picked per tier, continued linearly above ★3). */
  tune(): Resolved<T>;
  /** Does an instance of the owner item touch this weapon? Always true for combos and sets. */
  touches(weapon: { uid: string }): boolean;
  /** Placed instances of the owner item touching this weapon, each with its effective tier (and its flavor/rise on `instance`). */
  touching(weapon: { uid: string }): { instance: Inventory['placed'][number]; tier: number }[];
  /** Highest effective tier of `id` anywhere in the cart (0 = not placed). */
  owned(id: ItemTypeId): number;
  /**
   * Another content item's tune resolved at `tier` (content may not import the registry). Empty for an item that is not content.
   * Jelly Beans reads the Fuel Can / Ice Pack / Party Popper numbers this way.
   */
  tuneOf(id: ItemTypeId, tier: number): Readonly<Record<string, number>>;
  /** Effective number of distinct item types in a set (a double pack counts 2 in its family). */
  count(set: SetId): number;
  /** Level (0..3) of a set. */
  level(set: SetId): 0 | 1 | 2 | 3;
  /** The item's plain definition (family, element, electrical, base weapon stats). */
  def(id: ItemTypeId): ItemDef;
  /** Combos active in the finished build. Only filled for player hooks. */
  readonly active: readonly ActiveRecipe[];
  /** Arc (degrees) the weapon gained from utilities (Duct Tape) before the combos ran: a combo that sets the arc keeps it on top (Pressure Washer). 0 in player hooks. */
  readonly tapeArc: number;
  readonly cart: Inventory;
  /** Cart weight (systems/weight.ts): the occupied cells, and the ones that still slow the goblin (items touching a Helium Balloon are weightless). Only the Bowling Ball reads it. */
  readonly weight: { readonly cells: number; readonly slow: number };
  readonly perk: Perk;
}

export interface BuildSpec<T extends Tune = Tune> {
  phase: BuildPhase;
  /** Position among hooks of the same phase (default 0, ties: file order). In `module` it must follow BUFF_ORDER. */
  order?: number;
  /**
   * Edit one weapon's stats. In `module`, returning `false` means "did not apply" (the buff is not recorded in
   * `stats.buffs`).
   */
  weapon?(stats: WeaponStats, c: BuildCtx<T>): void | false;
  /** Edit the finished player build (max HP, pickup radius, shove, ...). Runs after every weapon, in `order`. */
  player?(build: Build, c: BuildCtx<T>): void;
}

// ---- runtime hooks ----------------------------------------------------------------------------------------------------

/** Every combat hook, in the order a table lists them (the typed payloads are in engine/hooks.ts, the API in engine/ctx.ts). */
export const HOOK_NAMES: readonly HookName[] = [
  'onAisleStart', 'onTick', 'modifyDamage', 'onHit', 'afterHit', 'onCrit', 'onKill', 'afterKill', 'onDashStart', 'onDashHit', 'onDashEnd', 'onEnemyShotTouch', 'onPlayerHit', 'onCoinPickup',
  'pattern:sweep', 'pattern:explode', 'pattern:zap', 'pattern:bounce', 'pattern:shotHit', 'pattern:shotMove', 'pattern:beam', 'pattern:fire', 'pattern:pulse', 'pattern:cone', 'pattern:puddleEnter', 'pattern:aura', 'pattern:look',
];

/**
 * `hooks` of a content file: the combat hooks of docs/item-hooks-refactor.md §4c, each `(event, ctx, c)` where `c` carries the
 * owner's tier and `tune()` (`HookCtx`). `order` positions all of this owner's hooks among the others (default 0, ties: registration
 * order: items, combos, sets). There are no run-lifecycle hooks: what happens between aisles (Sourdough's rise, Jelly Beans' reroll, the
 * Checkout interest) is in state/run.ts and reads the content tune.
 */
export type RuntimeHooks<T extends Tune = Tune> = RuntimeHookMap<T> & { order?: number };

// ---- text and rows ----------------------------------------------------------------------------------------------------

/** Text may use `{key}` / `{key|fmt}` placeholders for any `tune` key (see engine/text.ts). */
export interface ItemText {
  name: string; blurb: string; rules: string;
  /** A weapon's ★3 behavior: one line `itemRules` appends to the rules from ★3 on (★1/★2 text stays without it). */
  star3?: string;
}
export interface ComboText { name: string; short: string; summary: string; detail: string }
/** `bonus[0..2]` = the L1/L2/L3 bonus line; placeholders resolve at that level. */
export interface SetText { name: string; bonus: readonly [string, string, string] }

/** One row of the shop's per-level scaling table: the values at ★1/★2/★3 of `tune[key]`, formatted with `fmt` (default `n`). */
export interface RowSpec<T extends Tune = Tune> { label: Localized<string>; key: keyof T & string; fmt?: string }

/** The two scaling rows every weapon shows (Damage / Interval). Needs `damage` and `cooldown` tune entries ({@link weaponTiers}). */
export const WEAPON_ROWS: readonly RowSpec<{ damage: TierTriple; cooldown: TierTriple }>[] = [
  { label: { en: 'Damage', de: 'Schaden' }, key: 'damage' },
  { label: { en: 'Interval', de: 'Intervall' }, key: 'cooldown', fmt: 's' },
];

// ---- shop metadata (typed, not wired until the item that needs it moves) ----------------------------------------------

export type ItemUnlock = 'starting' | (Omit<Extract<Unlock, { kind: 'item' }>, 'id' | 'kind' | 'item' | 'need'> & { need: Localized<string> });
/** Replaces the `ENHANCES` table in systems/shop.ts: when does the shop favor this item for the current cart? */
export type EnhancedBy = 'always' | 'anyWeapon' | readonly ItemTypeId[]; // an array = "any of these is owned"

// ---- content ----------------------------------------------------------------------------------------------------------

/**
 * An active item ("spell"): the E key spends one charge of every instance in the cart that has one left (engine/actives.ts). The item's
 * `tune.charges` is the charges per aisle at ★1..★3 and the only thing the engine reads; every other number of the effect is also in `tune`.
 */
export interface ActiveSpec<T extends Tune = Tune> {
  use(ctx: RuntimeCtx, c: { readonly tier: number; tune(): Resolved<T>; /** The instance's uid (= its weapon uid when the item is a weapon). */ readonly uid: string }): void;
}

export interface ItemContent<T extends Tune = Tune> {
  id: ItemTypeId;
  kind: ItemDef['kind'];
  /** `[family, element?]`, as `ItemDef.family` / `ItemDef.element`. The `electrical` flag adds the Electric set. */
  sets: readonly [FamilyTag] | readonly [FamilyTag, ElementTag];
  /** Static, or a function of the tier (Sourdough). `ITEMS[id].cells` is the ★1 footprint. */
  shape: Shape | ((tier: number) => Shape);
  price: number;
  electrical?: boolean;
  /**
   * Weapons and modules: extra hit elements the item's own effect deals or applies, beyond its sets. A module's sets only say which set it counts
   * toward (Hot Sauce is Heat but adds plain damage), so Fuel Can names its burn `heat`, Ice Pack its slow `frost`, Party Popper its pop `blast`.
   * A weapon adds what its sets cannot say: Laser and Blender are `electric` (the `electrical` flag only makes an item count toward the Electric
   * set, it adds no tag). Read by every hit's tags and the shop's "Strong vs" (`weaponTags` / `itemTags`, engine/hitTags.ts).
   */
  elements?: readonly AffinityTag[];
  /** Modules: the item's hits shred armor, so the shop card's "Strong vs" adds the armored chip (`ui/affinity.ts`). */
  shreds?: boolean;
  legendary?: boolean;
  /** Never offered by a shop or crate (the Spent Key). */
  noShop?: boolean;
  /** Weapons only. */
  tags?: ItemDef['tags'];
  weapon?: ItemDef['weapon'];
  /** Modules: the buff this item grants to touching weapons (= its BUFF_ORDER entry). */
  buff?: ItemDef['buff'];
  unlock?: ItemUnlock;
  /**
   * Jelly Beans: the instance's current flavor (`ItemInstance.flavor`, rerolled every shop visit) is its element, so it counts toward
   * that element's set. Only for items without a static element (`sets` has just the family). Read by `setsOf` (data/sets).
   */
  flavored?: boolean;
  /**
   * Counts aisles on `ItemInstance.age` (`ageItems`, state/run.ts): 'cart' = only while placed (Avocado, Fresh Fish, Scoby, Basil),
   * 'owned' = also on the shelf (Sourdough Starter).
   */
  age?: 'cart' | 'owned';
  /** Replaces the base sell price for this instance (Avocado: grows while fresh, 1 coin once brown). Read by `sellValue` (systems/shop.ts). */
  sellValue?: (base: number, i: ItemInstance, tune: Resolved<T>) => number;
  /** Instances for which the art switches to the `icon_<id>_<look>` variant (spoiled Avocado / Fish); `assetFor` (data/assets.ts). */
  look?: (i: ItemInstance, tune: Resolved<T>) => string | null;
  /** Scalars, or per-tier arrays of 3. Legendaries are ★1 only: scalars. */
  tune?: T;
  text: Localized<ItemText>;
  /** Shop scaling rows. Default: one row per array-valued tune key, labelled with the key. */
  rows?: readonly RowSpec<T>[];
  build?: BuildSpec<T>;
  /** Combat hooks (onHit, onKill, pattern:sweep ...): see RuntimeHooks. */
  hooks?: RuntimeHooks<T>;
  /** E-key active, see `ActiveSpec`. Needs a `charges` tune entry. */
  active?: ActiveSpec<T>;
  /** More hooks for other phases when one item needs two (Multipack: `module` damage + `post-combo` count). Never `module`. */
  extraBuild?: readonly BuildSpec<T>[];
  shopBias?: readonly DepartmentId[];
  enhancedBy?: EnhancedBy;
  starterGuarantee?: readonly StarterWeapon[];
  /**
   * Gold Star: placed items touching one of these work `tune[key]` effective tiers higher. Read by `eff()` in computeBuild and
   * `describeBuffs`, through `tierBoostOf` (engine/build.ts). No chaining (it lifts the touching item once, however many
   * boosters touch it), and never the kinds listed in `excludes`.
   */
  tierBoost?: { key: keyof T & string; excludes: readonly ('weapon' | 'legendary')[] };
}

export interface ComboContent<T extends Tune = Tune> {
  id: RecipeId;
  /** Every part, weapon first. For `cart` combos there is no weapon: the first part anchors the rest. */
  requires: readonly ItemTypeId[];
  cart?: boolean;
  /** Combos this one overrides on the same weapon (Ray Gun replaces Nailstorm). */
  replaces?: readonly RecipeId[];
  /** Module buffs this combo switches off on its weapon (Mist Machine suppresses the Desk Fan): `computeBuild` skips those modules there. */
  suppresses?: readonly BuffId[];
  /** Scalars only (a combo has no tier). */
  tune?: T;
  text: Localized<ComboText>;
  /** Combos run in the `combo` phase, inside the per-recipe loop, in RECIPE_ORDER (`data/recipes.ts`). A combo with no stat effect has no `build`. */
  build?: BuildSpec<T>;
  /** Combat hooks, active while the combo is: see RuntimeHooks. */
  hooks?: RuntimeHooks<T>;
}

export interface SetContent<T extends Tune = Tune> {
  id: SetId;
  /** Arrays are L1/L2/L3: `c.tune()` / the rendered text pick the entry of the set's level. */
  tune?: T;
  text: Localized<SetText>;
  /**
   * Phase `set`, `post-combo` or `final`. `tier` = the set level; hooks only run when the level is above 0. `order` positions the hook
   * among the others of its phase (items first on ties): the set weapon hooks run kitchen 10, cleaning 20, tools 30, heat 40, blast 50,
   * electric 60 in `set`, frost in `post-combo` after every item.
   */
  build?: BuildSpec<T>;
  /** More hooks for other phases when a set needs two (Tools: `set` cooldown + `final` dash damage). */
  extraBuild?: readonly BuildSpec<T>[];
  /** Combat hooks, active while the set level is above 0 (`c.tier` = level): see RuntimeHooks. */
  hooks?: RuntimeHooks<T>;
}

/** Identity helpers: they only check and infer types. `const T` keeps per-tier arrays as tuples. */
export const defineItem = <const T extends Tune = Tune>(def: ItemContent<T>): ItemContent<T> => def;
export const defineCombo = <const T extends Tune = Tune>(def: ComboContent<T>): ComboContent<T> => def;
export const defineSet = <const T extends Tune = Tune>(def: SetContent<T>): SetContent<T> => def;

// ---- enemies ----------------------------------------------------------------------------------------------------------

/**
 * What an enemy can be weak to or resist (the element soft counters, docs/item-hooks-refactor.md "Affinity"). `heat`, `frost`, `electric`, `blast`,
 * `cleaning` and `poison` are hit tags (derived per hit by `engine/hitTags.ts`); `mark` is the Price Check / Sale Flag mark bonus.
 */
export const AFFINITY_TAGS = ['heat', 'frost', 'electric', 'blast', 'cleaning', 'poison', 'mark'] as const;
export type AffinityTag = (typeof AFFINITY_TAGS)[number];
/**
 * An enemy's `weak` / `resist`: the per-tag MAGNITUDE (a positive fraction, not a multiplier). `weak: { heat: 0.3 }` takes +30% damage from heat hits
 * and ×`AFFINITY.weakDuration` status time of heat; `resist: { frost: 0.3 }` takes −30% and ×`AFFINITY.resistDuration`. A boss weak uses 0.4. For
 * `mark` the value scales the mark's bonus instead: `weak: { mark: 1 }` doubles it (×1.2 becomes ×1.4). A tag is never both weak and resist.
 */
export type AffinityMap = Partial<Record<AffinityTag, number>>;

/**
 * The one place the soft-counter numbers live (tunable). Enemy files use the magnitudes (`weak`, `bossWeak`, `resist`, `markWeak`), the engine
 * (`engine/affinity.ts`) the durations and the stagger.
 */
export const AFFINITY = {
  /** Magnitude of a regular enemy's weakness (+30% damage). */
  weak: 0.3,
  /** Magnitude of a boss's weakness (+40% damage). */
  bossWeak: 0.4,
  /** Magnitude of a resistance (−30% damage), regular enemies and bosses. */
  resist: 0.3,
  /** The Manager's weak mark: the mark bonus is scaled by 1 + this (1 doubles it: ×1.2 becomes ×1.4). */
  markWeak: 1,
  /** Status duration (burn, slow, poison, frost/electric stuns) against a weak / resisting enemy. The dps and the slow percentage are never scaled. */
  weakDuration: 1.5,
  resistDuration: 0.5,
  /** A boss or mini-boss hit on its weak tag may stagger: a short stun in its walk state only, at most once per `cooldown` seconds per boss. */
  stagger: { time: 0.25, cooldown: 4 },
} as const;

/**
 * Shred (docs/item-hooks-refactor.md "Shred"): an enemy status that strips armor. Each stack is -1 armor against direct hits, so on an armored
 * enemy it soaks less and on an unarmored one it ADDS damage, flat per stack but never more than `bonusShare` of the hit. Stacks add up to `cap`,
 * share one timer (refreshed to the later end by every application) and expire together. No element tag: affinity does not touch it, bosses are not immune.
 */
export const SHRED = { cap: 3, duration: 4, bonusShare: 0.5 } as const;

/**
 * Weaken (docs/item-hooks-refactor.md "Weaken"): an enemy status that cuts the damage it deals to the player (contact, melee and its projectiles; hazards are not
 * its damage). The percentage is capped at `cap`; the strongest running one wins, the end is the later of the two. No element tag: affinity does not touch it,
 * bosses are not immune.
 */
export const WEAKEN = { cap: 0.5 } as const;

/**
 * Wet (docs/item-hooks-refactor.md "Wet"): an enemy status that does nothing on its own and makes the elements react. `duration` is the default seconds a source
 * gives (refresh to the later end). While wet: an `electric` hit deals x`electricMult`; an Electric chain / Microwave zap that starts on the enemy gets
 * `chainBonus` more hops; a frost slow gets `frostSlowBonus` more points (never pushed past `slowCap`, the Frost set's L3 cap, and never lowered);
 * the Frost freeze chance is x`freezeChanceMult`; a burn lasts x`burnDurationMult` and dries the enemy (steam). No affinity tag, bosses are not immune.
 * (The wet-floor event's own constant is `EVENTS.wetFloor`, unrelated.)
 */
export const WET_STATUS = { duration: 3, electricMult: 1.2, chainBonus: 1, frostSlowBonus: 0.1, freezeChanceMult: 2, burnDurationMult: 0.5, slowCap: 0.7 } as const;

/** The element reactions (`engine/reactions.ts`, `ReactionId` is derived from this list). */
export const REACTION_IDS = ['shatter', 'fumes', 'conduct', 'crack', 'iceSheet', 'detonate'] as const;
export type ReactionId = (typeof REACTION_IDS)[number];

/**
 * Element reactions (docs/item-hooks-refactor.md "Reactions"): a status or hit that meets a status already on the enemy sets off a burst. One cooldown for all
 * of them, per enemy. `shatter` (burn + frosted): `flat` + `share` of the triggering hit's damage on that enemy; it also has its own longer per-enemy `cooldown` (s). `fumes` (burn + poison): a poison cloud of
 * `radius` that lives `duration` s, ticks every `tick` s and poisons the OTHER enemies in it for `poisonDuration` s. `conduct` (wet + an electric hit): `hops` hits of
 * `share` of the hit along the nearest enemies. `crack` (shred at the cap + a blast hit): `targets` enemies within `radius` take `share` of the hit and `shred` stacks.
 * `iceSheet` (wet + a frost hit that did not freeze): the enemy slides helplessly for `slide` s at `speed` px/s and takes `slam` damage when it hits a wall, a prop or another enemy.
 * `detonate` (poisoned + a blast hit): eats the poison; everything within `radius` takes its poison dps x the seconds it had left.
 */
export const REACTIONS = {
  cooldown: 1,
  shatter: { flat: 8, share: 0.5, cooldown: 3 },
  fumes: { radius: 60, duration: 2, tick: 0.5, poisonDuration: 2 },
  conduct: { hops: 3, share: 0.6 },
  crack: { targets: 3, radius: 90, share: 0.5, shred: 1 },
  iceSheet: { slide: 1.5, slam: 12, speed: 260 },
  detonate: { radius: 70 },
} as const;

/** The enemy behaviors (`EnemyBehavior` of types.ts is derived from this list). */
export const ENEMY_BEHAVIORS = ['chase', 'charger', 'tank', 'spitter', 'swiper', 'exploder', 'splitter', 'healer', 'thief', 'teleporter', 'boss'] as const;

/** Boss move loop entries. 'special' runs the kit's signature move (BossKit.special). */
export type BossMove = 'volley' | 'charge' | 'summon' | 'special';
export const BOSS_MOVES: readonly BossMove[] = ['volley', 'charge', 'summon', 'special'];
/** Signature moves: slush = slowing ice puddles dropped on marked circles; ring = radial shot burst; lanes = telegraphed live-cable strips; belt = conveyor shoves you toward the boss. */
export type BossSpecial = 'slush' | 'ring' | 'lanes' | 'belt';
/** The `tune` keys each signature move needs on its boss (the validator checks them; the numbers are in the boss's file). */
export const BOSS_SPECIAL_KEYS: Readonly<Record<BossSpecial, readonly string[]>> = {
  slush: ['spots', 'radius', 'scatter', 'life', 'rMult'],
  ring: ['shots', 'speed', 'life', 'halfExtra'],
  lanes: ['count', 'gap', 'width'],
  belt: ['speed', 'time'],
};
/** A boss's move set: the loop it walks through, the texture of its shots, its signature move and its volley / summon numbers. */
export interface BossKit {
  cycle: BossMove[];
  /** Texture of the volley / ring shots. */
  shot: string;
  special?: BossSpecial;
  /** Volley / summon numbers (shift bonuses are added on top for aisle-8 bosses; mini-bosses use them as is). */
  moves: { volleyCount?: number; volleySpreadDeg?: number; summonCount?: number; summonTypes?: EnemyId[] };
}

/** The numbers every enemy has (missing ones are 0). `armor` / `shield` / `trail` are flags of a few. */
export interface EnemyStats {
  hp: number;
  speed: number;
  contactDamage: number;
  coins: number;
  /** Collision radius (smaller than the art). */
  radius: number;
  /** 0..1 */
  knockbackResist?: number;
  /** Flat damage soaked off direct hits (Canned Beans). */
  armor?: number;
  /** Blocks player projectiles from the front (Cereal Box). */
  shield?: boolean;
  /** Leaves sticky puddles while walking (Bubble Gum). */
  trail?: boolean;
  /** Behavior tuning (seconds / world units). */
  tell?: number;
  attackCooldown?: number;
  attackRange?: number;
  attackDamage?: number;
  projectileSpeed?: number;
  projectileLife?: number;
  lungeSpeed?: number;
  lungeTime?: number;
  preferredDistance?: number;
  arcDeg?: number;
}
export const ENEMY_STAT_KEYS: readonly (keyof EnemyStats)[] = [
  'hp', 'speed', 'contactDamage', 'coins', 'radius', 'knockbackResist', 'armor', 'shield', 'trail',
  'tell', 'attackCooldown', 'attackRange', 'attackDamage', 'projectileSpeed', 'projectileLife', 'lungeSpeed', 'lungeTime', 'preferredDistance', 'arcDeg',
];

/** Codex text. Placeholders resolve against the enemy's `tune` and its numeric stats (see {@link enemyTextTune}). */
export interface EnemyText { name: string; blurb: string }

export interface EnemyContent<T extends Tune = Tune> {
  id: EnemyId;
  behavior: EnemyBehavior;
  /** Sprite scale on the field (the art is drawn bigger than the collision radius). */
  scale: number;
  stats: EnemyStats;
  /** Numbers that belong to this enemy's behavior only (a Spitter's fan, a Honey Jar's heal, the egg blast ...). Scalars: an enemy has no tiers. */
  tune?: T;
  /** Health bar once damaged (never at full HP, to avoid clutter). Elites always show theirs. */
  hpBar?: boolean;
  /** Affinity (see {@link AffinityMap}): magnitudes per tag; `weak` takes more damage and longer statuses of that tag, `resist` less and shorter. */
  weak?: AffinityMap;
  resist?: AffinityMap;
  text: Localized<EnemyText>;
  /** Bosses only (behavior 'boss'): the department whose aisle-8 boss this is, and the move set. A boss's `tune` holds its signature move's numbers (BOSS_SPECIAL_KEYS). */
  boss?: { theme: DepartmentId; kit: BossKit };
}

/** What `{key}` in an enemy's text can name: its numeric stats (armor ...), overridden by its `tune`. */
export const enemyTextTune = (c: Pick<EnemyContent, 'stats' | 'tune'>): Tune => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(c.stats)) if (typeof v === 'number') out[k] = v;
  return { ...out, ...c.tune };
};

export const defineEnemy = <const T extends Tune = Tune>(def: EnemyContent<T>): EnemyContent<T> => def;
