import type { ItemTypeId } from '../types';

export const STOCK = {
  /** Non-legendary items in the pool; a smaller source is taken whole. One legendary comes on top. */
  size: 24,
  minWeapons: 6,
  /** Random combos added whole, so every part can show up. */
  featuredCombos: 3,
  staples: ['canopener'] as readonly ItemTypeId[],
  freshMax: 2,
  /** Shop 1 offers one part of each of this many different combos with the starting weapon. */
  openers: 3,
};
