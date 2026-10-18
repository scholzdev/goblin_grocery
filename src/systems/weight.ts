import type { Inventory } from '../types';
import { cellsOf } from '../data/items';
import { neighbors } from './inventory';

// Cart weight (docs/new-items-plan.md "Cart weight"): the number of occupied cart cells. Only the Bowling Ball reads it, so carts without
// one play exactly as before. The Helium Balloon makes the items touching it weightless for the Ball's slow (the damage still counts them).

/** Occupied cart cells: what the Bowling Ball's dash damage counts. */
export const cartWeight = (inv: Inventory): number => inv.placed.reduce((n, i) => n + cellsOf(i).length, 0);

/** Occupied cells that still slow the goblin: `cartWeight` minus the cells of every item touching a Helium Balloon. */
export function slowWeight(inv: Inventory): number {
  const light = new Set<string>();
  for (const b of inv.placed) if (b.type === 'balloon') for (const n of neighbors(inv.placed, b.uid)) light.add(n.uid);
  return inv.placed.reduce((n, i) => n + (light.has(i.uid) ? 0 : cellsOf(i).length), 0);
}
