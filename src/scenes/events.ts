import Phaser from 'phaser';import { t } from '../i18n';
import { EVENTS } from '../data/events';
import type { EventRoll } from '../systems/events';
import { applySlow } from '../systems/combat';
import { settings } from '../state/settings';
import { store } from '../state/store';
import { flow } from '../flow';
import { showBanner } from '../ui/hud';
import { play } from '../audio/sfx';
import { DEPTH } from './fx';
import type { ArenaScene } from './ArenaScene';
import { ARENA } from './ArenaScene';

// Aisle events (see data/events.ts). One per aisle at most; the roll happens in ArenaScene.create.
// Wet floor: a mop robot drives 1-3 streaks and leaves slowing puddles. Outage: dark overlay lit only by the cart's headlight.

interface Streak { x0: number; y0: number; x1: number; y1: number; len: number; delay: number; dist: number; signs: number[]; img: Phaser.GameObjects.Image; done: boolean }
interface Spot { x: number; y: number; age: number; img: Phaser.GameObjects.Image; puddle: boolean }

const WET = EVENTS.wetFloor;
const OUT = EVENTS.outage;
const BRUSH = 'event_light_brush';
const lerp = Phaser.Math.Linear;

export class AisleEvents {
  private t = 0;
  private started = false;
  private streaks: Streak[] = [];
  private spots: Spot[] = [];
  private playerWet = false;
  private splashCd = 0;
  // outage
  private rt?: Phaser.GameObjects.RenderTexture;
  private brush?: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Graphics;
  private angle = 0;
  private backShown = false;

  constructor(private scene: ArenaScene, private roll: EventRoll | null) {}

  /** Player speed multiplier from puddles (the dash ignores it by not calling this). */
  playerSlow(): number {
    return this.playerWet ? 1 - WET.playerSlow : 1;
  }

  update(dt: number, active: boolean): void {
    const r = this.roll;
    if (!r) return;
    if (active) this.t += dt;
    if (r.kind === 'wetFloor') this.updateWet(dt);
    else this.updateOutage(dt);
  }

  /** Checkout / death: lights back on, robot stops. */
  stop(): void {
    this.roll = null;
    this.destroyDark();
    for (const s of this.streaks) s.img.destroy();
    this.streaks = [];
  }

  // ───────────────────────────── wet floor ─────────────────────────────

  private updateWet(dt: number): void {
    const sc = this.scene;
    if (!this.started && this.t >= this.roll!.startAt) {
      this.started = true;
      showBanner(t('cleanupBanner', { n: store.state.wave }), t('cleanupSub'));
      play('whistle');
      play('splash', { rate: 0.8 });
      const n = 1 + Math.floor(flow.rng() * WET.streaks);
      for (let i = 0; i < n; i++) this.streaks.push(this.newStreak(i));
    }
    for (const s of this.streaks) this.driveRobot(s, dt);
    for (const sp of this.spots) {
      sp.age += dt;
      const fade = Math.min(1, (WET.dryAfter - sp.age) / 2.5);
      sp.img.setAlpha(Math.min(1, sp.age * 4) * Math.max(0, fade) * (sp.puddle ? 0.9 : 1));
    }
    this.spots = this.spots.filter((sp) => sp.age < WET.dryAfter || (sp.img.destroy(), false));

    const p = sc.player;
    const R = WET.puddleR * 0.8;
    this.playerWet = this.spots.some((sp) => sp.puddle && sc.playerNear(sp.x, sp.y).d < R);
    const now = sc.time.now / 1000;
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      if (this.spots.some((sp) => sp.puddle && Math.hypot(e.x - sp.x, e.y - sp.y) < R)) applySlow(e.status, { pct: WET.enemySlow, duration: 0.3 }, now);
    }
    this.splashCd -= dt;
    if (this.playerWet && this.splashCd <= 0 && Math.hypot(p.vx, p.vy) > 10) {
      this.splashCd = 0.22;
      sc.fx.spark(p.x, p.y - 4, 3, 0x8fc0ff);
    }
  }

  private newStreak(i: number): Streak {
    const p = this.scene.player;
    const { left, right, top, bottom } = ARENA;
    let best = { x0: left, y0: 400, x1: right, y1: 400, d: -1 };
    for (let k = 0; k < 10; k++) {
      const ltr = flow.rng() < 0.5;
      const y0 = lerp(top + 40, bottom - 40, flow.rng());
      const y1 = flow.rng() < 0.5 ? y0 : lerp(top + 40, bottom - 40, flow.rng());
      const c = { x0: ltr ? left : right, y0, x1: ltr ? right : left, y1, d: 0 };
      const q = Phaser.Geom.Line.GetNearestPoint(new Phaser.Geom.Line(c.x0, c.y0, c.x1, c.y1), new Phaser.Geom.Point(p.x, p.y));
      c.d = Math.hypot(p.x - q.x, p.y - q.y);
      if (c.d > best.d) best = c;
      if (c.d > 150) break;
    }
    const len = Math.hypot(best.x1 - best.x0, best.y1 - best.y0);
    const signs = [0.25 + flow.rng() * 0.15, ...(flow.rng() < 0.5 ? [0.6 + flow.rng() * 0.2] : [])].map((f) => f * len);
    const img = this.scene.add.image(best.x0, best.y0, 'mopbot').setOrigin(0.5, 0.9).setScale(0.8).setVisible(false);
    return { ...best, len, delay: i * 1.6, dist: 0, signs, img, done: false };
  }

  private driveRobot(s: Streak, dt: number): void {
    if (s.done) return;
    if (s.delay > 0) { s.delay -= dt; if (s.delay > 0) return; s.img.setVisible(true); this.drop(s, 0); }
    const from = s.dist;
    s.dist = Math.min(s.len, s.dist + WET.robotSpeed * dt);
    const f = s.dist / s.len;
    const x = lerp(s.x0, s.x1, f), y = lerp(s.y0, s.y1, f);
    s.img.setPosition(x, y).setDepth(DEPTH.world + y).setFlipX(s.x1 < s.x0).setAngle(Math.sin(this.t * 30) * 2);
    for (let d = Math.ceil(from / WET.puddleSpacing) * WET.puddleSpacing; d <= s.dist; d += WET.puddleSpacing) this.drop(s, d);
    s.signs = s.signs.filter((d) => {
      if (d > s.dist) return true;
      const sx = lerp(s.x0, s.x1, d / s.len), sy = lerp(s.y0, s.y1, d / s.len) + 16;
      this.spots.push({ x: sx, y: sy, age: 0, puddle: false, img: this.scene.add.image(sx, sy, 'prop_wetfloor').setOrigin(0.5, 0.95).setScale(0.8).setDepth(DEPTH.world + sy).setAlpha(0) });
      return false;
    });
    if (s.dist >= s.len) {
      s.done = true;
      this.scene.tweens.add({ targets: s.img, alpha: 0, duration: 400, onComplete: () => s.img.destroy() });
    }
  }

  private drop(s: Streak, d: number): void {
    const x = lerp(s.x0, s.x1, d / s.len), y = lerp(s.y0, s.y1, d / s.len);
    const R = WET.puddleR;
    const img = this.scene.add.image(x, y, 'fx_puddle').setDepth(DEPTH.decal - 0.2).setTint(0x8fc0ff).setDisplaySize(R * 2.3, R * 1.45).setAlpha(0);
    this.spots.push({ x, y, age: 0, img, puddle: true });
  }

  // ───────────────────────────── power outage ─────────────────────────────

  private updateOutage(dt: number): void {
    const r = this.roll!;
    const tt = this.t - r.startAt;
    const F = OUT.flicker;
    if (tt < 0) return;
    if (!this.started) {
      this.started = true;
      this.buildDark();
      showBanner(t('outageBanner'), t('outageSub'));
      play('zap');
    }
    if (tt >= r.duration + 2 * F) { this.destroyDark(); return; }
    // 0..1 how far the lights are out; flicker phases strobe (or just fade with reduced motion).
    let u = 1;
    if (tt < F) u = tt / F;
    else if (tt >= F + r.duration) {
      u = 1 - (tt - F - r.duration) / F;
      if (!this.backShown) { this.backShown = true; showBanner(t('powerBack'), ''); play('ding', { rate: 1.3 }); }
    } else u = 1;
    const strobe = Math.sin(tt * 61) + Math.sin(tt * 37) > 0.1;
    const k = u >= 1 ? 1 : settings.reducedMotion ? u : Math.max(u * 0.6, strobe ? 0.9 : 0.12);
    this.drawDark(dt, k);
  }

  private buildDark(): void {
    const sc = this.scene;
    if (!sc.textures.exists(BRUSH)) {
      const c = OUT.coneRange, S = c * 2;
      const tex = sc.textures.createCanvas(BRUSH, S, S)!;
      const ctx = tex.getContext();
      const grad = (r: number, mid: number): CanvasGradient => {
        const g = ctx.createRadialGradient(c, c, 0, c, c, r);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(mid, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        return g;
      };
      ctx.fillStyle = grad(OUT.glowR, 0.5);
      ctx.beginPath(); ctx.arc(c, c, OUT.glowR, 0, Math.PI * 2); ctx.fill();
      // Stacked wedges of decreasing width give the cone a soft angular edge.
      const half = Phaser.Math.DegToRad(OUT.coneDeg / 2);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = grad(OUT.coneRange, 0.65);
      for (const f of [1.25, 1.1, 0.95, 0.8, 0.6]) {
        ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, OUT.coneRange, -half * f, half * f); ctx.closePath(); ctx.fill();
      }
      tex.refresh();
    }
    const pad = 16;
    this.rt = sc.add.renderTexture(0, 0, sc.scale.width + pad * 2, sc.scale.height + pad * 2).setOrigin(0).setDepth(DEPTH.fx + 500);
    this.brush = sc.make.image({ key: BRUSH, add: false });
    this.glow = sc.add.graphics().setDepth(DEPTH.fx + 600);
    this.angle = sc.player.facing > 0 ? 0 : Math.PI;
  }

  private destroyDark(): void {
    this.rt?.destroy(); this.brush?.destroy(); this.glow?.destroy();
    this.rt = this.brush = this.glow = undefined;
  }

  private drawDark(dt: number, k: number): void {
    const sc = this.scene, p = sc.player, rt = this.rt, brush = this.brush, glow = this.glow;
    if (!rt || !brush || !glow) return;
    const cam = sc.cameras.main, pad = 16;
    const w = sc.scale.width + pad * 2, h = sc.scale.height + pad * 2;
    if (rt.width !== w || rt.height !== h) rt.resize(w, h);
    const ox = cam.worldView.x - pad, oy = cam.worldView.y - pad;
    rt.setPosition(ox, oy).setAlpha(k);
    const moving = Math.hypot(p.vx, p.vy) > 10;
    const target = moving ? Math.atan2(p.vy, p.vx) : p.shoveT > 0 ? Math.atan2(p.shoveDY, p.shoveDX) : p.facing > 0 ? 0 : Math.PI;
    this.angle = Phaser.Math.Angle.RotateTo(this.angle, target, 9 * dt);
    const lx = p.x + p.facing * 22, ly = p.y - 28;
    rt.clear().fill(0x07040d, OUT.darkness);
    brush.setRotation(this.angle);
    rt.erase(brush, lx - ox, ly - oy);

    // Eyes and enemy shots keep glowing above the overlay.
    glow.clear();
    const half = Phaser.Math.DegToRad(OUT.coneDeg / 2);
    const lit = (x: number, y: number): boolean => {
      const d = Math.hypot(x - lx, y - ly);
      return d < OUT.glowR * 0.7 || (d < OUT.coneRange * 0.75 && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - ly, x - lx) - this.angle)) < half * 0.8);
    };
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const ey = e.y - e.sprite.displayHeight * 0.62;
      if (lit(e.x, ey)) continue;
      glow.fillStyle(0xffe066, k).fillCircle(e.x - 6, ey, 3).fillCircle(e.x + 6, ey, 3);
    }
    for (const s of sc.arsenal.enemyShots) {
      if (!s.active) continue;
      glow.fillStyle(0xff8a70, 0.3 * k).fillCircle(s.x, s.y - 20, 16).fillStyle(0xffd0c0, 0.5 * k).fillCircle(s.x, s.y - 20, 6);
    }
  }
}
