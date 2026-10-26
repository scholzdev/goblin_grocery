// Which texture an enemy shows right now. Pure: no Phaser (scenes/enemies.ts applies it to the sprite).
import { SVG_ASSETS } from '../data/assets';
import { enemyFrame, type EnemyFrame } from '../data/enemies';
import type { EnemyId } from '../types';

/** How long the hurt face stays up after a hit (s). */
export const HURT_FACE_S = 0.25;
/** Minimum time between hurt-face triggers (s): under constant fire the face blinks instead of freezing on. */
export const HURT_FACE_GAP = 0.7;

const DRAWN = new Set(SVG_ASSETS.map((a) => a.key));

export interface EnemyLook {
  id: EnemyId;
  /** Winding up or attacking. */
  telling: boolean;
  /** Scene time (s) of the last hurt-face trigger. */
  hurtAt: number;
  /** Scene clock (s). */
  now: number;
  /** Walk cycle step. */
  step: 0 | 1;
}

/** The first frame in preference order (tell, hurt, walk) that the asset manifest has: a missing hurt or tell frame falls through, so redrawing an enemy needs no second registry. A telegraph outranks a hurt face so it stays readable under fire. */
export function enemyTexture({ id, telling, hurtAt, now, step }: EnemyLook): string {
  const order: EnemyFrame[] = [];
  if (telling) order.push('tell');
  if (now - hurtAt < HURT_FACE_S) order.push('hurt');
  order.push(step ? 'b' : 'a');
  const keys = order.map((f) => enemyFrame(id, f));
  return keys.find((k) => DRAWN.has(k)) ?? keys[keys.length - 1];
}
