import type { RecipeDef, RecipeId } from '../types';

export const RECIPES: Record<RecipeId, RecipeDef> = {
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
    id: 'coldStorage', short: 'Huge freezing pulse', name: 'Cold Storage', weapon: 'vacuum', supports: ['ice'],
    summary: 'Vacuum touching an Ice Pack: frost ring pulse.',
    detail: 'Pulses reach 20% farther, deal 2.5× damage and leave a frost ring that slows enemies 50% for 1.5 s. Replaces the Ice Pack slow (never added together).',
  },
  expressCheckout: {
    id: 'expressCheckout', short: 'Shove → bonus pan sweep', name: 'Express Checkout', weapon: 'pan', supports: ['bell'],
    summary: 'Frying Pan touching a Shopping Bell: shove triggers a bonus sweep.',
    detail: 'A shove that hits an enemy triggers one extra pan sweep (1.0 s internal cooldown). Bell shove cooldown reduction still applies.',
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
    detail: 'Puddles become grease fires: 40% bigger, and their burn is doubled (6 damage/s, no stacking).',
  },
  pressurePoint: {
    id: 'pressurePoint', short: 'Blasts leave fire pools', name: 'Pressure Point', weapon: 'cooker', supports: ['fuel'],
    summary: 'Pressure Cooker touching a Fuel Can: blasts leave burning pools.',
    detail: 'Each explosion leaves a fire pool for 2.5 s: enemies inside burn (3 damage/s, no stacking).',
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
    detail: 'Each sweep leaves a burning arc on the floor for 2 s. Enemies walking through it catch fire.',
  },
  frostbiteNails: {
    id: 'frostbiteNails', short: '3rd hit freezes', name: 'Frostbite Nails', weapon: 'nailgun', supports: ['ice'],
    summary: 'Nail Gun touching an Ice Pack: nails freeze groceries solid.',
    detail: 'Nails pierce 1 extra enemy, and every 3rd nail that hits the same enemy freezes it solid for 0.7 s.',
  },
  staticCling: {
    id: 'staticCling', short: 'Pulses zap 3', name: 'Static Cling', weapon: 'vacuum', supports: ['battery'],
    summary: 'Vacuum touching a Battery: pulses throw out lightning.',
    detail: 'Each pulse also zaps up to 3 enemies inside its radius for 150% pulse damage.',
  },
  reheat: {
    id: 'reheat', short: 'Zaps leave fire', name: 'Reheat', weapon: 'microwave', supports: ['fuel'],
    summary: 'Microwave touching a Fuel Can: overcooked!',
    detail: 'Every zap leaves a burning pool at its target for 2.5 s.',
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
  priceCheck: {
    id: 'priceCheck', short: 'Marks: +20% dmg', name: 'Price Check', weapon: 'laser', supports: ['pricegun'],
    summary: 'Self-Checkout Laser touching a Price Gun: everything gets a sticker.',
    detail: 'Enemies hit by the beam are marked for 3 s and take +20% damage from everything.',
  },
};

export const RECIPE_TUNING = {
  toastMode: { count: 3, damageMult: 0.75, spreadDeg: 22 },
  nailstorm: { extraPierce: 1, homingTurn: 7 /* rad/s */, homingRange: 200 },
  coldStorage: { pct: 0.5, duration: 1.5, damageMult: 2.5, radiusMult: 1.2 },
  expressCheckout: { icd: 1.0 },
  brainFreeze: { radiusMult: 1.25, pct: 0.4, duration: 0.6 },
  tvDinner: { chain: 1, cooldownMult: 0.92 },
  clearanceSale: { extraBounces: 2 },
  greaseFire: { dps: 3, duration: 2, tick: 0.5 },
  pressurePoint: { dps: 3, duration: 2, tick: 0.5, poolTime: 2.5 },
  mistMachine: { arcDeg: 120, rangeMult: 1.4 },
  greaseFireBoost: { radiusMult: 1.4, burnMult: 2 },
  fiveAlarm: { vsBurning: 1.8 },
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
};
