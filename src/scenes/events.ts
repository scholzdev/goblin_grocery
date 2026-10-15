import Phaser from 'phaser';import { t } from '../i18n';
import { EVENTS, SET_EVENT, SET_EVENTS, type SetEventKind } from '../data/events';
import { ROOMS } from '../data/modifiers';
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
// Set events (happy hour, heatwave, power surge, flash sale, freezer fail): timed modifiers; the scene reads them through the getters below. A matching set (lv 1+) boosts the helpful part by SET_EVENT.bonus.

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
  // set events
  private live: SetEventKind | null = null;
  private over = false;
  private tint?: Phaser.GameObjects.Rectangle;
  private patches: { x: number; y: number; img: Phaser.GameObjects.Image }[] = [];
  private zaps: { x: number; y: number; age: number }[] = [];
  private zapT = 0;
  private zapG?: Phaser.GameObjects.Graphics;

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
    else if (r.kind === 'outage') this.updateOutage(dt);
    else this.updateSet(dt);
  }

  // ───────────────────────────── set event effects (read by the scene) ─────────────────────────────

  private boost(): number {
    const k = this.live;
    return k && store.state.build.sets[SET_EVENTS[k]] >= 1 ? SET_EVENT.bonus : 1;
  }
  /** Scale only the bonus part of a multiplier: 1.5 with boost 1.5 -> 1.75. */
  private stretch(m: number): number { return 1 + (m - 1) * this.boost(); }

  /** Extra player HP/s (Happy Hour). */
  regenBonus(): number { return this.live === 'happyHour' ? EVENTS.happyHour.regen * this.boost() : 0; }
  /** Enemy speed multiplier (Happy Hour faster, Freezer Fail slower). */
  enemySpeed(): number {
    if (this.live === 'happyHour') return EVENTS.happyHour.enemySpeed;
    if (this.live === 'freezerFail') return 1 - EVENTS.freezerFail.enemySlow * this.boost();
    return 1;
  }
  /** Burn effect with the Heatwave duration bonus applied. */
  burn<B extends { duration: number }>(b: B): B {
    return this.live === 'heatwave' ? { ...b, duration: b.duration * this.stretch(EVENTS.heatwave.burnMult) } : b;
  }
  /** Fire-rate multiplier for electrical weapons (Power Surge). */
  electricRate(): number { return this.live === 'powerSurge' ? this.stretch(EVENTS.powerSurge.fireRate) : 1; }
  /** Kill coin multiplier (Flash Sale). */
  coinMult(): number { return this.live === 'flashSale' ? EVENTS.flashSale.coinMult * this.boost() : 1; }
  /** Player velocity ease rate on slippery floor (cold room, freezer patches); 0 = normal grip. */
  slipAccel(x: number, y: number): number {
    let a = 0;
    if (store.state.modifier === 'coldRoom') a = ROOMS.coldRoom.playerAccel;
    if (this.live === 'freezerFail') {
      const R = EVENTS.freezerFail.patchR * 0.75;
      if (this.patches.some((p) => ((x - p.x) / R) ** 2 + ((y - p.y) / (R * 0.63)) ** 2 < 1)) a = a ? Math.min(a, EVENTS.freezerFail.playerAccel) : EVENTS.freezerFail.playerAccel;
    }
    return a;
  }

  private updateSet(dt: number): void {
    const sc = this.scene, r = this.roll!, kind = r.kind as SetEventKind;
    const tt = this.t - r.startAt;
    if (tt < 0 || this.over) return;
    if (!this.live) {
      this.live = kind;
      const boosted = this.boost() > 1;
      showBanner(t(`evName_${kind}`), t(`evSub_${kind}`) + (boosted ? ` ${t('evSetBonus')}` : ''));
      play(kind === 'powerSurge' ? 'zap' : kind === 'flashSale' ? 'ding' : 'whistle', { rate: kind === 'flashSale' ? 1.2 : 1 });
      if (kind === 'heatwave') this.tint = sc.add.rectangle(ARENA.w / 2, ARENA.h / 2, ARENA.w + 1400, ARENA.h + 1400, EVENTS.heatwave.tint, 0).setDepth(DEPTH.fx + 50);
      if (kind === 'freezerFail') this.buildPatches();
      if (kind === 'powerSurge') this.zapG = sc.add.graphics().setDepth(DEPTH.telegraph + 1);
    }
    if (tt >= r.duration) {
      this.over = true;
      showBanner(t('evOver', { name: t(`evName_${kind}`) }), '');
      play('ding', { rate: 1.3 });
      this.clearSet();
      return;
    }
    if (this.tint) this.tint.setAlpha(Math.min(1, tt / 1.5) * (settings.reducedMotion ? 0.08 : 0.07 + 0.04 * Math.sin(this.t * 3)));
    if (kind === 'heatwave' && !settings.reducedMotion && Math.random() < dt * 6) sc.fx.puff(Phaser.Math.Between(ARENA.left, ARENA.right), Phaser.Math.Between(ARENA.top + 40, ARENA.bottom), 1);
    if (kind === 'powerSurge') this.updateZaps(dt);
    if (kind === 'freezerFail') for (const p of this.patches) p.img.setAlpha(Math.min(0.85, tt * 0.6) * Math.min(1, (r.duration - tt) / 1.5));
  }

  private clearSet(): void {
    this.live = null;
    this.tint?.destroy(); this.tint = undefined;
    for (const p of this.patches) p.img.destroy();
    this.patches = [];
    this.zaps = [];
    this.zapG?.destroy(); this.zapG = undefined;
  }

  private buildPatches(): void {
    const sc = this.scene, F = EVENTS.freezerFail;
    for (let i = 0; i < F.patches; i++) {
      let x = 0, y = 0;
      for (let k = 0; k < 6; k++) {
        x = lerp(ARENA.left + 110, ARENA.right - 110, Math.random());
        y = lerp(ARENA.top + 90, ARENA.bottom - 70, Math.random());
        if (Math.hypot(x - sc.player.x, y - sc.player.y) > 170) break;
      }
      const img = sc.add.image(x, y, 'fx_puddle').setDepth(DEPTH.decal - 0.1).setTint(0xcfefff).setDisplaySize(F.patchR * 2.3, F.patchR * 1.45).setAlpha(0);
      this.patches.push({ x, y, img });
    }
  }

  /** Power Surge: random spots telegraph, then zap whatever stands there. */
  private updateZaps(dt: number): void {
    const sc = this.scene, P = EVENTS.powerSurge;
    if ((this.zapT -= dt) <= 0) {
      this.zapT = P.sparkEvery;
      const near = Math.random() < 0.5; // half the zaps land around the cart, half anywhere
      const x = Phaser.Math.Clamp(near ? sc.player.x + Phaser.Math.Between(-160, 160) : lerp(ARENA.left + 60, ARENA.right - 60, Math.random()), ARENA.left + 40, ARENA.right - 40);
      const y = Phaser.Math.Clamp(near ? sc.player.y + Phaser.Math.Between(-110, 110) : lerp(ARENA.top + 60, ARENA.bottom - 40, Math.random()), ARENA.top + 40, ARENA.bottom - 20);
      this.zaps.push({ x, y, age: 0 });
    }
    const g = this.zapG;
    g?.clear();
    this.zaps = this.zaps.filter((z) => {
      z.age += dt;
      const k = Math.min(1, z.age / P.tell);
      if (z.age < P.tell) {
        g?.lineStyle(3, 0xffe066, 0.5 + 0.4 * k).strokeEllipse(z.x, z.y, P.sparkR * 2, P.sparkR * 1.3);
        g?.fillStyle(0xffe066, 0.12 + 0.25 * k).fillEllipse(z.x, z.y, P.sparkR * 2 * k, P.sparkR * 1.3 * k);
        return true;
      }
      sc.fx.spark(z.x, z.y - 10, 10, 0xffe066);
      sc.fx.ring('fx_pulse', z.x, z.y, P.sparkR * 2.2, 240, 0xffe066);
      play('zap', { rate: 1.1 });
      if (sc.playerNear(z.x, z.y).d < P.sparkR) sc.hurtPlayer(P.damage);
      return false;
    });
  }

  /** Checkout / death: lights back on, robot stops. */
  stop(): void {
    this.roll = null;
    this.destroyDark();
    this.clearSet();
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
