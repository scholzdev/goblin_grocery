import { ITEMS } from '../../src/data/items';
import { computeBuild } from '../../src/systems/synergies';
import type { ItemTypeId, WeaponStats } from '../../src/types';
import type { Perk } from '../../src/types';
import { build, type Spec } from '../golden/carts';

// Shared by the per-item content tests. Specs place item 0 (the weapon) first; every other item touches it unless `near`/`apart` say otherwise.

/** The weapon's stats (weapon = first spec). */
export const stats = (specs: Spec[]): WeaponStats => computeBuild(build(specs)).weapons[0];
export const sets = (specs: Spec[]) => computeBuild(build(specs)).sets;

/** `{ type, tier }` shorthand. */
export const at = (type: ItemTypeId, tier?: number, extra: Partial<Spec> = {}): Spec => ({ type, ...(tier ? { tier } : {}), ...extra });

/** A Gold Star touching the item at `index` but not the weapon: it lifts that module by one effective tier. */
export const gilded = (index: number): Spec => ({ type: 'goldstar', near: [index], apart: [0] });

/** The item ids around `id` in the shop order, e.g. `around('fan', 1, 1)` = [before, 'fan', after]. */
export const around = (id: ItemTypeId, before: number, after: number): string[] => {
  const ids = Object.keys(ITEMS);
  return ids.slice(ids.indexOf(id) - before, ids.indexOf(id) + after + 1);
};

// Passives (build-level items: Magnet, Lunchbox, Fortune ...) have no touching concept: they sit anywhere in the cart.

/** The whole build of a roomy 8x6 cart (weapon = first spec), for player-level fields. */
export const full = (specs: Spec[], perk: Perk = {}) => computeBuild(build(specs, 8, 6), perk);
/** Anywhere in the cart, not touching the weapon. */
export const far = (type: ItemTypeId, tier?: number): Spec => at(type, tier, { near: [], apart: [0] });
/** Same, at a fixed corner (6,4) so a Gold Star can be placed against it without touching the weapon. */
export const corner = (type: ItemTypeId, tier?: number): Spec => at(type, tier, { near: [], apart: [0], at: [6, 4] });
