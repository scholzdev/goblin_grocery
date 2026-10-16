import { ITEMS } from '../../src/data/items';
import { computeBuild } from '../../src/systems/synergies';
import type { ItemTypeId, WeaponStats } from '../../src/types';
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
