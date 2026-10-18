import { store } from '../state/store';
import { flow } from '../flow';
import { newUid, recomputeBuild } from '../state/run';
import { BOSS_WAVE } from '../data/waves';
import { MINI_BOSS } from '../data/enemies';
import { layoutBossBuild } from './bossBuild';

/** DEV ONLY: jump straight to the boss with a developed build. */
export function jumpToBoss(): void {
  const s = store.state;
  const inv = s.inventory;
  const { placed, shelf } = layoutBossBuild(inv.cols, inv.rows, () => newUid(s));
  inv.placed = placed;
  inv.shelf = inv.shelf.map(() => null);
  shelf.forEach((it, i) => { if (i < inv.shelf.length) inv.shelf[i] = it; });
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
