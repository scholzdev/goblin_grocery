import { ITEMS, TIER } from '../data/items';
import { THEMES } from '../data/departments';
import { ELITE_AFFIXES, ELITE_EXCLUDED, ENEMIES, MINI_BOSS, SPLITTER_EXCLUDED, type EliteAffix } from '../data/enemies';
import { SET_EVENT_KINDS, type EventKind } from '../data/events';
import { MODIFIERS, type ModifierId } from '../data/modifiers';
import { SHIFTS, SHOP_LEVELS } from '../data/waves';
import { ARENA } from '../data/arena';
import { FLAVORS } from '../engine/define';
import { canPlace, normalizeRotation } from '../systems/inventory';
import type { SpreadKind } from '../systems/spread';
import type { LabDummy } from '../lab';
import type { DepartmentId, ElementTag, EnemyId, Inventory, ItemTypeId, Rotation, StarterId } from '../types';

// A sim is a Test Lab scenario in one file: src/sims/<id>.ts with `export default defineSim({...})`.
// This file holds the shape, the defaults and the validation (pure: no Phaser, no DOM). The registry is `_registry.ts`,
// the run builder is `state/sim.ts`. Files starting with `_` are helpers, not sims. See docs/sims.md.

/** Departments a sim can pick (the five themes; the boss aisle is `aisle: 8` with `waves: true`). */
export type SimDepartment = Extract<DepartmentId, 'main' | 'frozen' | 'bakery' | 'electronics' | 'checkout'>;
export type SimEvent = 'none' | 'random' | EventKind;
export type SimTier = 1 | 2 | 3;

export interface SimItem {
  id: ItemTypeId;
  /** ★1..★3 (legendaries are always ★1). Default 1. */
  tier?: SimTier;
  /** Top-left cell of the item's (rotated) footprint. Without it the item goes to the first spot that fits. */
  at?: [number, number];
  /** Clockwise quarter turns. Default 0 (auto-placement tries all four). */
  rot?: Rotation;
  /** Jelly Beans only: its element for set counting. Default 'heat'. Re-rolls whenever you open the cart editor (F8). */
  flavor?: ElementTag;
}

export interface SimShelfItem { id: ItemTypeId; tier?: SimTier }

export interface SimEnemy {
  id: EnemyId;
  /** How many copies. Default 1. */
  count?: number;
  /** An elite with that affix, or `'elite'` for a random one. Default: a plain enemy. */
  affix?: EliteAffix | 'elite';
  /** Stands still (no walking, no attacks). Default false. */
  still?: boolean;
  /** Refills its HP instead of dying. Default true. */
  immortal?: boolean;
  /** Mid-shift boss variant index (0..), see MINI_BOSS.variants. */
  mini?: number;
  /** Arena position in world px: the spot (one enemy) or the centre of the group. */
  at?: [number, number];
  /** Layout of the group. 'random' (default): random spots away from you. 'cluster': one tight bunch. 'ring': around `at` (default: around you). */
  spread?: SpreadKind;
}

export interface SimDef {
  /** Must equal the file name (`src/sims/<id>.ts`). */
  id: string;
  /** Free text shown for a few seconds when the sim starts. */
  notes?: string;
  /** Goblin (perks only). Default 'toaster'. */
  character?: StarterId;
  /** Aisle 1..15 (8 = boss, above = overtime). Default 1. */
  aisle?: number;
  /** Default 'main'. */
  department?: SimDepartment;
  /** Door modifier of the aisle. Default 'none'. */
  doorMod?: ModifierId;
  /** Aisle event: 'none', 'random' (normal roll) or a kind. Default 'none'. */
  event?: SimEvent;
  /** Shift index (0 = Day Shift). Default 0. */
  shift?: number;
  /** false (default): dummy sandbox, no waves, `enemies` are the dummies. true: a real aisle run starting at `aisle`. */
  waves?: boolean;
  /** 'arena' (default) drops you into the fight, 'shop' parks you in the cart editor first. */
  start?: 'arena' | 'shop';
  /** No damage taken. Default true. */
  god?: boolean;
  /** Default 999. */
  money?: number;
  /** Run seed; fixed means the same shops, rolls and spawns every time. Default 1. */
  seed?: number;
  /** [cols, rows] of the cart. Default [7, 5]. */
  cartSize?: [number, number];
  /** Loyalty level 1..3. Default 1. */
  shopLevel?: number;
  /** Exactly what is in the cart (the starter weapon is NOT added). */
  cart: SimItem[];
  /** Items waiting on the shelf (they do not count for the build). */
  shelf?: SimShelfItem[];
  /** Dummies for the sandbox (`waves: false` only). */
  enemies?: SimEnemy[];
}

/** Identity helper that gives editors the types (item, enemy, department, door mod, event and affix ids autocomplete). */
export const defineSim = (sim: SimDef): SimDef => sim;

/** Thrown when a sim does not validate; `problems` has one line per issue. */
export class SimError extends Error {
  constructor(readonly simId: string, readonly problems: string[]) {
    super(`sim "${simId}": ${problems.join('; ')}`);
    this.name = 'SimError';
  }
}

export const SIM_DEFAULTS = { character: 'toaster', aisle: 1, department: 'main', doorMod: 'none', event: 'none', shift: 0, waves: false, start: 'arena', god: true, money: 999, seed: 1, cartSize: [7, 5], shopLevel: 1 } as const;

const EVENT_IDS: readonly string[] = ['none', 'random', 'wetFloor', 'outage', ...SET_EVENT_KINDS];
const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export interface CartSlot { type: ItemTypeId; tier: number; x: number; y: number; rot: Rotation; flavor?: ElementTag }

/**
 * Where each cart entry ends up, in cart order. Entries with `at` are placed first (as given, checked with `canPlace`), then the
 * rest go to the first free spot scanning rows, columns and rotations. `errors` explains every entry that does not fit.
 */
export function layoutCart(sim: Pick<SimDef, 'cart' | 'cartSize'>): { slots: (CartSlot | null)[]; errors: string[] } {
  const [cols, rows] = sim.cartSize ?? SIM_DEFAULTS.cartSize;
  const inv: Inventory = { cols, rows, placed: [], shelf: [] };
  const slots: (CartSlot | null)[] = sim.cart.map(() => null);
  const errors: string[] = [];
  const place = (i: number, s: CartSlot): void => {
    inv.placed.push({ uid: `s${i}`, type: s.type, x: s.x, y: s.y, rot: s.rot, tier: s.tier });
    slots[i] = s;
  };
  const tierOf = (e: SimItem): number => (ITEMS[e.id]?.legendary ? 1 : e.tier ?? 1);
  sim.cart.forEach((e, i) => {
    if (!e.at || !ITEMS[e.id]) return;
    const rot = normalizeRotation(e.id, e.rot ?? 0, tierOf(e));
    const r = canPlace(inv, e.id, e.at[0], e.at[1], rot, undefined, tierOf(e));
    if (r.ok) place(i, { type: e.id, tier: tierOf(e), x: e.at[0], y: e.at[1], rot, flavor: e.flavor });
    else errors.push(`cart[${i}] ${e.id} at [${e.at}]: ${r.reason}`);
  });
  sim.cart.forEach((e, i) => {
    if (e.at || !ITEMS[e.id]) return;
    const tier = tierOf(e);
    const rots = e.rot === undefined ? ([0, 1, 2, 3] as Rotation[]) : [e.rot];
    for (let y = 0; y < rows && !slots[i]; y++) for (let x = 0; x < cols && !slots[i]; x++) for (const rot of rots) {
      if (normalizeRotation(e.id, rot, tier) !== rot) continue; // same shape as a smaller turn: already tried
      if (canPlace(inv, e.id, x, y, rot, undefined, tier).ok) { place(i, { type: e.id, tier, x, y, rot, flavor: e.flavor }); break; }
    }
    if (!slots[i]) errors.push(`cart[${i}] ${e.id}: no free spot in the ${cols}x${rows} cart`);
  });
  return { slots, errors };
}

/** Every problem with a sim (empty = valid). `fileId` is the file name without `.ts`; when given, `sim.id` must equal it. Never throws. */
export function validateSim(sim: SimDef, fileId?: string): string[] {
  const errs: string[] = [];
  const bad = (msg: string): void => { errs.push(msg); };
  if (typeof sim.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(sim.id)) bad(`id "${sim.id}" must be lowercase letters, digits and dashes`);
  if (fileId !== undefined && sim.id !== fileId) bad(`id "${sim.id}" must equal the file name "${fileId}"`);
  if (sim.character !== undefined && !(['toaster', 'pan', 'coupon', 'night'] as StarterId[]).includes(sim.character)) bad(`unknown character "${sim.character}"`);
  const aisle = sim.aisle ?? SIM_DEFAULTS.aisle;
  if (!isInt(aisle) || aisle < 1 || aisle > 15) bad(`aisle ${aisle} must be a whole number 1..15`);
  if (sim.department !== undefined && !THEMES.includes(sim.department)) bad(`unknown department "${sim.department}" (one of ${THEMES.join(', ')})`);
  if (sim.doorMod !== undefined && !(sim.doorMod in MODIFIERS)) bad(`unknown doorMod "${sim.doorMod}" (one of ${Object.keys(MODIFIERS).join(', ')})`);
  if (sim.event !== undefined && !EVENT_IDS.includes(sim.event)) bad(`unknown event "${sim.event}" (one of ${EVENT_IDS.join(', ')})`);
  if (sim.shift !== undefined && (!isInt(sim.shift) || sim.shift < 0 || sim.shift >= SHIFTS.length)) bad(`shift ${sim.shift} must be 0..${SHIFTS.length - 1}`);
  if (sim.start !== undefined && sim.start !== 'arena' && sim.start !== 'shop') bad(`start "${sim.start}" must be 'arena' or 'shop'`);
  if (sim.seed !== undefined && !isInt(sim.seed)) bad(`seed ${sim.seed} must be a whole number`);
  if (sim.money !== undefined && (!isInt(sim.money) || sim.money < 0)) bad(`money ${sim.money} must be a whole number >= 0`);
  if (sim.shopLevel !== undefined && (!isInt(sim.shopLevel) || sim.shopLevel < 1 || sim.shopLevel > SHOP_LEVELS.length)) bad(`shopLevel ${sim.shopLevel} must be 1..${SHOP_LEVELS.length}`);
  const cs = sim.cartSize ?? SIM_DEFAULTS.cartSize;
  if (!Array.isArray(cs) || cs.length !== 2 || !cs.every((n) => isInt(n) && n >= 1 && n <= 12)) bad(`cartSize [${cs}] must be [cols, rows], whole numbers 1..12`);

  if (!Array.isArray(sim.cart)) { bad('cart must be a list'); return errs; }
  sim.cart.forEach((e, i) => {
    const where = `cart[${i}] ${e.id}`;
    if (!ITEMS[e.id]) { bad(`cart[${i}]: unknown item "${e.id}"`); return; }
    if (e.tier !== undefined && (!isInt(e.tier) || e.tier < 1 || e.tier > TIER.max)) bad(`${where}: tier ${e.tier} must be 1..${TIER.max}`);
    else if (e.tier !== undefined && e.tier > 1 && ITEMS[e.id].legendary) bad(`${where}: legendary items are always tier 1`);
    if (e.rot !== undefined && ![0, 1, 2, 3].includes(e.rot)) bad(`${where}: rot ${e.rot} must be 0..3`);
    if (e.at !== undefined && !(Array.isArray(e.at) && e.at.length === 2 && e.at.every(isInt))) bad(`${where}: at must be [x, y] whole numbers`);
    if (e.flavor !== undefined && (!ITEMS[e.id].flavored || !FLAVORS.includes(e.flavor))) bad(`${where}: flavor only applies to Jelly Beans (heat, frost or blast)`);
  });
  if (!errs.some((m) => m.startsWith('cart[') || m.startsWith('cartSize'))) errs.push(...layoutCart(sim).errors);

  sim.shelf?.forEach((e, i) => {
    if (!ITEMS[e.id]) bad(`shelf[${i}]: unknown item "${e.id}"`);
    else if (e.tier !== undefined && (!isInt(e.tier) || e.tier < 1 || e.tier > TIER.max)) bad(`shelf[${i}] ${e.id}: tier ${e.tier} must be 1..${TIER.max}`);
  });

  if (sim.waves && sim.enemies?.length) bad('enemies only work with waves: false (a real aisle spawns its own)');
  const box = ARENA;
  sim.enemies?.forEach((e, i) => {
    const where = `enemies[${i}] ${e.id}`;
    if (!ENEMIES[e.id]) { bad(`enemies[${i}]: unknown enemy "${e.id}"`); return; }
    if (e.count !== undefined && (!isInt(e.count) || e.count < 1 || e.count > 60)) bad(`${where}: count ${e.count} must be 1..60`);
    if (e.affix !== undefined) {
      if (e.affix !== 'elite' && !ELITE_AFFIXES.includes(e.affix)) bad(`${where}: unknown affix "${e.affix}" (one of ${ELITE_AFFIXES.join(', ')}, elite)`);
      else if (ELITE_EXCLUDED.includes(e.id)) bad(`${where}: ${e.id} can never be an elite`);
      else if (e.affix === 'splitter' && SPLITTER_EXCLUDED.includes(e.id)) bad(`${where}: ${e.id} cannot be a Splitter`);
      else if (e.mini !== undefined) bad(`${where}: a mini boss cannot also be an elite`);
    }
    if (e.mini !== undefined && (!isInt(e.mini) || e.mini < 0 || e.mini >= MINI_BOSS.variants.length)) bad(`${where}: mini ${e.mini} must be 0..${MINI_BOSS.variants.length - 1}`);
    if (e.spread !== undefined && !['random', 'cluster', 'ring'].includes(e.spread)) bad(`${where}: unknown spread "${e.spread}" (random, cluster, ring)`);
    if (e.at !== undefined) {
      if (!(Array.isArray(e.at) && e.at.length === 2 && e.at.every((n) => typeof n === 'number' && Number.isFinite(n)))) bad(`${where}: at must be [x, y]`);
      else if (e.at[0] < box.left || e.at[0] > box.right || e.at[1] < box.top || e.at[1] > box.bottom) bad(`${where}: at [${e.at}] is outside the arena (x ${box.left}..${box.right}, y ${box.top}..${box.bottom})`);
    }
  });
  return errs;
}

/** The sandbox dummies a sim asks for, one per copy. Groups (`count` > 1) share a layout and a centre. */
export function simDummies(sim: Pick<SimDef, 'enemies'>): LabDummy[] {
  const out: LabDummy[] = [];
  (sim.enemies ?? []).forEach((e, group) => {
    const n = e.count ?? 1;
    for (let slot = 0; slot < n; slot++) {
      out.push({
        id: e.id, still: e.still ?? false, immortal: e.immortal ?? true, mini: e.mini, affix: e.affix,
        place: e.at || e.spread ? { at: e.at, spread: e.spread ?? 'random', slot, of: n, group } : undefined,
      });
    }
  });
  return out;
}
