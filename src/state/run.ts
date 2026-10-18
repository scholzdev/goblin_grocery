import { t } from '../i18n';
import { ITEMS, ITEM_IDS, PLAYER, SIGNATURE, STARTER_WEAPONS, TIER, signatureOf } from '../data/items';
import { DEPARTMENTS } from '../data/departments';
import { MODIFIERS, type DoorId } from '../data/modifiers';
import { BOSS_WAVE, ECONOMY, SHIFTS, SHOP_LEVELS } from '../data/waves';
import type { DepartmentId, ElementTag, Build, Inventory, ItemInstance, ItemTypeId, LabOpts, OpResult, Rotation, RunState, StarterId, StarterWeapon } from '../types';
import { canPlace, findItem, normalizeRotation } from '../systems/inventory';
import { mulberry32, type Rng } from '../systems/rng';
import { zonesOf } from '../data/zones';
import { currentRerollCost, repairCost, rollDoors, rollOffers, rollZones, sellPrice } from '../systems/shop';
import { computeBuild } from '../systems/synergies';
import { newDamageStats } from '../systems/damageStats';
import { contentSetTune, contentTune } from '../engine/registry';
import { FLAVORS } from '../engine/define';
import { PUNCH_REROLLS } from '../systems/contracts';
import { canShortcut, spendKey } from '../systems/shortcut';

const fail = (reason: string): OpResult => ({ ok: false, reason });
const OK: OpResult = { ok: true };

export function newUid(state: RunState): string {
  return `i${state.nextUid++}`;
}

/** Jelly Beans start with a flavor drawn from the run seed (no rng at the creation sites); reshuffled by rollFlavors on every shop open. */
const newFlavor = (state: RunState, type: ItemTypeId): { flavor?: ElementTag } =>
  type === 'jellybeans' ? { flavor: FLAVORS[Math.floor(mulberry32(state.seed ^ Math.imul(state.nextUid, 0x9e3779b1) ^ state.wave)() * FLAVORS.length)] } : {};

/** Every shop visit re-rolls the flavor of all owned Jelly Beans (cart and shelf). */
export function rollFlavors(state: RunState, rng: Rng): void {
  for (const i of [...state.inventory.placed, ...state.inventory.shelf]) if (i?.type === 'jellybeans') i.flavor = FLAVORS[Math.floor(rng() * FLAVORS.length)];
  recomputeBuild(state);
}

export function createRun(seed: number, starter: StarterId = 'toaster', shift = 0, weapon: StarterWeapon = 'toaster', theme: DepartmentId = 'main'): RunState {
  const inventory: Inventory = { cols: 4, rows: 4, placed: [], shelf: Array(ECONOMY.shelfSlots).fill(null) };
  const zs = zonesOf(theme), zone = zs.length ? zs[Math.floor(mulberry32(seed ^ 0x2f6b9d)() * zs.length)].id : null; // aisle 1's zone, from the seed
  const state: RunState = {
    phase: 'title', wave: 1, hp: PLAYER.maxHp, money: PLAYER.startMoney + (PLAYER.starters[starter].perk?.startMoney ?? 0), inventory,
    build: undefined as unknown as Build, shop: null, shopLevel: 1, starter, weapon, shift, theme, department: theme, modifier: 'none', route: [theme], mods: ['none'], doors: null, zone, zones: [zone], doorZones: null, coinLog: [], nextUid: 1, seed,
    stats: { kills: 0, coinsEarned: 0, damageByWeapon: {}, damage: newDamageStats(), wavesCleared: 0, timeSeconds: 0, bossDefeated: false },
  };
  const w = STARTER_WEAPONS[weapon];
  inventory.placed.push({ uid: newUid(state), type: weapon, x: w.x, y: w.y, rot: w.rot });
  state.build = computeBuild(inventory, PLAYER.starters[starter].perk);
  state.hp = state.build.maxHp;
  return state;
}

/** Test Lab: a run parked in the shop before aisle `o.aisle`, with an empty cart and every item unlocked. */
export function createLabRun(seed: number, o: LabOpts): RunState {
  const s = createRun(seed, o.starter, o.shift, o.weapon, o.dept === 'boss' ? 'main' : o.dept);
  s.inventory = { cols: o.cart[0], rows: o.cart[1], placed: [], shelf: Array(o.shelf).fill(null) };
  s.wave = o.sandbox ? o.aisle : o.aisle - 1; // the sandbox never advances, so it sits on the chosen aisle
  s.money = o.money;
  s.shopLevel = o.shopLevel;
  s.unlocked = [...ITEM_IDS];
  s.lab = true;
  s.labGod = o.god;
  s.labEvent = o.event ?? 'random';
  s.labDept = o.aisle === BOSS_WAVE ? 'boss' : s.theme;
  s.labMod = o.mod ?? 'none';
  s.labSandbox = !!o.sandbox;
  s.department = s.labDept;
  if (o.aisle > BOSS_WAVE) s.overtime = true;
  recomputeBuild(s);
  s.hp = s.build.maxHp;
  return s;
}

/** Door of the next lab aisle: the chosen modifier (the boss aisle is always the boss). */
export const labDoor = (s: RunState): DoorId =>
  s.wave + 1 === BOSS_WAVE && !s.overtime ? 'boss' : s.labMod ?? 'none';

/** Free copy of `type` at `tier` (legendaries ★1) on the first empty shelf slot. */
export function labAddItem(state: RunState, type: ItemTypeId, tier: number): OpResult {
  if (state.phase !== 'shop') return fail(t('rShopClosed'));
  const free = state.inventory.shelf.indexOf(null);
  if (free < 0) return fail(t('rShelfFull'));
  state.inventory.shelf[free] = { uid: newUid(state), type, x: 0, y: 0, rot: 0, tier: ITEMS[type].legendary ? 1 : Math.max(1, Math.min(TIER.max, tier)), ...newFlavor(state, type) };
  return OK;
}

export function labClear(state: RunState): void {
  state.inventory.placed = [];
  state.inventory.shelf.fill(null);
  recomputeBuild(state);
}

const perkOf = (state: RunState) => PLAYER.starters[state.starter ?? 'toaster'].perk;

export function recomputeBuild(state: RunState): void {
  state.build = computeBuild(state.inventory, perkOf(state));
  state.hp = Math.min(state.hp, state.build.maxHp);
}

export const ownedTypes = (state: RunState): ItemTypeId[] =>
  [...state.inventory.placed, ...state.inventory.shelf.filter((s): s is ItemInstance => !!s)].map((i) => i.type);

export type MoveTarget = { where: 'grid'; x: number; y: number; rot: Rotation } | { where: 'shelf'; slot: number };

/** Validates fully, then mutates `inv`. */
function applyMove(inv: Inventory, uid: string, tg: MoveTarget): OpResult {
  const f = findItem(inv, uid);
  if (!f) return fail(t('rNoItem'));
  const inst = f.inst;
  if (tg.where === 'grid') {
    const rot = normalizeRotation(inst.type, tg.rot, inst.tier);
    const r = canPlace(inv, inst.type, tg.x, tg.y, rot, uid, inst.tier);
    if (!r.ok) return r;
    if (f.where === 'shelf') { inv.shelf[f.slot] = null; inv.placed.push(inst); }
    inst.x = tg.x; inst.y = tg.y; inst.rot = rot;
  } else {
    if (!Number.isInteger(tg.slot) || tg.slot < 0 || tg.slot >= inv.shelf.length) return fail(t('rNoSlot'));
    const ownSlot = f.where === 'shelf' && f.slot === tg.slot;
    if (inv.shelf[tg.slot] && !ownSlot) return fail(t('rSlotTaken'));
    if (f.where === 'grid') inv.placed.splice(inv.placed.indexOf(inst), 1);
    else inv.shelf[f.slot] = null;
    inst.x = 0; inst.y = 0; inst.rot = 0;
    inv.shelf[tg.slot] = inst;
  }
  return OK;
}

export function moveItem(state: RunState, uid: string, target: MoveTarget): OpResult {
  if (state.phase !== 'shop') return fail(t('rNoRearrange'));
  const r = applyMove(state.inventory, uid, target);
  if (r.ok) recomputeBuild(state);
  return r;
}

export function previewMove(state: RunState, uid: string, target: MoveTarget): { result: OpResult; build: Build | null } {
  if (state.phase !== 'shop') return { result: fail(t('rNoRearrange')), build: null };
  const inv = structuredClone(state.inventory);
  const result = applyMove(inv, uid, target);
  return { result, build: result.ok ? computeBuild(inv, perkOf(state)) : null };
}

export const itemValue = (i: ItemInstance): number => TIER.value(ITEMS[i.type].price, i.tier ?? 1);

export function upgradeCost(i: ItemInstance): number | null {
  const t = i.tier ?? 1;
  return ITEMS[i.type].legendary || t >= TIER.max ? null : TIER.upgradeCost(ITEMS[i.type].price, t);
}

/** Validates, then removes `uid` and raises the target's tier. */
function applyMerge(inv: Inventory, uid: string, targetUid: string): OpResult {
  const a = findItem(inv, uid), b = findItem(inv, targetUid);
  if (!a || !b || a.inst === b.inst || a.inst.type !== b.inst.type) return fail(t('rMergeIdentical'));
  if (ITEMS[a.inst.type].legendary) return fail(t('rLegNoMerge'));
  if ((a.inst.tier ?? 1) !== (b.inst.tier ?? 1)) return fail(t('rTiersMatch'));
  if ((b.inst.tier ?? 1) >= TIER.max) return fail(t('rMaxTier'));
  // Sourdough changes shape with its tier: the merged shape must fit where it sits (the consumed copy's cells are free).
  if (b.where === 'grid' && !canPlace({ ...inv, placed: inv.placed.filter((p) => p !== a.inst) }, b.inst.type, b.inst.x, b.inst.y, b.inst.rot, b.inst.uid, (b.inst.tier ?? 1) + 1).ok) return fail(t('rNoFit'));
  if (a.where === 'grid') inv.placed.splice(inv.placed.indexOf(a.inst), 1);
  else inv.shelf[a.slot] = null;
  b.inst.tier = (b.inst.tier ?? 1) + 1;
  if (a.inst.double) b.inst.double = true;
  return OK;
}

/** The owned copy (cart first, then shelf) that a new `type`/`tier` item would merge into, or null. */
export function mergeTargetFor(inv: Inventory, type: ItemTypeId, tier: number, except?: ItemInstance): ItemInstance | null {
  if (ITEMS[type].legendary || tier >= TIER.max) return null;
  return [...inv.placed, ...inv.shelf].find((i) => i && i !== except && i.type === type && (i.tier ?? 1) === tier) ?? null;
}

export function mergeItems(state: RunState, uid: string, targetUid: string): OpResult {
  if (state.phase !== 'shop') return fail(t('rNoRearrange'));
  const r = applyMerge(state.inventory, uid, targetUid);
  if (r.ok) {
    recomputeBuild(state);
    if (signatureOf(state.starter) === 'mergeHeal') state.hp = Math.min(state.build.maxHp, state.hp + SIGNATURE.mergeHeal.hp); // Line Cook
  }
  return r;
}

export function previewMerge(state: RunState, uid: string, targetUid: string): { result: OpResult; build: Build | null } {
  if (state.phase !== 'shop') return { result: fail(t('rNoRearrange')), build: null };
  const inv = structuredClone(state.inventory);
  const result = applyMerge(inv, uid, targetUid);
  return { result, build: result.ok ? computeBuild(inv, perkOf(state)) : null };
}

export function upgradeItem(state: RunState, uid: string): OpResult {
  if (state.phase !== 'shop') return fail(t('rShopClosed'));
  const f = findItem(state.inventory, uid);
  if (!f) return fail(t('rNoItem'));
  if (ITEMS[f.inst.type].legendary) return fail(t('rLegNoUpgrade'));
  const cost = upgradeCost(f.inst);
  if (cost === null) return fail(t('rMaxTier'));
  if (state.money < cost) return fail(t('needCoins', { n: cost - state.money }));
  if (f.where === 'grid' && !canPlace(state.inventory, f.inst.type, f.inst.x, f.inst.y, f.inst.rot, f.inst.uid, (f.inst.tier ?? 1) + 1).ok) return fail(t('rNoFit'));
  state.money -= cost;
  f.inst.tier = (f.inst.tier ?? 1) + 1;
  recomputeBuild(state);
  return OK;
}

export const shopUpgradeCost = (state: RunState): number | null =>
  state.shopLevel >= SHOP_LEVELS.length ? null : SHOP_LEVELS[state.shopLevel - 1].upgradeCost;

export function upgradeShop(state: RunState): OpResult {
  if (state.phase !== 'shop' || !state.shop) return fail(t('rShopClosed'));
  const cost = shopUpgradeCost(state);
  if (cost === null) return fail(t('rLoyaltyMax'));
  if (state.money < cost) return fail(t('needCoins', { n: cost - state.money }));
  state.money -= cost;
  state.shopLevel++;
  return OK;
}

export function buyOffer(state: RunState, slot: number): OpResult {
  if (state.phase !== 'shop' || !state.shop) return fail(t('rShopClosed'));
  const o = state.shop.offers[slot];
  if (!o || o.sold) return fail(t('rNotAvailable'));
  if (state.money < o.price) return fail(t('needCoins', { n: o.price - state.money }));
  const free = state.inventory.shelf.indexOf(null);
  if (free < 0) return fail(t('rShelfFullSell'));
  state.money -= o.price;
  state.inventory.shelf[free] = { uid: newUid(state), type: o.type, x: 0, y: 0, rot: 0, tier: o.tier, ...(o.double ? { double: true } : {}), ...newFlavor(state, o.type) };
  o.sold = true;
  return OK;
}

/** Stockroom: take the free item (shelf full: its sell price in coins instead). Returns true if it went on the shelf. */
export function takeStockroomItem(state: RunState, o: { type: ItemTypeId; tier: number; double?: boolean }): boolean {
  const free = state.inventory.shelf.indexOf(null);
  if (free < 0) { addCoins(state, sellPrice(o.type, o.tier), t('coinStockroom')); return false; }
  state.inventory.shelf[free] = { uid: newUid(state), type: o.type, x: 0, y: 0, rot: 0, tier: o.tier, ...(o.double ? { double: true } : {}), ...newFlavor(state, o.type) };
  return true;
}

export function sellItem(state: RunState, uid: string): OpResult {
  if (state.phase !== 'shop') return fail(t('rNoSell'));
  const f = findItem(state.inventory, uid);
  if (!f) return fail(t('rNoItem'));
  if (f.where === 'grid') state.inventory.placed.splice(state.inventory.placed.indexOf(f.inst), 1);
  else state.inventory.shelf[f.slot] = null;
  state.money += sellPrice(f.inst.type, f.inst.tier ?? 1);
  recomputeBuild(state);
  return OK;
}

export function reroll(state: RunState, rng: Rng): OpResult {
  if (state.phase !== 'shop' || !state.shop) return fail(t('rShopClosed'));
  const cost = currentRerollCost(state);
  const bonus = state.shop.bonusFreeRerolls > 0;
  if (state.money < cost) return fail(t('needCoins', { n: cost - state.money }));
  state.money -= cost;
  state.shop.offers = rollOffers(state, rng, state.shop.shopIndex, false, { bias: state.shop.bias, legendaryBonus: state.shop.legendaryBonus }); // guarantee is initial-roll only
  if (bonus) state.shop.bonusFreeRerolls--; else if (cost === 0) state.shop.freeRerollUsed = true; else state.shop.rerolls++;
  return OK;
}

export function repair(state: RunState): OpResult {
  if (state.phase !== 'shop' || !state.shop) return fail(t('rShopClosed'));
  if (state.shop.repairUsed) return fail(t('rRepairedAlready'));
  if (state.hp >= state.build.maxHp) return fail(t('rFullHealth'));
  const cost = repairCost(state);
  if (state.money < cost) return fail(t('needCoins', { n: cost - state.money }));
  state.money -= cost;
  state.hp = Math.min(state.build.maxHp, state.hp + ECONOMY.repairHp);
  state.shop.repairUsed = true;
  return OK;
}

/**
 * Sourdough Starter: one aisle more cooked; every `every` aisles (content tune) it rises a star (and a cell).
 * In the cart the grown shape must fit at its anchor and rotation, otherwise it stays pending and retries next shop. Returns true if any is pending.
 */
export function riseSourdough(state: RunState): boolean {
  let wait = false;
  const every = contentTune('sourdough', 1).every;
  for (const i of [...state.inventory.placed, ...state.inventory.shelf]) {
    if (i?.type !== 'sourdough' || (i.tier ?? 1) >= TIER.max) continue;
    if ((i.rise = (i.rise ?? 0) + 1) < every) continue;
    const nt = (i.tier ?? 1) + 1;
    if (state.inventory.placed.includes(i) && !canPlace(state.inventory, i.type, i.x, i.y, i.rot, i.uid, nt).ok) { i.rise = every; wait = true; continue; }
    i.tier = nt; i.rise = 0;
  }
  return wait;
}

export function openShop(state: RunState, rng: Rng): void {
  state.phase = 'shop';
  const d = DEPARTMENTS[state.department];
  const m = MODIFIERS[state.modifier];
  const opts = { bias: [...d.shopBias], legendaryBonus: d.legendaryBonus, forceLegendary: d.forceLegendary || m.forceLegendary };
  state.shop = { offers: rollOffers(state, rng, state.wave, state.wave === 1, opts), rerolls: 0, repairUsed: false, freeRerollUsed: false, bonusFreeRerolls: m.freeRerolls + (signatureOf(state.starter) === 'freeReroll' ? SIGNATURE.freeReroll.rerolls : 0), shopIndex: state.wave, ...opts };
  if (state.punch?.status === 'done') { state.shop.bonusFreeRerolls += PUNCH_REROLLS; state.punch = undefined; } // Punch Card: the completed goal's free reroll
  state.shop.riseWait = riseSourdough(state);
  rollFlavors(state, rng); // recomputes the build (after sourdough tiers changed)
}

export function addCoins(state: RunState, amount: number, label: string): void {
  state.money += amount;
  state.stats.coinsEarned += amount;
  const e = state.coinLog.find((c) => c.label === label);
  if (e) e.amount += amount; else state.coinLog.push({ label, amount });
}

/** Punch Card completed: its coins (the receipt lists them); the free reroll comes with the next shop. */
export function payPunchCard(state: RunState): void {
  if (state.punch?.status === 'done') addCoins(state, state.punch.coins, t('coinPunchCard'));
}

export function finishWave(state: RunState): void {
  addCoins(state, Math.round(ECONOMY.waveClearBonus * DEPARTMENTS[state.department].coinMult * MODIFIERS[state.modifier].coinMult * SHIFTS[state.shift].coinMult), t('coinWaveClear'));
  const ck = contentSetTune('checkout', state.build.sets.checkout);
  const interest = state.build.sets.checkout >= 2 ? Math.min(ck.interestCap, Math.floor(state.money / ck.interestPer)) : 0;
  if (interest > 0) addCoins(state, interest, t('coinInterest'));
  state.stats.wavesCleared++;
  state.hp = Math.min(state.build.maxHp, state.hp + PLAYER.repairBetweenWaves);
  state.phase = 'checkout';
}

export function startNextWave(state: RunState): void {
  state.wave++;
  state.phase = 'combat';
  state.shop = null;
  state.coinLog = [];
}

export function damagePlayer(state: RunState, amount: number): boolean {
  state.hp = Math.max(0, state.hp - amount); // armor (Bubble Wrap) is an onPlayerHit hook: ArenaScene.hurtPlayer lowers `amount` first
  if (state.hp > 0) return false;
  state.phase = 'defeat';
  return true;
}

export function leaveShop(state: RunState, rng: Rng): OpResult {
  if (state.phase !== 'shop' || !state.shop) return fail(t('rShopClosed'));
  state.doors = state.lab ? [labDoor(state), ...(canShortcut(state, state.wave) ? ['shortcut' as const] : [])] : rollDoors(state, rng); // a lab aisle has its one door, plus Staff Only while a key is owned
  state.doorZones = rollZones(state, rng, state.doors);
  state.phase = 'route';
  return OK;
}

/**
 * Staff Only door: the next aisle is skipped (no fight, no clear bonus, no shop), the goblin heals to full and `startNextWave` then lands on the aisle after it.
 * The skipped aisle keeps a plain entry in route / mods / zones, which are indexed by aisle. The key turns into a Spent Key.
 */
function takeShortcut(state: RunState): OpResult {
  if (!canShortcut(state, state.wave)) return fail(t('rDoorUnavailable'));
  spendKey(state.inventory);
  state.route.push(state.theme); state.mods.push('none'); state.zones.push(null);
  state.skipped = state.wave + 1;
  (state.skippedAisles ??= []).push(state.skipped);
  state.wave++;
  const landing = state.wave + 1, boss = landing === BOSS_WAVE && !state.overtime;
  const zone = boss ? null : rollZones(state, mulberry32(state.seed ^ Math.imul(landing, 0x9e3779b1)), ['none'])[0];
  state.department = boss ? 'boss' : state.labDept ?? state.theme;
  state.modifier = state.lab && !boss ? state.labMod ?? 'none' : 'none';
  state.route.push(state.department); state.mods.push(state.modifier); state.zone = zone; state.zones.push(zone);
  state.doors = null;
  state.doorZones = null;
  recomputeBuild(state);
  state.hp = state.build.maxHp;
  return OK;
}

export function chooseDoor(state: RunState, id: DoorId): OpResult {
  if (state.phase !== 'route' || !state.doors) return fail(t('rNoDoors'));
  if (!state.doors.includes(id)) return fail(t('rDoorUnavailable'));
  if (id === 'shortcut') return takeShortcut(state);
  const zone = state.doorZones?.[state.doors.indexOf(id)] ?? null;
  state.department = id === 'boss' ? 'boss' : state.theme;
  state.modifier = id === 'boss' ? 'none' : id;
  state.route.push(state.department);
  state.mods.push(state.modifier);
  state.zone = zone;
  state.zones.push(zone);
  state.doors = null;
  state.doorZones = null;
  return OK;
}

// ── Store services: bigger cart / extra shelf slot ──
const cartStep = (inv: Inventory): number => ECONOMY.cartSizes.findIndex(([c, r]) => c > inv.cols || r > inv.rows);
const shelfStep = (inv: Inventory): number => ECONOMY.shelfSizes.findIndex((n) => n > inv.shelf.length);

/** Price of the next cart size, or null when maxed. */
export function cartUpgradeCost(state: RunState): number | null {
  const i = cartStep(state.inventory);
  return i < 0 ? null : ECONOMY.cartPrices[i];
}

export function nextCartSize(state: RunState): [number, number] | null {
  const i = cartStep(state.inventory);
  return i < 0 ? null : ECONOMY.cartSizes[i];
}

export function upgradeCart(state: RunState): OpResult {
  if (state.phase !== 'shop') return fail(t('rShopClosed'));
  const i = cartStep(state.inventory);
  if (i < 0) return fail(t('rCartMax'));
  const cost = ECONOMY.cartPrices[i];
  if (state.money < cost) return fail(t('needCoins', { n: cost - state.money }));
  state.money -= cost;
  [state.inventory.cols, state.inventory.rows] = ECONOMY.cartSizes[i];
  recomputeBuild(state);
  return OK;
}

export function shelfUpgradeCost(state: RunState): number | null {
  const i = shelfStep(state.inventory);
  return i < 0 ? null : ECONOMY.shelfPrices[i];
}

export function upgradeShelf(state: RunState): OpResult {
  if (state.phase !== 'shop') return fail(t('rShopClosed'));
  const i = shelfStep(state.inventory);
  if (i < 0) return fail(t('rShelfMax'));
  const cost = ECONOMY.shelfPrices[i];
  if (state.money < cost) return fail(t('needCoins', { n: cost - state.money }));
  state.money -= cost;
  while (state.inventory.shelf.length < ECONOMY.shelfSizes[i]) state.inventory.shelf.push(null);
  return OK;
}
