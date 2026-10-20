import { applyBurn, applyPoison, applyShred, applySlow, applyWeaken, hitArmor, newStatus, shredGain } from '../systems/combat';
import { applyWet, burnVsWet, slowVsWet, wetElectricMult } from './wet';
import { newDamageStats, recordDamage, type DamageSink } from '../systems/damageStats';
import { combatRng, type Rng } from '../systems/rng';
import { CRIT, PLAYER } from '../data/items';
import { ENEMIES } from '../data/enemies';
import { t, type UIKey } from '../i18n';
import type { AudioKey } from '../data/assets';
import type { Build, BurnEffect, HitSource, ItemTypeId, SlowEffect, WeaponStats } from '../types';
import { FX_METHODS, type AisleView, type CombatEnemy, type CombatShot, type FxApi, type PlayerView, type PoolSpec, type RuntimeCtx, type ShotSpec } from './ctx';
import { EMPTY_HOOKS, type HitEvent, type HitOpts, type HookTable } from './hooks';
import { applyMark, markedDamage } from './marks';
import { Reactor, markFrostStun } from './reactions';
import { affinityMult, burnFor, markMult, poisonTimeFor, slowFor, statusDurationMult, tryStagger } from './affinity';
import { AFFINITY, SHRED, WET_STATUS, type AffinityTag } from './define';
import { hitTags } from './hitTags';
import { damageType } from './damageType';
import { applyHitStatuses, scheduleEcho } from './onHitStatuses';
import { applyKillEffects } from './onKillEffects';
import { beamOnce, explodeAt, spawnFirePool, sweepOnce, type PatternEnemy, type PatternHost, type WeaponRt } from './patterns';

// `RuntimeCtx` for tests (docs/item-hooks-refactor.md §5/§6): a deterministic clock and rng, an in-memory enemy list, and a log of
// every effect a hook asked for. No Phaser, no timers: delayed callbacks and tweens run when the test calls `advance(s)`.
//
// Per-item tests build a cart, compile its hooks (`buildHooks(cart, recipes, sets, fake)`), `attach` the table and drive it:
//   fake.hit(enemy, 10, stats)     a player-originated hit through the damage pipeline (modifyDamage -> crit -> onCrit -> hp -> onHit -> onKill)
//   fake.hooks.emit('onDashHit', { ... })   any other emit point, with a payload the test builds
// then assert on `fake.calls` / `fake.callsOf('stun')` and on the in-memory enemies/player.
//
// What the fake does NOT simulate is everything the scene still does outside hooks (knockback, the pattern code that fires the hooks'
// events: a test emits `pattern:*` / `onDash*` events itself). When an item moves into a hook, its effect shows up here as a recorded call.

/** One effect a hook asked for, stamped with the fake clock (`at`, seconds). */
export type Call = { at: number } & (
  | { kind: 'damage'; enemy: number; dmg: number; source: string | null; opts: HitOpts }
  | { kind: 'stun'; enemy: number; seconds: number; tag?: AffinityTag }
  | { kind: 'pullCoins' }
  | { kind: 'boostWeapon'; weapon: string; pull: number; range: number; seconds: number }
  | { kind: 'slide'; enemy: number; seconds: number; slam: number; speed: number }
  | { kind: 'stagger'; enemy: number }
  | { kind: 'ignite'; enemy: number; burn: BurnEffect }
  | { kind: 'slow'; enemy: number; slow: SlowEffect }
  | { kind: 'poison'; enemy: number; dps: number; duration: number }
  | { kind: 'mark'; enemy: number; seconds: number }
  | { kind: 'shred'; enemy: number; stacks: number; seconds: number }
  | { kind: 'weaken'; enemy: number; pct: number; seconds: number }
  | { kind: 'wet'; enemy: number; seconds: number }
  | { kind: 'hurt'; dmg: number; source?: HitSource }
  | { kind: 'heal'; hp: number }
  | { kind: 'drain'; hp: number; by: ItemTypeId }
  | { kind: 'healFx'; x: number; y: number }
  | { kind: 'spawnShot'; spec: ShotSpec }
  | { kind: 'spawnPool'; spec: PoolSpec }
  | { kind: 'popperBlast'; x: number; y: number; damage: number; radius: number; setPop: boolean }
  | { kind: 'killShot'; shot: CombatShot }
  | { kind: 'reflectShot'; shot: CombatShot; mult: number }
  | { kind: 'dropCoin'; x: number; y: number; label: string }
  | { kind: 'addCoins'; n: number; label: string }
  | { kind: 'fx'; method: string; args: unknown[] }
  | { kind: 'sound'; name: AudioKey; opts?: { rate?: number; volume?: number } }
  | { kind: 'tween'; props: Record<string, number>; ms: number }
  | { kind: 'delay'; seconds: number }
  | { kind: 'sweep'; weapon: string; angle: number; bonus: boolean }
  | { kind: 'explode'; weapon: string; x: number; y: number }
  | { kind: 'beam'; weapon: string; target: number; echo: boolean }
  | { kind: 'boltFx'; x: number; y: number; small: boolean }
  | { kind: 'line'; id: string; text: string | null; order: number }
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

const defaultPlayer = (): PlayerView => ({ x: 0, y: 0, radius: 20, facing: 1, vx: 0, vy: 0, invulnT: 0, protectT: 0, hurtT: 0, reflectT: 0, shoveT: 0, shoveCd: 0, chainT: 0, shoveDX: 1, shoveDY: 0, dead: false, speedMods: {} });

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
  /** The status lines (`setLine`) as the scene would show them: id -> text/order, null once removed. */
  readonly lines = new Map<string, { text: string; order: number } | null>();
  readonly player: PlayerView;
  build: Build;
  run: { hp: number; maxHp: number; money: number; aisle: number; boss: boolean };
  readonly aisle: AisleView;
  /** `combatActive()`: set false to test the "aisle is over" guard in delayed callbacks. */
  active = true;
  /** The compiled hooks `damage`/`hit`/`hurt` dispatch to. */
  hooks: HookTable = EMPTY_HOOKS;
  /**
   * The weapons `spawnShot`, `spawnPool`, `sweep`, `explode` and `beam` act on, routed like `PhaserCtx` routes them to the scene's arsenal (the build
   * lab sets its `FakeArsenal`). Without one, as in a test of a single hook, a spawned shot only lands in `playerShots` and the others are only logged.
   */
  arsenal: PatternHost | null = null;
  readonly fx: FxApi;
  /** The run's damage breakdown as `ArenaScene` keeps it (`RunStats.damageByWeapon` + `damage`): every hit of `runHit` is recorded here. */
  readonly dmgLog: DamageSink = { damageByWeapon: {}, damage: newDamageStats() };
  /** The element reactions (engine/reactions.ts), the same rules the arena runs; their counts land in `dmgLog.damage.reactions`. */
  readonly reactor = new Reactor(this, () => this.dmgLog);
  readonly killingHit = new WeakMap<CombatEnemy, HitEvent>();
  readonly seed: number;
  private readonly rand: Rng;
  private nextId = 1;
  private queue: { due: number; seq: number; fn: () => void }[] = [];
  private seq = 0;

  constructor(opts: FakeOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rand = combatRng(this.seed, opts.aisle ?? 0);
    this.build = opts.build ?? ({ maxHp: opts.maxHp ?? 100, weapons: [], recipes: [], sets: {} } as unknown as Build);
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

  /**
   * Add a live enemy built from the real content def of `id` (radius, behavior, knockback resist, armor, weak / resist, HP): what the arena
   * would spawn at HP scale 1. `spawnEnemy` stays neutral (no affinity) so tests of one item do not depend on the enemy table.
   */
  spawnReal(id: keyof typeof ENEMIES, p: Partial<Omit<CombatEnemy, 'def'>> = {}): CombatEnemy {
    const d = ENEMIES[id];
    return this.spawnEnemy({ hp: d.hp, ...p, def: { id, radius: d.radius, behavior: d.behavior, knockbackResist: d.knockbackResist, ...(d.armor ? { armor: d.armor } : {}), ...(d.weak ? { weak: d.weak } : {}), ...(d.resist ? { resist: d.resist } : {}) } });
  }

  /** Add an enemy projectile in flight. */
  spawnHostileShot(p: Partial<CombatShot> = {}): CombatShot {
    const s: CombatShot = { active: true, x: 0, y: 0, vx: 0, vy: 0, life: 2, damage: 8, stats: null, splash: null, tracker: { hits: new Set() }, ...p };
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
  ricochetTarget(from: { x: number; y: number }, seen: ReadonlySet<number>, range: number): CombatEnemy | null {
    let best: CombatEnemy | null = null, bd = range * range;
    for (const c of this.enemies) {
      if (!c.alive || c.state === 'spawn' || seen.has(c.id)) continue;
      const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
      if (d <= bd) { best = c; bd = d; }
    }
    return best;
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
  /** Mirrors `ArenaScene.stunEnemy`: bosses are immune, the time scales with the enemy's affinity for `tag`. The log keeps the requested seconds. */
  stun(e: CombatEnemy, seconds: number, tag?: AffinityTag, bossSeconds = 0): number {
    this.log({ kind: 'stun', enemy: e.id, seconds, ...(tag ? { tag } : {}) });
    if (!e.alive) return 0;
    if (e.def.behavior === 'boss') { // mirrors the scene: only a walking boss, only for the cap
      if (bossSeconds <= 0 || e.state !== 'walk') return 0;
      e.state = 'stun';
      e.stateT = Math.max(e.stateT ?? 0, bossSeconds);
      return bossSeconds;
    }
    const applied = seconds * statusDurationMult(e.def, tag);
    e.state = 'stun';
    e.stateT = Math.max(e.stateT ?? 0, applied);
    if (tag === 'frost') { markFrostStun(e.status, applied, this.time); this.reactor.applied(e, 'frost'); } // a frost stun is a freeze: the enemy is frosted
    return applied;
  }
  /** Mirrors `ArenaScene.slideEnemy`: bosses are immune, the shove goes away from the goblin (the slam itself is the scene's, so only `slideUntil` and the velocity are set). */
  slide(e: CombatEnemy, seconds: number, slam: number, speed: number): number {
    this.log({ kind: 'slide', enemy: e.id, seconds, slam, speed });
    if (!e.alive || e.def.behavior === 'boss') return 0;
    const dx = e.x - this.player.x, dy = e.y - this.player.y, d = Math.hypot(dx, dy) || 1, k = 1 - e.def.knockbackResist;
    e.kx = (dx / d) * speed * k; e.ky = (dy / d) * speed * k;
    e.slideUntil = this.time + seconds;
    return seconds;
  }
  // The log keeps what the hook asked for; the status on the enemy has the duration scaled by its affinity (burnFor / slowFor / poisonTimeFor).
  ignite(e: CombatEnemy, burn: BurnEffect): void {
    this.log({ kind: 'ignite', enemy: e.id, burn });
    applyBurn(e.status, burnVsWet(e.status, burnFor(e.def, this.aisle.burn(burn)), this.time), this.time);
    this.reactor.applied(e, 'burn');
  }
  slow(e: CombatEnemy, slow: SlowEffect): void {
    this.log({ kind: 'slow', enemy: e.id, slow });
    applySlow(e.status, slowVsWet(e.status, slowFor(e.def, slow), this.time), this.time, true); // the stats-driven slow is the frost channel (see PhaserCtx.slow)
    this.reactor.applied(e, 'frost');
  }
  poison(e: CombatEnemy, dps: number, duration: number): void {
    this.log({ kind: 'poison', enemy: e.id, dps, duration });
    applyPoison(e.status, dps, poisonTimeFor(e.def, duration), this.time);
    this.reactor.applied(e, 'poison');
  }
  mark(e: CombatEnemy, seconds: number): void {
    this.log({ kind: 'mark', enemy: e.id, seconds });
    applyMark(e, this.time, seconds);
  }
  shred(e: CombatEnemy, stacks: number, seconds: number = SHRED.duration): void {
    this.log({ kind: 'shred', enemy: e.id, stacks, seconds });
    applyShred(e.status, stacks, seconds, this.time);
  }
  weaken(e: CombatEnemy, pct: number, seconds: number): void {
    this.log({ kind: 'weaken', enemy: e.id, pct, seconds });
    applyWeaken(e.status, pct, seconds, this.time);
  }
  wet(e: CombatEnemy, seconds: number = WET_STATUS.duration): void {
    this.log({ kind: 'wet', enemy: e.id, seconds });
    applyWet(e.status, seconds, this.time);
  }

  playerNear(x: number, y: number): { x: number; y: number; d: number } {
    return { x: this.player.x, y: this.player.y, d: Math.hypot(x - this.player.x, y - this.player.y) };
  }
  /** Mirrors `ArenaScene.hurtPlayer`: i-frames block it, `onPlayerHit` hooks may lower the damage / change the i-frames. True when the hit landed. `source` is optional: the lab and the tests keep no damage-taken book. */
  hurt(dmg: number, source?: HitSource): boolean {
    this.log({ kind: 'hurt', dmg, source });
    const p = this.player;
    if (p.dead || p.invulnT > 0 || p.protectT > 0) return false;
    let invuln = PLAYER.invuln;
    if (this.hooks.onPlayerHit.length) { const ev = { dmg, invuln }; this.hooks.emit('onPlayerHit', ev); dmg = ev.dmg; invuln = ev.invuln; }
    this.run.hp = Math.max(0, this.run.hp - dmg);
    p.invulnT = invuln;
    if (this.run.hp <= 0) p.dead = true;
    return true;
  }
  heal(hp: number): void {
    this.log({ kind: 'heal', hp });
    this.run.hp = Math.min(this.run.maxHp, this.run.hp + hp);
  }
  drain(hp: number, by: ItemTypeId): void {
    this.log({ kind: 'drain', hp, by });
    this.run.hp = Math.min(this.run.hp, Math.max(1, this.run.hp - hp));
  }
  healFx(x: number, y: number): void { this.log({ kind: 'healFx', x, y }); }

  spawnShot(spec: ShotSpec): CombatShot | null {
    this.log({ kind: 'spawnShot', spec });
    if (this.arsenal) return this.arsenal.spawn(spec.key, spec.x, spec.y, spec.angle, spec.speed, spec.life, spec.damage, spec.stats, spec.maxHits);
    const s: CombatShot = { active: true, x: spec.x, y: spec.y, vx: Math.cos(spec.angle) * spec.speed, vy: Math.sin(spec.angle) * spec.speed, life: spec.life, damage: spec.damage, stats: spec.stats, splash: null, tracker: { hits: new Set() } };
    this.playerShots.push(s);
    return s;
  }
  spawnPool(spec: PoolSpec): void {
    this.log({ kind: 'spawnPool', spec });
    if (this.arsenal) spawnFirePool(this.arsenal, spec.x, spec.y, spec.r, spec.time, spec.stats, spec.tune);
  }
  /** Damages every enemy in the radius with `fromPopper` (so poppers never re-trigger), as the scene does. */
  pullCoins(): void { this.log({ kind: 'pullCoins' }); }
  boostWeapon(weaponUid: string, boost: { pull: number; range: number }, seconds: number): void { this.log({ kind: 'boostWeapon', weapon: weaponUid, ...boost, seconds }); }
  popperBlast(pos: { x: number; y: number }, pop: { damage: number; radius: number }, setPop = false): void {
    this.log({ kind: 'popperBlast', x: pos.x, y: pos.y, damage: pop.damage, radius: pop.radius, setPop });
    for (const e of this.inRadius(pos, pop.radius)) this.damage(e, pop.damage, null, { fromPopper: true, label: 'Party Popper' });
  }
  sweep(weaponUid: string, angle: number, bonus = false): void {
    this.log({ kind: 'sweep', weapon: weaponUid, angle, bonus });
    const a = this.arsenal, w = this.weaponOf(weaponUid);
    if (a && w) sweepOnce(a, w, angle, bonus);
  }
  explode(weaponUid: string, x: number, y: number): void {
    this.log({ kind: 'explode', weapon: weaponUid, x, y });
    const a = this.arsenal, w = this.weaponOf(weaponUid);
    if (a && w) explodeAt(a, x, y, w.stats);
  }
  beam(weaponUid: string, target: CombatEnemy, echo = false): void {
    this.log({ kind: 'beam', weapon: weaponUid, target: target.id, echo });
    const a = this.arsenal, w = this.weaponOf(weaponUid);
    if (a && w) beamOnce(a, w, target as PatternEnemy, echo);
  }
  enemyShots(): readonly CombatShot[] { return this.hostileShots.filter((s) => s.active); }
  killShot(shot: CombatShot): void { this.log({ kind: 'killShot', shot }); shot.active = false; }
  reflectShot(shot: CombatShot, mult: number): void { this.log({ kind: 'reflectShot', shot, mult }); shot.active = false; }

  dropCoin(pos: { x: number; y: number }, label: string): void { this.log({ kind: 'dropCoin', x: pos.x, y: pos.y, label }); }
  addCoins(n: number, label: string): void { this.log({ kind: 'addCoins', n, label }); this.run.money += n; }

  /** The real strings (current language), so a test sees the label the player would. */
  t(key: UIKey, vars?: Record<string, string | number>): string { return t(key, vars); }
  arcFx(points: readonly { x: number; y: number }[]): void { this.log({ kind: 'fx', method: 'arc', args: [points] }); }
  boltFx(x: number, y: number, small: boolean): void { this.log({ kind: 'boltFx', x, y, small }); }
  setLine(id: string, text: string | null, order = 0): void { this.log({ kind: 'line', id, text, order }); this.lines.set(id, text === null ? null : { text, order }); }
  sound(name: AudioKey, opts?: { rate?: number; volume?: number }): void { this.log({ kind: 'sound', name, opts }); }
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

  private weaponOf(uid: string): WeaponRt | undefined { return this.arsenal?.weapons.find((w) => w.stats.uid === uid); }
  private log(c: { kind: CallKind } & Record<string, unknown>): void { this.calls.push({ at: this.time, ...c } as Call); }
  private later(seconds: number, fn: () => void): void { this.queue.push({ due: this.time + seconds, seq: this.seq++, fn }); }

  /**
   * The combat-rng part of `ArenaScene.damageEnemy` (see the pipeline comment there): modifyDamage, the element affinity, the mark, crit roll, onCrit, hp, onHit, the
   * stats-driven statuses (burn, ignite, slow), afterHit (the Frost freeze, Cleaning, Electric chain), the element reactions, echo, and on a lethal hit onKill +
   * afterKill (Kitchen heal, Blast pop) + the popper blast, and the engine's mark multiplier. The armor step (with Shred) is the shared `hitArmor`. Not simulated: knockback itself.
   */
  private runHit(e: CombatEnemy, dmg: number, stats: WeaponStats | null, o: HitOpts): void {
    if (!e.alive) return;
    const H = this.hooks, now = this.time;
    const key = o.poison ? 'poison' : o.isDot ? 'burn' : stats?.uid ?? o.label ?? 'shove';
    const tags = hitTags(stats, o);
    const hit: HitEvent = { enemy: e, base: dmg, dmg, stats, opts: o, source: key, now, tags, direct: !o.isDot && !o.echo && !o.fromPopper && !o.chained && !o.reaction, crit: false, armored: false, killed: false, kbMult: 1 };
    const rx = !!o.reaction, open = this.reactor.begin(e, o); // rx: a reaction's own burst (never crits, never reacts again)
    if (!rx) { H.emit('modifyDamage', hit); dmg = hit.dmg; }
    const aff = affinityMult(e.def, tags);
    dmg *= aff; // element soft counters (engine/affinity), after the modifyDamage hooks like the scene
    if (!rx) dmg *= wetElectricMult(e.status, tags, now); // Wet: electric hits on a wet enemy, right after the affinity like the scene
    const unmarked = dmg;
    dmg = markedDamage(dmg, e.markedUntil, now, markMult(e.def)); // the shared mark rule (engine/marks), after the affinity like the scene
    const markBonus = dmg - unmarked;
    if (!o.isDot && !rx && stats && stats.critChance > 0 && this.rand() < stats.critChance) {
      dmg *= CRIT.mult;
      hit.crit = true; hit.dmg = dmg; H.emit('onCrit', hit); dmg = hit.dmg;
    }
    const soaked = hitArmor(e, dmg, o, now), shredBonus = shredGain(e, dmg, soaked, o);
    dmg = soaked; // armor and shred (systems/combat), direct hits only, like the scene
    hit.armored = dmg < hit.dmg * 0.5; hit.dmg = dmg;
    e.hp -= dmg;
    if (!o.isDot) e.lastHitT = now;
    recordDamage(this.dmgLog, { source: key, dmg, type: damageType(tags, e.def, { isDot: o.isDot, poison: o.poison, reaction: rx }), isDot: !!o.isDot, weak: aff > 1, resisted: aff < 1, shred: shredBonus, mark: markBonus });
    hit.killed = e.hp <= 0;
    if (!rx) {
      H.emit('onHit', hit);
      applyHitStatuses(hit, this);
      H.emit('afterHit', hit);
      this.reactor.end(open, { dmg, tags }); // element reactions: the statuses applied above and this hit's own tags
    }
    if (e.hp > 0 && !o.isDot && !rx && tryStagger(e, tags, (e.markedUntil ?? 0) > now, now)) { this.log({ kind: 'stagger', enemy: e.id }); e.state = 'stun'; e.stateT = Math.max(e.stateT ?? 0, AFFINITY.stagger.time); }
    scheduleEcho(hit, this);
    if (e.hp <= 0 && e.alive) { // (a reaction's burst on this very enemy may already have killed it)
      e.alive = false;
      e.state = 'dying';
      this.killingHit.set(e, hit);
      H.emit('onKill', { enemy: e, hit });
      H.emit('afterKill', { enemy: e, hit });
      applyKillEffects(hit, this);
    }
  }
}
