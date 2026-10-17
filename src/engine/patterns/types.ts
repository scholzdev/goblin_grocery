import type Phaser from 'phaser';
import type { Build, BurnEffect, SlowEffect, WeaponBase, WeaponPattern, WeaponStats } from '../../types';
import type { HitTracker } from '../../systems/combat';
import type { CombatEnemy, FxApi, PlayerView } from '../ctx';
import type { HitOpts, HookTable, WeaponLook } from '../hooks';

// What the pattern code (engine/patterns/*) needs from the arena. Types only: Phaser is imported as a type, never at runtime, so the
// patterns run headless against `FakeArsenal` (fakeHost.ts) and against the real `Arsenal` (scenes/weapons.ts) alike.

/** The part of a Phaser `Image` the patterns call (every method returns the image itself). A Phaser image satisfies it. */
export interface Sprite {
  setVisible(v: boolean): this;
  setTexture(key: string): this;
  setAlpha(a: number): this;
  setScale(x: number, y?: number): this;
  setRotation(r: number): this;
  setPosition(x: number, y?: number): this;
  setDepth(d: number): this;
  setDisplaySize(w: number, h: number): this;
  setOrigin(x: number, y?: number): this;
  setTint(tint: number): this;
  destroy(): void;
  rotation: number;
  texture: { key: string };
}

/** The real `Enemy` (scenes/enemies.ts) as far as the patterns read it. */
export type PatternEnemy = CombatEnemy & { shieldBlocked?: number; def: { shield?: boolean } };

/** What patterns use of `ArenaScene`. The real scene satisfies it structurally. */
export interface PatternScene {
  add: { image(x: number, y: number, key: string): Sprite };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tweens: { add(config: any): unknown };
  time: Pick<Phaser.Time.Clock, 'now' | 'delayedCall'>;
  readonly enemies: PatternEnemy[];
  readonly player: PlayerView;
  readonly hooks: HookTable;
  readonly fx: FxApi;
  /** Department perk: electrical weapons cycle this much faster. */
  readonly dept: { readonly electricalRate: number };
  readonly aisleEvent: { electricRate(): number; burn(b: BurnEffect): BurnEffect };
  rng(): number;
  combatActive(): boolean;
  /** The nearest live enemy within `range` of the goblin (Honey Jars count double). */
  nearestEnemy(range: number): PatternEnemy | null;
  nearestEnemyFrom(x: number, y: number, range: number, exclude?: Set<number>): PatternEnemy | null;
  damageEnemy(e: PatternEnemy, dmg: number, stats: WeaponStats | null, opts: HitOpts): void;
  /** The cart prop of this weapon kicks (a tween). */
  recoil(uid: string): void;
}

/** A player or enemy projectile. Pooled by the arsenal. */
export interface Shot {
  img: Sprite;
  shadow: Sprite;
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number;
  damage: number;
  tracker: HitTracker;
  stats: WeaponStats | null; // null = enemy projectile
  /** Armed by a hook: `pattern:shotMove` runs for the shot every frame. */
  homing: boolean;
  spin: number;
  maxLife: number;
  ricochet: boolean;
  /** A hook's splash on impact (Ray Gun sets it, its `pattern:shotHit` hook applies it). */
  splash: { r: number; m: number } | null;
}

/** The runtime of one weapon of the cart. */
export interface WeaponRt {
  stats: WeaponStats;
  cd: number;
  burstLeft: number;
  burstT: number;
  /** Blender: the spinning blade ring (drawn by the arsenal, turned by the aura pattern). */
  blades: Sprite | null;
  /** The weapon item's base definition (its content `weapon`): knockback, sprite key ... */
  base: WeaponBase;
  /** The item's content tune resolved at the weapon's tier: the pattern parameters that are not stats (puddle slow, cone blow). */
  tune: Readonly<Record<string, number>>;
  /** Electrical weapons cycle faster in the Electronics department. */
  electrical: boolean;
}

export interface Puddle { img: Sprite; x: number; y: number; r: number; until: number; nextTick: number; stats: WeaponStats; burnOnly?: boolean; burn?: BurnEffect; /** The soap slip (drops of a Mop; burning pools have none). */ slow?: SlowEffect; /** Enemies that already had a tick here (only tracked while a puddleEnter hook is registered: Black Ice freezes on `first`). */ seen?: Set<number> }
export interface Pot { img: Sprite; shadow: Sprite; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; stats: WeaponStats }

/** The arsenal as the patterns see it: the scene plus the pools they share. */
export interface PatternHost {
  readonly sc: PatternScene;
  weapons: WeaponRt[];
  shots: Shot[];
  puddles: Puddle[];
  pots: Pot[];
  /** The arsenal's own clock (s): puddles live by it. */
  time: number;
  /** Cosmetics per weapon uid (`pattern:look`). */
  readonly looks: Map<string, WeaponLook>;
  /** Gap between the repeats of a sweep / cone / mortar (Multipack's tune). */
  readonly repeatDelay: number;
  /** The computed build of the running cart. */
  readonly build: Build;
  spawn(key: string, x: number, y: number, a: number, speed: number, life: number, damage: number, stats: WeaponStats | null, maxHits: number): Shot | null;
  kill(s: Shot): void;
  sound(name: string, opts?: { rate?: number; volume?: number }): void;
}

/**
 * One way of attacking. The weapon's content file names it (`weapon.pattern`) and tunes it (base stats, `tune`); the pattern owns the
 * geometry, the damage calls and the `pattern:*` events combos hook into.
 */
export interface Pattern {
  readonly id: WeaponPattern;
  /** Every frame for each weapon of this pattern, before its cooldown ticks: spinning blades, suction, the later nails of a burst. */
  tick?(h: PatternHost, w: WeaponRt, dt: number, firing: boolean): void;
  /** The cooldown ran out (and, unless `blind`, `target` is in range): attack. Return nothing; the arsenal resets the cooldown. */
  fire(h: PatternHost, w: WeaponRt, target: PatternEnemy | null): void;
  /** Attacks without waiting for an enemy and does not recoil (Mop drops its puddle behind the cart). */
  readonly blind?: boolean;
  /** Once per frame after the shots moved: things the pattern left in the world (puddles, lobbed pots). */
  update?(h: PatternHost, dt: number): void;
}
