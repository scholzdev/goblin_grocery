import type { ItemTypeId } from '../types';

/** A run's stock (src/systems/stock.ts): the item types its shops may offer, drawn once per run. */
export const STOCK = {
  /** Non-legendary items in the pool; a smaller source is taken whole. One legendary comes on top. */
  size: 24,
  minWeapons: 6,
  /** Random combos added whole, so every part can show up. */
  featuredCombos: 3,
  /** Always in the pool when the source has them. */
  staples: ['canopener'] as readonly ItemTypeId[],
  /** Fresh unlocks the player has not viewed in the Catalog yet, put in the next run. */
  freshMax: 2,
  /** Shop 1 offers one part of each of this many different combos with the starting weapon. */
  openers: 3,
};
