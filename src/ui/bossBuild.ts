import { layoutCart } from '../sims/_sim';
import type { ItemInstance, ItemTypeId } from '../types';

/** DEV ONLY: the jump-to-boss build, in priority order. */
export const BOSS_BUILD: ItemTypeId[] = ['fan', 'toaster', 'fuel', 'pan', 'magnet', 'nailgun', 'battery', 'bell', 'hotsauce'];

/** Lays `BOSS_BUILD` out in a cols x rows cart through `canPlace`; what does not fit goes to the shelf. */
export function layoutBossBuild(cols: number, rows: number, nextUid: () => string): { placed: ItemInstance[]; shelf: ItemInstance[] } {
  const { slots } = layoutCart({ cart: BOSS_BUILD.map((id) => ({ id })), cartSize: [cols, rows] });
  const placed: ItemInstance[] = [], shelf: ItemInstance[] = [];
  slots.forEach((s, i) => {
    if (s) placed.push({ uid: nextUid(), type: s.type, x: s.x, y: s.y, rot: s.rot });
    else shelf.push({ uid: nextUid(), type: BOSS_BUILD[i], x: 0, y: 0, rot: 0 });
  });
  return { placed, shelf };
}
