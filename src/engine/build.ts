import { ITEMS } from '../data/items';
import { setCount } from '../data/sets';
import { neighbors } from '../systems/inventory';
import type { ActiveRecipe, BuffId, Build, Inventory, ItemInstance, ItemTypeId, Perk, RecipeId, SetId, WeaponStats } from '../types';
import { resolveTune, type BuildCtx, type BuildPhase, type BuildSpec, type ComboContent, type ItemContent, type SetContent, type Tune } from './define';
import { contentCombos, contentItems, contentSets } from './registry';

// Build-phase dispatch for content files. `computeBuild` (systems/synergies.ts) calls these at the position of each legacy
// branch: if content defines a hook there it runs, otherwise the legacy branch does. Pure: no Phaser, no RNG.

/** What `computeBuild` already knows about the cart. */
export interface BuildEnv {
  inv: Inventory;
  perk: Perk;
  sets: Record<SetId, 0 | 1 | 2 | 3>;
  /** Effective tier of an instance (Gold Star included). */
  eff(i: ItemInstance): number;
  /** Highest effective tier of an item type in the cart (0 = absent). */
  top(type: ItemTypeId): number;
}

/** The weapon being built. */
export interface WeaponEnv {
  env: BuildEnv;
  /** Instances touching the weapon. */
  near: ItemInstance[];
  uid: string;
  /** Combos whose parts all touch the weapon (before `replaces` filtering). */
  matching: readonly RecipeId[];
}

interface Owner { id: string; tune?: Tune; item: boolean }

function makeCtx(env: BuildEnv, owner: Owner, tier: number, w?: WeaponEnv, active: readonly ActiveRecipe[] = []): BuildCtx {
  const placed = env.inv.placed;
  const near = (weapon: { uid: string }) => (w && weapon.uid === w.uid ? w.near : neighbors(placed, weapon.uid));
  return {
    tier,
    tune: () => resolveTune(owner.tune, tier),
    touches: (weapon) => !owner.item || near(weapon).some((n) => n.type === owner.id),
    touching: (weapon) => (owner.item ? near(weapon).filter((n) => n.type === owner.id).map((n) => ({ instance: n, tier: env.eff(n) })) : []),
    owned: (id) => env.top(id),
    count: (set) => setCount(placed, set),
    level: (set) => env.sets[set],
    def: (id) => ITEMS[id],
    matching: w?.matching ?? [],
    active,
    cart: env.inv,
    perk: env.perk,
  };
}

// ---- hook tables (built once from the registry) -----------------------------------------------------------------------

type Kind = 'item' | 'set' | 'combo';
interface Entry { kind: Kind; content: ItemContent | SetContent | ComboContent; build: BuildSpec; order: number }

const byOrder = (a: Entry, b: Entry) => a.order - b.order; // stable: registry order breaks ties

const ALL: Entry[] = [
  ...contentItems().flatMap((content): Entry[] => [...(content.build ? [content.build] : []), ...(content.extraBuild ?? [])].map((build) => ({ kind: 'item', content, build, order: build.order ?? 0 }))),
  ...contentSets().map((content): Entry | null => (content.build ? { kind: 'set', content, build: content.build, order: content.build.order ?? 0 } : null)),
  ...contentCombos().map((content): Entry | null => (content.build ? { kind: 'combo', content, build: content.build, order: content.build.order ?? 0 } : null)),
].filter((e): e is Entry => !!e);

const WEAPON_HOOKS = new Map<BuildPhase, Entry[]>();
for (const e of ALL) if (e.build.weapon && e.kind !== 'combo' && e.build.phase !== 'module') WEAPON_HOOKS.set(e.build.phase, [...(WEAPON_HOOKS.get(e.build.phase) ?? []), e]);
for (const list of WEAPON_HOOKS.values()) list.sort(byOrder);
const PLAYER_HOOKS = ALL.filter((e) => e.build.player).sort(byOrder);
const MODULES = new Map<BuffId, ItemContent>();
for (const e of ALL) if (e.kind === 'item' && e.build.phase === 'module' && e.build.weapon && (e.content as ItemContent).buff) MODULES.set((e.content as ItemContent).buff!, e.content as ItemContent);
const COMBOS = new Map<RecipeId, ComboContent>();
for (const e of ALL) if (e.kind === 'combo' && e.build.weapon) COMBOS.set(e.content.id as RecipeId, e.content as ComboContent);

const ownerOf = (e: Entry): Owner => ({ id: e.content.id, tune: e.content.tune, item: e.kind === 'item' });

// ---- dispatch ---------------------------------------------------------------------------------------------------------

/**
 * `module` phase (inside the BUFF_ORDER loop): runs the content hook for `buff` if there is one. Returns `undefined` when the
 * buff has no content hook (run the legacy branch), otherwise `true` if it applied or `false` if the hook skipped it
 * (the legacy `continue`: do not record the buff).
 */
export function runModule(buff: BuffId, s: WeaponStats, we: WeaponEnv, tier: number): boolean | undefined {
  const c = MODULES.get(buff);
  if (!c) return undefined;
  return c.build!.weapon!(s, makeCtx(we.env, { id: c.id, tune: c.tune, item: true }, tier, we)) !== false;
}

/**
 * Every other weapon phase. Runs, in `order`, the hooks of content that applies to this weapon: an item that is in the cart
 * (the weapon item itself in `base`), a set whose level is above 0. Does nothing while no content has a hook in the phase.
 */
export function runPhase(phase: Exclude<BuildPhase, 'module' | 'combo'>, s: WeaponStats, we: WeaponEnv): void {
  const list = WEAPON_HOOKS.get(phase);
  if (!list) return;
  for (const e of list) {
    let tier: number;
    if (e.kind === 'set') tier = we.env.sets[e.content.id as SetId];
    else if (phase === 'base') tier = e.content.id === s.type ? s.tier : 0;
    else tier = we.env.top(e.content.id as ItemTypeId);
    if (!tier) continue;
    e.build.weapon!(s, makeCtx(we.env, ownerOf(e), tier, we));
  }
}

/** `combo` phase (inside the per-recipe loop): the content hook for this combo, if any. Returns false to run the legacy branch. */
export function runCombo(id: RecipeId, s: WeaponStats, we: WeaponEnv): boolean {
  const c = COMBOS.get(id);
  if (!c) return false;
  c.build!.weapon!(s, makeCtx(we.env, { id: c.id, tune: c.tune, item: false }, 1, we));
  return true;
}

/** Player hooks (`build.player`), after every weapon is built, in `order`. Items: in the cart. Sets: level > 0. Combos: active. */
export function runPlayerHooks(b: Build, env: BuildEnv): void {
  for (const e of PLAYER_HOOKS) {
    const tier = e.kind === 'set' ? env.sets[e.content.id as SetId] : e.kind === 'combo' ? +b.recipes.some((r) => r.id === e.content.id) : env.top(e.content.id as ItemTypeId);
    if (tier) e.build.player!(b, makeCtx(env, ownerOf(e), tier, undefined, b.recipes));
  }
}
