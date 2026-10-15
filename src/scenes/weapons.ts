import Phaser from 'phaser';
import type { WeaponStats } from '../types';
import { RECIPE_TUNING } from '../data/recipes';
import { newHitTracker, shieldBlocks, tryHit, isSpent, pickRicochetTarget, type HitTracker } from '../systems/combat';
import { ITEMS, MULTIPACK, PUDDLE } from '../data/items';
import { SETS, setCfg } from '../data/sets';
import { store } from '../state/store';
import { SHIELD } from '../data/enemies';
import { applyBurn } from '../systems/combat';
import { play } from '../audio/sfx';
import { DEPTH } from './fx';
import type { ArenaScene } from './ArenaScene';
import type { Enemy } from './enemies';

export interface WeaponRt {
  stats: WeaponStats;
  cd: number;
  burstLeft: number;
  burstT: number;
  expressIcd: number;
  blades: Phaser.GameObjects.Image | null;
}

interface Puddle { img: Phaser.GameObjects.Image; x: number; y: number; r: number; until: number; nextTick: number; stats: WeaponStats; burnOnly?: boolean; frozen?: Set<number> }
interface Pot { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; stats: WeaponStats }

export interface Shot {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number;
  damage: number;
  tracker: HitTracker;
  stats: WeaponStats | null; // null = enemy projectile
  homing: boolean;
  spin: number;
  maxLife: number;
  ricochet: boolean;
}

const SHOT_POOL = 200;
const ENEMY_POOL = 90;

export class Arsenal {
  weapons: WeaponRt[] = [];
  shots: Shot[] = [];
  enemyShots: Shot[] = [];
  puddles: Puddle[] = [];
  pots: Pot[] = [];
  private time = 0;

  constructor(private scene: ArenaScene) {
    for (let i = 0; i < SHOT_POOL; i++) this.shots.push(this.makeShot('proj_toast'));
    for (let i = 0; i < ENEMY_POOL; i++) this.enemyShots.push(this.makeShot('proj_bubble'));
  }

  private makeShot(key: string): Shot {
    const img = this.scene.add.image(0, 0, key).setVisible(false);
    const shadow = this.scene.add.image(0, 0, 'shadow').setVisible(false).setDisplaySize(22, 7).setAlpha(0.6).setDepth(DEPTH.decal);
    return { img, shadow, active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, damage: 0, tracker: newHitTracker(1), stats: null, homing: false, spin: 0, maxLife: 1, ricochet: false };
  }

  setBuild(weapons: WeaponStats[]): void {
    this.weapons = weapons.map((stats, i) => ({
      stats, cd: 0.4 + i * 0.17, burstLeft: 0, burstT: 0, expressIcd: 0,
      // Blender: persistent spinning blade ring sized to its radius.
      blades: stats.pattern === 'aura'
        ? this.scene.add.image(0, 0, 'fx_blades').setDisplaySize(stats.range * 2.1, stats.range * 2.1 * 0.62).setAlpha(0.85).setDepth(DEPTH.decal + 1)
        : null,
    }));
  }

  get activeShots(): number {
    return this.shots.reduce((n, s) => n + (s.active ? 1 : 0), 0);
  }

  update(dt: number, firing: boolean): void {
    const sc = this.scene;
    this.time += dt;
    for (const w of this.weapons) {
      if (w.blades) {
        w.blades.setPosition(sc.player.x, sc.player.y - 4).setVisible(firing);
        w.blades.rotation += dt * (w.stats.recipes.includes('brainFreeze') ? 9 : 12);
        if (w.stats.recipes.includes('brainFreeze')) w.blades.setTint(0xcff3ff);
      }
      if (firing && w.stats.pattern === 'pulse') this.suction(w, dt);
      w.expressIcd -= dt;
      if (w.burstLeft > 0) {
        w.burstT -= dt;
        if (w.burstT <= 0) {
          const t = sc.nearestEnemy(w.stats.range);
          if (t) this.fireNail(w, t);
          w.burstLeft--;
          w.burstT = w.stats.burstInterval;
        }
      }
      // Electronics department perk: electrical weapons cycle faster while fighting there.
      w.cd -= dt * (ITEMS[w.stats.type].electrical ? sc.dept.electricalRate * sc.aisleEvent.electricRate() : 1);
      if (!firing || w.cd > 0) continue;
      if (w.stats.pattern === 'puddle') { w.cd = w.stats.cooldown; this.dropPuddle(w); continue; }
      const target = sc.nearestEnemy(w.stats.range);
      if (!target) { w.cd = 0.05; continue; }
      w.cd = w.stats.cooldown;
      switch (w.stats.pattern) {
        case 'toast': this.fireToast(w, target); break;
        case 'burst': w.burstLeft = w.stats.count; w.burstT = 0; break;
        case 'sweep': this.repeat(w, () => { const t = sc.nearestEnemy(w.stats.range); if (t) this.sweep(w, Math.atan2(t.y - sc.player.y, t.x - sc.player.x)); }); break;
        case 'pulse': this.pulse(w); break;
        case 'aura': this.aura(w); break;
        case 'zap': this.zap(w); break;
        case 'ricochet': this.fireCap(w, target); break;
        case 'laser': this.laser(w, target); break;
        case 'cone': this.repeat(w, () => this.cone(w)); break;
        case 'mortar': this.repeat(w, () => this.lobPot(w)); break;
      }
      sc.recoil(w.stats.uid);
    }
    this.updateShots(dt);
    this.updateEnemyShots(dt);
    this.updatePuddles();
    this.updatePots(dt);
  }

  private spawn(key: string, x: number, y: number, a: number, speed: number, life: number, damage: number, stats: WeaponStats | null, maxHits: number): Shot | null {
    const pool = stats ? this.shots : this.enemyShots;
    const s = pool.find((p) => !p.active);
    if (!s) return null;
    s.active = true;
    s.x = x; s.y = y; s.vx = Math.cos(a) * speed; s.vy = Math.sin(a) * speed;
    s.life = life; s.maxLife = life; s.damage = damage; s.stats = stats;
    s.tracker = newHitTracker(maxHits);
    s.homing = false;
    s.ricochet = key === 'proj_cap';
    s.spin = key === 'proj_toast' ? 9 : key === 'proj_receipt' ? 6 : key === 'proj_cap' ? 14 : 0;
    s.img.setTexture(key).setVisible(true).setAlpha(1).setScale(1).setRotation(key === 'proj_nail' ? a : 0).setPosition(x, y - 26);
    s.shadow.setVisible(true).setPosition(x, y);
    return s;
  }

  private origin(): { x: number; y: number } {
    const p = this.scene.player;
    return { x: p.x + p.facing * 18, y: p.y };
  }

  private fireToast(w: WeaponRt, target: Enemy): void {
    const o = this.origin();
    const st = w.stats;
    const base = Math.atan2(target.y - o.y, target.x - o.x);
    // Multipack can add projectiles without a recipe spread: fan them out a little so they don't overlap.
    const spread = Phaser.Math.DegToRad(st.spreadDeg || 12);
    for (let i = 0; i < st.count; i++) {
      const a = base + (st.count > 1 ? (i - (st.count - 1) / 2) * spread : 0);
      this.spawn('proj_toast', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
    }
    play('toast_pop', { rate: st.recipes.includes('toastMode') ? 0.85 : 1 });
  }

  private fireNail(w: WeaponRt, target: Enemy): void {
    const o = this.origin();
    const st = w.stats;
    const a = Math.atan2(target.y - o.y, target.x - o.x) + (Math.random() - 0.5) * 0.08;
    this.spawn('proj_nail', o.x, o.y, a, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.pierce);
    if (w.burstLeft === st.count) play('nail_burst');
  }

  private fireCap(w: WeaponRt, target: Enemy): void {
    const o = this.origin();
    const st = w.stats;
    const a = Math.atan2(target.y - o.y, target.x - o.x);
    for (let i = 0; i < st.count; i++) {
      const ai = a + (i - (st.count - 1) / 2) * 0.2;
      this.spawn('proj_cap', o.x, o.y, ai, st.projectileSpeed, st.range / st.projectileSpeed, st.damage, st, 1 + st.bounces + st.pierce);
    }
    play('cap_ping', { rate: 0.8 });
  }

  /** Self-Checkout Laser: a beam that hits every enemy along the line once. */
  private laser(w: WeaponRt, target: Enemy, echo = false): void {
    const sc = this.scene;
    // Power Surge: every beam fires again shortly after (re-aimed at the same target if it's still standing).
    if (!echo && w.stats.recipes.includes('powerSurge')) sc.time.delayedCall(RECIPE_TUNING.powerSurge.delay * 1000, () => {
      const t = target.alive ? target : sc.nearestEnemy(w.stats.range);
      if (t && sc.combatActive()) this.laser(w, t, true);
    });
    const st = w.stats;
    const o = this.origin();
    const inBeam = (e: Enemy, cx: number, cy: number): boolean => {
      const dx = e.x - o.x, dy = e.y - o.y, along = dx * cx + dy * cy;
      return along >= 0 && along <= st.range && Math.abs(dx * cy - dy * cx) <= e.def.radius + 14;
    };
    // Aim down the line that crosses the most groceries; the nearest target is tried first, so it wins ties.
    // ponytail: O(n²) over live enemies every ~1.6 s (n ≤ ~70); sweep sorted angles if counts ever grow.
    const live = sc.enemies.filter((e) => e.alive && e.state !== 'spawn');
    let a = Math.atan2(target.y - o.y, target.x - o.x), best = -1;
    for (const t of [target, ...live]) {
      if (Math.hypot(t.x - o.x, t.y - o.y) > st.range) continue;
      const ta = Math.atan2(t.y - o.y, t.x - o.x), tx = Math.cos(ta), ty = Math.sin(ta);
      const n = live.reduce((k, e) => k + (inBeam(e, tx, ty) ? 1 : 0), 0);
      if (n > best) { best = n; a = ta; }
    }
    const cx = Math.cos(a), cy = Math.sin(a);
    const beam = sc.add.image(o.x, o.y - 30, 'fx_laser').setOrigin(0, 0.5).setRotation(a).setDepth(DEPTH.fx)
      .setDisplaySize(st.range, 34);
    sc.tweens.add({ targets: beam, displayHeight: 4, alpha: 0, duration: 260, ease: 'Cubic.In', onComplete: () => beam.destroy() });
    const tracker = newHitTracker(Infinity);
    for (const e of live) {
      if (!inBeam(e, cx, cy) || !tryHit(tracker, e.id)) continue;
      if (st.recipes.includes('priceCheck')) e.markedUntil = sc.time.now / 1000 + RECIPE_TUNING.priceCheck.duration;
      sc.damageEnemy(e, st.damage * (echo ? RECIPE_TUNING.powerSurge.damageMult : 1), st, { kb: echo ? 20 : 70, kbX: cx, kbY: cy });
    }
    play('zap', { rate: echo ? 1.8 : 1.5 });
  }

  /** Blender: every tick, each enemy inside the radius is hit once. */
  private aura(w: WeaponRt): void {
    const sc = this.scene;
    const p = sc.player;
    const st = w.stats;
    let hit = false;
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > st.range + e.def.radius) continue;
      hit = true;
      sc.damageEnemy(e, st.damage, st, { kb: 20, kbX: (e.x - p.x) / (d || 1), kbY: (e.y - p.y) / (d || 1), quiet: true });
    }
    if (hit) play('blender');
    // Smoothie Shield: enemy projectiles inside the blade ring get shredded.
    if (st.recipes.includes('smoothieShield')) for (const shot of this.enemyShots) {
      if (!shot.active || (shot.x - p.x) ** 2 + (shot.y - p.y) ** 2 > st.range * st.range) continue;
      sc.fx.spark(shot.x, shot.y - 20, 4, 0xcff3ff);
      this.kill(shot);
    }
  }

  /** Microwave: strike one random target in range, splash around it, then chain. */
  private zap(w: WeaponRt): void {
    const sc = this.scene;
    const st = w.stats;
    const p = sc.player;
    const pool = sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < st.range * st.range);
    if (!pool.length) return;
    const tracker = newHitTracker(Infinity);
    // Sniper role: the toughest grocery in range (Elites first, then most HP); the splash handles the small fry.
    let target: Enemy | null = pool.reduce((b, e) => (e.elite !== b.elite ? (e.elite ? e : b) : e.hp > b.hp ? e : b));
    // Reheat: the first zap target's spot keeps burning.
    if (st.recipes.includes('reheat')) this.firePool(target.x, target.y, st.aoe, RECIPE_TUNING.reheat.poolTime, st);
    for (let link = 0; target && link <= st.chain; link++) {
      const t: Enemy = target;
      this.bolt(t.x, t.y, link > 0);
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 > (st.aoe + e.def.radius) ** 2) continue;
        if (!tryHit(tracker, e.id)) continue;
        sc.damageEnemy(e, link > 0 ? st.damage * 0.6 : st.damage, st, { kb: 80, kbX: Math.sign(e.x - t.x), kbY: 0 });
      }
      target = pickRicochetTarget(t, sc.enemies.filter((e) => e.alive && e.state !== 'spawn'), tracker.hits, 220);
    }
    play('zap');
  }

  private bolt(x: number, y: number, small: boolean): void {
    const sc = this.scene;
    const b = sc.add.image(x, y - 10, 'fx_zap').setOrigin(0.5, 1).setDepth(DEPTH.fx).setScale(small ? 0.6 : 1);
    sc.tweens.add({ targets: b, alpha: 0, duration: 220, onComplete: () => b.destroy() });
    sc.fx.ring('fx_zap_burst', x, y, small ? 110 : 170, 260);
    sc.fx.spark(x, y - 20, small ? 3 : 6, 0xf5bd45);
  }

  /** Multipack on sweeps/cones/mortars: the attack repeats (count - 1) more times. */
  private repeat(w: WeaponRt, attack: () => void): void {
    attack();
    for (let i = 1; i < w.stats.count; i++) this.scene.time.delayedCall(MULTIPACK.repeatDelay * 1000 * i, () => { if (this.scene.combatActive()) attack(); });
  }

  /** Spray Bottle: every enemy inside the cone is hit once per spray. */
  private cone(w: WeaponRt): void {
    const sc = this.scene;
    const p = sc.player;
    const st = w.stats;
    const t = sc.nearestEnemy(st.range + 40);
    if (!t) return;
    const a = Math.atan2(t.y - p.y, t.x - p.x);
    const half = Phaser.Math.DegToRad(st.arcDeg / 2);
    const fx = sc.add.image(p.x + Math.cos(a) * 20, p.y - 26 + Math.sin(a) * 20, 'fx_spray').setOrigin(0, 0.5).setRotation(a).setDepth(DEPTH.fx - 2)
      .setDisplaySize(st.range * 0.6, st.range * Math.tan(half) * 1.2 + 20).setAlpha(0.9);
    sc.tweens.add({ targets: fx, displayWidth: st.range * 1.05, alpha: 0, duration: 260, ease: 'Cubic.Out', onComplete: () => fx.destroy() });
    const tracker = newHitTracker(Infinity);
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > st.range + e.def.radius) continue;
      if (Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a)) > half && d > e.def.radius + p.radius) continue;
      if (!tryHit(tracker, e.id)) continue;
      sc.damageEnemy(e, st.damage, st, { kb: 40, kbX: dx / (d || 1), kbY: dy / (d || 1), quiet: true });
    }
    play('spray');
  }

  /** Pressure Cooker: lob a pot at the densest cluster in range; it explodes on landing. */
  private lobPot(w: WeaponRt): void {
    const sc = this.scene;
    const st = w.stats;
    const p = sc.player;
    const inRange = sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < st.range * st.range);
    if (!inRange.length) return;
    let best = inRange[0], bestN = -1;
    for (const e of inRange) {
      const n = inRange.reduce((k, o) => k + ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < st.aoe * st.aoe ? 1 : 0), 0);
      if (n > bestN) { bestN = n; best = e; }
    }
    const o = this.origin();
    const dist = Math.hypot(best.x - o.x, best.y - o.y);
    const img = sc.add.image(o.x, o.y - 30, 'proj_pot').setDepth(DEPTH.fx - 1);
    const shadow = sc.add.image(o.x, o.y, 'shadow').setDisplaySize(30, 9).setAlpha(0.6).setDepth(DEPTH.decal);
    this.pots.push({ img, shadow, sx: o.x, sy: o.y, tx: best.x, ty: best.y, t: 0, dur: Math.max(0.35, dist / st.projectileSpeed), stats: st });
    sc.fx.ring('fx_pulse', best.x, best.y, st.aoe * 2, 500, 0xf45f52);
    play('whistle', { volume: 0.35 });
  }

  private updatePots(dt: number): void {
    for (const pot of [...this.pots]) {
      pot.t += dt;
      const k = Math.min(1, pot.t / pot.dur);
      const x = pot.sx + (pot.tx - pot.sx) * k, y = pot.sy + (pot.ty - pot.sy) * k;
      const h = Math.sin(k * Math.PI) * (60 + pot.dur * 120);
      pot.img.setPosition(x, y - 30 - h).setRotation(k * 6);
      pot.shadow.setPosition(x, y);
      if (k < 1) continue;
      pot.img.destroy(); pot.shadow.destroy();
      this.pots = this.pots.filter((q) => q !== pot);
      this.explode(pot.tx, pot.ty, pot.stats);
    }
  }

  private explode(x: number, y: number, st: WeaponStats): void {
    const sc = this.scene;
    const tracker = newHitTracker(Infinity);
    sc.fx.ring('fx_boom', x, y, st.aoe * 2.4, 380);
    sc.fx.puff(x, y - 10, 5);
    sc.fx.crumbsAt(x, y - 10, 8, 0xf5bd45);
    sc.fx.shake(0.003, 90);
    play('boom');
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d > st.aoe + e.def.radius || !tryHit(tracker, e.id)) continue;
      sc.damageEnemy(e, st.damage, st, { kb: 220, kbX: dx / (d || 1), kbY: dy / (d || 1) });
    }
    if (st.firePool) this.firePool(x, y, st.aoe, RECIPE_TUNING.pressurePoint.poolTime, st);
    // Shrapnel: pot fragments fly out in a ring.
    if (st.recipes.includes('shrapnel')) {
      const T = RECIPE_TUNING.shrapnel;
      for (let i = 0; i < T.count; i++) {
        const a = (i / T.count) * Math.PI * 2 + Math.random() * 0.3;
        this.spawn('proj_nail', x, y, a, T.speed, T.range / T.speed, st.damage * T.damageMult, st, 2);
      }
    }
  }

  /** Burning floor patch (Pressure Point, Reheat, Sizzling Skillet): applies the weapon's burn, no direct damage. */
  private firePool(x: number, y: number, r: number, time: number, st: WeaponStats): void {
    if (!st.burn) return;
    if (this.puddles.length >= 14) this.removePuddle(this.puddles[0]);
    const img = this.scene.add.image(x, y, 'fx_puddle_fire').setDepth(DEPTH.decal).setDisplaySize(r * 1.8, r * 1.1).setAlpha(0.9);
    this.puddles.push({ img, x, y, r: r * 0.9, until: this.time + time, nextTick: this.time, stats: st, burnOnly: true });
  }

  private dropPuddle(w: WeaponRt): void {
    const p = this.scene.player;
    if (this.puddles.length >= 14) this.removePuddle(this.puddles[0]);
    const st = w.stats;
    const key = st.recipes.includes('greaseFire') ? 'fx_puddle_fire' : 'fx_puddle';
    const x = p.x - p.facing * 40, y = p.y + 4;
    const img = this.scene.add.image(x, y, key).setDepth(DEPTH.decal).setDisplaySize(st.range * 0.6, st.range * 0.4).setAlpha(0.9);
    this.scene.tweens.add({ targets: img, displayWidth: st.range * 2.2, displayHeight: st.range * 1.36, duration: 200, ease: 'Back.Out' });
    this.puddles.push({ img, x, y, r: st.range, until: this.time + st.duration, nextTick: this.time + 0.1, stats: st });
    play('splash');
  }

  private updatePuddles(): void {
    const sc = this.scene;
    for (const pd of [...this.puddles]) {
      if (this.time >= pd.until) { this.removePuddle(pd); continue; }
      if (pd.until - this.time < 0.5) pd.img.setAlpha(0.9 * (pd.until - this.time) / 0.5);
      if (pd.stats.recipes.includes('greaseFire') && Math.random() < 0.25) sc.fx.flame(pd.x + Phaser.Math.Between(-pd.r, pd.r) * 0.8, pd.y + Phaser.Math.Between(-pd.r, pd.r) * 0.4);
      if (this.time < pd.nextTick) continue;
      pd.nextTick += pd.stats.tick; // fixed tick: each enemy inside is hit once per tick
      const now = sc.time.now / 1000;
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        // Floor ellipse test (puddles are drawn flattened).
        const dx = (e.x - pd.x) / pd.r, dy = (e.y - pd.y) / (pd.r * 0.62);
        if (dx * dx + dy * dy > 1) continue;
        if (pd.burnOnly) { if (pd.stats.burn) applyBurn(e.status, sc.aisleEvent.burn(pd.stats.burn), now); continue; }
        // Black Ice: the first step into each puddle freezes the grocery solid.
        if (pd.stats.recipes.includes('blackIce') && !(pd.frozen ??= new Set()).has(e.id)) {
          pd.frozen.add(e.id);
          sc.stunEnemy(e, RECIPE_TUNING.blackIce.freeze);
          sc.fx.frostBurst(e.x, e.y - 20, 4);
        }
        applySlowFx(e, now, store.state.build.sets.frost);
        sc.damageEnemy(e, pd.stats.damage, pd.stats, { quiet: true });
      }
    }
  }

  private removePuddle(pd: Puddle): void {
    pd.img.destroy();
    this.puddles = this.puddles.filter((x) => x !== pd);
  }

  /** Arc sweep around the cart; each enemy at most once per swing. */
  sweep(w: WeaponRt, angle: number, bonus = false): void {
    const sc = this.scene;
    const p = sc.player;
    const st = w.stats;
    const tracker = newHitTracker(Infinity);
    const half = Phaser.Math.DegToRad(st.arcDeg / 2);
    const fx = sc.add.image(p.x, p.y - 22, 'fx_sweep').setRotation(angle + Math.PI).setDepth(DEPTH.fx - 2)
      .setScale(st.range / 70 * 0.55).setAlpha(0.95);
    if (bonus) fx.setTint(0xfff2d5);
    sc.tweens.add({ targets: fx, scale: st.range / 70, alpha: 0, rotation: angle + Math.PI + 0.5 * (Math.random() < 0.5 ? 1 : -1), duration: 220, ease: 'Cubic.Out', onComplete: () => fx.destroy() });
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > st.range + e.def.radius) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle));
      if (diff > half && d > e.def.radius + p.radius) continue;
      if (!tryHit(tracker, e.id)) continue;
      sc.damageEnemy(e, st.damage, st, { kb: 150, kbX: dx / (d || 1), kbY: dy / (d || 1) });
    }
    // Sizzling Skillet: the arc scorches the floor.
    if (st.recipes.includes('sizzlingSkillet')) {
      const T = RECIPE_TUNING.sizzlingSkillet;
      for (let i = 0; i < T.pools; i++) {
        const a = angle + (i / (T.pools - 1) - 0.5) * Phaser.Math.DegToRad(st.arcDeg) * 0.8;
        this.firePool(p.x + Math.cos(a) * st.range * 0.7, p.y + Math.sin(a) * st.range * 0.7 * 0.62, 34, T.poolTime, st);
      }
    }
    play('pan_clang', { rate: bonus ? 1.25 : 1 });
  }

  /** Vacuum, every frame: drags enemies in range toward the cart and draws dust into the nozzle. */
  private suction(w: WeaponRt, dt: number): void {
    const sc = this.scene;
    const p = sc.player;
    const st = w.stats;
    let pulling = false;
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      // Stop short of the cart so suction doesn't just feed melee enemies into the goblin.
      if (d > st.range + e.def.radius || d < p.radius + e.def.radius + 12) continue;
      pulling = true;
      // Knockback velocity decays at 9/s (updateEnemy), so this settles at `pull` px/s.
      const f = st.pull * 9 * dt * (1 - e.def.knockbackResist * 0.7) / d;
      e.kx += dx * f; e.ky += dy * f;
    }
    sc.fx.suck(p.x, p.y, st.range, pulling && Math.random() < dt * 22, st.frostRing ? 0xcff3ff : undefined);
  }

  /** Vacuum damage tick: everything inside the suction radius. */
  private pulse(w: WeaponRt): void {
    const sc = this.scene;
    const p = sc.player;
    const st = w.stats;
    sc.fx.ring(st.frostRing ? 'fx_frost' : 'fx_pulse', p.x, p.y, st.range * 2.2, 420, undefined, true);
    for (const e of sc.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      if (Math.hypot(p.x - e.x, p.y - e.y) > st.range + e.def.radius) continue;
      sc.damageEnemy(e, st.damage, st, {});
      if (st.frostRing) sc.fx.frostBurst(e.x, e.y - 20, 3);
    }
    // Static Cling: lightning jumps to a few groceries inside the pulse.
    if (st.recipes.includes('staticCling')) {
      const T = RECIPE_TUNING.staticCling;
      const inside = sc.enemies.filter((e) => e.alive && e.state !== 'spawn' && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (st.range + e.def.radius) ** 2);
      for (const e of inside.sort(() => Math.random() - 0.5).slice(0, T.targets)) {
        this.bolt(e.x, e.y, true);
        sc.damageEnemy(e, st.damage * T.damageMult, st, {});
      }
      if (inside.length) play('zap', { rate: 1.3, volume: 0.6 });
    }
    play('vacuum_pulse', { volume: 0.7 });
  }

  /** Express Checkout: bonus pan sweeps after a shove that connected. */
  expressCheckout(angle: number): boolean {
    let fired = false;
    for (const w of this.weapons) {
      if (!w.stats.expressSweep || w.expressIcd > 0) continue;
      w.expressIcd = RECIPE_TUNING.expressCheckout.icd;
      this.sweep(w, angle, true);
      fired = true;
    }
    return fired;
  }

  /** Pot Slam: the dash landing sets off a full pot blast. */
  dashBlast(x: number, y: number): void {
    for (const w of this.weapons) if (w.stats.dashBlast) this.explode(x, y, w.stats);
  }

  private updateShots(dt: number): void {
    const sc = this.scene;
    for (const s of this.shots) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { this.kill(s); continue; }
      const st = s.stats!;
      if (s.homing) {
        const t = sc.nearestEnemyFrom(s.x, s.y, RECIPE_TUNING.nailstorm.homingRange, s.tracker.hits);
        if (t) {
          const cur = Math.atan2(s.vy, s.vx);
          const want = Math.atan2(t.y - s.y, t.x - s.x);
          const turn = Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - cur), -RECIPE_TUNING.nailstorm.homingTurn * dt, RECIPE_TUNING.nailstorm.homingTurn * dt);
          const sp = Math.hypot(s.vx, s.vy);
          s.vx = Math.cos(cur + turn) * sp; s.vy = Math.sin(cur + turn) * sp;
          s.img.setRotation(cur + turn);
        }
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < 20 || s.x > 1260 || s.y < 120 || s.y > 800) { this.kill(s); continue; }
      s.img.setPosition(s.x, s.y - 26).setDepth(DEPTH.world + s.y);
      if (s.spin) s.img.rotation += s.spin * dt;
      s.shadow.setPosition(s.x, s.y);
      if (st.recipes.includes('toastMode') && Math.random() < 0.7) sc.fx.flame(s.x - s.vx * 0.02, s.y - 26 - s.vy * 0.02);
      if (st.recipes.includes('nailstorm') && Math.random() < 0.3) sc.fx.spark(s.x, s.y - 26, 1, 0x3fb7a6);
      for (const e of sc.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        const r = e.def.radius + 8;
        if (Math.abs(e.x - s.x) > r || Math.abs(e.y - s.y) > r) continue;
        if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > r * r) continue;
        // Cereal Box: a cardboard front stops player projectiles (sweeps, blasts, puddles etc. pass).
        // The front soaks up SHIELD.blocks shots, then goes soggy for good.
        if (e.def.shield && (e.shieldBlocked ?? 0) < SHIELD.blocks * (e.elite ? SHIELD.eliteMult : 1)
          && !s.tracker.hits.has(e.id) && shieldBlocks(s.vx, s.vy, sc.player.x - e.x, sc.player.y - e.y)) {
          e.shieldBlocked = (e.shieldBlocked ?? 0) + 1;
          sc.fx.spark(s.x, s.y - 26, 4, 0xd9954a);
          play('cap_ping', { rate: 0.6 });
          if (e.shieldBlocked >= SHIELD.blocks * (e.elite ? SHIELD.eliteMult : 1)) {
            sc.fx.puff(e.x, e.y - 20, 6);
          }
          this.kill(s);
          break;
        }
        if (!tryHit(s.tracker, e.id)) continue;
        const sp = Math.hypot(s.vx, s.vy) || 1;
        sc.damageEnemy(e, s.damage, st, { kb: 60, kbX: s.vx / sp, kbY: s.vy / sp });
        // Frostbite Nails: every 3rd nail on the same grocery freezes it.
        if (st.recipes.includes('frostbiteNails') && st.pattern === 'burst' && e.alive) {
          e.nailHits = (e.nailHits ?? 0) + 1;
          if (e.nailHits % RECIPE_TUNING.frostbiteNails.every === 0) { sc.stunEnemy(e, RECIPE_TUNING.frostbiteNails.freeze); sc.fx.frostBurst(e.x, e.y - 20, 6); }
        }
        if (st.homing) s.homing = true;
        if (isSpent(s.tracker)) { this.kill(s); break; }
        if (s.ricochet) {
          const next = pickRicochetTarget(s, sc.enemies.filter((x) => x.alive && x.state !== 'spawn'), s.tracker.hits, 230);
          // Confetti Cannon: every bounce goes off like a party popper.
          if (st.recipes.includes('confettiCannon')) sc.popperBlast(s.x, s.y, { damage: s.damage * RECIPE_TUNING.confettiCannon.damageMult, radius: RECIPE_TUNING.confettiCannon.radius * (store.state.build.sets.blast ? SETS.blast.radiusMult : 1) });
          if (next) {
            const a = Math.atan2(next.y - s.y, next.x - s.x);
            s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
            s.life = Math.max(s.life, 0.6);
            play('cap_ping', { rate: 1.2 + Math.random() * 0.2 });
            sc.fx.spark(s.x, s.y - 26, 2, 0xf5bd45);
          }
        }
      }
    }
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
      if (sc.playerNear(s.x, sy).d < p.radius && sc.hurtPlayer(s.damage)) {
        sc.fx.puff(s.x, s.y - 20, 3);
        this.kill(s);
      }
    }
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
    for (const pd of [...this.puddles]) this.removePuddle(pd);
    for (const pot of this.pots) { pot.img.destroy(); pot.shadow.destroy(); }
    this.pots = [];
  }
}

import { applySlow } from '../systems/combat';
function applySlowFx(e: Enemy, now: number, frostLv: number): void {
  const f = setCfg('frost', frostLv);
  applySlow(e.status, frostLv > 0 ? { ...PUDDLE.slow, pct: Math.min(f.slowCap, PUDDLE.slow.pct + f.slowBonus) } : PUDDLE.slow, now);
}
