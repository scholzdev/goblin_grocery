import Phaser from 'phaser';
import type { HazardKind } from '../types';
import type { HazardLayout } from '../systems/shop';
import { DEPT_TUNING } from '../data/departments';
import { play } from '../audio/sfx';
import { DEPTH } from './fx';
import type { ArenaScene } from './ArenaScene';
import { ARENA } from './ArenaScene';
import { BELTS, CABLE_ROWS, ICE_RADII, ICE_SPOTS, VENT_SPOTS } from '../data/arena';

// Department floor hazards. Each timed hazard runs idle → tell (telegraphed) → active, and hurts
// groceries as well as the goblin, all through the scene's normal damage paths.

type Phase = 'idle' | 'tell' | 'active';
interface Timed { x: number; y: number; img: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite; phase: Phase; t: number; hitPlayer: boolean; hit: Set<number>; w: number }
interface Belt { y: number; dir: 1 | -1; x0: number; x1: number; img: Phaser.GameObjects.TileSprite }
interface Patch { x: number; y: number; rx: number; ry: number }

export class Hazards {
  private patches: Patch[] = [];
  private timed: Timed[] = [];
  private belts: Belt[] = [];
  private timer = 2.5;
  private next = 0;
  private g: Phaser.GameObjects.Graphics;

  readonly kind: HazardKind;
  private speed: number;

  constructor(private scene: ArenaScene, { kind, spots, beltSpeed }: HazardLayout) {
    this.kind = kind;
    this.speed = beltSpeed;
    this.g = scene.add.graphics().setDepth(DEPTH.telegraph);
    const T = DEPT_TUNING;
    if (kind === 'ice') {
      for (const p of ICE_SPOTS.slice(0, spots)) {
        scene.add.image(p.x, p.y, 'hz_ice').setDepth(DEPTH.decal - 0.5);
        this.patches.push({ x: p.x, y: p.y, ...ICE_RADII });
      }
    } else if (kind === 'vents') {
      for (const p of VENT_SPOTS.slice(0, spots)) {
        this.timed.push({ ...p, img: scene.add.image(p.x, p.y, 'hz_vent').setDepth(DEPTH.decal - 0.5), phase: 'idle', t: 0, hitPlayer: false, hit: new Set(), w: T.vents.radius });
      }
    } else if (kind === 'cables') {
      for (const c of CABLE_ROWS.slice(0, spots)) {
        const img = scene.add.tileSprite((c.x0 + c.x1) / 2, c.y, c.x1 - c.x0, 36, 'hz_cable').setDepth(DEPTH.decal - 0.5);
        this.timed.push({ x: (c.x0 + c.x1) / 2, y: c.y, img, phase: 'idle', t: 0, hitPlayer: false, hit: new Set(), w: c.x1 - c.x0 });
      }
    } else if (kind === 'conveyor') {
      for (const b of BELTS) {
        const x0 = 150, x1 = ARENA.w - 150;
        const img = scene.add.tileSprite((x0 + x1) / 2, b.y, x1 - x0, T.conveyor.height, 'hz_conveyor').setDepth(DEPTH.decal - 0.5);
        if (b.dir < 0) img.setFlipX(true);
        this.belts.push({ ...b, x0, x1, img });
      }
    }
  }

  onIce(x: number, y: number): boolean {
    return this.patches.some((p) => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1);
  }

  /** Conveyor push for anything standing on a belt (world units per second, signed). */
  beltPush(x: number, y: number): number {
    for (const b of this.belts) if (x > b.x0 && x < b.x1 && Math.abs(y - b.y) < DEPT_TUNING.conveyor.height / 2) return b.dir * this.speed;
    return 0;
  }

  update(dt: number, active: boolean): void {
    for (const b of this.belts) b.img.tilePositionX -= b.dir * this.speed * dt * (b.dir < 0 ? -1 : 1);
    this.g.clear();
    if (!this.timed.length) return;
    const cfg = this.kind === 'vents' ? DEPT_TUNING.vents : DEPT_TUNING.cables;
    if (active) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = cfg.interval * (0.85 + this.scene.rng() * 0.3);
        const h = this.timed[this.next++ % this.timed.length];
        if (h.phase === 'idle') { h.phase = 'tell'; h.t = cfg.tell; }
      }
    }
    for (const h of this.timed) {
      if (h.phase === 'idle') continue;
      h.t -= dt;
      if (h.phase === 'tell') {
        this.drawTell(h, 1 - h.t / cfg.tell);
        if (h.t <= 0) this.activate(h, cfg.active);
      } else {
        this.applyActive(h);
        if (h.t <= 0) this.deactivate(h);
      }
    }
  }

  private drawTell(h: Timed, k: number): void {
    const g = this.g;
    if (this.kind === 'vents') {
      const r = DEPT_TUNING.vents.radius;
      g.fillStyle(0xf45f52, 0.12 + 0.2 * k).fillEllipse(h.x, h.y, r * 2, r * 1.24);
      g.lineStyle(3, 0xf45f52, 0.8).strokeEllipse(h.x, h.y, r * 2, r * 1.24);
      g.fillStyle(0xf45f52, 0.3).fillEllipse(h.x, h.y, r * 2 * k, r * 1.24 * k);
      (h.img as Phaser.GameObjects.Image).setTexture(Math.floor(k * 8) % 2 ? 'hz_vent_hot' : 'hz_vent');
    } else {
      const half = DEPT_TUNING.cables.width;
      g.fillStyle(0xf5bd45, 0.1 + 0.25 * k).fillRect(h.x - h.w / 2, h.y - half, h.w, half * 2);
      g.lineStyle(3, 0xf45f52, 0.75).strokeRect(h.x - h.w / 2, h.y - half, h.w, half * 2);
      h.img.setAlpha(Math.floor(k * 10) % 2 ? 1 : 0.55);
    }
  }

  private activate(h: Timed, time: number): void {
    h.phase = 'active';
    h.t = time;
    h.hitPlayer = false;
    h.hit.clear();
    h.img.setAlpha(1);
    if (this.kind === 'vents') {
      (h.img as Phaser.GameObjects.Image).setTexture('hz_vent_hot');
      play('frost', { rate: 0.5 });
    } else {
      h.img.setTint(0xfff2a0);
      play('zap', { rate: 1.2 });
    }
  }

  private applyActive(h: Timed): void {
    const sc = this.scene;
    const p = sc.player;
    if (this.kind === 'vents') {
      const T = DEPT_TUNING.vents;
      if (Math.random() < 0.6) sc.fx.flame(h.x + Phaser.Math.Between(-T.radius, T.radius) * 0.7, h.y - Phaser.Math.Between(0, 30));
      const inside = (x: number, y: number, r: number) => ((x - h.x) / (T.radius + r)) ** 2 + ((y - h.y) / ((T.radius + r) * 0.62)) ** 2 <= 1;
      if (!h.hitPlayer && inside(p.x, p.y, 10)) { h.hitPlayer = true; sc.hurtPlayer(T.playerDamage, { how: 'hazard', by: 'vents' }); }
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn' || h.hit.has(e.id) || !inside(e.x, e.y, e.def.radius)) continue;
        h.hit.add(e.id);
        sc.damageEnemy(e, T.enemyDamage, null, { label: 'Oven vent', tags: ['heat'] });
      }
    } else {
      const T = DEPT_TUNING.cables;
      if (Math.random() < 0.7) sc.fx.spark(h.x + (Math.random() - 0.5) * h.w, h.y - 6, 1, 0xf5bd45);
      const inside = (x: number, y: number, r: number) => Math.abs(x - h.x) < h.w / 2 && Math.abs(y - h.y) < T.width + r * 0.5;
      if (!h.hitPlayer && inside(p.x, p.y, 10)) { h.hitPlayer = true; sc.hurtPlayer(T.playerDamage, { how: 'hazard', by: 'cables' }); }
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn' || h.hit.has(e.id) || !inside(e.x, e.y, e.def.radius)) continue;
        h.hit.add(e.id);
        sc.damageEnemy(e, T.enemyDamage, null, { label: 'Live cable', tags: ['electric'] });
        sc.stunEnemy(e, T.stun, 'electric');
      }
    }
  }

  private deactivate(h: Timed): void {
    h.phase = 'idle';
    h.img.setAlpha(1);
    if (this.kind === 'vents') (h.img as Phaser.GameObjects.Image).setTexture('hz_vent');
    else h.img.clearTint();
  }

  /** Checkout transition: switch everything off. */
  stop(): void {
    for (const h of this.timed) this.deactivate(h);
    this.timer = 1e9;
    this.g.clear();
  }
}
