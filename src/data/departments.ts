import type { DepartmentDef, DepartmentId, EnemyId } from '../types';

// Departments: run themes (+ hazard, roster). See docs/departments.md.
const base = {
  mix: {}, hpMult: 1, speedMult: 1, countMult: 1, coinMult: 1, shopBias: [], legendaryBonus: 0,
  forceLegendary: false, electricalRate: 1, breadHeal: false,
};

export const DEPARTMENTS: Record<DepartmentId, DepartmentDef> = {
  main: {
    ...base, id: 'main', name: 'Main Aisle', short: 'MAIN AISLE', danger: 0, hazard: 'none',
    mix: { cereal: 2.5, beans: 2.5, soda: 2, honey: 2 },
    blurb: 'No hazards', enemiesText: 'Cereal, Beans, Soda & Honey', rewardText: 'No bonus',
    theme: { floor: 'floor_tile', walls: ['freezer_a', 'shelf_a', 'shelf_b', 'freezer_b'], sides: ['shelf_side'], props: ['prop_wetfloor', 'prop_salesign', 'prop_cans', 'prop_cereal'], icon: 'dept_main' },
  },
  frozen: {
    ...base, id: 'frozen', name: 'Frozen Foods', short: 'FROZEN', danger: 1, hazard: 'ice',
    blurb: 'Ice patches: longer shoves, enemies slip', enemiesText: 'Turkeys, Expired Milk, Sour Milk & Soda',
    rewardText: 'Cold deals in the shop',
    mix: { turkey: 2.5, expired: 2.5, milk: 2, soda: 2 }, shopBias: ['ice', 'blender', 'vacuum'],
    theme: { floor: 'floor_frozen', walls: ['freezer_a', 'freezer_c', 'freezer_b', 'freezer_c'], sides: ['side_freezer'], props: ['prop_icecream', 'prop_wetfloor', 'prop_cans'], icon: 'dept_frozen' },
  },
  bakery: {
    ...base, id: 'bakery', name: 'Bakery', short: 'BAKERY', danger: 2, hazard: 'vents',
    blurb: 'Oven vents blast heat (hurts groceries too!)', enemiesText: 'Baguettes, Eggs, Honey & Bananas',
    rewardText: 'Bread crumbs heal · kitchen deals in the shop',
    mix: { baguette: 1.8, egg: 1.8, honey: 2.5, banana: 1.5 }, breadHeal: true, shopBias: ['pan', 'toaster', 'fuel', 'hotsauce', 'lunchbox'],
    theme: { floor: 'floor_bakery', walls: ['bakery_rack_a', 'oven_wall', 'bakery_rack_b', 'oven_wall'], sides: ['side_bakery'], props: ['prop_breadbasket', 'prop_cereal', 'prop_breadbasket', 'prop_breadbasket', 'prop_salesign'], icon: 'dept_bakery' },
  },
  electronics: {
    ...base, id: 'electronics', name: 'Electronics', short: 'ELECTRONICS', danger: 2, hazard: 'cables',
    blurb: 'Live cables zap & stun groceries', enemiesText: 'Spitters, Beans, Cereal & Expired Milk',
    rewardText: 'Electric weapons +15% speed · gadget deals',
    mix: { spitter: 2.5, beans: 2, cereal: 2, expired: 1.5 }, electricalRate: 1.15, legendaryBonus: 0.03,
    shopBias: ['battery', 'microwave', 'blender', 'nailgun', 'powerstrip'],
    theme: { floor: 'floor_electronics', walls: ['tv_wall_a', 'tv_wall_b', 'tv_wall_a', 'tv_wall_b'], sides: ['side_electronics'], props: ['prop_tvbox', 'prop_cans'], icon: 'dept_electronics' },
  },
  checkout: {
    ...base, id: 'checkout', name: 'Checkout Lanes', short: 'CHECKOUT', danger: 3, hazard: 'conveyor',
    blurb: 'Conveyor belts carry everything', enemiesText: 'Bubble Gum, Melons, Bananas & Gift Cards',
    rewardText: 'No bonus',
    mix: { gum: 2.5, melon: 1.5, banana: 2, giftcard: 2 },
    theme: { floor: 'floor_checkout', walls: ['checkout_counter', 'checkout_counter', 'checkout_counter', 'checkout_counter'], sides: ['side_checkout'], props: ['prop_lanesign', 'prop_cans'], icon: 'dept_checkout' },
  },
  clearance: {
    ...base, id: 'clearance', name: 'Clearance Bin', short: 'CLEARANCE', danger: 3, hazard: 'none',
    blurb: 'No hazards, just a LOT of groceries', enemiesText: '+35% groceries, +25% HP, Cereal & Honey',
    rewardText: '+25% coins · guaranteed legendary next shop',
    mix: { cereal: 1.8, honey: 2 }, hpMult: 1.25, countMult: 1.35, coinMult: 1.25, forceLegendary: true,
    theme: { floor: 'floor_tile', walls: ['shelf_a', 'shelf_b', 'shelf_a', 'shelf_b'], sides: ['shelf_side'], props: ['prop_salesign', 'prop_salesign', 'prop_cans', 'prop_cereal'], tint: 0xffd6d0, icon: 'dept_clearance' },
  },
  boss: {
    ...base, id: 'boss', name: "Manager's Checkout", short: 'MANAGER', danger: 3, hazard: 'none',
    blurb: 'The Store Manager awaits', enemiesText: 'Boss + summons', rewardText: 'Victory',
    theme: { floor: 'floor_checkout', walls: ['checkout_counter', 'checkout_counter', 'checkout_counter', 'checkout_counter'], sides: ['side_checkout'], props: ['prop_lanesign'], icon: 'dept_boss' },
  },
};

/** Run themes the player can pick on the start screen. */
export const THEMES: DepartmentId[] = ['main', 'frozen', 'bakery', 'electronics', 'checkout'];
export const DEPT_TUNING = {
  /** Off-theme enemies spawn at this weight; basics stay at 1. */
  offTheme: 0.35,
  basics: ['milk', 'banana', 'giftcard'] as EnemyId[],
  biasWeight: 2.5,
  clearanceFromShop: 3,
  clearanceChance: 0.25,
  threeDoorsAtLoyalty: 3,
  ice: { patches: 4, enemySlow: 0.3, knockbackMult: 1.6, shoveMult: 1.5 },
  vents: { count: 3, interval: 5, tell: 1, active: 0.6, radius: 62, playerDamage: 6, enemyDamage: 15 },
  cables: { count: 3, interval: 4, tell: 0.8, active: 0.5, width: 26, playerDamage: 5, enemyDamage: 15, stun: 0.7 },
  conveyor: { speed: 90, height: 64 },
  bread: { chance: 0.08, heal: 1, capPerAisle: 8 },
};
