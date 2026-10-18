import type { BurnEffect, Build, EnemyId, SlowEffect, WeaponStats } from '../types';
import type { StatusFx } from '../systems/combat';
import type { UIKey } from '../i18n';
import type { AudioKey } from '../data/assets';
import type { HitOpts } from './hooks';
import type { AffinityMap, AffinityTag } from './define';

// The narrow runtime API runtime hooks get (docs/item-hooks-refactor.md §5). Hooks never touch the scene: everything they may
// do is a method here. Pure types, no Phaser: `PhaserCtx` (src/scenes/phaserCtx.ts) adapts the arena, `FakeCtx`
// (src/engine/fakeCtx.ts) records every call for tests.

/** The part of an `Enemy` (scenes/enemies.ts) hooks may read or write. The real `Enemy` is assignable to it. */
export interface CombatEnemy {
  id: number;
  x: number; y: number;
  /** Knockback velocity. */
  kx: number; ky: number;
  hp: number; maxHp: number;
  alive: boolean;
  /** 'spawn' (still arriving: not targetable), 'walk', 'stun', 'dying', ... */
  state: string;
  elite: boolean;
  status: StatusFx;
  /** Price Check / Sale Flag mark: takes extra damage until this time (s, scene clock). */
  markedUntil?: number;
  critCoinDropped?: boolean;
  frozenT?: number;
  nailHits?: number;
  /** Seconds left in the current stun / stagger / recovery (the real `Enemy` always has it; `FakeCtx.stun` writes it). */
  stateT?: number;
  /** Scene clock (s) of this boss's last weakness stagger (`engine/affinity.ts` `tryStagger`). */
  staggerAt?: number;
  def: { id: EnemyId; radius: number; behavior: string; knockbackResist: number; armor?: number; weak?: AffinityMap; resist?: AffinityMap };
}

/** The part of a `Shot` (scenes/weapons.ts) hooks may read or write. `stats === null`: an enemy projectile. */
export interface CombatShot {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number;
  damage: number;
  stats: WeaponStats | null;
  /** A hook may hang a splash on a player shot (Ray Gun: radius and fraction of the hit damage); the hook's own `pattern:shotHit` reads it back. */
  splash: { r: number; m: number } | null;
  /** Enemies this shot has hit so far (including the hit being handled in `pattern:shotHit`). */
  tracker: { readonly hits: ReadonlySet<number> };
  /** Armed by a hook (Nailstorm, after the first hit): `pattern:shotMove` fires for the shot every frame so a hook can steer it. */
  homing?: boolean;
}

/** The goblin (`ArenaScene.player`). Live object: writes go straight to the game. */
export interface PlayerView {
  x: number; y: number;
  radius: number;
  facing: 1 | -1;
  vx: number; vy: number;
  invulnT: number; protectT: number; hurtT: number;
  /** Tin Foil Hat: > 0 while dashing and for a short grace after (enemy shots reflect). */
  reflectT: number;
  /** Dash: seconds of dash left / cooldown left / free-chain window left. */
  shoveT: number; shoveCd: number; chainT: number;
  /** Dash direction (unit vector). */
  shoveDX: number; shoveDY: number;
  dead: boolean;
  /**
   * Walking-speed multipliers hooks register by owner id (Sugar Rush, Tailwind); the scene multiplies the live value of each into the
   * goblin's speed every frame. A function of the scene clock, so a stack that expires between two ticks stops counting at once.
   */
  speedMods: Record<string, (now: number) => number>;
}

/** The `Fx` methods effect code calls today (scenes/fx.ts). No-ops in `FakeCtx` (recorded). */
export interface FxApi {
  spark(x: number, y: number, count?: number, tint?: number): void;
  crumbsAt(x: number, y: number, count?: number, tint?: number): void;
  puff(x: number, y: number, count?: number): void;
  flame(x: number, y: number): void;
  confetti(x: number, y: number, count?: number): void;
  frostBurst(x: number, y: number, count?: number): void;
  suck(x: number, y: number, radius: number, emit: boolean, tint?: number): void;
  number(x: number, y: number, value: number, color?: string, size?: number): void;
  label(x: number, y: number, text: string, color?: string, size?: number): void;
  ring(key: string, x: number, y: number, size: number, duration?: number, tint?: number, inward?: boolean): void;
  popImage(key: string, x: number, y: number, scale?: number, depth?: number): void;
  shake(intensity?: number, duration?: number): void;
  /** A straight line from (x1, y1) to (x2, y2) that fades out fast: Crack's shrapnel. */
  streak(x1: number, y1: number, x2: number, y2: number, tint?: number): void;
  /** Bag It: the garbage bag drawn at (x, y) for `seconds` (it swells and shrinks, then disappears). The blast itself is the hook's. */
  garbageBag(x: number, y: number, seconds: number): void;
}
export const FX_METHODS = ['spark', 'crumbsAt', 'puff', 'flame', 'confetti', 'frostBurst', 'suck', 'number', 'label', 'ring', 'popImage', 'shake', 'streak', 'garbageBag'] as const;

/** A player projectile for `spawnShot` (Arsenal.spawn's arguments). */
export interface ShotSpec { key: string; x: number; y: number; angle: number; speed: number; life: number; damage: number; stats: WeaponStats; maxHits: number }
/** A burning floor patch for `spawnPool` (Arsenal.firePool's arguments): no direct damage, burns for `tune`. */
export interface PoolSpec { x: number; y: number; r: number; time: number; stats: WeaponStats; tune: { dps: number; duration: number; tick: number } }

/** Read-only view of the aisle's modifiers (event, department). */
export interface AisleView {
  /** The department's/event's burn multiplier applied to a burn (heatwave, ...). */
  burn(b: BurnEffect): BurnEffect;
  /** Electrical weapons' cooldown rate: department perk x event. */
  electricRate(): number;
  /** Is (x, y) on an ice patch? */
  onIce(x: number, y: number): boolean;
}

export interface RuntimeCtx {
  // ---- time and randomness
  /** Scene clock in seconds (the one `markedUntil`, `burnUntil` ... compare against). */
  now(): number;
  /** Seeded combat rng (run seed + aisle index). Never `Math.random`, never `flow.rng`. */
  rng(): number;

  // ---- run state
  /** The computed build of the running cart (`store.state.build`). */
  readonly build: Build;
  readonly run: { readonly hp: number; readonly maxHp: number; readonly money: number; readonly aisle: number; readonly boss: boolean };
  readonly aisle: AisleView;
  /** True while weapons should keep acting (use it in delayed callbacks). */
  combatActive(): boolean;

  // ---- enemies
  /** Live, targetable enemies (not 'spawn', not dying). Do not keep the array across frames. */
  alive(): readonly CombatEnemy[];
  nearest(pos: { x: number; y: number }, range: number, exclude?: ReadonlySet<number>): CombatEnemy | null;
  inRadius(pos: { x: number; y: number }, r: number): CombatEnemy[];
  /**
   * The Electric-set / ricochet pick: the closest live enemy within `range` of `from` that is not in `seen` (ties go to the later one in
   * the arena's order, unlike `nearest`: no Honey Jar priority, the range is inclusive).
   */
  ricochetTarget(from: { x: number; y: number }, seen: ReadonlySet<number>, range: number): CombatEnemy | null;
  /** `ArenaScene.damageEnemy`: the full pipeline (crit, armor, statuses, kill). `source` null = no weapon (label it with `opts.label`). */
  damage(e: CombatEnemy, dmg: number, source: WeaponStats | null, opts?: HitOpts): void;
  /** Hit every live enemy within `r` of `pos` (+ its radius) once. Returns how many were hit. */
  damageArea(pos: { x: number; y: number }, r: number, dmg: number, source: WeaponStats | null, opts?: HitOpts): number;
  /**
   * Stun for `seconds` (bosses are immune). `tag` names the element of a frost or electric stun: the time scales with the enemy's affinity for it
   * (`statusDurationMult`); no tag = x1 (the dash stun). Returns the seconds actually applied (0 = refused), for a hook's ice-block visual.
   * `bossSeconds` (default 0 = immune): a boss or mini-boss that is walking is staggered for this long instead (Air Horn).
   */
  stun(e: CombatEnemy, seconds: number, tag?: AffinityTag, bossSeconds?: number): number;
  /** Every coin on the floor flies to the goblin (Vacuum's Full Suck). */
  pullCoins(): void;
  /** Multiply a weapon's suction `pull` and `range` for `seconds` (Vacuum's Full Suck). No effect on other patterns. */
  boostWeapon(weaponUid: string, boost: { pull: number; range: number }, seconds: number): void;
  /** Burn through the aisle's modifiers (`aisle.burn`), as the weapon branches do; its duration scales with the enemy's heat affinity. */
  ignite(e: CombatEnemy, burn: BurnEffect): void;
  /** Slow, its duration scaled by the enemy's frost affinity. */
  slow(e: CombatEnemy, slow: SlowEffect): void;
  /** Poison, its duration scaled by the enemy's poison affinity. */
  poison(e: CombatEnemy, dps: number, duration: number): void;
  /** Price Check / Sale Flag mark: extra damage from every source for `seconds`. */
  mark(e: CombatEnemy, seconds: number): void;
  /**
   * Shred: `stacks` more stacks (capped at `SHRED.cap`), -1 armor each against direct hits, for `seconds` (default `SHRED.duration`). Bosses are not immune;
   * no element, so affinity never scales it. Nothing here is rolled: a source that shreds only sometimes draws its own chance first.
   */
  shred(e: CombatEnemy, stacks: number, seconds?: number): void;
  /**
   * Weaken: the enemy deals `pct` less damage to the player for `seconds` (contact, melee, its projectiles; not hazards). The strongest running pct wins and the end is
   * the later of the two (capped at `WEAKEN.cap`). Bosses are not immune; no element, so affinity never scales it. Nothing is rolled here.
   */
  weaken(e: CombatEnemy, pct: number, seconds: number): void;
  /**
   * Wet: the enemy is soaked for `seconds` (default `WET_STATUS.duration`; refresh to the later end). On its own it does nothing; it makes electric hits, Electric chains,
   * frost slows / freezes and burns react (docs/item-hooks-refactor.md "Wet"). Bosses are not immune; no element, so affinity never scales it. Nothing is rolled here.
   */
  wet(e: CombatEnemy, seconds?: number): void;

  // ---- player
  readonly player: PlayerView;
  /** Closest point of the goblin's cart hitbox to (x, y). */
  playerNear(x: number, y: number): { x: number; y: number; d: number };
  /** `ArenaScene.hurtPlayer`: i-frames, `onPlayerHit` hooks (Bubble Wrap armor), death. */
  hurt(dmg: number): void;
  heal(hp: number): void;
  /** The flying heart + "+N" popup of a heal at (x, y). */
  healFx(x: number, y: number): void;

  // ---- spawning
  spawnShot(spec: ShotSpec): CombatShot | null;
  spawnPool(spec: PoolSpec): void;
  /** Party Popper blast: damages everything within `pop.radius`, never re-triggers poppers. `setPop`: the pink Blast-set look. */
  popperBlast(pos: { x: number; y: number }, pop: { damage: number; radius: number }, setPop?: boolean): void;
  /** A pan sweep of the weapon `weaponUid` at `angle` (`bonus`: the lighter extra sweep, Express Checkout). Fires `pattern:sweep` like any sweep. */
  sweep(weaponUid: string, angle: number, bonus?: boolean): void;
  /** A full Pressure Cooker explosion of the weapon `weaponUid` at (x, y) (Pot Slam). Fires `pattern:explode` like a lobbed pot. */
  explode(weaponUid: string, x: number, y: number): void;
  /** Fire the Self-Checkout beam of `weaponUid` at `target` right now (Power Surge's aftershock is `echo`). Fires `pattern:beam`. */
  beam(weaponUid: string, target: CombatEnemy, echo?: boolean): void;
  /** Enemy projectiles in flight. */
  enemyShots(): readonly CombatShot[];
  killShot(shot: CombatShot): void;
  /** Tin Foil Hat: turn an enemy shot around as a player shot worth `shot.damage * mult`. */
  reflectShot(shot: CombatShot, mult: number): void;

  // ---- economy
  dropCoin(pos: { x: number; y: number }, label: string): void;
  /** Credit coins directly (no floor coin). */
  addCoins(n: number, label: string): void;

  // ---- presentation (no-ops with `FakeCtx`, but recorded)
  /** A UI string in the current language: coin labels (`coinCoupon`, ...). Content files carry no i18n imports, so they ask the ctx. */
  t(key: UIKey, vars?: Record<string, string | number>): string;
  readonly fx: FxApi;
  /** The jagged bolt through `points` (the Electric chain), with its zap sound. */
  arcFx(points: readonly { x: number; y: number }[]): void;
  /** A zap bolt drawn on (x, y) (Microwave links; `small`: the lighter one Static Cling throws). Fx only. */
  boltFx(x: number, y: number, small: boolean): void;
  /**
   * One line of the status text above the goblin ("SUGAR ###", "BAG x3"). Lines are shown top to bottom by `order`, then in the order they
   * first appeared; `null` removes the line. Drawn only while the goblin is fighting.
   */
  setLine(id: string, text: string | null, order?: number): void;
  sound(name: AudioKey, opts?: { rate?: number; volume?: number }): void;
  tween(target: object, props: Record<string, number>, ms: number): void;
  delay(seconds: number, fn: () => void): void;
}
