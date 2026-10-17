import type { BurnEffect, SlowEffect, WeaponStats } from '../types';
import { applyBurn, applySlow, applyPoison, applyShred, applyWeaken, pickRicochetTarget } from '../systems/combat';
import { applyWet, burnVsWet, slowVsWet } from '../engine/wet';
import { addCoins } from '../state/run';
import { store } from '../state/store';
import { play } from '../audio/sfx';
import { t, type UIKey } from '../i18n';
import type { CombatEnemy, CombatShot, PoolSpec, PlayerView, RuntimeCtx, ShotSpec } from '../engine/ctx';
import type { HitOpts } from '../engine/hooks';
import { SHRED, WET_STATUS, type AffinityTag } from '../engine/define';
import { burnFor, poisonTimeFor, slowFor } from '../engine/affinity';
import { applyMark } from '../engine/marks';
import { Reactor, markFrostStun } from '../engine/reactions';
import type { ArenaScene } from './ArenaScene';
import type { Enemy } from './enemies';
import { beamOnce, boltFx, explodeAt, spawnFirePool, sweepOnce } from '../engine/patterns';
import type { Shot } from './weapons';

type AudioName = Parameters<typeof play>[0];

/**
 * `RuntimeCtx` over the live arena: ArenaScene, its Arsenal and Fx. A thin adapter, no game logic: every member forwards to the
 * method that already does the work. The real `Enemy`/`Shot`/`Player` objects are handed out as the narrower `Combat*` views.
 */
export class PhaserCtx implements RuntimeCtx {
  /** The element reactions (engine/reactions.ts): `damageEnemy` opens and closes a hit on it, the status calls below report their applications to it. */
  readonly reactor = new Reactor(this, () => store.state.stats);

  constructor(private sc: ArenaScene) {}

  now(): number { return this.sc.time.now / 1000; }
  rng(): number { return this.sc.rng(); }

  get build() { return store.state.build; }
  get run() {
    const s = store.state, sc = this.sc;
    return { hp: s.hp, maxHp: s.build.maxHp, money: s.money, aisle: s.wave, boss: sc.wave.boss };
  }
  readonly aisle = {
    burn: (b: BurnEffect): BurnEffect => this.sc.aisleEvent.burn(b),
    electricRate: (): number => this.sc.aisleEvent.electricRate(),
    onIce: (x: number, y: number): boolean => this.sc.hazards.onIce(x, y),
  };
  combatActive(): boolean { return this.sc.combatActive(); }

  alive(): readonly CombatEnemy[] { return this.sc.enemies.filter((e) => e.alive && e.state !== 'spawn'); }
  nearest(pos: { x: number; y: number }, range: number, exclude?: ReadonlySet<number>): CombatEnemy | null { return this.sc.nearestEnemyFrom(pos.x, pos.y, range, exclude as Set<number> | undefined); }
  inRadius(pos: { x: number; y: number }, r: number): CombatEnemy[] {
    return this.sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 <= (r + e.def.radius) ** 2);
  }
  ricochetTarget(from: { x: number; y: number }, seen: ReadonlySet<number>, range: number): CombatEnemy | null {
    return pickRicochetTarget(from, this.sc.enemies.filter((x) => x.alive && x.state !== 'spawn'), seen as Set<number>, range);
  }
  damage(e: CombatEnemy, dmg: number, source: WeaponStats | null, opts: HitOpts = {}): void { this.sc.damageEnemy(e as Enemy, dmg, source, opts); }
  damageArea(pos: { x: number; y: number }, r: number, dmg: number, source: WeaponStats | null, opts: HitOpts = {}): number {
    const hit = this.inRadius(pos, r);
    for (const e of hit) this.sc.damageEnemy(e as Enemy, dmg, source, opts);
    return hit.length;
  }
  stun(e: CombatEnemy, seconds: number, tag?: AffinityTag): number {
    const applied = this.sc.stunEnemy(e as Enemy, seconds, tag);
    if (applied > 0 && tag === 'frost') { markFrostStun(e.status, applied, this.now()); this.reactor.applied(e, 'frost'); } // a frost stun is a freeze: the enemy is frosted
    return applied;
  }
  // Status durations scale with the enemy's element affinity (engine/affinity); the dps and the slow percentage never do.
  // Wet (systems/combat): a burn on a wet enemy is halved and dries it, a frost slow on a wet enemy gains points.
  // Reactions: every burn / frost / poison application is reported to the reactor (checked once, at the end of the hit it belongs to, or at once outside a hit).
  // `slow` is the stats-driven frost channel (Ice Pack, Jelly frost, Cold Storage, Brain Freeze), so it marks the enemy frosted; the soap puddle and the wet floor slow without it.
  ignite(e: CombatEnemy, burn: BurnEffect): void { const now = this.now(); applyBurn(e.status, burnVsWet(e.status, burnFor(e.def, this.sc.aisleEvent.burn(burn)), now), now); this.reactor.applied(e, 'burn'); }
  slow(e: CombatEnemy, slow: SlowEffect): void { const now = this.now(); applySlow(e.status, slowVsWet(e.status, slowFor(e.def, slow), now), now, true); this.reactor.applied(e, 'frost'); }
  poison(e: CombatEnemy, dps: number, duration: number): void { applyPoison(e.status, dps, poisonTimeFor(e.def, duration), this.now()); this.reactor.applied(e, 'poison'); }
  mark(e: CombatEnemy, seconds: number): void { applyMark(e, this.now(), seconds); }
  shred(e: CombatEnemy, stacks: number, seconds: number = SHRED.duration): void { applyShred(e.status, stacks, seconds, this.now()); }
  weaken(e: CombatEnemy, pct: number, seconds: number): void { applyWeaken(e.status, pct, seconds, this.now()); }
  wet(e: CombatEnemy, seconds: number = WET_STATUS.duration): void { applyWet(e.status, seconds, this.now()); }

  get player(): PlayerView { return this.sc.player; }
  playerNear(x: number, y: number): { x: number; y: number; d: number } { return this.sc.playerNear(x, y); }
  hurt(dmg: number): void { this.sc.hurtPlayer(dmg); }
  heal(hp: number): void {
    const s = store.state;
    s.hp = Math.min(s.build.maxHp, s.hp + hp);
    store.changed();
  }
  healFx(x: number, y: number): void { this.sc.healHeartFx(x, y); }

  spawnShot(spec: ShotSpec): CombatShot | null { return this.sc.arsenal.spawn(spec.key, spec.x, spec.y, spec.angle, spec.speed, spec.life, spec.damage, spec.stats, spec.maxHits); }
  spawnPool(spec: PoolSpec): void { spawnFirePool(this.sc.arsenal, spec.x, spec.y, spec.r, spec.time, spec.stats, spec.tune); }
  popperBlast(pos: { x: number; y: number }, pop: { damage: number; radius: number }, setPop = false): void { this.sc.popperBlast(pos.x, pos.y, pop, setPop); }
  sweep(weaponUid: string, angle: number, bonus = false): void { const w = this.sc.arsenal.weaponOf(weaponUid); if (w) sweepOnce(this.sc.arsenal, w, angle, bonus); }
  explode(weaponUid: string, x: number, y: number): void { const w = this.sc.arsenal.weaponOf(weaponUid); if (w) explodeAt(this.sc.arsenal, x, y, w.stats); }
  beam(weaponUid: string, target: CombatEnemy, echo = false): void { const w = this.sc.arsenal.weaponOf(weaponUid); if (w) beamOnce(this.sc.arsenal, w, target as Enemy, echo); }
  enemyShots(): readonly CombatShot[] { return this.sc.arsenal.enemyShots; }
  killShot(shot: CombatShot): void { this.sc.arsenal.kill(shot as Shot); }
  reflectShot(shot: CombatShot, mult: number): void { this.sc.arsenal.reflect(shot as Shot, mult); }

  dropCoin(pos: { x: number; y: number }, label: string): void { this.sc.dropCoin(pos.x, pos.y, label); }
  addCoins(n: number, label: string): void { addCoins(store.state, n, label); }

  get fx() { return this.sc.fx; }
  arcFx(points: readonly { x: number; y: number }[]): void { this.sc.arcFx(points); }
  boltFx(x: number, y: number, small: boolean): void { boltFx(this.sc.arsenal, x, y, small); }
  setLine(id: string, text: string | null, order = 0): void { this.sc.overlay.setLine(id, text, order); }
  t(key: UIKey, vars?: Record<string, string | number>): string { return t(key, vars); }
  sound(name: AudioName, opts?: { rate?: number; volume?: number }): void { play(name, opts); }
  tween(target: object, props: Record<string, number>, ms: number): void { this.sc.tweens.add({ targets: target, ...props, duration: ms }); }
  delay(seconds: number, fn: () => void): void { this.sc.time.delayedCall(seconds * 1000, fn); }
}
