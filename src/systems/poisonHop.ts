// Pure maths for the poisoned-enemy hop (visual only; scenes/enemies.ts applies it to the sprite). No Phaser, no imports.

/** Hop tuning: `hz` hops/s, amplitude = hit radius * `ampPerRadius` clamped to [minLift, maxLift] (bosses: `maxLiftBoss`), `squash` at ground contact, `shadowShrink` at the top of a hop. */
export const HOP = { hz: 3, ampPerRadius: 0.3, minLift: 3, maxLift: 6, maxLiftBoss: 10, squash: 0.09, shadowShrink: 0.22, phasePerId: 0.618033988749895 };

export interface HopInput {
  /** Scene clock (s). Not dt: dt is 0 outside combat. */
  now: number;
  /** Stable per-enemy id, spreads the phases so a crowd does not hop in lockstep. */
  id: number;
  /** Hit radius of the enemy (px): a bigger enemy hops a bit higher. */
  radius: number;
  boss: boolean;
  poisoned: boolean;
  reducedMotion: boolean;
}
export interface Hop {
  /** Pixels the sprite is lifted above the ground (>= 0). */
  lift: number;
  /** Extra squash (wider, shorter) while the feet touch the ground; added to the sprite's own squash. */
  squash: number;
  /** Shadow size factor, 1 on the ground, a bit smaller in the air. */
  shadow: number;
}

const GROUNDED: Hop = { lift: 0, squash: 0, shadow: 1 };

/** Largest lift of an enemy with this hit radius. */
export const hopAmplitude = (radius: number, boss: boolean): number =>
  Math.min(boss ? HOP.maxLiftBoss : HOP.maxLift, Math.max(HOP.minLift, radius * HOP.ampPerRadius));

/** Where in its hop a poisoned enemy is: a bouncing-ball arc (|sin|: round top, sharp contact) that lands `hz` times a second, squashed on landing. Neutral when not poisoned or with reduced motion. */
export function poisonHop(o: HopInput): Hop {
  if (!o.poisoned || o.reducedMotion) return GROUNDED;
  const air = Math.abs(Math.sin(Math.PI * (HOP.hz * o.now + o.id * HOP.phasePerId))); // 0 on the ground, 1 at the top
  return {
    lift: hopAmplitude(o.radius, o.boss) * air,
    squash: HOP.squash * Math.max(0, 1 - air / 0.25), // full on the ground, gone once a quarter of the way up
    shadow: 1 - HOP.shadowShrink * air,
  };
}
