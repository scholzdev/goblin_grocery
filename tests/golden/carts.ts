import { ITEMS, ITEM_IDS, PLAYER, WEAPON_IDS } from '../../src/data/items';
import { RECIPES, recipeParts } from '../../src/data/recipes';
import { adjacentPairs, canPlace } from '../../src/systems/inventory';
import type { ElementTag, Inventory, ItemInstance, ItemTypeId, Perk, SetId, StarterId } from '../../src/types';

/**
 * Fixed cart fixtures for the golden tests. Everything here is deterministic: uids are `u<index>`,
 * placement is a fixed scan (rotation, then y, then x), flavors are explicit, no RNG, no clock.
 * Keep the cart *definitions* stable during the refactor: the point is to feed the same inputs to the new engine.
 */
export interface Spec {
  type: ItemTypeId;
  tier?: number;
  flavor?: ElementTag;
  double?: boolean;
  /** Aisles in the cart / kills on the item (perishables and growers). */
  age?: number;
  kills?: number;
  /** Indices of earlier specs this item must touch. Default: [0] (the first item); [] = anywhere. */
  near?: number[];
  /** Indices of earlier specs this item must NOT touch. */
  apart?: number[];
  /** Force the grid origin (rot 0 scan still applies to the other rotations). */
  at?: [number, number];
}
export interface GoldenCart { name: string; inv: Inventory; perk: Perk }

/** Place `specs` in an empty cart. Item 0 goes to (1,1) rot 0 (like tests/cart.ts); the rest at the first spot satisfying near/apart. */
export function build(specs: Spec[], cols = 5, rows = 4): Inventory {
  const inv: Inventory = { cols, rows, placed: [], shelf: [null, null, null, null] };
  specs.forEach((s, i) => {
    const near = s.near ?? (i === 0 ? [] : [0]);
    const apart = s.apart ?? [];
    const ok = (it: ItemInstance): boolean => {
      if (s.at) return it.x === s.at[0] && it.y === s.at[1];
      if (i === 0) return it.x === 1 && it.y === 1;
      inv.placed.push(it);
      const pairs = adjacentPairs(inv.placed);
      inv.placed.pop();
      const touches = (j: number) => pairs.some(([a, b]) => (a === it.uid && b === `u${j}`) || (b === it.uid && a === `u${j}`));
      return near.every(touches) && !apart.some(touches);
    };
    for (const rot of [0, 1, 2, 3] as const) for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const it: ItemInstance = { uid: `u${i}`, type: s.type, x, y, rot };
      if (s.tier !== undefined) it.tier = s.tier;
      if (s.flavor !== undefined) it.flavor = s.flavor;
      if (s.double) it.double = true;
      if (s.age !== undefined) it.age = s.age;
      if (s.kills !== undefined) it.kills = s.kills;
      if (canPlace(inv, s.type, x, y, rot, undefined, s.tier ?? 1).ok && ok(it)) { inv.placed.push(it); return; }
    }
    throw new Error(`golden cart: no spot for #${i} ${s.type} (${specs.map((p) => p.type).join('+')})`);
  });
  return inv;
}

const S = (type: ItemTypeId, extra: Partial<Spec> = {}): Spec => ({ type, ...extra });
const STARTERS = Object.keys(PLAYER.starters) as StarterId[];

/** Hard-coded set rosters (weapon first). Hand-picked so refactors that reorder ITEMS cannot change them. */
export const SET_CARTS: Record<SetId, Spec[]> = {
  kitchen: [S('blender'), S('sample', { near: [] }), S('sourdough', { near: [] }), S('ice', { near: [] })],
  cleaning: [S('leafblower'), S('fan', { near: [] }), S('vacuum', { near: [] }), S('spray', { near: [] })],
  tools: [S('nailgun'), S('magnet', { near: [] }), S('tape', { near: [] }), S('boot', { near: [] })],
  snacks: [S('fizz'), S('lunchbox', { near: [] }), S('energy', { near: [] }), S('fortune', { near: [] })],
  // Pan is not a checkout item: it is only the weapon, so this roster has one extra leading entry (see SET_LEAD).
  checkout: [S('pan'), S('bell', { near: [] }), S('tipjar', { near: [] }), S('flag', { near: [] }), S('coupon', { near: [] })],
  heat: [S('pan'), S('fuel'), S('hotsauce', { near: [] }), S('cooker', { near: [] })],
  frost: [S('mop'), S('ice'), S('fizz', { near: [] }), S('spray', { near: [] })],
  blast: [S('nailgun'), S('popper'), S('bumper', { near: [] }), S('doublebag', { near: [] })],
  electric: [S('nailgun'), S('battery'), S('vacuum', { near: [] }), S('blender', { near: [] })],
};
/** Leading roster entries that do not count toward their own set (a plain weapon). */
const SET_LEAD: Partial<Record<SetId, number>> = { checkout: 1 };
const SET_ORDER: SetId[] = ['kitchen', 'cleaning', 'tools', 'snacks', 'checkout', 'heat', 'frost', 'blast', 'electric'];

export function goldenCarts(): GoldenCart[] {
  const out: GoldenCart[] = [];
  const names = new Set<string>();
  const add = (name: string, specs: Spec[], perk: Perk = {}, size?: [number, number]) => {
    if (names.has(name)) throw new Error(`duplicate golden cart ${name}`);
    names.add(name);
    out.push({ name, inv: build(specs, ...(size ?? [5, 4])), perk });
  };

  // 1. Each weapon alone at ★1/★2/★3.
  for (const w of WEAPON_IDS) for (const tier of [1, 2, 3]) add(`weapon.${w}.t${tier}`, [S(w, { tier })]);

  // 2a. Buff modules (the ones with a `buff`) at ★1 next to every weapon (patterns branch), ★3 on a projectile and a melee weapon.
  const buffItems = ITEM_IDS.filter((id) => ITEMS[id].buff);
  for (const it of buffItems) {
    for (const w of WEAPON_IDS) add(`item.${it}.t1.on.${w}`, [S(w), S(it)]);
    for (const w of ['toaster', 'pan'] as const) add(`item.${it}.t3.on.${w}`, [S(w), S(it, { tier: 3 })]);
  }
  // 2b. Everything else that is not a weapon (passives, legendaries, flavor/damage modules) at ★1/★3 touching a toaster.
  for (const it of ITEM_IDS) {
    if (ITEMS[it].kind === 'weapon' || ITEMS[it].buff) continue;
    for (const tier of [1, 3]) add(`item.${it}.t${tier}.on.toaster`, [S('toaster'), S(it, { tier })]);
  }

  // 3. Every combo with exactly its required parts, each touching the first part (weapon, or the first support for cart combos).
  for (const r of Object.values(RECIPES)) add(`combo.${r.id}`, recipeParts(r).map((type, i) => S(type, i === 0 ? {} : { near: [0] })));

  // 4. Set bonuses L1/L2/L3 (2/4/6 set points: the first two members at ★1, the third and fourth at ★2).
  for (const id of SET_ORDER) for (const lv of [1, 2, 3]) {
    const lead = SET_LEAD[id] ?? 0;
    add(`set.${id}.L${lv}`, SET_CARTS[id].slice(0, lv + 1 + lead).map((s, i) => (i >= 2 + lead ? { ...s, tier: 2 } : s)));
  }

  // 5. Edge cases.
  // Gold Star: boosts touching modules/passives by one star, never weapons/legendaries, no chaining; counts as +1 bundle on the weapon.
  add('edge.gold.fuel_not_weapon', [S('toaster'), S('fuel'), S('goldstar', { near: [1], apart: [0] })]);
  add('edge.gold.fuel_and_weapon', [S('toaster'), S('fuel'), S('goldstar', { near: [0, 1] })]);
  add('edge.gold.weapon_only', [S('toaster'), S('goldstar')]);
  add('edge.gold.fan_t3', [S('toaster'), S('fan', { tier: 3 }), S('goldstar', { near: [1] })]);
  add('edge.gold.two_stars_one_fan', [S('toaster'), S('fan'), S('goldstar', { near: [1] }), S('goldstar', { near: [1] })]);
  add('edge.gold.lunchbox_passive', [S('toaster'), S('lunchbox', { at: [3, 0] }), S('goldstar', { near: [1], apart: [0] })]);
  add('edge.gold.bubblewrap_armor', [S('toaster'), S('bubblewrap', { at: [2, 3] }), S('goldstar', { near: [1], apart: [0] })]);
  add('edge.gold.piggy_passive', [S('toaster'), S('piggy', { at: [4, 3] }), S('goldstar', { near: [1], apart: [0] })]);
  add('edge.gold.sourdough', [S('pan'), S('sourdough'), S('goldstar', { near: [1] })]);
  add('edge.gold.legendary_powerstrip', [S('toaster'), S('powerstrip'), S('goldstar', { near: [1], apart: [0] })]);
  add('edge.gold.jellybeans', [S('toaster'), S('jellybeans'), S('goldstar', { near: [1] })]);
  add('edge.gold.chain_no_stack', [S('toaster'), S('fan'), S('fuel'), S('goldstar', { near: [1], apart: [2] }), S('goldstar', { near: [2], apart: [1] })]);

  // Jelly Beans: fixed flavors only (the live flavor is rolled per shop visit; the cart stores it explicitly).
  for (const f of ['heat', 'frost', 'blast'] as const) for (const tier of [1, 3]) add(`edge.jelly.${f}.t${tier}`, [S('toaster'), S('jellybeans', { flavor: f, tier })]);
  add('edge.jelly.no_flavor_defaults_heat', [S('toaster'), S('jellybeans')]);
  add('edge.jelly.heat_vs_fuel_max', [S('toaster'), S('fuel'), S('jellybeans', { flavor: 'heat', tier: 3 })]);
  add('edge.jelly.heat_weaker_than_fuel', [S('toaster'), S('fuel', { tier: 3 }), S('jellybeans', { flavor: 'heat' })]);
  add('edge.jelly.frost_vs_ice', [S('toaster'), S('ice'), S('jellybeans', { flavor: 'frost', tier: 3 })]);
  add('edge.jelly.blast_vs_popper', [S('toaster'), S('popper'), S('jellybeans', { flavor: 'blast', tier: 3 })]);
  add('edge.jelly.two_bags', [S('toaster'), S('jellybeans', { flavor: 'heat' }), S('jellybeans', { flavor: 'frost', tier: 2 })]);
  add('edge.jelly.frost_counts_for_frost_set', [S('mop'), S('jellybeans', { flavor: 'frost' }), S('fizz', { near: [] })]);

  // Sourdough Starter: +6%/star damage per touching starter; footprint grows with tier.
  for (const tier of [1, 2, 3]) add(`edge.sourdough.t${tier}.on.pan`, [S('pan'), S('sourdough', { tier })]);
  add('edge.sourdough.two_starters', [S('pan'), S('sourdough'), S('sourdough', { tier: 2 })]);
  add('edge.sourdough.not_touching', [S('pan'), S('sourdough', { near: [], apart: [0] })]);

  // Power Strip: all electrical weapons +20% rate, +40% when touching.
  add('edge.powerstrip.global_electric', [S('toaster'), S('powerstrip', { near: [], apart: [0] })]);
  add('edge.powerstrip.touching_electric', [S('toaster'), S('powerstrip')]);
  add('edge.powerstrip.non_electric', [S('pan'), S('powerstrip')]);
  add('edge.powerstrip.with_battery', [S('toaster'), S('battery'), S('powerstrip', { near: [0] })]);
  add('edge.powerstrip.two_weapons', [S('toaster'), S('powerstrip', { near: [0] }), S('microwave', { near: [], apart: [0, 1] })]);

  // Ray Gun replaces Nailstorm; Mist Machine suppresses the Fan range; Cold Storage / Brain Freeze override Ice.
  add('edge.raygun.plus_tape', [S('nailgun'), S('battery'), S('tinfoilhat'), S('magnet'), S('tape')]);
  add('edge.nailstorm_without_tinfoil', [S('nailgun'), S('magnet'), S('battery'), S('tape')]);
  add('edge.mist.fan_t3', [S('spray'), S('fan', { tier: 3 })]);
  add('edge.mist.fan_and_tape', [S('spray'), S('fan'), S('tape')]);
  add('edge.coldstorage.ice_t3', [S('vacuum'), S('ice', { tier: 3 })]);
  add('edge.coldstorage.ice_and_frost_jelly', [S('vacuum'), S('ice'), S('jellybeans', { flavor: 'frost', tier: 3 })]);
  add('edge.brainfreeze.ice_t3', [S('blender'), S('ice', { tier: 3 })]);
  add('edge.frost_set_cap.on_ice', [S('mop'), S('ice', { tier: 3 }), S('fizz', { near: [] }), S('spray', { near: [] })]);

  add('edge.blast_set_l3.microwave_aoe', [S('microwave'), S('popper'), S('bumper', { near: [] }), S('doublebag', { near: [] }), S('multipack', { near: [] })], {}, [6, 5]);
  add('edge.blast_set_l3.cooker_aoe', [S('cooker'), S('popper'), S('bumper', { near: [] }), S('doublebag', { near: [] }), S('multipack', { near: [] })], {}, [6, 5]);

  // Multipack count (Toast Mode sets the base count first), melee repeat, other weapons +damage.
  add('edge.multipack.toastmode_t1', [S('toaster'), S('fan'), S('fuel'), S('multipack')]);
  add('edge.multipack.toastmode_t3', [S('toaster'), S('fan'), S('fuel'), S('multipack', { tier: 3 })]);
  add('edge.multipack.pan_t3', [S('pan'), S('multipack', { tier: 3 })]);
  add('edge.multipack.blender_t3', [S('blender'), S('multipack', { tier: 3 })]);
  add('edge.multipack.nailgun_t3', [S('nailgun'), S('multipack', { tier: 3 })]);

  // Expired Milk curse multiplies the finished max HP (lunchbox, snack bag, snacks set, perk).
  add('edge.milk.alone', [S('toaster'), S('expiredmilk', { near: [] })]);
  add('edge.milk.with_lunchbox_snackbag', [S('toaster'), S('expiredmilk', { near: [] }), S('lunchbox', { near: [] }), S('snackbag', { near: [] })], {}, [6, 5]);
  add('edge.milk.t3_with_snacks_set', [S('fizz'), S('expiredmilk', { tier: 3, near: [] }), S('lunchbox', { near: [] }), S('energy', { near: [] }), S('fortune', { near: [] })]);
  add('edge.milk.coupon_perk', [S('toaster'), S('expiredmilk', { near: [] })], PLAYER.starters.coupon.perk ?? {});

  // Legendaries.
  add('edge.legendary.snackbag_t1', [S('toaster'), S('snackbag', { near: [] })]);
  add('edge.legendary.laser_with_powerstrip_and_gold', [S('laser'), S('powerstrip'), S('goldstar')], {}, [6, 5]);
  add('edge.legendary.laser_t3', [S('laser', { tier: 3 })], {}, [6, 5]);

  // Other cross-cutting bits: double pack, duplicate modules, Fortune on top of the Price Gun, Fan duplicates.
  add('edge.double_pack.kitchen_set', [S('pan'), S('sample', { double: true, near: [] }), S('ice', { near: [] })]);
  add('edge.fortune_plus_pricegun', [S('toaster'), S('pricegun'), S('fortune', { near: [] })]);
  add('edge.fortune_t3', [S('toaster'), S('fortune', { tier: 3, near: [] })]);
  add('edge.dup_fans_t1_t2', [S('toaster'), S('fan'), S('fan', { tier: 2 })]);
  add('edge.two_weapons_share_module', [S('toaster'), S('fuel'), S('pan', { near: [1] })]);
  add('edge.kitchen_family_plus_bundle', [S('pan'), S('sample'), S('hotsauce'), S('ice'), S('fuel')], {}, [6, 5]);

  // 6. One perk per character (perks feed computeBuild: damage, max HP, pickup, shove, move speed).
  for (const id of STARTERS) add(`perk.${id}`, [S('toaster'), S('fan'), S('fuel')], PLAYER.starters[id].perk ?? {});
  add('perk.all_fields', [S('toaster')], { priceMult: 0.9, startMoney: 5, maxHp: 7, shoveCooldown: -0.5, shoveDamage: 2, moveSpeedMult: 1.1, damageMult: 1.25, pickupRadius: 15 });

  return out;
}
