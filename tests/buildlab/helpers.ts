import { Item } from '../../src/engine/ids';
import { createRun, recomputeBuild } from '../../src/state/run';
import type { RunState } from '../../src/types';
import { build, type Spec } from '../golden/carts';

/** A run parked in aisle `aisle` with exactly these cart items (Spec as in tests/golden/carts), full HP. */
export function stateWith(specs: Spec[], opts: { aisle?: number; cols?: number; rows?: number; seed?: number; hp?: number } = {}): RunState {
  const s = createRun(opts.seed ?? 1, 'toaster', 0, 'toaster', 'main');
  s.phase = 'combat';
  s.wave = opts.aisle ?? 3;
  s.inventory = build(specs, opts.cols ?? 7, opts.rows ?? 5);
  s.inventory.shelf = [null, null, null, null];
  s.nextUid = 100;
  recomputeBuild(s);
  s.hp = opts.hp ?? s.build.maxHp;
  return s;
}

export const bareToaster = (): Spec[] => [{ type: Item.toaster }];
/** Three weapons at the higher tiers and two modules: a clearly stronger cart than the bare starter. */
export const strongCart = (): Spec[] => [
  { type: Item.toaster, tier: 3 },
  { type: Item.nailgun, tier: 3, near: [] },
  { type: Item.pan, tier: 3, near: [] },
  { type: Item.fan, tier: 2 },
  { type: Item.fuel, tier: 2 },
];
