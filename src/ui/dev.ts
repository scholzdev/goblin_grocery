import { store } from '../state/store';
import { flow } from '../flow';
import { newUid, recomputeBuild } from '../state/run';
import { BOSS_WAVE } from '../data/waves';
import { MINI_BOSS } from '../data/enemies';
import type { ItemTypeId, Rotation } from '../types';

/** DEV ONLY: jump straight to the boss with a developed build. */
export function jumpToBoss(): void {
  const s = store.state;
  const layout: [ItemTypeId, number, number, Rotation][] = [
    ['fan', 0, 0, 0], ['toaster', 1, 0, 0], ['fuel', 3, 0, 0], ['pan', 4, 0, 0],
    ['magnet', 0, 2, 0], ['nailgun', 1, 2, 0], ['battery', 3, 2, 0], ['bell', 4, 3, 0], ['hotsauce', 1, 1, 0],
  ];
  s.inventory.placed = layout.map(([type, x, y, rot]) => ({ uid: newUid(s), type, x, y, rot }));
  recomputeBuild(s);
  s.hp = s.build.maxHp;
  s.wave = BOSS_WAVE;
  s.phase = 'combat';
  flow.restartArena();
  store.changed();
}

/** DEV ONLY: jump to the mini-boss aisle (same build as jumpToBoss, plain modifier so it spawns). */
export function jumpToMini(): void {
  jumpToBoss();
  const s = store.state;
  s.wave = MINI_BOSS.aisle;
  s.modifier = 'none';
  s.department = s.theme;
  flow.restartArena();
  store.changed();
}
