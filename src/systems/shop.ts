import { ELITE_EXCLUDED, MINI_BOSS } from '../data/enemies';
import { DEPARTMENTS, DEPT_TUNING } from '../data/departments';
import { DOOR_POOL, MODIFIERS, ROOMS, ROOM_DOORS, type DoorId } from '../data/modifiers';
import { BOSS_WAVE, ECONOMY, SHIFTS, SHOP_LEVELS, eliteChance, shopQuality, waveDef } from '../data/waves';
import { PLAYER, ITEMS, ITEM_IDS, TIER } from '../data/items';
import { RECIPES } from '../data/recipes';
import { ZONES, ZONE_TUNING, zonesOf, type ZoneId } from '../data/zones';
import { BELTS, CABLE_ROWS, ICE_SPOTS, VENT_SPOTS } from '../data/arena';
import type { Build, EnemyId, HazardKind, ItemTypeId, RunState, ShopOffer } from '../types';
import type { Rng } from './rng';
import { canShortcut } from './shortcut';

/** What selling pays: the value x `build.sellRate` (Barter Stamp), full value for a family a Collector's Binder holds. */
export const sellPrice = (type: ItemTypeId, tier = 1, build?: Pick<Build, 'sellRate' | 'sellFullFamilies'>): number =>
  Math.floor(TIER.value(ITEMS[type].price, tier) * (build?.sellFullFamilies.includes(ITEMS[type].family) ? 1 : build?.sellRate ?? 0.5));
export const rerollCost = (rerollsDone: number, shopIndex: number): number => (ECONOMY.rerollBase + Math.ceil(shopIndex / 2)) * (rerollsDone + 1);
const shopIdx = (state: RunState) => state.shop?.shopIndex ?? state.wave;
/** Item price multiplier for the current shop (1 in shop 1). */
export const inflation = (state: RunState, shopIndex = shopIdx(state)): number => 1 + ECONOMY.inflationPerShop * Math.max(0, shopIndex - 1);
export const repairCost = (state: RunState): number => ECONOMY.repairBase + ECONOMY.repairPerShop * shopIdx(state);

const anyWeapon = (o: Set<ItemTypeId>) => [...o].some((t) => ITEMS[t].kind === 'weapon');
const ENHANCES: Partial<Record<ItemTypeId, (own: Set<ItemTypeId>) => boolean>> = {
  fan: anyWeapon, fuel: anyWeapon, battery: anyWeapon, ice: anyWeapon, hotsauce: anyWeapon, pricegun: anyWeapon, tape: anyWeapon,
  popper: anyWeapon, doublebag: anyWeapon, multipack: anyWeapon, expiredmilk: anyWeapon, tinfoilhat: () => true, jellybeans: anyWeapon, sourdough: anyWeapon,
  magnet: (o) => o.has('nailgun'),
  bell: (o) => o.has('pan'),
  bumper: (o) => o.has('cooker') || o.has('bell') || o.has('boot'),
  sparewheel: (o) => o.has('bell') || o.has('boot'),
  tipjar: (o) => o.has('bell') || o.has('boot') || o.has('sparewheel'),
  flag: (o) => o.has('bell') || o.has('boot') || o.has('sparewheel'),
  lunchbox: (o) => o.has('microwave'),
  coupon: (o) => o.has('fizz'),
};

function weight(t: ItemTypeId, own: Set<ItemTypeId>, mergeable: Set<ItemTypeId>, focusWeapon?: ItemTypeId): number {
  let w: number;
  if (mergeable.has(t)) w = ECONOMY.ownedWeight;
  else if (ITEMS[t].kind === 'weapon') w = 1.1;
  else if (Object.values(RECIPES).some((r) => (r.weapon ? own.has(r.weapon) : r.supports.some((s) => s !== t && own.has(s))) && r.supports.includes(t))) w = 1.2;
  else w = ENHANCES[t]?.(own) ? 1.1 : 1;

  if (!focusWeapon) return w;
  // Keep the chosen starting weapon viable through the run: its combo parts get a gentle pull,
  // while alternate weapons remain possible but lose some of their early-shop appeal.
  const focusParts = new Set(Object.values(RECIPES).filter((r) => r.weapon === focusWeapon).flatMap((r) => r.supports));
  if (t !== focusWeapon && focusParts.has(t)) w *= 1.35;
  if (ITEMS[t].kind === 'weapon' && t !== focusWeapon && !own.has(t)) w *= 0.85;
  return w;
}

export function currentRerollCost(state: RunState): number {
  const sh = state.shop;
  if (!sh) return rerollCost(0, shopIdx(state));
  if (sh.bonusFreeRerolls > 0) return 0;
  return SHOP_LEVELS[state.shopLevel - 1].freeReroll && !sh.freeRerollUsed ? 0 : rerollCost(sh.rerolls, sh.shopIndex);
}

/** `guarantee`: shop 1's initial roll: the run's openers (`RunState.openers`) at ★1, the rest at flat weights (default: only when shopIndex is 1). */
/** `keep`: the offers of a locked shop. Unsold ones stay as they are (price included); each sold slot gets a fresh offer in place. */
export interface RollOpts { bias?: ItemTypeId[]; legendaryBonus?: number; forceLegendary?: boolean; keep?: ShopOffer[] }

export function rollOffers(state: RunState, rng: Rng, shopIndex: number, guarantee = shopIndex === 1, opts: RollOpts = {}): ShopOffer[] {
  const bias = opts.bias ?? [], bonus = opts.legendaryBonus ?? 0;
  const owned = [...state.inventory.placed, ...state.inventory.shelf.filter((s) => !!s)];
  const own = new Set(owned.map((i) => i.type));
  const mergeable = new Set(owned.filter((i) => (i.tier ?? 1) < TIER.max).map((i) => i.type));
  const lv = state.lab ? SHOP_LEVELS[Math.max(0, Math.min(SHOP_LEVELS.length, state.shopLevel) - 1)] : shopQuality(shopIndex);
  const kept = (opts.keep ?? []).filter((o) => !o.sold);
  const offers: ShopOffer[] = kept.map((o) => ({ ...o }));
  // Checkout set discount is baked in at roll time: offers already on the table keep their price until the next reroll.
  const add = (type: ItemTypeId, tier: number) => offers.push({ slot: offers.length, type, tier, price: Math.max(1, Math.round(TIER.value(ITEMS[type].price, tier) * (PLAYER.starters[state.starter ?? 'toaster'].perk?.priceMult ?? 1) * (state.build?.priceMult ?? 1) * inflation(state, shopIndex))), sold: false });
  if (guarantee) for (const t of state.openers ?? []) add(t, 1);
  const allowed = (t: ItemTypeId) => !state.pool || state.pool.includes(t);
  const regular = ITEM_IDS.filter((t) => allowed(t) && !ITEMS[t].legendary && !ITEMS[t].noShop && !offers.some((o) => o.type === t));
  const legends = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].legendary);
  while (offers.length < ECONOMY.offerCount) {
    const needLegend = !!opts.forceLegendary && offers.length === ECONOMY.offerCount - 1 && !offers.some((o) => ITEMS[o.type].legendary);
    if (legends.length && (needLegend || (shopIndex >= 2 && rng() < lv.legendary + bonus))) { add(legends.splice(Math.floor(rng() * legends.length), 1)[0], 1); continue; }
    const families = new Set(owned.flatMap((i) => ITEMS[i.type].weaponFamily ? [ITEMS[i.type].weaponFamily!] : []));
    const needsPartner = guarantee && families.size === 1 && offers.length === ECONOMY.offerCount - 1 &&
      !offers.some((o) => ITEMS[o.type].weaponFamily && !families.has(ITEMS[o.type].weaponFamily!));
    const hasPartner = regular.some((t) => ITEMS[t].weaponFamily && !families.has(ITEMS[t].weaponFamily!));
    const ws = regular.map((t) => needsPartner && hasPartner && (!ITEMS[t].weaponFamily || families.has(ITEMS[t].weaponFamily!)) ? 0 :
      (guarantee ? 1 : weight(t, own, mergeable, state.weapon)) * (bias.includes(t) ? DEPT_TUNING.biasWeight : 1));
    let r = rng() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < regular.length - 1 && (r -= ws[i]) >= 0) i++;
    add(regular.splice(i, 1)[0], rng() < lv.tier3 ? 3 : rng() < lv.tier2 ? 2 : 1);
    if (shopIndex >= 2 && rng() < ECONOMY.doublePackChance) { const o = offers[offers.length - 1]; o.double = true; o.price = Math.round(o.price * ECONOMY.doublePackPriceMult); }
  }
  if (!opts.keep) return offers;
  const fresh = offers.slice(kept.length);
  return opts.keep.map((o, slot) => ({ ...(o.sold ? fresh.shift()! : { ...o }), slot }));
}

export function rollDoors(state: RunState, rng: Rng): DoorId[] {
  const idx = state.shop?.shopIndex ?? state.wave;
  if (idx + 1 >= BOSS_WAVE && !state.overtime) return ['boss'];
  const pool = [...DOOR_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const doors: DoorId[] = pool.slice(0, state.shopLevel >= DEPT_TUNING.threeDoorsAtLoyalty ? 3 : 2);
  if (idx >= DEPT_TUNING.clearanceFromShop && state.modifier !== 'clearance' && rng() < DEPT_TUNING.clearanceChance) doors[doors.length - 1] = 'clearance';
  // Special rooms: each regular slot may turn into one (never next to a clearance door, never the boss door).
  if (idx + 1 >= ROOMS.fromAisle && !doors.includes('clearance')) {
    for (let i = 0; i < doors.length; i++) {
      if (rng() < ROOMS.chance) { doors[i] = ROOM_DOORS[Math.floor(rng() * ROOM_DOORS.length)]; break; }
    }
  }
  if (canShortcut(state, idx)) doors.push('shortcut'); // last: callers that take doors[0] never pick it
  return doors;
}

/** Stockroom: three free items from the unlocked pool, pick one. */
export function rollStockroom(state: RunState, rng: Rng): ShopOffer[] {
  return rollOffers(state, rng, Math.max(2, state.wave), false).slice(0, ROOMS.stockroom.choices).map((o, slot) => ({ ...o, slot, price: 0 }));
}

/** Mid-shift boss loot: one unlocked legendary you don't own yet (if any), the rest distinct weapons at MINI_BOSS.weaponTier. Pick one. */
export function rollMiniCrates(state: RunState, rng: Rng): ShopOffer[] {
  const allowed = (t: ItemTypeId) => !state.pool || state.pool.includes(t);
  const owned = new Set([...state.inventory.placed, ...state.inventory.shelf].filter((i) => !!i).map((i) => i!.type));
  const take = (pool: ItemTypeId[]) => pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const legends = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].legendary && !owned.has(t));
  const weapons = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].kind === 'weapon' && !ITEMS[t].legendary);
  const picks: { type: ItemTypeId; tier: number }[] = legends.length ? [{ type: take(legends), tier: 1 }] : [];
  while (picks.length < MINI_BOSS.crates && weapons.length) picks.push({ type: take(weapons), tier: MINI_BOSS.weaponTier });
  return picks.map((p, slot) => ({ ...p, slot, price: 0, sold: false }));
}

/** Any door but Staff Only, which skips an aisle instead of leading into one. */
export type AisleDoor = Exclude<DoorId, 'shortcut'>;

export function doorAisle(state: RunState, id: AisleDoor): Pick<RunState, 'department' | 'modifier' | 'zone'> {
  const boss = id === 'boss';
  return { department: boss ? 'boss' : state.theme, modifier: boss ? 'none' : id, zone: state.doorZones?.[state.doors?.indexOf(id) ?? -1] ?? null };
}

/** Zone behind each door (parallel to `doors`): distinct per route screen, repeats get rarer; clearance / boss have none. */
export function rollZones(state: RunState, rng: Rng, doors: DoorId[]): (ZoneId | null)[] {
  const pool = zonesOf(state.theme);
  return doors.map((d) => {
    if (d === 'boss' || d === 'shortcut' || d === 'clearance' || ROOM_DOORS.includes(d) || !pool.length) return null;
    const ws = pool.map((z) => 1 / (1 + state.zones.filter((u) => u === z.id).length) ** ZONE_TUNING.repeatPenalty);
    let r = rng() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= ws[i]) >= 0) i++;
    return pool.splice(i, 1)[0].id;
  });
}

export type AisleSpec = Pick<RunState, 'wave' | 'department' | 'modifier' | 'zone' | 'theme' | 'shift'>;
export interface SpawnPlan { total: number; mix: Partial<Record<EnemyId, number>>; hpScale: number; speedScale: number; dmgScale: number }

const aisleZone = (a: AisleSpec) => (a.zone && a.department === a.theme ? ZONES[a.zone] : null);

export function waveSpawnPlan(state: AisleSpec): SpawnPlan {
  const w = waveDef(state.wave), d = DEPARTMENTS[state.department], sh = SHIFTS[state.shift], m = MODIFIERS[state.modifier];
  if (state.department === 'boss' || w.boss) return { total: w.total, mix: { ...w.mix }, hpScale: w.hpScale, speedScale: w.speedScale, dmgScale: w.dmgScale * sh.dmgMult };
  const T = DEPT_TUNING, mix: Partial<Record<EnemyId, number>> = {}, zone = aisleZone(state);
  for (const [k, v] of Object.entries(w.mix) as [EnemyId, number][]) mix[k] = v * (d.mix[k] ?? (T.basics.includes(k) ? 1 : T.offTheme));
  if (zone) for (const [k, m] of Object.entries(zone.tilt) as [EnemyId, number][]) if (mix[k] !== undefined) mix[k] *= m;
  return { total: Math.round(w.total * d.countMult * m.countMult * sh.countMult), mix, hpScale: w.hpScale * d.hpMult * m.hpMult * sh.hpMult, speedScale: w.speedScale * d.speedMult * sh.speedMult, dmgScale: w.dmgScale * sh.dmgMult };
}

export type EliteOdds = 'none' | 'some' | 'more' | 'all';
export interface AislePreview { plan: SpawnPlan; top: EnemyId[]; elites: EliteOdds; hazard: HazardLayout }

/**
 * The aisle behind a door, read on the route screen without choosing it (no state change, no random draw): its spawn plan, the 3 most
 * common groceries by expected count, the elite odds and the floor hazard. An elite's affix is rolled when it spawns, so it is never shown.
 */
export function previewAisle(state: RunState, id: AisleDoor): AislePreview {
  const a: AisleSpec = { ...doorAisle(state, id), wave: state.wave + 1, theme: state.theme, shift: state.shift };
  const plan = waveSpawnPlan(a), w = waveDef(a.wave), bonus = w.boss ? 0 : MODIFIERS[a.modifier].eliteBonus;
  const common = plan.total > 0 ? (Object.entries(plan.mix) as [EnemyId, number][]).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([k]) => k) : [];
  const eligible = common.find((k) => !ELITE_EXCLUDED.includes(k)), chance = eligible ? eliteChance(eligible, w, a.shift) + bonus : 0;
  return { plan, top: common.slice(0, 3), elites: chance <= 0 ? 'none' : chance >= 1 ? 'all' : bonus > 0 ? 'more' : 'some', hazard: aisleHazard(a) };
}

export interface HazardLayout { kind: HazardKind; spots: number; beltSpeed: number }

/** Overtime keeps the aisle-7 values; both belts always run. */
export function aisleHazard(a: AisleSpec): HazardLayout {
  const T = DEPT_TUNING, kind: HazardKind = a.modifier === 'stockroom' ? 'none' : DEPARTMENTS[a.department].hazard;
  const ramp = Math.min(Math.max(a.wave, 1), 7) - 1, extra = Math.floor(ramp / 3) + (aisleZone(a)?.hazardExtra ?? 0);
  const n = (base: number, len: number) => Math.min(len, Math.max(1, base + extra));
  const spots: Record<HazardKind, number> = { none: 0, ice: n(T.ice.patches, ICE_SPOTS.length), vents: n(T.vents.count, VENT_SPOTS.length), cables: n(T.cables.count, CABLE_ROWS.length), conveyor: BELTS.length };
  return { kind, spots: spots[kind], beltSpeed: T.conveyor.speed * (1 + 0.04 * ramp) };
}
