import type { WeaponStats } from '../types';
import { newHitTracker } from '../systems/combat';
import { DEPTH } from '../data/depth';
import { contentItem, contentTune } from '../engine/registry';
import type { WeaponLook } from '../engine/hooks';
import { collectLooks, removePuddle, stepArsenal, weaponRt } from '../engine/patterns';
import type { PatternHost, PatternScene, Pot, Puddle, Shot, WeaponRt } from '../engine/patterns';
import { store } from '../state/store';
import { play } from '../audio/sfx';
import type { ArenaScene } from './ArenaScene';

// The arena's side of the weapons: the pooled projectile sprites, the blade ring, the enemy projectiles. What a weapon DOES each frame is
// the pattern code in src/engine/patterns (the weapon's content file picks the pattern); this class is its `PatternHost`.

export type { Shot, WeaponRt };
type AudioName = Parameters<typeof play>[0];

const SHOT_POOL = 200;
const ENEMY_POOL = 90;

export class Arsenal implements PatternHost {
  weapons: WeaponRt[] = [];
  shots: Shot[] = [];
  enemyShots: Shot[] = [];
  puddles: Puddle[] = [];
  pots: Pot[] = [];
  time = 0;
  readonly looks = new Map<string, WeaponLook>();
  /** Multipack: gap between the repeats of a sweep/cone/mortar (s). Flat across tiers, so the ★1 tune is the value. */
  readonly repeatDelay = contentTune('multipack', 1).repeatDelay;

  constructor(private scene: ArenaScene) {
    for (let i = 0; i < SHOT_POOL; i++) this.shots.push(this.makeShot('proj_toast'));
    for (let i = 0; i < ENEMY_POOL; i++) this.enemyShots.push(this.makeShot('proj_bubble'));
  }

  get sc(): PatternScene { return this.scene; }
  get build() { return store.state.build; }
  sound(name: AudioName, opts?: { rate?: number; volume?: number }): void { play(name, opts); }

  private makeShot(key: string): Shot {
    const img = this.scene.add.image(0, 0, key).setVisible(false);
    const shadow = this.scene.add.image(0, 0, 'shadow').setVisible(false).setDisplaySize(22, 7).setAlpha(0.6).setDepth(DEPTH.decal);
    return { img, shadow, active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, tracker: newHitTracker(1), stats: null, homing: false, spin: 0, maxLife: 1, ricochet: false, splash: null, killBounce: false };
  }

  /** The runtime of the weapon with this uid (what `ctx.sweep` / `explode` / `beam` act on). */
  weaponOf(uid: string): WeaponRt | undefined {
    return this.weapons.find((w) => w.stats.uid === uid);
  }

  setBuild(weapons: WeaponStats[]): void {
    this.weapons = weapons.map((stats, i) => weaponRt(
      stats, i,
      // Blender: persistent spinning blade ring sized to its radius.
      stats.pattern === 'aura'
        ? this.scene.add.image(0, 0, 'fx_blades').setDisplaySize(stats.range * 2.1, stats.range * 2.1 * 0.62).setAlpha(0.85).setDepth(DEPTH.decal + 1)
        : null,
      contentItem(stats.type)!,
    ));
  }

  /**
   * Ask the compiled hooks how each weapon looks (`pattern:look`). Called by the scene right after it compiles its hooks. Cosmetic only:
   * Toast Mode's flames, Nailstorm's sparks, Brain Freeze's pale blades, Grease Fire's burning slicks.
   */
  applyLooks(): void { collectLooks(this.scene.hooks, this.weapons, this.looks); }

  get activeShots(): number {
    return this.shots.reduce((n, s) => n + (s.active ? 1 : 0), 0);
  }

  update(dt: number, firing: boolean): void {
    stepArsenal(this, dt, firing, () => this.updateEnemyShots(dt));
  }

  spawn(key: string, x: number, y: number, a: number, speed: number, life: number, damage: number, stats: WeaponStats | null, maxHits: number): Shot | null {
    const pool = stats ? this.shots : this.enemyShots;
    const s = pool.find((p) => !p.active);
    if (!s) return null;
    s.active = true;
    s.x = x; s.y = y; s.vx = Math.cos(a) * speed; s.vy = Math.sin(a) * speed;
    s.life = life; s.maxLife = life; s.damage = damage; s.stats = stats;
    s.tracker = newHitTracker(maxHits);
    s.homing = false;
    s.splash = null;
    s.killBounce = false;
    s.ricochet = key === 'proj_cap';
    s.spin = key === 'proj_toast' ? 9 : key === 'proj_receipt' ? 6 : key === 'proj_cap' ? 14 : 0;
    s.img.setTexture(key).setVisible(true).setAlpha(1).setScale(1).setRotation(key === 'proj_nail' || key.startsWith('proj_raybolt') ? a : 0).setPosition(x, y - 26);
    s.shadow.setVisible(true).setPosition(x, y);
    return s;
  }

  private updateEnemyShots(dt: number): void {
    const sc = this.scene;
    const p = sc.player;
    for (const s of this.enemyShots) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { sc.fx.puff(s.x, s.y - 20, 2); this.kill(s); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < 30 || s.x > 1250 || s.y < 140 || s.y > 790) { this.kill(s); continue; }
      // Expiration tell: wobble + shrink during the final second.
      const fade = s.life < 1 ? 0.6 + 0.4 * s.life : 1;
      const wob = s.life < 1 ? 1 + Math.sin(s.life * 30) * 0.08 : 1;
      s.img.setPosition(s.x, s.y - 22).setDepth(DEPTH.world + s.y).setScale(fade * wob).setAlpha(0.6 + 0.4 * fade);
      if (s.spin) s.img.rotation += s.spin * dt;
      s.shadow.setPosition(s.x, s.y);
      // Shots arriving from above (screen-up) also hit the goblin's drawn torso/head, not just its feet.
      const sy = s.y < p.y ? Math.min(p.y, s.y + 34) : s.y;
      const hit = sc.playerNear(s.x, sy).d < p.radius;
      if (hit && sc.hooks.onEnemyShotTouch.length) { const ev = { shot: s, damage: s.damage, handled: false }; sc.hooks.emit('onEnemyShotTouch', ev); if (ev.handled) continue; }
      if (hit && sc.hurtPlayer(s.damage)) {
        sc.fx.puff(s.x, s.y - 20, 3);
        this.kill(s);
      }
    }
  }

  reflect(s: Shot, mult: number): void {
    const sc = this.scene;
    const base = this.weapons[0]?.stats;
    if (!base) return;
    // Plain stats: no burn/slow/recipes; damage is booked under the hat's own label.
    const stats: WeaponStats = { ...base, uid: 'Tin Foil Hat', recipes: [], burn: null, ignite: null, slow: null, popper: null, echo: 0, critChance: 0, chainChance: 0, pierce: 0, buffs: [] };
    const r = this.spawn(s.img.texture.key, s.x, s.y, Math.atan2(-s.vy, -s.vx), Math.hypot(s.vx, s.vy), 1.6, s.damage * mult, stats, 1);
    if (r) r.spin = 0;
    sc.fx.spark(s.x, s.y - 22, 6, 0xdfe6f0);
    sc.fx.ring('fx_pulse', s.x, s.y - 20, 60, 220, 0xdfe6f0);
    play('cap_ping', { rate: 1.6 });
    this.kill(s);
  }

  spawnEnemyShot(key: string, x: number, y: number, a: number, speed: number, life: number, damage: number): void {
    this.spawn(key, x, y, a, speed, life, damage, null, 1);
  }

  kill(s: Shot): void {
    s.active = false;
    s.img.setVisible(false);
    s.shadow.setVisible(false);
  }

  clearAll(withPuffs: boolean): void {
    for (const s of [...this.shots, ...this.enemyShots]) {
      if (!s.active) continue;
      if (withPuffs && !s.stats) this.scene.fx.puff(s.x, s.y - 20, 1);
      this.kill(s);
    }
    for (const w of this.weapons) w.burstLeft = 0;
    for (const pd of [...this.puddles]) removePuddle(this, pd);
    for (const pot of this.pots) { pot.img.destroy(); pot.shadow.destroy(); }
    this.pots = [];
  }
}
