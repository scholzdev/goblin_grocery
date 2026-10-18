import { tierBoostOf } from './build';
import { contentComboTune, contentCombos, contentItems, contentSets, contentSetTune, contentTune } from './registry';
import { neighbors } from '../systems/inventory';
import { ITEMS } from '../data/items';
import type { ActiveRecipe, Inventory, ItemDef, ItemInstance, ItemTypeId, RecipeId, SetId, SlowEffect, WeaponStats } from '../types';
import { HOOK_NAMES, resolveTune, type AffinityTag, type ReactionId, type ComboContent, type ItemContent, type Resolved, type RuntimeHooks, type SetContent, type Tune } from './define';
import type { CombatEnemy, CombatShot, FxApi, RuntimeCtx } from './ctx';

// Runtime (combat) hooks, docs/item-hooks-refactor.md §4c. Content declares `hooks: { onHit(hit, ctx, c) { ... } }`; this file holds the
// payload types and the compiled dispatch. Pure: no Phaser (the scene fills the payloads and owns the emit points).
//
// Compiled dispatch: when the cart changes, `hookSourcesFor` + `compileHooks` flatten the hooks of the content in the placed cart, the
// active combos and the sets above level 0 into one array per hook name (sorted by `order`, then registration order), with
// tier and tune resolved. Emitting a hook nobody registered is `if (!list.length) return`. Emit sites that build a payload guard with
// `table.<hook>.length` first, so an empty hook allocates nothing.

// ---- payloads ---------------------------------------------------------------------------------------------------------

/** The `opts` of `ArenaScene.damageEnemy`, verbatim. */
export interface HitOpts {
  kb?: number; kbX?: number; kbY?: number;
  /** Burn/poison tick: no crit, no armor, no onHit side effects. */
  isDot?: boolean;
  label?: string;
  /** Area tick (aura, puddle, cone, Ray Gun splash): no flash, no armor. The vacuum pulse is not quiet: its hits are armored. */
  quiet?: boolean;
  /** The second strike of Double Bag. */
  echo?: boolean;
  /** A Party Popper / Blast-set blast. */
  fromPopper?: boolean;
  /** An Electric-set arc or Ray Gun splash. */
  chained?: boolean;
  poison?: boolean;
  /** Leaf Blower slam damage. */
  blow?: number;
  /** Extra affinity tags this hit carries besides its weapon's and its kind's (`engine/hitTags.ts`): explosions `blast`, the Leaf Blower slam `cleaning`, hazards. */
  tags?: readonly AffinityTag[];
  /**
   * The hit is the burst of an element reaction (`engine/reactions.ts`): it never crits, skips the weapon hooks (modifyDamage, onHit, afterHit chains, statuses,
   * echo, stagger) and armor, never triggers a reaction itself, and is shown and counted as the `reaction` damage type.
   */
  reaction?: ReactionId;
}

/** One `damageEnemy` call, from `modifyDamage` to `onKill`. The same object travels the whole pipeline. */
export interface HitEvent {
  enemy: CombatEnemy;
  /** The damage as it came in, before any modifier. Echo and chain hits are a fraction of this. */
  base: number;
  /**
   * Current damage. `modifyDamage` handlers multiply it (it is pre-crit, pre-armor); `onCrit` sees it times the crit multiplier;
   * from `onHit` on it is what was actually dealt (after armor).
   */
  dmg: number;
  /** The source weapon's stats; null for the dash, popper blasts, hazards, the bag bomb ... (see `opts.label`). */
  stats: WeaponStats | null;
  opts: HitOpts;
  /** The `damageByWeapon` key: weapon uid, 'burn'/'poison', or the label. */
  source: string;
  /** Scene clock (s). */
  now: number;
  /** A player-originated primary hit: not a DoT tick, an echo, a popper blast or a chained hit. Echo-eligible. */
  direct: boolean;
  crit: boolean;
  /** Canned Beans armor soaked at least half of the hit. */
  armored: boolean;
  /** Set when `onHit` runs: this hit took the enemy to 0 HP (it dies right after). */
  killed: boolean;
  /** The hit's affinity tags (`hitTags`: the weapon's element sets and electrical flag, plus the kind of hit). Read-only; `affinityMult` already used them. */
  tags: readonly AffinityTag[];
  /** Knockback multiplier (starts at 1): `afterHit` hooks multiply it (Cleaning L2), the scene applies it last when it computes the push. */
  kbMult: number;
}

export interface KillEvent {
  enemy: CombatEnemy;
  /** The killing hit (credited kills always come from `damageEnemy`). */
  hit: HitEvent | null;
}

export interface AisleStartEvent { aisle: number; boss: boolean; department: string; modifier: string }

/** A dash (shove) that just started. Spare Wheel: `chained` = it was taken inside the free-chain window. */
export interface DashStartEvent { x: number; y: number; dx: number; dy: number; reach: number; chained: boolean }
/** The dash connected with one enemy (once per enemy per dash), right after its damage. */
export interface DashHitEvent { enemy: CombatEnemy; dx: number; dy: number; dmg: number }
/** The dash ended at (x, y). `hit`: it connected with at least one enemy (Express Checkout). */
export interface DashEndEvent { x: number; y: number; dx: number; dy: number; hit: boolean }

/** An enemy projectile touches the goblin. A handler that deals with it (reflect, kill) sets `handled`; the shot then does not hurt. */
export interface ShotTouchEvent { shot: CombatShot; damage: number; handled: boolean }
/** The goblin is about to take `dmg`. Handlers may lower it (armor) and change the post-hit i-frames. Past the iframe/guard checks only. */
export interface PlayerHitEvent { dmg: number; invuln: number }
export interface CoinPickupEvent { label: string; streak: number }

export interface PatternBase { stats: WeaponStats }
/**
 * `before`: range/dmg are still editable (Chicken Dinner). `hit`: `enemy` was just damaged (once per enemy, in the arc loop: Smash the Bank
 * rolls here so its rng draw stays between the enemies' own draws). `after`: the arc is resolved, `hits` are the enemies it damaged.
 */
export interface SweepEvent extends PatternBase { stage: 'before' | 'hit' | 'after'; x: number; y: number; angle: number; bonus: boolean; range: number; dmg: number; hits: CombatEnemy[]; enemy?: CombatEnemy }
/** A pot blast (or dash blast) at (x, y), after its damage. */
export interface ExplodeEvent extends PatternBase { x: number; y: number; hits: CombatEnemy[] }
/**
 * One link of a Microwave zap (link 0 = the first target). `before`: `damageMult` is editable (starts at 1; TV Dinner / Sparks Fly set the chain
 * links). `hit`: `enemy` was just damaged (Sparks Fly rolls its stun here, between the enemies' own draws). `after`: `hits` were damaged.
 */
export interface ZapEvent extends PatternBase { stage: 'before' | 'hit' | 'after'; link: number; target: CombatEnemy; damageMult: number; hits: CombatEnemy[]; enemy?: CombatEnemy }
/** A ricochet cap hit an enemy; `next` is the target it bounces to (null: it ends here). */
export interface BounceEvent extends PatternBase { shot: CombatShot; x: number; y: number; next: CombatEnemy | null }
/** A projectile just damaged `enemy` (before splash, Frostbite and the pierce check). */
export interface ShotHitEvent extends PatternBase { shot: CombatShot; enemy: CombatEnemy }
/**
 * The Self-Checkout beam. `before`: `targets` are the enemies in the line (not damaged yet: marks go here) and `damageMult` (starts at 1) is
 * editable (Power Surge's aftershock). `echo`: this is a re-fired beam. `after`: `hits` were damaged.
 */
export interface BeamEvent extends PatternBase { stage: 'before' | 'after'; target: CombatEnemy; angle: number; echo: boolean; targets: CombatEnemy[]; damageMult: number; hits: CombatEnemy[] }
/**
 * A nail is about to be fired (Nail Gun burst; `first`: the first nail of the burst). A handler that fires something else in its place
 * (Ray Gun's energy bolt) spawns it and sets `handled`; the default nail is then skipped. `angle` already includes the spread (one rng draw).
 */
export interface FireEvent extends PatternBase { x: number; y: number; angle: number; first: boolean; handled: boolean }
/** A Vacuum damage pulse, after its damage; `inside` = enemies within its radius. */
export interface PulseEvent extends PatternBase { x: number; y: number; inside: CombatEnemy[] }
/** A Spray Bottle / Leaf Blower cone, after its damage. */
export interface ConeEvent extends PatternBase { x: number; y: number; angle: number; hits: CombatEnemy[] }
/** An enemy inside a puddle on its tick; `first`: its first tick in this puddle (Black Ice). */
/** An enemy inside a puddle at its tick. `slow` is the slow this tick applies (writable: the Frost set strengthens it). */
export interface PuddleEnterEvent extends PatternBase { enemy: CombatEnemy; puddle: { x: number; y: number; r: number }; first: boolean; slow: SlowEffect }
/** A Blender tick, after its damage. */
export interface AuraEvent extends PatternBase { x: number; y: number; range: number; hit: boolean }
/**
 * A player shot with `homing` set (a hook arms it, usually on `pattern:shotHit`) is about to move this frame. `steer(angle)` turns its
 * velocity to `angle` at the same speed (and its sprite with it); `hits` are the enemies it already pierced. The event object is reused
 * between shots and frames: do not keep it.
 */
export interface ShotMoveEvent extends PatternBase { shot: CombatShot; dt: number; hits: ReadonlySet<number>; steer(angle: number): void }
/**
 * The cosmetics of one weapon, asked once when the aisle's hooks are compiled (`Arsenal.applyLooks`). A combo or item changes how its
 * weapon is drawn by editing `look`; nothing here has a gameplay effect. The pattern code reads the finished object.
 */
export interface LookEvent extends PatternBase { look: WeaponLook }

/** How a weapon is drawn and sounds. Every field is optional; the pattern has a default for each. Pure presentation. */
export interface WeaponLook {
  /** Pitch of the firing sound (Toast Mode plays the toast pop lower). */
  soundRate?: number;
  /** Runs every frame for each live shot of the weapon: particle trails. */
  trail?(shot: { x: number; y: number; vx: number; vy: number }, fx: FxApi): void;
  /** Tint of the sparks on a direct hit of this weapon (default white). */
  hitSpark?: number;
  /** Blender: blade rotation speed (rad/s, default 12) and tint (default none). */
  bladeSpin?: number;
  bladeTint?: number;
  /** Mop: sprite key of the puddle (default `fx_puddle`) and a per-frame particle callback for each live puddle of the weapon. */
  puddleKey?: string;
  puddleFx?(puddle: { x: number; y: number; r: number }, fx: FxApi): void;
}

/** Event type per hook name. `onTick`'s event is the frame delta in seconds (no payload object per frame). */
export interface HookEvents {
  onAisleStart: AisleStartEvent;
  onTick: number;
  modifyDamage: HitEvent;
  onHit: HitEvent;
  /** After the stats-driven statuses (burn, ignite, slow) and before knockback / flash / echo: Frost freeze, Cleaning knockback, Electric chain. */
  afterHit: HitEvent;
  onCrit: HitEvent;
  onKill: KillEvent;
  /** On a lethal hit, after `killEnemy` + `onKill` and Bag It, before the Party Popper blast: Kitchen heal, Blast pop. */
  afterKill: KillEvent;
  onDashStart: DashStartEvent;
  onDashHit: DashHitEvent;
  onDashEnd: DashEndEvent;
  onEnemyShotTouch: ShotTouchEvent;
  onPlayerHit: PlayerHitEvent;
  onCoinPickup: CoinPickupEvent;
  'pattern:sweep': SweepEvent;
  'pattern:explode': ExplodeEvent;
  'pattern:zap': ZapEvent;
  'pattern:bounce': BounceEvent;
  'pattern:shotHit': ShotHitEvent;
  'pattern:shotMove': ShotMoveEvent;
  'pattern:beam': BeamEvent;
  'pattern:fire': FireEvent;
  'pattern:pulse': PulseEvent;
  'pattern:cone': ConeEvent;
  'pattern:puddleEnter': PuddleEnterEvent;
  'pattern:aura': AuraEvent;
  'pattern:look': LookEvent;
}
export type HookName = keyof HookEvents;

/** The `c` every hook receives: its owner's tier and tune, resolved once when the cart was compiled. */
export interface HookCtx<T extends Tune = Tune> {
  readonly id: string;
  readonly kind: 'item' | 'combo' | 'set';
  /** Item: best effective tier in the cart (Gold Star included, same as the build hooks' `env.top`). Combo: 1. Set: its level. */
  readonly tier: number;
  /** The owner's `tune` resolved for `tier`. The same frozen object every call (no allocation). */
  tune(): Resolved<T>;
  /** Does an instance of the owner touch the weapon with this uid? A combo: is that its weapon? (true for sets and cart combos). */
  touches(weaponUid: string): boolean;
  /** Items: the owner's placed instances (the live objects: Basil writes `kills`, Scoby `age`). Empty for combos and sets. */
  readonly instances: readonly ItemInstance[];
  /** Items: the owner's instances touching the weapon with this uid. */
  touching(weaponUid: string): readonly ItemInstance[];
  /** Highest effective tier of `id` in the cart (0 = not placed). */
  owned(id: ItemTypeId): number;
  /** The item's plain definition (family, element, base weapon pattern). Sets use it to tell which weapons they apply to. */
  def(id: ItemTypeId): ItemDef;
  /**
   * Another content owner's tune: an item at tier `level`, a combo (scalars), or a set at level `level` (default 1). Empty for an id that is
   * not content. Confetti Cannon reads the Blast set's radius, Tailwind the Sugar Rush stack numbers.
   */
  tuneOf(id: OwnerId, level?: number): Readonly<Record<string, number>>;
  /**
   * The scratch state of another owner active in this cart (undefined when it is not): Tailwind adds to Sugar Rush's stacks. Fresh per
   * aisle like `state`; the owner creates its own fields lazily, so a reader must tolerate an empty object.
   */
  stateOf(id: OwnerId): Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Scratch state, fresh for every aisle (counters, timers). Shared by all hooks of the same owner. */
  state: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** What another owner's tune / state is looked up by: an item, a combo or a set (the three kinds of content that own hooks). */
export type OwnerId = ItemTypeId | RecipeId | SetId;

export type HookFn<K extends HookName, T extends Tune = Tune> = (ev: HookEvents[K], ctx: RuntimeCtx, c: HookCtx<T>) => void;
/** The combat part of a content file's `hooks`. */
export type RuntimeHookMap<T extends Tune = Tune> = { [K in HookName]?: HookFn<K, T> };

// ---- compiled dispatch ------------------------------------------------------------------------------------------------

export interface Handler<K extends HookName = HookName> { id: string; order: number; fn: HookFn<K, Tune>; c: HookCtx }
type Lists = { readonly [K in HookName]: readonly Handler<K>[] };

export interface HookTable extends Lists {
  /** True while some hit hook (modifyDamage/onHit/onCrit/onKill) is registered: `damageEnemy` builds its payload only then. */
  readonly hit: boolean;
  /** Handlers across all hooks. */
  readonly size: number;
  /** Run the handlers of `name` in order. A no-op (no call, no allocation) when nobody registered. */
  emit<K extends HookName>(name: K, ev: HookEvents[K]): void;
}

/** One content owner with runtime hooks that is active in the current cart. */
export interface HookSource {
  id: string;
  kind: 'item' | 'combo' | 'set';
  tier: number;
  tune?: Tune;
  hooks: RuntimeHooks;
  /** Weapon uids the owner touches (items) / belongs to (weapon combos). null = every weapon. */
  weapons: ReadonlySet<string> | null;
  /** Items: the placed instances of the owner, and per weapon uid the ones touching it (own uid included, like `weapons`). */
  instances?: readonly ItemInstance[];
  touching?: ReadonlyMap<string, readonly ItemInstance[]>;
}

/** `HookCtx.tuneOf`: items by tier, combos (scalars) and sets by level, whichever owns the id. */
function otherTune(id: OwnerId, level = 1): Readonly<Record<string, number>> {
  return contentItems().some((c) => c.id === id) ? contentTune(id as ItemTypeId, level)
    : contentCombos().some((c) => c.id === id) ? contentComboTune(id as RecipeId)
      : contentSetTune(id as SetId, level);
}

/** Flattens `sources` into per-hook handler arrays. `owned(id)`: highest effective tier of an item in the cart. */
export function compileHooks(sources: readonly HookSource[], ctx: RuntimeCtx, owned: (id: ItemTypeId) => number = () => 0): HookTable {
  const lists = {} as Record<HookName, Handler[]>;
  for (const n of HOOK_NAMES) lists[n] = [];
  let seq = 0;
  const staged: { name: HookName; h: Handler; seq: number }[] = [];
  const states = new Map<string, Record<string, any>>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const s of sources) states.set(s.id, {});
  const stateOf = (id: OwnerId) => states.get(id);
  for (const s of sources) {
    const tune = Object.freeze(resolveTune(s.tune, s.tier));
    const c: HookCtx = { id: s.id, kind: s.kind, tier: s.tier, tune: () => tune, touches: (uid) => !s.weapons || s.weapons.has(uid), instances: s.instances ?? [], touching: (uid) => s.touching?.get(uid) ?? [], owned, def: (id) => ITEMS[id], tuneOf: otherTune, stateOf, state: states.get(s.id)! };
    const order = s.hooks.order ?? 0;
    for (const name of HOOK_NAMES) {
      const fn = s.hooks[name];
      if (fn) staged.push({ name, h: { id: s.id, order, fn: fn as Handler['fn'], c }, seq: seq++ });
    }
  }
  staged.sort((a, b) => a.h.order - b.h.order || a.seq - b.seq);
  for (const { name, h } of staged) lists[name].push(h);
  const hit = lists.modifyDamage.length + lists.onHit.length + lists.onCrit.length + lists.onKill.length > 0;
  const table = {
    ...lists, hit, size: staged.length,
    emit<K extends HookName>(name: K, ev: HookEvents[K]): void {
      const list = lists[name];
      for (let i = 0; i < list.length; i++) list[i].fn(ev as never, ctx, list[i].c);
    },
  };
  return table as unknown as HookTable;
}

/** The table before any aisle was built (and in the title scene): every hook empty. */
export const EMPTY_HOOKS: HookTable = compileHooks([], undefined as unknown as RuntimeCtx);

/** Where `hookSourcesFor` finds content (the registry by default; tests pass fixtures). */
export interface ContentLookup { items(): readonly ItemContent[]; combos(): readonly ComboContent[]; sets(): readonly SetContent[] }
export const REGISTRY_LOOKUP: ContentLookup = { items: contentItems, combos: contentCombos, sets: contentSets };

/**
 * The hook owners active in this cart, in registration order (items, then combos, then sets; each in registry order):
 * content items with `hooks` that are placed (tier = best effective copy), combos in `recipes` (the finished, post-`replaces` list
 * of `computeBuild`), sets with a level above 0.
 */
export function hookSourcesFor(cart: Inventory, recipes: readonly ActiveRecipe[], sets: Record<SetId, 0 | 1 | 2 | 3>, lookup: ContentLookup = REGISTRY_LOOKUP): { sources: HookSource[]; owned: (id: ItemTypeId) => number } {
  const placed = cart.placed, boost = tierBoostOf(placed);
  const top = new Map<ItemTypeId, number>();
  for (const p of placed) top.set(p.type, Math.max(top.get(p.type) ?? 0, (p.tier ?? 1) + boost(p)));
  const owned = (id: ItemTypeId): number => top.get(id) ?? 0;
  const sources: HookSource[] = [];
  for (const c of lookup.items()) {
    const tier = owned(c.id);
    if (!c.hooks || !tier) continue;
    const weapons = new Set<string>(), touching = new Map<string, ItemInstance[]>(), instances: ItemInstance[] = [];
    const touch = (uid: string, p: ItemInstance) => { weapons.add(uid); (touching.get(uid) ?? touching.set(uid, []).get(uid)!).push(p); };
    for (const p of placed) if (p.type === c.id) { instances.push(p); touch(p.uid, p); for (const n of neighbors(placed, p.uid)) touch(n.uid, p); } // own uid: a weapon item's hooks touch itself
    sources.push({ id: c.id, kind: 'item', tier, tune: c.tune, hooks: c.hooks, weapons, instances, touching });
  }
  for (const c of lookup.combos()) {
    if (!c.hooks) continue;
    const mine = recipes.filter((r) => r.id === c.id);
    if (!mine.length) continue;
    const uids = mine.flatMap((r) => (r.weaponUid ? [r.weaponUid] : []));
    sources.push({ id: c.id, kind: 'combo', tier: 1, tune: c.tune, hooks: c.hooks, weapons: uids.length ? new Set(uids) : null });
  }
  for (const c of lookup.sets()) {
    const level = sets[c.id];
    if (c.hooks && level > 0) sources.push({ id: c.id, kind: 'set', tier: level, tune: c.tune, hooks: c.hooks, weapons: null });
  }
  return { sources, owned };
}

/** `hookSourcesFor` + `compileHooks` in one step: what the arena calls when it is handed a build. */
export function buildHooks(cart: Inventory, recipes: readonly ActiveRecipe[], sets: Record<SetId, 0 | 1 | 2 | 3>, ctx: RuntimeCtx, lookup?: ContentLookup): HookTable {
  const { sources, owned } = hookSourcesFor(cart, recipes, sets, lookup);
  return compileHooks(sources, ctx, owned);
}

