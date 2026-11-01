import type { WeaponPattern } from '../../types';
import { aura } from './aura';
import { burst } from './burst';
import { cone } from './cone';
import { laser } from './laser';
import { mortar } from './mortar';
import { popcorn } from './popcorn';
import { puddle } from './puddle';
import { pulse } from './pulse';
import { updateShots } from './projectile';
import { ricochet } from './ricochet';
import { sweep } from './sweep';
import { toast } from './toast';
import { tomato } from './tomato';
import { zap } from './zap';
import type { Pattern, PatternHost } from './types';

// The weapon patterns (docs/item-hooks-refactor.md). A weapon's content file names one in `weapon.pattern`; the arsenal asks the
// table below what to do each frame. Combos change a pattern through its `pattern:*` events (engine/hooks.ts), never by editing it.

export const PATTERNS: Readonly<Record<WeaponPattern, Pattern>> = { toast, burst, sweep, pulse, aura, zap, ricochet, puddle, laser, mortar, cone, popcorn, tomato };

/** What lives on in the world between attacks, in the order it updates: floor patches before lobbed pots (puddles update before pots). */
const WORLD: readonly Pattern[] = [puddle, mortar];

/**
 * The weapon loop of one frame: per weapon its pattern's `tick`, the cooldown (electrical weapons run faster in the Electronics
 * department), the target search and `fire`. A weapon with no enemy in range retries in 0.05 s. A blind pattern (Mop) never waits for one.
 */
export function stepWeapons(h: PatternHost, dt: number, firing: boolean): void {
  const sc = h.sc;
  for (const w of h.weapons) {
    const p = PATTERNS[w.stats.pattern];
    p.tick?.(h, w, dt, firing);
    w.cd -= dt * (w.electrical ? sc.dept.electricalRate * sc.aisleEvent.electricRate() : 1);
    if (!firing || w.cd > 0) continue;
    if (p.blind) { w.cd = w.stats.cooldown; p.fire(h, w, null); continue; }
    const target = sc.targetForWeapon(w.stats.range, w.targetMode);
    if (!target) { w.cd = 0.05; continue; }
    w.cd = w.stats.cooldown;
    p.fire(h, w, target);
    sc.recoil(w.stats.uid);
  }
}

/**
 * One frame of the whole arsenal, in this order: the arsenal clock, the weapons, the player projectiles, `enemyShots` (the arena's
 * own projectiles, which the host moves), then floor patches and pots.
 */
export function stepArsenal(h: PatternHost, dt: number, firing: boolean, enemyShots?: () => void): void {
  h.time += dt;
  stepWeapons(h, dt, firing);
  updateShots(h, dt);
  enemyShots?.();
  for (const p of WORLD) p.update!(h, dt);
}

export { collectLooks, degToRad, emitFire, origin, repeat, weaponRt } from './common';
export { sweepOnce } from './sweep';
export { explodeAt } from './mortar';
export { beamOnce } from './laser';
export { boltFx } from './zap';
export { removePuddle, spawnFirePool } from './puddle';
export { updateShots } from './projectile';
export type { Pattern, PatternEnemy, PatternHost, PatternScene, Puddle, Pot, Shot, Sprite, TargetMode, WeaponRt } from './types';
