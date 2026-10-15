import { MINI_BOSS } from '../data/enemies';
import { DEPARTMENTS, DEPT_TUNING } from '../data/departments';
import { DOOR_POOL, MODIFIERS, ROOMS, ROOM_DOORS, type DoorId } from '../data/modifiers';
import { BOSS_WAVE, ECONOMY, SHIFTS, SHOP_LEVELS, waveDef } from '../data/waves';
import { PLAYER, ITEMS, ITEM_IDS, STARTER_WEAPONS, TIER } from '../data/items';
import { RECIPES } from '../data/recipes';
import { ZONES, ZONE_TUNING, zonesOf, type ZoneId } from '../data/zones';
import type { EnemyId, ItemTypeId, RunState, ShopOffer } from '../types';
import type { Rng } from './rng';

export const sellPrice = (type: ItemTypeId, tier = 1): number => Math.floor(TIER.value(ITEMS[type].price, tier) / 2);
export const rerollCost = (rerollsDone: number, shopIndex: number): number => (ECONOMY.rerollBase + Math.ceil(shopIndex / 2)) * (rerollsDone + 1);
const shopIdx = (state: RunState) => state.shop?.shopIndex ?? state.wave;
/** Item price multiplier for the current shop (1 in shop 1). */
export const inflation = (state: RunState, shopIndex = shopIdx(state)): number => 1 + ECONOMY.inflationPerShop * Math.max(0, shopIndex - 1);
export const repairCost = (state: RunState): number => ECONOMY.repairBase + ECONOMY.repairPerShop * shopIdx(state);

const anyWeapon = (o: Set<ItemTypeId>) => [...o].some((t) => ITEMS[t].kind === 'weapon');
const ENHANCES: Partial<Record<ItemTypeId, (own: Set<ItemTypeId>) => boolean>> = {
  fan: anyWeapon, fuel: anyWeapon, battery: anyWeapon, ice: anyWeapon, hotsauce: anyWeapon, pricegun: anyWeapon, tape: anyWeapon,
  popper: anyWeapon, doublebag: anyWeapon, multipack: anyWeapon,
  magnet: (o) => o.has('nailgun'),
  bell: (o) => o.has('pan'),
  bumper: (o) => o.has('cooker') || o.has('bell') || o.has('boot'),
  sparewheel: (o) => o.has('bell') || o.has('boot'),
  tipjar: (o) => o.has('bell') || o.has('boot') || o.has('sparewheel'),
  flag: (o) => o.has('bell') || o.has('boot') || o.has('sparewheel'),
  lunchbox: (o) => o.has('microwave'),
  coupon: (o) => o.has('fizz'),
};

function weight(t: ItemTypeId, own: Set<ItemTypeId>): number {
  if (ITEMS[t].kind === 'weapon') return own.has(t) ? 1.6 : 1.3;
  if (Object.values(RECIPES).some((r) => own.has(r.weapon) && r.supports.includes(t))) return 2.2;
  return ENHANCES[t]?.(own) ? 1.8 : 1;
}

export function currentRerollCost(state: RunState): number {
  const sh = state.shop;
  if (!sh) return rerollCost(0, shopIdx(state));
  if (sh.bonusFreeRerolls > 0) return 0;
  return SHOP_LEVELS[state.shopLevel - 1].freeReroll && !sh.freeRerollUsed ? 0 : rerollCost(sh.rerolls, sh.shopIndex);
}

/** `guarantee`: shop 1's initial roll includes the starting weapon's two suggested items at ★1 (default: only when shopIndex is 1). */
export interface RollOpts { bias?: ItemTypeId[]; legendaryBonus?: number; forceLegendary?: boolean }

export function rollOffers(state: RunState, rng: Rng, shopIndex: number, guarantee = shopIndex === 1, opts: RollOpts = {}): ShopOffer[] {
  const bias = opts.bias ?? [], bonus = opts.legendaryBonus ?? 0;
  const { placed, shelf } = state.inventory;
  const own = new Set<ItemTypeId>([...placed.map((p) => p.type), ...shelf.filter((s) => !!s).map((s) => s!.type)]);
  const lv = SHOP_LEVELS[Math.max(0, Math.min(SHOP_LEVELS.length, state.shopLevel) - 1)];
  const offers: ShopOffer[] = [];
  // Checkout set discount is baked in at roll time: offers already on the table keep their price until the next reroll.
  const add = (type: ItemTypeId, tier: number) => offers.push({ slot: offers.length, type, tier, price: Math.max(1, Math.round(TIER.value(ITEMS[type].price, tier) * (PLAYER.starters[state.starter ?? 'toaster'].perk?.priceMult ?? 1) * (state.build?.priceMult ?? 1) * inflation(state, shopIndex))), sold: false });
  if (guarantee) for (const t of STARTER_WEAPONS[state.weapon ?? 'toaster'].guarantee) add(t, 1);
  // Locked items (meta-progression) never show up.
  const allowed = (t: ItemTypeId) => !state.unlocked || state.unlocked.includes(t);
  const pool = ITEM_IDS.filter((t) => allowed(t) && !ITEMS[t].legendary && !offers.some((o) => o.type === t));
  const legends = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].legendary);
  while (offers.length < ECONOMY.offerCount) {
    const needLegend = !!opts.forceLegendary && offers.length === ECONOMY.offerCount - 1 && !offers.some((o) => ITEMS[o.type].legendary);
    if (legends.length && (needLegend || (shopIndex >= 2 && rng() < lv.legendary + bonus))) { add(legends.splice(Math.floor(rng() * legends.length), 1)[0], 1); continue; }
    const ws = pool.map((t) => (guarantee ? 1 : weight(t, own)) * (bias.includes(t) ? DEPT_TUNING.biasWeight : 1));
    let r = rng() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= ws[i]) >= 0) i++;
    add(pool.splice(i, 1)[0], rng() < lv.tier3 ? 3 : rng() < lv.tier2 ? 2 : 1);
    // Double pack: counts as 2 types in its family set, costs x1.5 (never legendary, never the guaranteed starters).
    if (shopIndex >= 2 && rng() < ECONOMY.doublePackChance) { const o = offers[offers.length - 1]; o.double = true; o.price = Math.round(o.price * ECONOMY.doublePackPriceMult); }
  }
  return offers;
}

export function rollDoors(state: RunState, rng: Rng): DoorId[] {
  const idx = state.shop?.shopIndex ?? state.wave;
  if (idx + 1 >= BOSS_WAVE && !state.overtime) return ['boss'];
  const pool = [...DOOR_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const doors = pool.slice(0, state.shopLevel >= DEPT_TUNING.threeDoorsAtLoyalty ? 3 : 2);
  if (idx >= DEPT_TUNING.clearanceFromShop && state.modifier !== 'clearance' && rng() < DEPT_TUNING.clearanceChance) doors[doors.length - 1] = 'clearance';
  // Special rooms: each regular slot may turn into one (never next to a clearance door, never the boss door).
  if (idx + 1 >= ROOMS.fromAisle && !doors.includes('clearance')) {
    for (let i = 0; i < doors.length; i++) {
      if (rng() < ROOMS.chance) { doors[i] = ROOM_DOORS[Math.floor(rng() * ROOM_DOORS.length)]; break; }
    }
  }
  return doors;
}

/** Stockroom: three free items from the unlocked pool, pick one. */
export function rollStockroom(state: RunState, rng: Rng): ShopOffer[] {
  return rollOffers(state, rng, Math.max(2, state.wave), false).slice(0, ROOMS.stockroom.choices).map((o, slot) => ({ ...o, slot, price: 0 }));
}

/** Mid-shift boss loot: one unlocked legendary you don't own yet (if any), the rest distinct weapons at MINI_BOSS.weaponTier. Pick one. */
export function rollMiniCrates(state: RunState, rng: Rng): ShopOffer[] {
  const allowed = (t: ItemTypeId) => !state.unlocked || state.unlocked.includes(t);
  const owned = new Set([...state.inventory.placed, ...state.inventory.shelf].filter((i) => !!i).map((i) => i!.type));
  const take = (pool: ItemTypeId[]) => pool.splice(Math.floor(rng() * pool.length), 1)[0];
  const legends = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].legendary && !owned.has(t));
  const weapons = ITEM_IDS.filter((t) => allowed(t) && ITEMS[t].kind === 'weapon' && !ITEMS[t].legendary);
  const picks: { type: ItemTypeId; tier: number }[] = legends.length ? [{ type: take(legends), tier: 1 }] : [];
  while (picks.length < MINI_BOSS.crates && weapons.length) picks.push({ type: take(weapons), tier: MINI_BOSS.weaponTier });
  return picks.map((p, slot) => ({ ...p, slot, price: 0, sold: false }));
}

/** Zone behind each door (parallel to `doors`): distinct per route screen, repeats get rarer; clearance / boss have none. */
export function rollZones(state: RunState, rng: Rng, doors: DoorId[]): (ZoneId | null)[] {
  const pool = zonesOf(state.theme);
  return doors.map((d) => {
    if (d === 'boss' || d === 'clearance' || ROOM_DOORS.includes(d) || !pool.length) return null;
    const ws = pool.map((z) => 1 / (1 + state.zones.filter((u) => u === z.id).length) ** ZONE_TUNING.repeatPenalty);
    let r = rng() * ws.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= ws[i]) >= 0) i++;
    return pool.splice(i, 1)[0].id;
  });
}

export function waveSpawnPlan(state: RunState): { total: number; mix: Partial<Record<EnemyId, number>>; hpScale: number; speedScale: number; dmgScale: number } {
  const w = waveDef(state.wave), d = DEPARTMENTS[state.department], sh = SHIFTS[state.shift], m = MODIFIERS[state.modifier];
  if (state.department === 'boss' || w.boss) return { total: w.total, mix: { ...w.mix }, hpScale: w.hpScale, speedScale: w.speedScale, dmgScale: w.dmgScale * sh.dmgMult };
  const T = DEPT_TUNING, mix: Partial<Record<EnemyId, number>> = {};
  for (const [k, v] of Object.entries(w.mix) as [EnemyId, number][]) mix[k] = v * (d.mix[k] ?? (T.basics.includes(k) ? 1 : T.offTheme));
  if (state.zone && state.department === state.theme) for (const [k, m] of Object.entries(ZONES[state.zone].tilt) as [EnemyId, number][]) if (mix[k] !== undefined) mix[k] *= m;
  return { total: Math.round(w.total * d.countMult * m.countMult * sh.countMult), mix, hpScale: w.hpScale * d.hpMult * m.hpMult * sh.hpMult, speedScale: w.speedScale * d.speedMult * sh.speedMult, dmgScale: w.dmgScale * sh.dmgMult };
}
