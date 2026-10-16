import type { ItemTypeId, RecipeDef, RecipeId } from '../types';
import { recipeDefOf, recipeTuningOf } from '../engine/legacy';
import { assertRegistry, contentCombo } from '../engine/registry';
import { ITEM_IDS } from './items';

/** Combos still defined here. A combo moves to src/content/combos/<id>.ts by deleting its entry (and its other legacy branches). */
const LEGACY_RECIPES: Partial<Record<RecipeId, RecipeDef>> = {
  toastMode: {
    id: 'toastMode', short: '3 flaming toasts per shot', name: 'Toast Mode', weapon: 'toaster', supports: ['fan', 'fuel'],
    summary: 'Toaster touching a Desk Fan AND a Fuel Can: flaming three-toast spread.',
    detail: 'Fires 3 toasts in a spread. Each deals 75% damage and sets enemies on fire (burn does not stack). Fan speed and range still apply.',
  },
  nailstorm: {
    id: 'nailstorm', short: 'Nails pierce and curve', name: 'Nailstorm', weapon: 'nailgun', supports: ['magnet', 'battery'],
    summary: 'Nail Gun touching a Magnet AND a Battery: piercing, curving nails.',
    detail: 'Each nail pierces one extra enemy and curves toward a nearby target after its first hit. Battery attack rate still applies.',
  },
  coldStorage: {
    id: 'coldStorage', short: 'Huge freezing suction', name: 'Cold Storage', weapon: 'vacuum', supports: ['ice'],
    summary: 'Vacuum touching an Ice Pack: freezing suction.',
    detail: 'Suction reaches 20% farther, and its damage ticks deal 2.5× damage and slow enemies 50% for 1.5 s. Replaces the Ice Pack slow (never added together).',
  },
  expressCheckout: {
    id: 'expressCheckout', short: 'Dash → bonus pan sweep', name: 'Express Checkout', weapon: 'pan', supports: ['bell'],
    summary: 'Frying Pan touching a Shopping Bell: dash triggers a bonus sweep.',
    detail: 'A dash that hits an enemy triggers one extra pan sweep (1.0 s internal cooldown). Bell dash cooldown reduction still applies.',
  },
  brainFreeze: {
    id: 'brainFreeze', short: 'Wider, freezing blades', name: 'Brain Freeze', weapon: 'blender', supports: ['ice'],
    summary: 'Blender touching an Ice Pack: a chilling, wider blade storm.',
    detail: 'Blade radius +25% and every tick slows 40% for 0.6 s. Replaces the Ice Pack slow for this weapon (never added together).',
  },
  tvDinner: {
    id: 'tvDinner', short: 'Zaps chain to +1 enemy', name: 'TV Dinner', weapon: 'microwave', supports: ['lunchbox', 'battery'],
    summary: 'Microwave touching a Lunchbox AND a Battery: chain-zapping meals.',
    detail: 'Each zap arcs to 1 more nearby enemy (60% damage) and the Microwave fires 8% faster (on top of the Battery).',
  },
  clearanceSale: {
    id: 'clearanceSale', short: '+2 bounces, crits drop coins', name: 'Clearance Sale', weapon: 'fizz', supports: ['pricegun', 'coupon'],
    summary: 'Fizz Cannon touching a Price Gun AND a Coupon Book: everything must go!',
    detail: 'Caps bounce 2 extra times, and critical hits knock a bonus coin loose (once per enemy).',
  },
  greaseFire: {
    id: 'greaseFire', short: 'Huge burning slicks', name: 'Grease Fire', weapon: 'mop', supports: ['fuel'],
    summary: 'Mop touching a Fuel Can: huge burning grease slicks.',
    detail: 'Puddles become grease fires: 40% bigger, and their burn is doubled (Fuel Can burn ×2, no stacking).',
  },
  pressurePoint: {
    id: 'pressurePoint', short: 'Blasts leave fire pools', name: 'Pressure Point', weapon: 'cooker', supports: ['fuel'],
    summary: 'Pressure Cooker touching a Fuel Can: blasts leave burning pools.',
    detail: 'Each explosion leaves a fire pool for 2.5 s: enemies inside burn (at least 3 damage/s, no stacking).',
  },
  mistMachine: {
    id: 'mistMachine', short: 'Huge 120° spray cone', name: 'Mist Machine', weapon: 'spray', supports: ['fan'],
    summary: 'Spray Bottle touching a Desk Fan: a huge misting cone.',
    detail: 'Spray cone widens to 120° and reaches 40% farther. (Fan speed/range bonus does not apply to sprays — this replaces it.)',
  },
  fiveAlarm: {
    id: 'fiveAlarm', short: '+80% vs burning', name: 'Five-Alarm Toast', weapon: 'toaster', supports: ['hotsauce', 'fuel'],
    summary: 'Toaster touching Hot Sauce AND a Fuel Can: toast scorches burning groceries.',
    detail: 'Toast deals +80% damage to enemies that are already on fire.',
  },
  sizzlingSkillet: {
    id: 'sizzlingSkillet', short: 'Sweeps leave fire', name: 'Sizzling Skillet', weapon: 'pan', supports: ['fuel'],
    summary: 'Frying Pan touching a Fuel Can: every sweep scorches the floor.',
    detail: 'Each sweep leaves a burning arc on the floor for 2 s. Enemies walking through it catch fire (at least 4 damage/s, no stacking).',
  },
  chickenDinner: {
    id: 'chickenDinner', short: 'Every 4th sweep is huge', name: 'Chicken Dinner', weapon: 'pan', supports: ['lunchbox'],
    summary: 'Frying Pan touching a Lunchbox: winner winner, every 4th sweep is a big serving.',
    detail: 'Every 4th sweep reaches 40% farther and deals 2.5x damage.',
  },
  frostbiteNails: {
    id: 'frostbiteNails', short: '3rd hit freezes', name: 'Frostbite Nails', weapon: 'nailgun', supports: ['ice'],
    summary: 'Nail Gun touching an Ice Pack: nails freeze groceries solid.',
    detail: 'Nails pierce 1 extra enemy, and every 3rd nail that hits the same enemy freezes it solid for 0.7 s.',
  },
  staticCling: {
    id: 'staticCling', short: 'Ticks zap 3', name: 'Static Cling', weapon: 'vacuum', supports: ['battery'],
    summary: 'Vacuum touching a Battery: the suction throws out lightning.',
    detail: 'Each damage tick also zaps up to 3 enemies inside the suction radius for 150% tick damage.',
  },
  reheat: {
    id: 'reheat', short: 'Zaps leave fire', name: 'Reheat', weapon: 'microwave', supports: ['fuel'],
    summary: 'Microwave touching a Fuel Can: overcooked!',
    detail: 'Every zap leaves a burning pool at its target for 2.5 s: enemies inside burn (at least 3 damage/s, no stacking).',
  },
  smoothieShield: {
    id: 'smoothieShield', short: 'Blades eat bullets', name: 'Smoothie Shield', weapon: 'blender', supports: ['bubblewrap'],
    summary: 'Blender touching Bubble Wrap: the blades shred enemy projectiles.',
    detail: 'Bubbles and receipts that enter the blade ring are destroyed.',
  },
  confettiCannon: {
    id: 'confettiCannon', short: 'Bounces explode', name: 'Confetti Cannon', weapon: 'fizz', supports: ['popper'],
    summary: 'Fizz Cannon touching a Party Popper: every bounce is a party.',
    detail: 'Each cap bounce sets off a small confetti blast: 50% damage within 60 (blasts never chain).',
  },
  blackIce: {
    id: 'blackIce', short: 'Puddles freeze', name: 'Black Ice', weapon: 'mop', supports: ['ice'],
    summary: 'Mop touching an Ice Pack: puddles freeze over.',
    detail: 'The first time an enemy steps into a puddle it freezes solid for 0.8 s.',
  },
  shrapnel: {
    id: 'shrapnel', short: 'Blasts spray nails', name: 'Shrapnel', weapon: 'cooker', supports: ['tape'],
    summary: 'Pressure Cooker touching Duct Tape: the lid comes off. Hard.',
    detail: 'Each explosion fires 6 pot fragments outward (40% damage, pierce 1).',
  },
  pressureWasher: {
    id: 'pressureWasher', short: 'Long hard jet', name: 'Pressure Washer', weapon: 'spray', supports: ['battery'],
    summary: 'Spray Bottle touching a Battery: motorized jet.',
    detail: 'The spray becomes a narrow jet: 25° wide, twice the reach, 2.5× damage.',
  },
  powerSurge: {
    id: 'powerSurge', short: 'Beam aftershock', name: 'Power Surge', weapon: 'laser', supports: ['powerstrip'],
    summary: 'Self-Checkout Laser touching a Power Strip: double scan.',
    detail: 'Every beam fires an aftershock 0.25 s later for 25% damage.',
  },
  potSlam: {
    id: 'potSlam', short: 'Dash landing = pot blast', name: 'Pot Slam', weapon: 'cooker', supports: ['bumper'],
    summary: 'Pressure Cooker touching a Slam Bumper: the dash lands with a pot blast.',
    detail: 'Every dash ends in a full Pressure Cooker explosion at the landing spot (damage, radius and knockback of the cooker). Fires every dash, independent of the cooker timer.',
  },
  priceCheck: {
    id: 'priceCheck', short: 'Marks: +20% dmg', name: 'Price Check', weapon: 'laser', supports: ['pricegun'],
    summary: 'Self-Checkout Laser touching a Price Gun: everything gets a sticker.',
    detail: 'Enemies hit by the beam are marked for 3 s and take +20% damage from everything.',
  },
  sugarRush: {
    id: 'sugarRush', short: 'Each dash: +8% speed (x5)', name: 'Sugar Rush', supports: ['energy', 'boot'],
    summary: 'Energy Drink touching Running Boots: every dash fuels a sugar high.',
    detail: 'Each dash adds a stack: +8% move speed for 3 s, up to 5 stacks (each stack expires on its own).',
  },
  smashBank: {
    id: 'smashBank', short: 'Pan hits may drop coins', name: 'Smash the Bank', weapon: 'pan', supports: ['piggy'],
    summary: 'Frying Pan touching a Piggy Bank: whack it and coins fall out.',
    detail: 'Every enemy hit by a pan sweep has a 15% chance to drop a coin.',
  },
  bagIt: {
    id: 'bagIt', short: 'Kills charge a garbage bomb', name: 'Bag It', weapon: 'vacuum', supports: ['doublebag', 'boot'],
    summary: 'Vacuum touching a Double Bag AND Running Boots: bag the trash, then toss it.',
    detail: 'Each enemy the vacuum kills adds 1 charge (max 10). Dashing with charges drops a garbage bag that explodes after 0.4 s: 6 damage per charge within 120, with knockback. Charges reset.',
  },
  sourMist: {
    id: 'sourMist', short: 'Spray poisons (4/s)', name: 'Sour Mist', weapon: 'spray', supports: ['expiredmilk', 'fan'],
    summary: 'Spray Bottle touching Expired Milk AND a Desk Fan: a curdled cloud.',
    detail: 'Spray hits poison enemies for 4 damage/s for 3 s (refreshes, never stacks).',
  },
  sparksFly: {
    id: 'sparksFly', short: 'Zaps chain +2, may stun', name: 'Sparks Fly', weapon: 'microwave', supports: ['tinfoilhat', 'battery'],
    summary: 'Microwave touching a Tin Foil Hat AND a Battery: the sparks go everywhere.',
    detail: 'Each zap arcs to 2 more nearby enemies for 50% damage, and every chained hit has a 25% chance to stun for 0.3 s. Stacks with TV Dinner.',
  },
  rayGun: {
    id: 'rayGun', short: 'Energy bolts, splash, 3rd is huge', name: 'Ray Gun', weapon: 'nailgun', supports: ['battery', 'tinfoilhat', 'magnet'], replaces: ['nailstorm'],
    summary: 'Nail Gun touching a Battery, a Tin Foil Hat AND a Magnet: pew pew.',
    detail: 'Nails become green energy bolts (no piercing) that splash 60% damage to enemies within 60. Every 3rd shot is a red overcharged bolt: splash radius 120 and +20% splash damage. Replaces Nailstorm.',
  },
  tailwind: {
    id: 'tailwind', short: 'Blasts push the cart forward', name: 'Tailwind', weapon: 'leafblower', supports: ['fan', 'boot'],
    summary: 'Leaf Blower touching a Desk Fan AND Running Boots: ride your own breeze.',
    detail: 'Each blower blast gives the cart a short forward push: +30% move speed for 0.4 s while you are moving. With Sugar Rush also active, every blast adds a Sugar Rush stack (1.5 s internal cooldown).',
  },
};

const LEGACY_TUNING = {
  toastMode: { count: 3, damageMult: 0.75, spreadDeg: 22 },
  nailstorm: { extraPierce: 1, homingTurn: 7 /* rad/s */, homingRange: 200 },
  coldStorage: { pct: 0.5, duration: 1.5, damageMult: 2.5, radiusMult: 1.2 },
  expressCheckout: { icd: 1.0 },
  brainFreeze: { radiusMult: 1.25, pct: 0.4, duration: 0.6 },
  tvDinner: { chain: 1, cooldownMult: 0.92, chainMult: 0.6 },
  clearanceSale: { extraBounces: 2 },
  pressurePoint: { dps: 3, duration: 2, tick: 0.5, poolTime: 2.5 },
  mistMachine: { arcDeg: 120, rangeMult: 1.4 },
  greaseFireBoost: { radiusMult: 1.4, burnMult: 2 },
  fiveAlarm: { vsBurning: 1.8 },
  chickenDinner: { every: 4, rangeMult: 1.4, damageMult: 2.5 },
  sizzlingSkillet: { dps: 4, duration: 2, tick: 0.5, poolTime: 2, pools: 3 },
  frostbiteNails: { every: 3, freeze: 0.7, extraPierce: 1 },
  staticCling: { targets: 3, damageMult: 1.5 },
  reheat: { dps: 3, duration: 2, tick: 0.5, poolTime: 2.5 },
  smoothieShield: {},
  confettiCannon: { damageMult: 0.5, radius: 60 },
  blackIce: { freeze: 0.8 },
  shrapnel: { count: 6, damageMult: 0.4, speed: 520, range: 260 },
  pressureWasher: { arcDeg: 25, rangeMult: 2, damageMult: 2.5 },
  powerSurge: { delay: 0.25, damageMult: 0.25 },
  priceCheck: { duration: 3, damageMult: 1.2 },
  sugarRush: { perStack: 0.08, duration: 3, max: 5 },
  smashBank: { chance: 0.15 },
  bagIt: { perKill: 1, max: 10, fuse: 0.4, radius: 120, dmgPerCharge: 6 },
  sourMist: { dps: 4, duration: 3 },
  sparksFly: { chain: 2, chainMult: 0.5, stunChance: 0.25, stun: 0.3 },
  tailwind: { boost: 0.3, boostTime: 0.4, sugarIcd: 1.5 },
  rayGun: { splashR: 60, splashMult: 0.6, every: 3, bigR: 120, bigMult: 1.2 },
  potSlam: {},
};

/** Order of `RECIPES` (computeBuild applies matching combos in this order): fixed here so moving a combo to content never reorders anything. */
const RECIPE_ORDER: RecipeId[] = [
  'toastMode', 'nailstorm', 'coldStorage', 'expressCheckout', 'brainFreeze', 'tvDinner', 'clearanceSale', 'greaseFire', 'pressurePoint', 'mistMachine',
  'fiveAlarm', 'sizzlingSkillet', 'chickenDinner', 'frostbiteNails', 'staticCling', 'reheat', 'smoothieShield', 'confettiCannon', 'blackIce', 'shrapnel',
  'pressureWasher', 'powerSurge', 'potSlam', 'priceCheck', 'sugarRush', 'smashBank', 'bagIt', 'sourMist', 'sparksFly', 'rayGun', 'tailwind',
];

/** Every combo: the content file when there is one (converted to the legacy `RecipeDef`), otherwise the legacy entry above. */
export const RECIPES: Record<RecipeId, RecipeDef> = Object.fromEntries(RECIPE_ORDER.map((id) => {
  const c = contentCombo(id), def = c ? recipeDefOf(c) : LEGACY_RECIPES[id];
  if (!def) throw new Error(`combo "${id}" has neither a content file nor a legacy entry`);
  if (c && LEGACY_RECIPES[id]) throw new Error(`combo "${id}" is defined twice: delete its legacy entry in data/recipes.ts`);
  return [id, def];
})) as Record<RecipeId, RecipeDef>;
for (const id of Object.keys(LEGACY_RECIPES)) if (!RECIPE_ORDER.includes(id as RecipeId)) throw new Error(`combo "${id}" is missing from RECIPE_ORDER`);

/** Tuning per combo: a content combo's `tune` replaces its legacy entry of the same name (keep the type of the legacy entry when moving one). */
export const RECIPE_TUNING = {
  ...LEGACY_TUNING,
  ...Object.fromEntries(RECIPE_ORDER.flatMap((id) => { const c = contentCombo(id); return c ? [[id, recipeTuningOf(c)]] : []; })),
} as typeof LEGACY_TUNING;

// Content that points at ids outside content (a combo's `requires`, `replaces`) must resolve against the legacy tables too.
assertRegistry({ knownItemIds: ITEM_IDS, knownComboIds: RECIPE_ORDER });

/** Every item type a combo needs (weapon first, if any). Cart combos have no weapon. */
export const recipeParts = (r: RecipeDef): ItemTypeId[] => [...(r.weapon ? [r.weapon] : []), ...r.supports];
/** Item whose icon stands for the combo. */
export const recipeIcon = (r: RecipeDef): ItemTypeId => r.weapon ?? r.supports[0];
