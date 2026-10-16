export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixed into the combat seed so it never equals a stream derived from the bare run seed (flow.rng, zone and flavor rolls). */
export const COMBAT_SALT = 0xc0ffee5;

/**
 * Seed of one aisle's combat rng: run seed + aisle index + a constant salt, mixed so neighboring aisles and neighboring runs
 * get unrelated streams. Pure; the same (seed, aisle) always gives the same seed.
 */
export const combatSeed = (runSeed: number, aisle: number): number =>
  (Math.imul((runSeed ^ COMBAT_SALT) >>> 0, 0x9e3779b1) ^ Math.imul(aisle + 1, 0x85ebca6b) ^ COMBAT_SALT) >>> 0;

/**
 * The aisle's combat rng: crit rolls, status chances, enemy AI choices, hazard and event rolls, coin scatter. A stream of its own,
 * **independent of `flow.rng`** (shop rolls, spawns, kill coins): drawing from it never shifts those. Recreated at every aisle start,
 * so a daily run rolls the same combat numbers every time it is played.
 */
export const combatRng = (runSeed: number, aisle: number): Rng => mulberry32(combatSeed(runSeed, aisle));
