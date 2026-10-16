import { applyBurn, applyPoison, applySlow, newStatus } from '../systems/combat';
import { combatRng, type Rng } from '../systems/rng';
import { CRIT, PLAYER } from '../data/items';
import { t, type UIKey } from '../i18n';
import type { Build, BurnEffect, SlowEffect, WeaponStats } from '../types';
import { FX_METHODS, type AisleView, type CombatEnemy, type CombatShot, type FxApi, type PlayerView, type PoolSpec, type RuntimeCtx, type ShotSpec } from './ctx';
import { EMPTY_HOOKS, type HitEvent, type HitOpts, type HookTable } from './hooks';
import { applyHitStatuses, scheduleEcho } from './onHitStatuses';
import { applyKillEffects } from './onKillEffects';

// `RuntimeCtx` for tests (docs/item-hooks-refactor.md §5/§6): a deterministic clock and rng, an in-memory enemy list, and a log of
// every effect a hook asked for. No Phaser, no timers: delayed callbacks and tweens run when the test calls `advance(s)`.
//
// Per-item tests build a cart, compile its hooks (`buildHooks(cart, recipes, sets, fake)`), `attach` the table and drive it:
//   fake.hit(enemy, 10, stats)     a player-originated hit through the damage pipeline (modifyDamage -> crit -> onCrit -> hp -> onHit -> onKill)
//   fake.hooks.emit('onDashHit', { ... })   any other emit point, with a payload the test builds
// then assert on `fake.calls` / `fake.callsOf('stun')` and on the in-memory enemies/player.
//
// What the fake does NOT simulate is everything the scene still does outside hooks (legacy branches: Five-Alarm, the mark multiplier, armor,
// burn/slow/knockback application, Bag It ...). When an item moves into a hook, its effect shows up here as a recorded call.

/** One effect a hook asked for, stamped with the fake clock (`at`, seconds). */
export type Call = { at: number } & (
  | { kind: 'damage'; enemy: number; dmg: number; source: string | null; opts: HitOpts }
  | { kind: 'stun'; enemy: number; seconds: number }
  | { kind: 'ignite'; enemy: number; burn: BurnEffect }
  | { kind: 'slow'; enemy: number; slow: SlowEffect }
  | { kind: 'poison'; enemy: number; dps: number; duration: number }
  | { kind: 'mark'; enemy: number; seconds: number }
  | { kind: 'hurt'; dmg: number }
  | { kind: 'heal'; hp: number }
  | { kind: 'healFx'; x: number; y: number }
  | { kind: 'spawnShot'; spec: ShotSpec }
  | { kind: 'spawnPool'; spec: PoolSpec }
  | { kind: 'popperBlast'; x: number; y: number; damage: number; radius: number; setPop: boolean }
  | { kind: 'killShot'; shot: CombatShot }
  | { kind: 'reflectShot'; shot: CombatShot; mult: number }
  | { kind: 'dropCoin'; x: number; y: number; label: string }
  | { kind: 'addCoins'; n: number; label: string }
  | { kind: 'fx'; method: string; args: unknown[] }
  | { kind: 'sound'; name: string; opts?: { rate?: number; volume?: number } }
  | { kind: 'tween'; props: Record<string, number>; ms: number }
  | { kind: 'delay'; seconds: number }
);
export type CallKind = Call['kind'];

export interface FakeOptions {
  /** Run seed; the combat rng is `combatRng(seed, aisle)`, exactly what the arena creates. Default 1. */
  seed?: number;
  aisle?: number;
  build?: Build;
  hp?: number; maxHp?: number; money?: number; boss?: boolean;
  player?: Partial<PlayerView>;
  /** Multiplies every burn passed to `ignite` (department / event burn modifiers). Default 1. */
  burnMult?: number;
  /** Which points are on ice. Default: nowhere. */
  onIce?: (x: number, y: number) => boolean;
}

const defaultPlayer = (): PlayerView => ({ x: 0, y: 0, radius: 20, facing: 1, vx: 0, vy: 0, invulnT: 0, protectT: 0, hurtT: 0, reflectT: 0, shoveT: 0, shoveCd: 0, chainT: 0, shoveDX: 1, shoveDY: 0, dead: false });

export class FakeCtx implements RuntimeCtx {
  /** Scene clock in seconds. */
  time = 0;
  readonly calls: Call[] = [];
  /** The in-memory arena: `spawnEnemy` adds here. */
  readonly enemies: CombatEnemy[] = [];
  /** Enemy projectiles in flight (what `enemyShots()` returns). */
  readonly hostileShots: CombatShot[] = [];
  /** Projectiles the hooks spawned. */
  readonly playerShots: CombatShot[] = [];
  readonly player: PlayerView;
  build: Build;
  run: { hp: number; maxHp: number; money: number; aisle: number; boss: boolean };
  readonly aisle: AisleView;
  /** `combatActive()`: set false to test the "aisle is over" guard in delayed callbacks. */
  active = true;
  /** The compiled hooks `damage`/`hit`/`hurt` dispatch to. */
  hooks: HookTable = EMPTY_HOOKS;
  readonly fx: FxApi;
  readonly seed: number;
  private readonly rand: Rng;
  private nextId = 1;
  private queue: { due: number; seq: number; fn: () => void }[] = [];
  private seq = 0;

  constructor(opts: FakeOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rand = combatRng(this.seed, opts.aisle ?? 0);
    this.build = opts.build ?? ({ maxHp: opts.maxHp ?? 100, invulnBonus: 0, weapons: [], recipes: [], sets: {} } as unknown as Build);
    this.run = { hp: opts.hp ?? opts.maxHp ?? 100, maxHp: opts.maxHp ?? this.build.maxHp ?? 100, money: opts.money ?? 0, aisle: opts.aisle ?? 0, boss: opts.boss ?? false };
    this.player = { ...defaultPlayer(), ...opts.player };
    const burnMult = opts.burnMult ?? 1, onIce = opts.onIce ?? (() => false);
    this.aisle = {
      burn: (b) => (burnMult === 1 ? b : { ...b, dps: b.dps * burnMult }),
      electricRate: () => 1,
      onIce,
    };
    const fx = {} as Record<string, (...args: unknown[]) => void>;
    for (const m of FX_METHODS) fx[m] = (...args: unknown[]) => { this.log({ kind: 'fx', method: m, args }); };
    this.fx = fx as unknown as FxApi;
  }

  // ---- test controls ------------------------------------------------------------------------------------------------------

  /** Use these compiled hooks for `damage`, `hit` and `hurt`. */
  attach(table: HookTable): this { this.hooks = table; return this; }

  /** Add a live enemy (defaults: a 10 HP walker at the origin). */
  spawnEnemy(p: Partial<Omit<CombatEnemy, 'def'>> & { def?: Partial<CombatEnemy['def']> } = {}): CombatEnemy {
    const { def, ...rest } = p;
    const e: CombatEnemy = {
      id: this.nextId++, x: 0, y: 0, kx: 0, ky: 0, hp: 10, maxHp: 10, alive: true, state: 'walk', elite: false, status: newStatus(),
      def: { id: 'milk', radius: 20, behavior: 'chase', knockbackResist: 0, ...def },
      ...rest,
    };
    if (rest.hp !== undefined && rest.maxHp === undefined) e.maxHp = rest.hp;
    this.enemies.push(e);
    return e;
  }

  /** Add an enemy projectile in flight. */
  spawnHostileShot(p: Partial<CombatShot> = {}): CombatShot {
    const s: CombatShot = { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 2, damage: 8, stats: null, ...p };
    this.hostileShots.push(s);
    return s;
  }

  /**
   * Run the clock forward `seconds`: due `delay` callbacks and tween ends fire in order, each at its own due time (callbacks may schedule
   * more). Nothing else moves.
   */
  advance(seconds: number): void {
    const end = this.time + seconds;
    for (;;) {
      let next = -1;
      for (let i = 0; i < this.queue.length; i++) {
        const q = this.queue[i];
        if (q.due <= end && (next < 0 || q.due < this.queue[next].due || (q.due === this.queue[next].due && q.seq < this.queue[next].seq))) next = i;
      }
      if (next < 0) break;
      const [q] = this.queue.splice(next, 1);
      this.time = Math.max(this.time, q.due);
      q.fn();
    }
    this.time = end;
  }

  /** One frame: `advance(dt)` then the `onTick` hooks. */
  tick(dt: number): void {
    this.advance(dt);
    if (this.hooks.onTick.length) this.hooks.emit('onTick', dt);
  }

  /** A player-originated hit (the weapon side of `damageEnemy`): not recorded as a call, but the pipeline and its hooks run. */
  hit(e: CombatEnemy, dmg: number, source: WeaponStats | null = null, opts: HitOpts = {}): void { this.runHit(e, dmg, source, opts); }

  callsOf<K extends CallKind>(kind: K): Extract<Call, { kind: K }>[] { return this.calls.filter((c): c is Extract<Call, { kind: K }> => c.kind === kind); }
  /** Forget the log (not the enemies or the clock). */
  clear(): void { this.calls.length = 0; }

  // ---- RuntimeCtx -------------------------------------------------------------------------------------------------------------

  now(): number { return this.time; }
  rng(): number { return this.rand(); }
  combatActive(): boolean { return this.active; }

  alive(): readonly CombatEnemy[] { return this.enemies.filter((e) => e.alive && e.state !== 'spawn'); }
  nearest(pos: { x: number; y: number }, range: number, exclude?: ReadonlySet<number>): CombatEnemy | null {
    let best: CombatEnemy | null = null, bd = range * range;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn' || exclude?.has(e.id)) continue;
      const d = (e.x - pos.x) ** 2 + (e.y - pos.y) ** 2;
      if (d >= range * range) continue;
      const k = e.def.id === 'honey' ? d * 0.25 : d;
      if (k < bd) { bd = k; best = e; }
    }
    return best;
  }
  inRadius(pos: { x: number; y: number }, r: number): CombatEnemy[] {
    return this.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 <= (r + e.def.radius) ** 2);
  }
  damage(e: CombatEnemy, dmg: number, source: WeaponStats | null, opts: HitOpts = {}): void {
    this.log({ kind: 'damage', enemy: e.id, dmg, source: source?.uid ?? null, opts });
    this.runHit(e, dmg, source, opts);
  }
  damageArea(pos: { x: number; y: number }, r: number, dmg: number, source: WeaponStats | null, opts: HitOpts = {}): number {
    const hit = this.inRadius(pos, r);
    for (const e of hit) this.damage(e, dmg, source, opts);
    return hit.length;
  }
  stun(e: CombatEnemy, seconds: number): void {
    this.log({ kind: 'stun', enemy: e.id, seconds });
    if (e.alive && e.def.behavior !== 'boss') e.state = 'stun';
  }
  ignite(e: CombatEnemy, burn: BurnEffect): void {
    this.log({ kind: 'ignite', enemy: e.id, burn });
    applyBurn(e.status, this.aisle.burn(burn), this.time);
  }
  slow(e: CombatEnemy, slow: SlowEffect): void {
    this.log({ kind: 'slow', enemy: e.id, slow });
    applySlow(e.status, slow, this.time);
  }
  poison(e: CombatEnemy, dps: number, duration: number): void {
    this.log({ kind: 'poison', enemy: e.id, dps, duration });
    applyPoison(e.status, dps, duration, this.time);
  }
  mark(e: CombatEnemy, seconds: number): void {
    this.log({ kind: 'mark', enemy: e.id, seconds });
    e.markedUntil = this.time + seconds;
  }

  playerNear(x: number, y: number): { x: number; y: number; d: number } {
    return { x: this.player.x, y: this.player.y, d: Math.hypot(x - this.player.x, y - this.player.y) };
  }
  /** Mirrors `ArenaScene.hurtPlayer`: i-frames block it, `onPlayerHit` hooks may lower the damage / change the i-frames. */
  hurt(dmg: number): void {
    this.log({ kind: 'hurt', dmg });
    const p = this.player;
    if (p.dead || p.invulnT > 0 || p.protectT > 0) return;
    let invuln = PLAYER.invuln + (this.build.invulnBonus ?? 0);
    if (this.hooks.onPlayerHit.length) { const ev = { dmg, invuln }; this.hooks.emit('onPlayerHit', ev); dmg = ev.dmg; invuln = ev.invuln; }
    this.run.hp = Math.max(0, this.run.hp - dmg);
    p.invulnT = invuln;
    if (this.run.hp <= 0) p.dead = true;
  }
  heal(hp: number): void {
    this.log({ kind: 'heal', hp });
    this.run.hp = Math.min(this.run.maxHp, this.run.hp + hp);
  }
  healFx(x: number, y: number): void { this.log({ kind: 'healFx', x, y }); }

  spawnShot(spec: ShotSpec): CombatShot | null {
    this.log({ kind: 'spawnShot', spec });
    const s: CombatShot = { active: true, x: spec.x, y: spec.y, vx: Math.cos(spec.angle) * spec.speed, vy: Math.sin(spec.angle) * spec.speed, life: spec.life, damage: spec.damage, stats: spec.stats };
    this.playerShots.push(s);
    return s;
  }
  spawnPool(spec: PoolSpec): void { this.log({ kind: 'spawnPool', spec }); }
  /** Damages every enemy in the radius with `fromPopper` (so poppers never re-trigger), as the scene does. */
  popperBlast(pos: { x: number; y: number }, pop: { damage: number; radius: number }, setPop = false): void {
    this.log({ kind: 'popperBlast', x: pos.x, y: pos.y, damage: pop.damage, radius: pop.radius, setPop });
    for (const e of this.inRadius(pos, pop.radius)) this.damage(e, pop.damage, null, { fromPopper: true, label: 'Party Popper' });
  }
  enemyShots(): readonly CombatShot[] { return this.hostileShots.filter((s) => s.active); }
  killShot(shot: CombatShot): void { this.log({ kind: 'killShot', shot }); shot.active = false; }
  reflectShot(shot: CombatShot, mult: number): void { this.log({ kind: 'reflectShot', shot, mult }); shot.active = false; }

  dropCoin(pos: { x: number; y: number }, label: string): void { this.log({ kind: 'dropCoin', x: pos.x, y: pos.y, label }); }
  addCoins(n: number, label: string): void { this.log({ kind: 'addCoins', n, label }); this.run.money += n; }

  /** The real strings (current language), so a test sees the label the player would. */
  t(key: UIKey, vars?: Record<string, string | number>): string { return t(key, vars); }
  sound(name: string, opts?: { rate?: number; volume?: number }): void { this.log({ kind: 'sound', name, opts }); }
  /** Recorded; the end values are applied to the target when the clock reaches `ms`. */
  tween(target: object, props: Record<string, number>, ms: number): void {
    this.log({ kind: 'tween', props, ms });
    this.later(ms / 1000, () => Object.assign(target, props));
  }
  delay(seconds: number, fn: () => void): void {
    this.log({ kind: 'delay', seconds });
    this.later(seconds, fn);
  }

  // ---- internals ----------------------------------------------------------------------------------------------------------------

  private log(c: { kind: CallKind } & Record<string, unknown>): void { this.calls.push({ at: this.time, ...c } as Call); }
  private later(seconds: number, fn: () => void): void { this.queue.push({ due: this.time + seconds, seq: this.seq++, fn }); }

  /**
   * The combat-rng part of `ArenaScene.damageEnemy` (see the pipeline comment there): modifyDamage, crit roll, onCrit, hp, onHit, the
   * stats-driven statuses (burn, ignite, slow, Frost L2), echo, and on a lethal hit onKill + the popper blast. Not simulated: Five-Alarm /
   * mark multipliers, armor, knockback, the Electric chain, the Kitchen / Blast-set kill rolls.
   */
  private runHit(e: CombatEnemy, dmg: number, stats: WeaponStats | null, o: HitOpts): void {
    if (!e.alive) return;
    const H = this.hooks, now = this.time;
    const key = o.poison ? 'poison' : o.isDot ? 'burn' : stats?.uid ?? o.label ?? 'shove';
    const hit: HitEvent = { enemy: e, base: dmg, dmg, stats, opts: o, source: key, now, direct: !o.isDot && !o.echo && !o.fromPopper && !o.chained, crit: false, armored: false, killed: false };
    H.emit('modifyDamage', hit); dmg = hit.dmg;
    if (!o.isDot && stats && stats.critChance > 0 && this.rand() < stats.critChance) {
      dmg *= CRIT.mult;
      hit.crit = true; hit.dmg = dmg; H.emit('onCrit', hit); dmg = hit.dmg;
    }
    hit.dmg = dmg;
    e.hp -= dmg;
    hit.killed = e.hp <= 0; H.emit('onHit', hit);
    applyHitStatuses(hit, this);
    scheduleEcho(hit, this);
    if (e.hp <= 0) {
      e.alive = false;
      e.state = 'dying';
      H.emit('onKill', { enemy: e, hit });
      applyKillEffects(hit, this);
    }
  }
}
