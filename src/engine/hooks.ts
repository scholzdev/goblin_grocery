import { tierBoostOf } from './build';
import { contentCombos, contentItems, contentSets } from './registry';
import { neighbors } from '../systems/inventory';
import type { ActiveRecipe, Inventory, ItemTypeId, SetId, WeaponStats } from '../types';
import { HOOK_NAMES, resolveTune, type ComboContent, type ItemContent, type Resolved, type RuntimeHooks, type SetContent, type Tune } from './define';
import type { CombatEnemy, CombatShot, RuntimeCtx } from './ctx';

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
  /** Area tick (aura, puddle, pulse): no flash, no armor. */
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
/** `before`: range/dmg are still editable (Chicken Dinner). `after`: the arc is resolved, `hits` are the enemies it damaged. */
export interface SweepEvent extends PatternBase { stage: 'before' | 'after'; x: number; y: number; angle: number; bonus: boolean; range: number; dmg: number; hits: CombatEnemy[] }
/** A pot blast (or dash blast) at (x, y), after its damage. */
export interface ExplodeEvent extends PatternBase { x: number; y: number; hits: CombatEnemy[] }
/** One link of a Microwave zap. `before`: `damageMult` is editable (TV Dinner / Sparks Fly chain). `after`: `hits` were damaged. */
export interface ZapEvent extends PatternBase { stage: 'before' | 'after'; link: number; target: CombatEnemy; damageMult: number; hits: CombatEnemy[] }
/** A ricochet cap hit an enemy; `next` is the target it bounces to (null: it ends here). */
export interface BounceEvent extends PatternBase { shot: CombatShot; x: number; y: number; next: CombatEnemy | null }
/** A projectile just damaged `enemy` (before splash, Frostbite and the pierce check). */
export interface ShotHitEvent extends PatternBase { shot: CombatShot; enemy: CombatEnemy }
/** The Self-Checkout beam. `before`: `targets` are the enemies in the line (not damaged yet: marks go here). `after`: `hits` were damaged. */
export interface BeamEvent extends PatternBase { stage: 'before' | 'after'; target: CombatEnemy; angle: number; echo: boolean; targets: CombatEnemy[]; hits: CombatEnemy[] }
/** A Vacuum damage pulse, after its damage; `inside` = enemies within its radius. */
export interface PulseEvent extends PatternBase { x: number; y: number; inside: CombatEnemy[] }
/** A Spray Bottle / Leaf Blower cone, after its damage. */
export interface ConeEvent extends PatternBase { x: number; y: number; angle: number; hits: CombatEnemy[] }
/** An enemy inside a puddle on its tick; `first`: its first tick in this puddle (Black Ice). */
export interface PuddleEnterEvent extends PatternBase { enemy: CombatEnemy; puddle: { x: number; y: number; r: number }; first: boolean }
/** A Blender tick, after its damage. */
export interface AuraEvent extends PatternBase { x: number; y: number; range: number; hit: boolean }

/** Event type per hook name. `onTick`'s event is the frame delta in seconds (no payload object per frame). */
export interface HookEvents {
  onAisleStart: AisleStartEvent;
  onTick: number;
  modifyDamage: HitEvent;
  onHit: HitEvent;
  onCrit: HitEvent;
  onKill: KillEvent;
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
  'pattern:beam': BeamEvent;
  'pattern:pulse': PulseEvent;
  'pattern:cone': ConeEvent;
  'pattern:puddleEnter': PuddleEnterEvent;
  'pattern:aura': AuraEvent;
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
  /** Highest effective tier of `id` in the cart (0 = not placed). */
  owned(id: ItemTypeId): number;
  /** Scratch state, fresh for every aisle (counters, timers). Shared by all hooks of the same owner. */
  state: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

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
}

/** Flattens `sources` into per-hook handler arrays. `owned(id)`: highest effective tier of an item in the cart. */
export function compileHooks(sources: readonly HookSource[], ctx: RuntimeCtx, owned: (id: ItemTypeId) => number = () => 0): HookTable {
  const lists = {} as Record<HookName, Handler[]>;
  for (const n of HOOK_NAMES) lists[n] = [];
  let seq = 0;
  const staged: { name: HookName; h: Handler; seq: number }[] = [];
  for (const s of sources) {
    const tune = Object.freeze(resolveTune(s.tune, s.tier));
    const c: HookCtx = { id: s.id, kind: s.kind, tier: s.tier, tune: () => tune, touches: (uid) => !s.weapons || s.weapons.has(uid), owned, state: {} };
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
    const weapons = new Set<string>();
    for (const p of placed) if (p.type === c.id) { weapons.add(p.uid); for (const n of neighbors(placed, p.uid)) weapons.add(n.uid); } // own uid: a weapon item's hooks touch itself
    sources.push({ id: c.id, kind: 'item', tier, tune: c.tune, hooks: c.hooks, weapons });
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

