import type { Unlock } from '../data/unlocks';
import type { HookName, RuntimeHookMap } from './hooks';
import type { ActiveRecipe, Build, Cell, DepartmentId, ElementTag, FamilyTag, Inventory, ItemDef, ItemInstance, ItemTypeId, Perk, RecipeId, SetId, StarterWeapon, WeaponStats } from '../types';

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

/** `TIER.mult` (data/items re-exports it): the multiplier of a ★-scaled bonus, ★1 = 1, +0.5 per tier, also above ★3 (Gold Star's ★4 = 2.5). */
export const tierMult = (tier: number): number => 1 + 0.5 * (tier - 1);

/** The flavors a Jelly Beans instance can take (rerolled every shop visit). */
export const FLAVORS: readonly ElementTag[] = ['heat', 'frost', 'blast'];
/** Flavor of an instance (a missing one = heat). Re-exported by data/sets. */
export const flavorOf = (p: Pick<ItemInstance, 'flavor'>): ElementTag => p.flavor ?? 'heat';

/**
 * Value of one tune entry at `tier`. Arrays hold ★1..★3. Above ★3 (Gold Star lifts a ★3 module to an effective ★4) the last
 * step is continued linearly, which is exactly what `TIER.mult` does for the legacy tables. Below ★1 clamps to ★1.
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

// ---- build hooks ------------------------------------------------------------------------------------------------------

/**
 * Pure stat phases, in the order `computeBuild` runs them (docs/item-hooks-refactor.md §4a).
 * Weapon hooks (`weapon`) run once per weapon at the phase's position. `module` is special: it runs inside the BUFF_ORDER loop,
 * per touching buff, with the highest effective tier of that buff. Player hooks (`player`) always run at the very end.
 */
/** Weapon patterns that fire projectiles (Desk Fan speed, Duct Tape pierce, Multipack extra shots). Re-exported by data/items. */
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
  /** The legacy item definition (family, element, electrical, base weapon stats). */
  def(id: ItemTypeId): ItemDef;
  /** Combos whose parts all touch the weapon being built (before `replaces` filtering). Empty for player hooks. */
  readonly matching: readonly RecipeId[];
  /** Combos active in the finished build. Only filled for player hooks. */
  readonly active: readonly ActiveRecipe[];
  readonly cart: Inventory;
  readonly perk: Perk;
}

export interface BuildSpec<T extends Tune = Tune> {
  phase: BuildPhase;
  /** Position among hooks of the same phase (default 0, ties: file order). In `module` it must follow BUFF_ORDER. */
  order?: number;
  /**
   * Edit one weapon's stats. In `module`, returning `false` means "did not apply" (the legacy `continue`: the buff is not
   * recorded in `stats.buffs`).
   */
  weapon?(stats: WeaponStats, c: BuildCtx<T>): void | false;
  /** Edit the finished player build (max HP, pickup radius, shove, ...). Runs after every weapon, in `order`. */
  player?(build: Build, c: BuildCtx<T>): void;
}

// ---- runtime hooks ----------------------------------------------------------------------------------------------------

/** Every combat hook, in the order a table lists them (the typed payloads are in engine/hooks.ts, the API in engine/ctx.ts). */
export const HOOK_NAMES: readonly HookName[] = [
  'onAisleStart', 'onTick', 'modifyDamage', 'onHit', 'onCrit', 'onKill', 'onDashStart', 'onDashHit', 'onDashEnd', 'onEnemyShotTouch', 'onPlayerHit', 'onCoinPickup',
  'pattern:sweep', 'pattern:explode', 'pattern:zap', 'pattern:bounce', 'pattern:shotHit', 'pattern:beam', 'pattern:pulse', 'pattern:cone', 'pattern:puddleEnter', 'pattern:aura',
];

type Handler = (event: never, ctx: never) => void;
/**
 * `hooks` of a content file: the combat hooks of docs/item-hooks-refactor.md §4c, each `(event, ctx, c)` where `c` carries the
 * owner's tier and `tune()` (`HookCtx`). `order` positions all of this owner's hooks among the others (default 0, ties: registration
 * order: items, combos, sets). The run-lifecycle hooks of §4b (pure state, no `ctx`) are typed but not wired yet.
 */
export type RuntimeHooks<T extends Tune = Tune> = RuntimeHookMap<T> & {
  order?: number;
  onShopEnter?: Handler; onAisleEnd?: Handler; onMerge?: Handler;
};

// ---- text and rows ----------------------------------------------------------------------------------------------------

/** Text may use `{key}` / `{key|fmt}` placeholders for any `tune` key (see engine/text.ts). */
export interface ItemText { name: string; blurb: string; rules: string }
export interface ComboText { name: string; short: string; summary: string; detail: string }
/** `bonus[0..2]` = the L1/L2/L3 bonus line; placeholders resolve at that level. */
export interface SetText { name: string; bonus: readonly [string, string, string] }

/** One row of the shop's per-level scaling table: the values at ★1/★2/★3 of `tune[key]`, formatted with `fmt` (default `n`). */
export interface RowSpec<T extends Tune = Tune> { label: Localized<string>; key: keyof T & string; fmt?: string }

// ---- shop metadata (typed, not wired until the item that needs it moves) ----------------------------------------------

export type ItemUnlock = 'starting' | (Omit<Extract<Unlock, { kind: 'item' }>, 'id' | 'kind' | 'item' | 'need'> & { need: Localized<string> });
/** Replaces the `ENHANCES` table in systems/shop.ts: when does the shop favor this item for the current cart? */
export type EnhancedBy = 'always' | 'anyWeapon' | readonly ItemTypeId[]; // an array = "any of these is owned"

// ---- content ----------------------------------------------------------------------------------------------------------

export interface ItemContent<T extends Tune = Tune> {
  id: ItemTypeId;
  kind: ItemDef['kind'];
  /** `[family, element?]`, as `ItemDef.family` / `ItemDef.element`. The `electrical` flag adds the Electric set. */
  sets: readonly [FamilyTag] | readonly [FamilyTag, ElementTag];
  /** Static, or a function of the tier (Sourdough). The legacy def carries the ★1 footprint. */
  shape: Shape | ((tier: number) => Shape);
  price: number;
  electrical?: boolean;
  legendary?: boolean;
  /** Weapons only. */
  tags?: ItemDef['tags'];
  weapon?: ItemDef['weapon'];
  /** Modules: the buff this item grants to touching weapons (= its BUFF_ORDER entry). */
  buff?: ItemDef['buff'];
  unlock?: ItemUnlock;
  /** Scalars, or per-tier arrays of 3. Legendaries are ★1 only: scalars. */
  tune?: T;
  text: Localized<ItemText>;
  /** Shop scaling rows. Default: one row per array-valued tune key, labelled with the key. */
  rows?: readonly RowSpec<T>[];
  build?: BuildSpec<T>;
  /** Combat hooks (onHit, onKill, pattern:sweep ...): see RuntimeHooks. */
  hooks?: RuntimeHooks<T>;
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
  /** Module buffs this combo switches off on its weapon (Mist Machine suppresses the Desk Fan). Typed; legacy still hard-codes it. */
  suppresses?: readonly NonNullable<ItemDef['buff']>[];
  /** Effects this combo replaces instead of adding to (Cold Storage, Brain Freeze override the Ice Pack slow). */
  overrides?: readonly 'slow'[];
  /** Scalars only (a combo has no tier). */
  tune?: T;
  text: Localized<ComboText>;
  /** Combos run in the `combo` phase, inside the per-recipe loop, in RECIPES order. */
  build?: BuildSpec<T>;
  /** Combat hooks, active while the combo is: see RuntimeHooks. */
  hooks?: RuntimeHooks<T>;
}

export interface SetContent<T extends Tune = Tune> {
  id: SetId;
  /** Arrays are L1/L2/L3. */
  tune?: T;
  text: Localized<SetText>;
  /** Phase `set`, `post-combo` or `final`. `tier` = the set level; hooks only run when the level is above 0. */
  build?: BuildSpec<T>;
  /** Combat hooks, active while the set level is above 0 (`c.tier` = level): see RuntimeHooks. */
  hooks?: RuntimeHooks<T>;
}

/** Identity helpers: they only check and infer types. `const T` keeps per-tier arrays as tuples. */
export const defineItem = <const T extends Tune = Tune>(def: ItemContent<T>): ItemContent<T> => def;
export const defineCombo = <const T extends Tune = Tune>(def: ComboContent<T>): ComboContent<T> => def;
export const defineSet = <const T extends Tune = Tune>(def: SetContent<T>): SetContent<T> => def;
