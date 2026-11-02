import type { WeaponStats } from '../../types';
import { resolveTune, type ItemContent } from '../define';
import type { HookTable, WeaponLook } from '../hooks';
import type { PatternEnemy, PatternHost, Sprite, TargetMode, WeaponRt } from './types';

// Helpers every pattern shares.

/** Degrees to radians (Phaser's `Math.DegToRad`, to the bit). */
export const degToRad = (deg: number): number => deg * (Math.PI / 180);

/** Pulls stop this far outside the cart, so they never feed melee enemies into the goblin. */
export const CART_STANDOFF = 12;

/** Auto targeting may be refined by weapon identity and an active family pairing. Manual aim stays authoritative. */
export function weaponTarget(h: PatternHost, w: WeaponRt): PatternEnemy | null {
  let target = h.sc.targetForWeapon(w.stats.range, w.targetMode);
  w.prioritizedTarget = false;
  if (w.targetMode !== 'auto') return target;
  const p = h.sc.player;
  const candidates = h.sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && Math.hypot(e.x - p.x, e.y - p.y) <= w.stats.range);
  if (h.sc.hooks['pattern:target'].length) {
    const ev = { stats: w.stats, candidates, target, prioritized: false };
    h.sc.hooks.emit('pattern:target', ev);
    target = ev.target as PatternEnemy | null;
    w.prioritizedTarget = ev.prioritized;
  }
  return target;
}

/** Where the cart's weapons shoot from: the nose of the cart. */
export function origin(h: PatternHost): { x: number; y: number } {
  const p = h.sc.player;
  return { x: p.x + p.facing * 18, y: p.y };
}

/** Directional weapons follow the mouse when active, otherwise their selected target. */
export function aimAngle(h: PatternHost, target: { x: number; y: number } | null, mode: TargetMode = 'auto'): number {
  if (mode === 'cursor' && h.sc.aimAngle !== null) return h.sc.aimAngle;
  const o = origin(h);
  return Math.atan2((target?.y ?? h.sc.player.y) - o.y, (target?.x ?? o.x) - o.x);
}

/** Multipack on sweeps/cones/mortars: the attack repeats (count - 1) more times, `repeatDelay` apart, while the aisle is still being fought. */
export function repeat(h: PatternHost, w: WeaponRt, attack: () => void): void {
  attack();
  for (let i = 1; i < w.stats.count; i++) h.sc.time.delayedCall(h.repeatDelay * 1000 * i, () => { if (h.sc.combatActive()) attack(); });
}

/**
 * `pattern:fire`: a projectile is about to be spawned at (x, y) heading `angle`. Returns true when a hook fired something else in its
 * place (Ray Gun's energy bolt), so the pattern skips the default shot. Allocates nothing while nobody listens.
 */
export function emitFire(h: PatternHost, st: WeaponStats, x: number, y: number, angle: number, first: boolean): boolean {
  const hooks = h.sc.hooks;
  if (!hooks['pattern:fire'].length) return false;
  const ev = { stats: st, x, y, angle, first, handled: false };
  hooks.emit('pattern:fire', ev);
  return ev.handled;
}

/** The runtime of the cart's `index`th weapon (`item` is its content file): its cooldown starts staggered (0.4 s + 0.17 s per weapon), its pattern parameters are resolved at its tier. */
export function weaponRt(stats: WeaponStats, index: number, blades: Sprite | null, item: ItemContent): WeaponRt {
  return {
    stats, targetMode: 'auto', cd: 0.4 + index * 0.17, burstLeft: 0, burstT: 0, blades,
    base: item.weapon!,
    tune: resolveTune(item.tune, stats.tier),
    electrical: !!item.electrical,
  };
}

/** Asks the compiled hooks how each weapon looks (`pattern:look`) and fills `looks` (weapons nobody restyles get no entry). */
export function collectLooks(hooks: HookTable, weapons: readonly WeaponRt[], looks: Map<string, WeaponLook>): void {
  looks.clear();
  if (!hooks['pattern:look'].length) return;
  for (const w of weapons) {
    const ev = { stats: w.stats, look: {} as WeaponLook };
    hooks.emit('pattern:look', ev);
    if (Object.keys(ev.look).length) looks.set(w.stats.uid, ev.look);
  }
}
