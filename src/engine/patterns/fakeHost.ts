import type { WeaponStats, Build } from '../../types';
import { newHitTracker } from '../../systems/combat';
import type { AudioKey } from '../../data/assets';
import type { FakeCtx } from '../fakeCtx';
import type { HookTable, WeaponLook } from '../hooks';
import { contentItem } from '../registry';
import { collectLooks, weaponRt } from './common';
import { stepArsenal } from './index';
import type { PatternEnemy, PatternHost, PatternScene, Pot, Puddle, Shot, Sprite, WeaponRt } from './types';

// The pattern code's host for tests: the weapons of a computed build, run against a `FakeCtx` (its enemies, clock, rng, hooks, damage
// pipeline and call log). No Phaser: sprites are stubs that record what the pattern asked of them.
//
//   const a = new FakeArsenal(fake, build);       // `fake` has the cart's hooks attached (tests/content/helpers.ts: `arsenal(specs)`)
//   a.applyLooks(); a.step(0.1);                    // frames; weapons fire when their cooldown runs out and an enemy is in range
//   a.spawned / a.sprites / a.sounds / fake.callsOf('damage') ...   what happened
//
// Not simulated: the arena's enemy projectiles, the pickup of coins, anything Phaser draws. Sprites never move on their own.

/** A sprite stand-in: every setter returns itself and is recorded in `log` ("setRotation(1.5)"). */
export class StubSprite implements Sprite {
  rotation = 0;
  texture: { key: string };
  readonly log: string[] = [];
  destroyed = false;
  visible = true;
  x = 0; y = 0;
  constructor(key = '') { this.texture = { key }; }
  private rec(name: string, ...args: unknown[]): this { this.log.push(`${name}(${args.join(',')})`); return this; }
  setVisible(v: boolean): this { this.visible = v; return this.rec('setVisible', v); }
  setTexture(key: string): this { this.texture = { key }; return this.rec('setTexture', key); }
  setAlpha(a: number): this { return this.rec('setAlpha', a); }
  setScale(x: number, y?: number): this { return this.rec('setScale', x, y); }
  setRotation(r: number): this { this.rotation = r; return this.rec('setRotation', r); }
  setPosition(x: number, y?: number): this { this.x = x; this.y = y ?? x; return this.rec('setPosition', x, y); }
  setDepth(d: number): this { return this.rec('setDepth', d); }
  setDisplaySize(w: number, h: number): this { return this.rec('setDisplaySize', w, h); }
  setOrigin(x: number, y?: number): this { return this.rec('setOrigin', x, y); }
  setTint(t: number): this { return this.rec('setTint', t); }
  destroy(): void { this.destroyed = true; this.log.push('destroy()'); }
  /** The texture key it was created with / last set to. */
  get key(): string { return this.texture.key; }
}

export interface SpawnedShot { /** Fake clock (s) when it was spawned. */ at: number; key: string; x: number; y: number; angle: number; speed: number; life: number; damage: number; stats: WeaponStats | null; maxHits: number; shot: Shot }

export class FakeArsenal implements PatternHost {
  weapons: WeaponRt[];
  shots: Shot[] = [];
  puddles: Puddle[] = [];
  pots: Pot[] = [];
  time = 0;
  readonly looks = new Map<string, WeaponLook>();
  readonly repeatDelay: number;
  build: Build;
  readonly sc: PatternScene;
  /** Every sprite a pattern created through `add.image`, in order. */
  readonly sprites: StubSprite[] = [];
  /** Every `tweens.add` config. */
  readonly tweens: Record<string, unknown>[] = [];
  /** `spawn` calls in order. */
  readonly spawned: SpawnedShot[] = [];
  /** Weapon uids that recoiled, in order. */
  readonly recoils: string[] = [];
  /** Department rate for electrical weapons (default 1). */
  electricalRate = 1;

  constructor(readonly fake: FakeCtx, build: Build = fake.build, opts: { repeatDelay?: number } = {}) {
    this.build = build;
    this.repeatDelay = opts.repeatDelay ?? 0.18;
    this.weapons = build.weapons.map((s, i) => weaponRt(s, i, s.pattern === 'aura' ? new StubSprite('fx_blades') : null, contentItem(s.type)!));
    const self = this, f = fake;
    this.sc = {
      add: { image: (x, y, key) => { const s = new StubSprite(key); s.x = x; s.y = y; self.sprites.push(s); return s; } },
      tweens: { add: (cfg: Record<string, unknown>) => { self.tweens.push(cfg); return null; } },
      time: {
        get now() { return f.time * 1000; },
        delayedCall: (ms: number, cb: () => void) => { f.delay(ms / 1000, cb); return null as never; },
      },
      get enemies() { return f.enemies as PatternEnemy[]; },
      player: f.player,
      get hooks() { return f.hooks; },
      fx: f.fx,
      dept: { get electricalRate() { return self.electricalRate; } },
      aisleEvent: { electricRate: () => 1, burn: (b) => f.aisle.burn(b) },
      rng: () => f.rng(),
      combatActive: () => f.combatActive(),
      nearestEnemy: (range) => f.nearest(f.player, range) as PatternEnemy | null,
      nearestEnemyFrom: (x, y, range, exclude) => f.nearest({ x, y }, range, exclude) as PatternEnemy | null,
      damageEnemy: (e, dmg, stats, opts) => f.damage(e, dmg, stats, opts),
      recoil: (uid) => { self.recoils.push(uid); },
    };
  }

  get hooks(): HookTable { return this.fake.hooks; }

  /** Ask the compiled hooks for each weapon's look (after `fake.attach`). */
  applyLooks(): void { collectLooks(this.fake.hooks, this.weapons, this.looks); }

  /** One frame of the arsenal (the weapons fire, shots fly, puddles tick) and of the fake clock (delayed callbacks, `onTick`). */
  step(dt: number, firing = true): void {
    this.fake.tick(dt);
    stepArsenal(this, dt, firing);
  }

  /** `n` frames of `dt`. */
  run(frames: number, dt = 0.05, firing = true): void { for (let i = 0; i < frames; i++) this.step(dt, firing); }

  weaponOf(uid: string): WeaponRt | undefined { return this.weapons.find((w) => w.stats.uid === uid); }

  spawn(key: string, x: number, y: number, a: number, speed: number, life: number, damage: number, stats: WeaponStats | null, maxHits: number): Shot | null {
    const shot: Shot = {
      img: new StubSprite(key), shadow: new StubSprite('shadow'), active: true, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, damage, tracker: newHitTracker(maxHits),
      stats, homing: false, spin: 0, maxLife: life, ricochet: key === 'proj_cap', splash: null,
    };
    this.shots.push(shot);
    this.spawned.push({ at: this.fake.time, key, x, y, angle: a, speed, life, damage, stats, maxHits, shot });
    return shot;
  }

  kill(s: Shot): void { s.active = false; }

  sound(name: AudioKey, opts?: { rate?: number; volume?: number }): void { this.fake.sound(name, opts); }

  /** The sounds played, as `name` or `name@rate`. */
  get sounds(): string[] { return this.fake.callsOf('sound').map((c) => (c.opts?.rate !== undefined ? `${c.name}@${c.opts.rate}` : c.name)); }
}
