import { computeBuild } from '../src/systems/synergies';
import { canPlace } from '../src/systems/inventory';
import type { Inventory, ItemInstance, ItemTypeId } from '../src/types';

/** Empty cart with `weapon` at (1,1) and each support placed touching it. */
export function cart(weapon: ItemTypeId, supports: ItemTypeId[]): Inventory {
  const inv: Inventory = { cols: 5, rows: 4, placed: [], shelf: [null, null, null, null] };
  let n = 0;
  const touchesWeapon = (it: ItemInstance) => {
    inv.placed.push(it);
    const ok = computeBuild(inv).adjacency.some(([a, b]) => (a === it.uid && b === 'u0') || (b === it.uid && a === 'u0'));
    inv.placed.pop();
    return ok;
  };
  const put = (type: ItemTypeId, want: (it: ItemInstance) => boolean) => {
    for (const rot of [0, 1, 2, 3] as const) for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) {
      const it = { uid: `u${n}`, type, x, y, rot };
      if (canPlace(inv, type, x, y, rot).ok && want(it)) { inv.placed.push(it); n++; return; }
    }
    throw new Error(`no spot for ${type}`);
  };
  put(weapon, (it) => it.x === 1 && it.y === 1);
  supports.forEach((s) => put(s, touchesWeapon));
  return inv;
}
