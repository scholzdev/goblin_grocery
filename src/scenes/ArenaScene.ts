import Phaser from 'phaser';import { t, lang } from '../i18n';
import { deptT, enemyT, itemT } from '../i18n/data';
import { store } from '../state/store';
import { flow } from '../flow';
import { waveDef, eliteChance, bossTuning, ECONOMY, SHIFTS, WAVE_RAMP } from '../data/waves';
import { SHOW_HP_BAR, EGG_BLAST, MELON_SLICES, ELITE, GIFTCARD, GUM, THEME_SUMMONS, ELITE_EXCLUDED, AFFIX, MINI_BOSS } from '../data/enemies';
import { GumPuddles } from './gum';
import { BUFFS, CRIT, ECHO, ITEMS, PLAYER, STARTER_LOOKS } from '../data/items';
import { SETS, setCfg } from '../data/sets';
import { RECIPE_TUNING } from '../data/recipes';
import { addCoins, damagePlayer, takeStockroomItem } from '../state/run';
import { applyBurn, applySlow, armorDamage, newHitTracker, pickRicochetTarget, tryHit, type HitTracker } from '../systems/combat';
import type { EnemyId, ShopOffer, WaveDef, WeaponStats } from '../types';
import { play, setWheel } from '../audio/sfx';
import { musicFor, playMusic } from '../audio/music';
import { settings } from '../state/settings';
import { hud, showBanner } from '../ui/hud';
import { Fx, DEPTH } from './fx';
import { createEnemy, drawTelegraph, updateEnemy, type BossMove, type Enemy } from './enemies';
import { Arsenal } from './weapons';
import { Hazards } from './hazards';
import { AisleEvents } from './events';
import { rollEvent } from '../systems/events';
import { showStockroom, hideStockroom } from '../ui/stockroom';
import { noteEnemy, profile } from '../state/profile';
import { CART_PARTS, GOBLIN_PARTS } from '../data/unlocks';

/** Texture key for a goblin/cart layer in the equipped skin (Wardrobe). */
const sk = (key: string): string =>
  GOBLIN_PARTS.includes(key) && profile.goblin !== 'classic' ? `${key}__${profile.goblin}`
    : CART_PARTS.includes(key) && profile.cart !== 'chrome' ? `${key}__${profile.cart}` : key;
import { DEPARTMENTS, DEPT_TUNING } from '../data/departments';
import { MODIFIERS, ROOMS } from '../data/modifiers';
import { waveSpawnPlan, rollStockroom, rollMiniCrates } from '../systems/shop';
import { killCoins } from '../systems/combat';
import type { DepartmentDef } from '../types';
import { OBSTACLES, OBSTACLE_KINDS } from '../data/obstacles';
import { ZONES, type ZoneDef } from '../data/zones';
import { type Rect, pushOutCapsule, pushOutCircle, segmentHitsRect, steerAround } from '../systems/obstacles';

import { ARENA, ENTRIES, SIDE_UNITS, DECO_SPOTS, edgeSolids } from '../data/arena';
export { ARENA };

interface Player {
  x: number; y: number; radius: number; facing: 1 | -1;
  vx: number; vy: number;
  invulnT: number; protectT: number; hurtT: number;
  shoveT: number; shoveCd: number; shoveDX: number; shoveDY: number; shoveTracker: HitTracker; shoveHit: boolean;
  dead: boolean;
}

interface Coin { bread: boolean; img: Phaser.GameObjects.Image; active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; label: string; pull: boolean }

interface SpawnGroup { at: number; ids: EnemyId[]; entry: number; told: boolean; done: boolean }

export class ArenaScene extends Phaser.Scene {
  player!: Player;
  enemies: Enemy[] = [];
  fx!: Fx;
  arsenal!: Arsenal;
  enraged = false;
  dept!: DepartmentDef;
  hazards!: Hazards;
  obstacles: Rect[] = [];
  private vaulting = false;
  aisleEvent!: AisleEvents;
  private plan!: ReturnType<typeof waveSpawnPlan>;
  private breadDropped = 0;

  private wave!: WaveDef;
  private waveTime = 0;
  private groups: SpawnGroup[] = [];
  private coins: Coin[] = [];
  private markers: Phaser.GameObjects.Image[] = [];
  private telegraphs!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private rig!: Phaser.GameObjects.Container;
  private parts!: { legs: Phaser.GameObjects.Image; torso: Phaser.GameObjects.Image; head: Phaser.GameObjects.Image; arm: Phaser.GameObjects.Image; wheels: Phaser.GameObjects.Image[]; body: Phaser.GameObjects.Container; accHead?: Phaser.GameObjects.Image; accTorso?: Phaser.GameObjects.Image };
  private props = new Map<string, Phaser.GameObjects.Image>();
  private shadow!: Phaser.GameObjects.Image;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'space', Phaser.Input.Keyboard.Key>;
  private animT = 0;
  private ending: '' | 'checkout' | 'victory' | 'defeat' = '';
  private boss: Enemy | null = null;
  /** Mid-shift boss while alive; `miniDue` holds the aisle open until its loot is picked. */
  private mini: Enemy | null = null;
  private miniDue = false;
  /** Free Sample heal budget: HP healed by crits in the current second. */
  private critHealSec = -1;
  private critHealed = 0;
  private coinStreak = 0;
  private coinStreakT = 0;
  gum!: GumPuddles;
  private hudT = 0;
  private shoveMult = 1;

  constructor() {
    super('Arena');
  }

  create(): void {
    const s = store.state;
    this.enemies = [];
    this.groups = [];
    this.coins = [];
    this.markers = [];
    this.props.clear();
    this.enraged = false;
    this.ending = '';
    this.boss = null;
    this.mini = null;
    this.miniDue = false;
    this.waveTime = 0;
    this.wave = waveDef(s.wave);
    this.dept = DEPARTMENTS[s.phase === 'title' ? 'main' : s.department];
    this.plan = waveSpawnPlan(s);
    this.breadDropped = 0;
    this.cameras.main.setBackgroundColor('#B8DED2');

    this.buildEnvironment();
    this.buildObstacles();
    const center = () => this.cameras.main.centerOn(ARENA.w / 2, ARENA.h / 2);
    center();
    this.scale.on(Phaser.Scale.Events.RESIZE, center);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, center));
    this.hazards = new Hazards(this, s.phase === 'combat' && s.modifier !== 'stockroom' ? this.dept.hazard : 'none', s.wave, this.zone()?.hazardExtra ?? 0);
    const roll = s.phase === 'combat' ? rollEvent(this.dept.id, s.wave, s.shift, flow.rng, this.wave.boss, s.modifier === 'stockroom' ? 'none' : s.labEvent && s.labEvent !== 'random' ? s.labEvent : MODIFIERS[s.modifier].forceEvent ? (flow.rng() < 0.5 ? 'wetFloor' : 'outage') : 'random', s.build.sets) : null;
    this.aisleEvent = new AisleEvents(this, roll);
    if (roll) store.emit('tut:event');
    this.gum = new GumPuddles(this);
    this.telegraphs = this.add.graphics().setDepth(DEPTH.telegraph);
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.fx = new Fx(this);
    this.arsenal = new Arsenal(this);
    this.buildPlayer();
    this.arsenal.setBuild(s.build.weapons);
    for (let i = 0; i < 140; i++) {
      this.coins.push({ bread: false, img: this.add.image(0, 0, 'coin').setVisible(false).setScale(0.8), active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, label: '', pull: false });
    }

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, space: K.SPACE }, false) as typeof this.keys;
    this.events.on(Phaser.Scenes.Events.RESUME, () => kb.resetKeys());

    if (s.phase === 'combat') {
      this.planWave();
      playMusic(musicFor(this.dept.id, this.wave.boss, s.modifier));
      const room = s.modifier === 'stockroom' || s.modifier === 'coldRoom' || s.modifier === 'vipAisle' ? s.modifier : null;
      if (room) showBanner(t(`modName_${room}`), t(`roomSub_${room}`));
      else showBanner(this.wave.boss ? t('finalAisle') : deptT(this.dept.id).name, this.wave.boss ? t('managerAwaits') : this.dept.hazard === 'none' ? t('surviveCheckout') : deptT(this.dept.id).blurb);
      if (s.modifier === 'stockroom' && !this.wave.boss) this.openStockroom();
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hideStockroom());
    if (import.meta.env.DEV) this.devHooks();
  }

  // ───────────────────────────── environment ─────────────────────────────

  private buildEnvironment(): void {
    const th = this.dept.theme;
    // Floor and dressing extend far past the arena so any screen aspect is filled with store, not bars.
    const PAD = 700;
    const floor = this.add.tileSprite(-PAD, -PAD, ARENA.w + PAD * 2, ARENA.h + PAD * 2, th.floor).setOrigin(0).setDepth(DEPTH.floor);
    if (th.tint) floor.setTint(th.tint);
    this.buildOuterStore(PAD);
    // Soft lavender shade where the shelves meet the floor.
    const shade = this.add.graphics().setDepth(DEPTH.floor + 1);
    shade.fillStyle(0x9081b6, 0.22).fillRect(0, 150, ARENA.w, 46);
    shade.fillStyle(0x9081b6, 0.14).fillRect(0, 196, ARENA.w, 18);
    shade.fillStyle(0x9081b6, 0.2).fillRect(0, 150, 70, ARENA.h).fillRect(ARENA.w - 70, 150, 70, ARENA.h);
    // Aisle openings recede into shadow.
    for (const x of [344, 968]) shade.fillStyle(0x6e5f98, 0.25).fillRect(x - 56, 0, 112, 160);

    [160, 528, 784, 1152].forEach((x, i) => this.add.image(x, 176, th.walls[i % th.walls.length]).setOrigin(0.5, 1).setDepth(DEPTH.world + 176));
    // Aisle back walls.
    for (const [i, x] of [344, 968].entries()) this.add.image(x, 70, th.walls[(i + 1) % th.walls.length]).setOrigin(0.5, 1).setScale(0.45, 0.5).setTint(0xb7a9d6).setDepth(1);
    SIDE_UNITS.xs.forEach((x, i) => {
      for (const by of SIDE_UNITS.bottoms) this.add.image(x, by, th.sides[0]).setOrigin(0.5, 1).setFlipX(i === 1).setDepth(DEPTH.world + by - 120);
    });
    // Same deco spots for every department; the department decides what stands there.
    DECO_SPOTS.forEach(([x, y, sc], i) => this.add.image(x, y, th.props[i % th.props.length]).setOrigin(0.5, 0.95).setScale(sc).setDepth(DEPTH.world + y));
    for (const e of ENTRIES) this.markers.push(this.add.image(e.x, e.y, 'entry_marker').setDepth(DEPTH.decal).setAlpha(0.55).setScale(0.9));
  }

  /** Zone of this aisle (themed aisles only). */
  private zone(): ZoneDef | null {
    const s = store.state;
    return s.zone && this.dept.id === s.theme ? ZONES[s.zone] : null;
  }

  /** Picks one of the department's obstacle layouts for this wave and drops the props in. */
  private buildObstacles(): void {
    this.obstacles = [];
    if (store.state.phase !== 'combat') return;
    const layouts = this.zone()?.layouts ?? OBSTACLES[this.dept.id] ?? [[]];
    const layout = layouts[Math.floor(flow.rng() * layouts.length)];
    this.obstacles = [...layout, ...edgeSolids(this.dept.theme.props)];
    if (layout.length) store.emit('tut:obstacles');
    for (const o of layout) {
      this.add.image(o.x, o.y + o.h / 2, OBSTACLE_KINDS[o.kind].tex).setOrigin(0.5, 0.9).setDepth(DEPTH.world + o.y + o.h / 2);
    }
  }

  /** Walking goblin + cart vs props: slide out along the shallowest side. Dashing (shove) skips this and vaults over. */
  private pushPlayerOut(): void {
    const p = this.player, a = -PLAYER.body.back * p.facing, b = PLAYER.body.front * p.facing;
    for (const o of this.obstacles) {
      const q = pushOutCapsule(p.x, p.y, Math.min(a, b), Math.max(a, b), p.radius, o);
      if (q) { p.x = q.x; p.y = q.y; }
    }
  }

  /** Grocery vs props. Returns true when it was pushed. Bosses ignore props. */
  pushEnemyOut(e: { x: number; y: number }, radius: number): boolean {
    let hit = false;
    for (const o of this.obstacles) {
      const q = pushOutCircle(e.x, e.y, radius, o);
      if (q) { e.x = q.x; e.y = q.y; hit = true; }
    }
    return hit;
  }

  /** Chase direction that bends around a prop standing between the grocery and its target. */
  steer(e: { x: number; y: number }, radius: number, nx: number, ny: number): { x: number; y: number } {
    if (!this.obstacles.length) return { x: nx, y: ny };
    return steerAround(e.x, e.y, this.player.x, this.player.y, radius, this.obstacles);
  }

  /** Non-playable store beyond the arena walls, dimmed so the fight stays the focus. */
  private buildOuterStore(pad: number): void {
    const th = this.dept.theme;
    const dim = 0xb7a9d6;
    for (let x = -60; x > -pad; x -= 96) for (const by of [400, 810, 1220]) {
      this.add.image(x, by, th.sides[0]).setOrigin(0.5, 1).setTint(dim).setDepth(1);
      this.add.image(ARENA.w - x, by, th.sides[0]).setOrigin(0.5, 1).setFlipX(true).setTint(dim).setDepth(1);
    }
    const keys = th.walls;
    for (let i = 0, x = -pad; x < ARENA.w + pad; x += 256, i++) {
      this.add.image(x, 22, keys[i % keys.length]).setOrigin(0, 1).setTint(dim).setDepth(1);
      this.add.image(x, -128, keys[(i + 2) % keys.length]).setOrigin(0, 1).setTint(0xa597c8).setDepth(1);
      this.add.image(x, 990, keys[(i + 1) % keys.length]).setOrigin(0, 1).setTint(dim).setDepth(DEPTH.world + 990);
    }
    const g = this.add.graphics().setDepth(DEPTH.fx - 10);
    g.fillStyle(0x30203f, 0.28);
    g.fillRect(-pad, -pad, pad, ARENA.h + pad * 2).fillRect(ARENA.w, -pad, pad, ARENA.h + pad * 2);
    g.fillRect(0, -pad, ARENA.w, pad).fillRect(0, ARENA.h, ARENA.w, pad);
  }

  // ───────────────────────────── player ─────────────────────────────

  private buildPlayer(): void {
    const s = store.state;
    this.player = {
      x: 640, y: 500, radius: PLAYER.radius, facing: 1, vx: 0, vy: 0, invulnT: 0, protectT: 0, hurtT: 0,
      shoveT: 0, shoveCd: 0, shoveDX: 1, shoveDY: 0, shoveTracker: newHitTracker(Infinity), shoveHit: false, dead: false,
    };
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(DEPTH.decal).setDisplaySize(150, 40);
    const wheels = [
      // casters sit right under the cart_back leg ends (world ≈ (5,-16) and (64,-16)); far pair peeks out up-right
      this.add.image(13, -13, sk('cart_wheel')).setScale(0.85).setTint(0xb0a6c8), this.add.image(72, -13, sk('cart_wheel')).setScale(0.85).setTint(0xb0a6c8),
      this.add.image(5, -9, sk('cart_wheel')), this.add.image(64, -9, sk('cart_wheel')),
    ];
    const cartBack = this.add.image(22, -6, sk('cart_back')).setOrigin(0.5, 1);
    const cartFront = this.add.image(22, -6, sk('cart_front')).setOrigin(0.5, 1);
    const legs = this.add.image(-50, 0, sk('goblin_legs_a')).setOrigin(0.5, 0.95).setScale(0.8);
    const torso = this.add.image(-50, -26, sk('goblin_torso')).setOrigin(0.5, 0.95).setScale(0.8);
    const head = this.add.image(-48, -60, sk('goblin_head')).setOrigin(0.5, 0.85).setScale(0.8);
    const arm = this.add.image(-46, -48, sk('goblin_arm')).setOrigin(0.1, 0.5).setScale(0.8);
    const body = this.add.container(0, 0, [...wheels.slice(0, 2), cartBack]);
    // Props go between cart back and front wires.
    const shown = this.chooseProps(s.build.weapons, s.build.recipes.map((r) => [r.weaponUid, ...r.supportUids]).flat());
    // Piled in the basket (cart_back spans ≈ x -2..56, rim ≈ y -66): two side by side, the third on top.
    const pile: [number, number, number][][] = [[], [[27, -74, 0]], [[15, -72, -8], [39, -72, 8]], [[13, -72, -10], [41, -72, 10], [27, -86, 4]]];
    shown.forEach(({ uid, type }, i) => {
      const [x, y, angle] = pile[shown.length][i];
      const img = this.add.image(x, y, `prop_${type}`).setScale(0.78).setAngle(angle);
      this.props.set(uid, img);
      body.add(img);
    });
    const look = STARTER_LOOKS[s.starter ?? 'toaster'];
    const accHead = look.head ? this.add.image(-48, -60, look.head).setOrigin(0.5, 0.8929).setScale(0.8) : undefined;
    const accTorso = look.torso ? this.add.image(-50, -26, look.torso).setOrigin(0.5, 0.95).setScale(0.8) : undefined;
    body.add([cartFront, ...wheels.slice(2), legs, torso, ...(accTorso ? [accTorso] : []), arm, head, ...(accHead ? [accHead] : [])]);
    this.rig = this.add.container(this.player.x, this.player.y, [body]).setScale(0.95);
    this.parts = { legs, torso, head, arm, wheels, body, accHead, accTorso };
  }

  /** Up to three cart props: the active recipe set first, then remaining weapons. */
  private chooseProps(weapons: WeaponStats[], recipeUids: string[]): { uid: string; type: string }[] {
    const inv = store.state.inventory.placed;
    const out: { uid: string; type: string }[] = [];
    const add = (uid: string) => {
      const it = inv.find((i) => i.uid === uid);
      if (it && out.length < 3 && !out.some((o) => o.uid === uid)) out.push({ uid, type: it.type });
    };
    recipeUids.forEach(add);
    weapons.forEach((w) => add(w.uid));
    return out;
  }

  recoil(uid: string): void {
    const img = this.props.get(uid);
    if (!img) return;
    this.tweens.killTweensOf(img);
    img.setScale(0.9);
    this.tweens.add({ targets: img, scale: 0.78, duration: 140, ease: 'Back.Out' });
  }

  // ───────────────────────────── waves ─────────────────────────────

  private planWave(): void {
    const w = this.wave;
    const plan = this.plan;
    const ids = Object.keys(plan.mix) as EnemyId[];
    const weights = ids.map((id) => plan.mix[id]!);
    const sum = weights.reduce((a, b) => a + b, 0);
    const pick = (): EnemyId => {
      let r = flow.rng() * sum;
      for (let i = 0; i < ids.length; i++) if ((r -= weights[i]) <= 0) return ids[i];
      return ids[0];
    };
    const sizes: number[] = [];
    let left = plan.total;
    while (left > 0) {
      const n = Math.min(left, w.group[0] + Math.floor(flow.rng() * (w.group[1] - w.group[0] + 1)));
      sizes.push(n);
      left -= n;
    }
    const start = w.boss ? 4 : 1.2;
    const end = w.boss ? 14 : w.duration - 6;
    sizes.forEach((n, i) => {
      // Later groups arrive closer together (densityPow < 1 pushes spawns toward the end of the wave).
      const u = (i / Math.max(1, sizes.length - 1)) ** (w.boss ? 1 : WAVE_RAMP.densityPow);
      const at = start + u * (end - start) + (flow.rng() - 0.5) * 0.6;
      // Early waves introduce one behavior at a time: first group of a new type arrives alone-ish.
      this.groups.push({ at, ids: Array.from({ length: n }, pick), entry: -1, told: false, done: false });
    });
    if (w.boss) this.time.delayedCall(1600, () => this.spawnBoss());
    if (w.index === MINI_BOSS.aisle && store.state.modifier !== 'stockroom') {
      this.miniDue = true;
      this.time.delayedCall(MINI_BOSS.at * 1000, () => this.spawnMini());
    }
  }

  private pickEntry(): number {
    const far = ENTRIES.map((e, i) => ({ i, d: Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) }))
      .filter((e) => e.d > 320);
    const pool = far.length ? far : ENTRIES.map((_, i) => ({ i, d: 0 }));
    return pool[Math.floor(flow.rng() * pool.length)].i;
  }

  private tellEntry(i: number): void {
    const m = this.markers[i];
    this.tweens.killTweensOf(m);
    m.setAlpha(1).setTint(0xf45f52).setScale(1.25);
    this.tweens.add({ targets: m, scale: 0.9, alpha: 0.55, duration: 800, ease: 'Sine.InOut', onComplete: () => m.clearTint() });
    play('spawn');
  }

  private updateDirector(): void {
    const alive = this.enemies.filter((e) => e.alive).length;
    for (const g of this.groups) {
      if (g.done) continue;
      if (!g.told && this.waveTime >= g.at - 0.8) {
        g.entry = this.pickEntry();
        g.told = true;
        this.tellEntry(g.entry);
      }
      if (g.told && this.waveTime >= g.at && alive + g.ids.length <= ECONOMY.maxActiveEnemies) {
        const en = ENTRIES[g.entry];
        g.ids.forEach((id, k) => {
          noteEnemy(store.state, id);
          const a = (k / g.ids.length) * Math.PI * 2;
          this.enemies.push(createEnemy(this, id, en.x + Math.cos(a) * 18 * Math.min(1, k), en.y + Math.sin(a) * 12 * Math.min(1, k), this.plan.hpScale * this.ramp(WAVE_RAMP.hp), this.plan.speedScale * this.ramp(WAVE_RAMP.speed), flow.rng() < eliteChance(id, this.wave, store.state.shift) + (this.wave.boss || ELITE_EXCLUDED.includes(id) ? 0 : MODIFIERS[store.state.modifier].eliteBonus), this.plan.dmgScale));
          if (this.enemies[this.enemies.length - 1].elite) store.emit('tut:elite');
        });
        this.fx.puff(en.x, en.y, 4);
        g.done = true;
      }
    }
  }

  private spawnBoss(): void {
    if (this.ending) return;
    noteEnemy(store.state, 'boss');
    const e = createEnemy(this, 'boss', 640, 330, SHIFTS[store.state.shift].bossHpMult, 1, false, this.plan.dmgScale);
    e.state = 'spawn';
    e.stateT = 1.2;
    e.sprite.setY(-100);
    this.tweens.killTweensOf(e.sprite);
    e.sprite.setScale(0.95);
    this.tweens.add({ targets: e.sprite, y: 330, duration: 700, ease: 'Bounce.Out', onComplete: () => { this.fx.shake(0.01, 250); this.fx.puff(640, 330, 10); play('boss_hit'); } });
    this.enemies.push(e);
    this.boss = e;
    showBanner(t('managerCaps'), t('watchFloor'));
  }

  /** Mid-shift boss: a giant grocery from the run's theme drops in; the aisle ends when it falls. */
  private spawnMini(): void {
    if (this.ending) return;
    const id = MINI_BOSS.byTheme[store.state.theme] ?? MINI_BOSS.byTheme.main!;
    const e = createEnemy(this, id, 640, 330, SHIFTS[store.state.shift].bossHpMult, 1, false, this.plan.dmgScale, 0, true);
    e.state = 'spawn';
    e.stateT = 1.2;
    e.sprite.setY(-100); // createEnemy's grow-in tween still scales it up on the way down
    this.tweens.add({ targets: e.sprite, y: 330, duration: 700, ease: 'Bounce.Out', onComplete: () => { this.fx.shake(0.008, 220); this.fx.puff(640, 330, 8); play('boss_hit'); } });
    this.enemies.push(e);
    this.mini = e;
    showBanner(t('miniBossCaps'), t('miniBossSub', { name: enemyT(id).name }));
  }

  private miniDefeated(): void {
    const m = this.mini!;
    this.mini = null;
    this.hazards.stop();
    this.gum.clear();
    this.ending = 'checkout';
    showBanner(t('miniBossDown'), t('miniBossDownSub'));
    this.fx.shake(0.008, 260);
    for (let i = 0; i < 4; i++) this.time.delayedCall(120 * i, () => {
      this.fx.puff(m.x + Phaser.Math.Between(-50, 50), m.y - 50, 4);
      play('ding', { rate: 1 + i * 0.1 });
    });
    this.arsenal.clearAll(true);
    this.groups.forEach((g) => (g.done = true));
    this.enemies.filter((e) => e.alive).forEach((e) => this.killEnemy(e, false));
    this.time.delayedCall(600, () => this.coins.forEach((c) => (c.pull = c.active)));
    this.time.delayedCall(1300, () => this.offerCrates(rollMiniCrates(store.state, flow.rng), { title: t('miniCratesTitle'), hint: t('miniCratesHint') }, () => {
      this.miniDue = false;
      this.ending = '';
      this.beginCheckout();
    }));
  }

  summonMinions(n: number): void {
    const T = bossTuning(store.state.shift);
    const entries = [this.pickEntry(), this.pickEntry()];
    for (let k = 0; k < 2; k++) {
      const ids = Array.from({ length: Math.ceil(n / 2) }, () => {
        const pool = flow.rng() < 0.5 ? THEME_SUMMONS[store.state.theme] ?? T.summonTypes : T.summonTypes;
        return pool[Math.floor(flow.rng() * pool.length)];
      });
      this.groups.push({ at: this.waveTime + 0.8, ids, entry: entries[k], told: true, done: false });
      this.tellEntry(entries[k]);
    }
  }

  bossBark(move: BossMove): void {
    const lines: Record<BossMove, string> = { volley: t('bossVolley'), charge: t('bossCharge'), summon: t('bossSummon') };
    hud.bark(lines[move]);
  }

  /** Stun from hazards. The boss shrugs it off to keep its patterns readable. */
  private regenFxT = 0;

  stunEnemy(e: Enemy, t: number): void {
    if (!e.alive || e.def.behavior === 'boss') return;
    e.state = 'stun';
    e.stateT = Math.max(e.stateT, t);
  }

  /** Floor slow multiplier for enemies (ice). */
  groundSlow(e: Enemy): number {
    return (this.hazards.onIce(e.x, e.y) ? 1 - DEPT_TUNING.ice.enemySlow : 1) * this.aisleEvent.enemySpeed() * (store.state.modifier === 'coldRoom' ? 1 - ROOMS.coldRoom.enemySlow : 1);
  }

  /** In-wave difficulty ramp: 1 at the start of a wave, 1 + amount at its end (boss wave: flat). */
  private ramp(amount: number): number {
    if (this.wave.boss) return 1;
    const aisle = Math.min(1, this.wave.index / WAVE_RAMP.fullAtWave);
    return 1 + amount * aisle * Math.min(1, this.waveTime / this.wave.duration);
  }

  halfHp(e: Enemy): boolean {
    return e.hp <= e.maxHp / 2;
  }

  bossCooldownMult(e: Enemy): number {
    return (this.halfHp(e) ? bossTuning(store.state.shift).halfHpCooldownMult : 1) * (this.enraged ? bossTuning(store.state.shift).enrageCooldownMult : 1);
  }

  // ───────────────────────────── combat helpers ─────────────────────────────

  nearestEnemy(range: number): Enemy | null {
    return this.nearestEnemyFrom(this.player.x, this.player.y, range);
  }

  nearestEnemyFrom(x: number, y: number, range: number, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bd = range * range;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn' || exclude?.has(e.id)) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d >= range * range) continue;
      const k = e.def.id === 'honey' ? d * 0.25 : d; // Honey Jars are priority targets
      if (k < bd) { bd = k; best = e; }
    }
    return best;
  }

  clampToArena(o: { x: number; y: number }, r: number): boolean {
    const x = Phaser.Math.Clamp(o.x, ARENA.left + r * 0.5, ARENA.right - r * 0.5);
    const y = Phaser.Math.Clamp(o.y, ARENA.top, ARENA.bottom);
    const hit = x !== o.x || y !== o.y;
    o.x = x; o.y = y;
    return hit;
  }

  damageEnemy(e: Enemy, dmg: number, stats: WeaponStats | null, o: { kb?: number; kbX?: number; kbY?: number; isDot?: boolean; label?: string; quiet?: boolean; echo?: boolean; fromPopper?: boolean; chained?: boolean }): void {
    if (!e.alive) return;
    const baseDmg = dmg;
    const now = this.time.now / 1000;
    const s = store.state;
    const sets = s.build.sets;
    // Five-Alarm Toast: toast scorches enemies that are already burning.
    if (stats?.recipes.includes('fiveAlarm') && stats.pattern === 'toast' && e.status.burnUntil > now) dmg *= RECIPE_TUNING.fiveAlarm.vsBurning;
    // Price Check mark: +30% from every source while marked.
    if ((e.markedUntil ?? 0) > now) dmg *= RECIPE_TUNING.priceCheck.damageMult;
    // Crits resolve here and only here (never on burn ticks).
    const crit = !o.isDot && !!stats && stats.critChance > 0 && Math.random() < stats.critChance;
    if (crit) {
      dmg *= CRIT.mult;
      this.fx.popImage('fx_crit', e.x + Phaser.Math.Between(-10, 10), e.y - e.sprite.displayHeight - 6, 0.8);
      play('crit');
      if (stats!.critCoin && !e.critCoinDropped) { e.critCoinDropped = true; this.dropCoin(e.x, e.y, t('coinClearance')); }
      // Free Sample: crits heal, capped per (whole) second so fast area weapons can't out-heal everything.
      if (s.build.critHeal > 0 && !this.player.dead) {
        const sec = Math.floor(now);
        if (sec !== this.critHealSec) { this.critHealSec = sec; this.critHealed = 0; }
        const h = Math.min(s.build.critHeal, BUFFS.sampleHealCap - this.critHealed, s.build.maxHp - s.hp);
        if (h > 0) { s.hp += h; this.critHealed += h; this.fx.spark(this.player.x, this.player.y - 46, 2, 0x8fcb57); }
      }
    }
    // Armor (Canned Beans): direct hits only; burn, puddles, auras and pulses (isDot/quiet) pass through.
    let armored = false;
    if (e.def.armor && !o.isDot && !o.quiet) {
      const soaked = armorDamage(dmg, e.def.armor);
      armored = soaked < dmg * 0.5;
      dmg = soaked;
    }
    e.hp -= dmg;
    if (!o.isDot) e.lastHitT = now;
    const key = o.isDot ? 'burn' : stats?.uid ?? o.label ?? 'shove';
    s.stats.damageByWeapon[key] = (s.stats.damageByWeapon[key] ?? 0) + dmg;
    if (stats?.burn) applyBurn(e.status, this.aisleEvent.burn(stats.burn), now);
    if (!o.isDot && stats?.ignite && !stats.burn && Math.random() < stats.ignite.chance) { applyBurn(e.status, this.aisleEvent.burn(stats.ignite.burn), now); this.igniteFx(e); } // Heat L2
    if (stats?.slow) applySlow(e.status, stats.slow, now);
    // Frost L2: direct hits on well-slowed enemies sometimes freeze them briefly (not aura/puddle ticks, see SETS).
    if (!o.isDot && stats && stats.pattern !== 'aura' && stats.pattern !== 'puddle' && sets.frost >= 2 && e.status.slowUntil > now && e.status.slowPct >= SETS.frost.stunMinSlow && Math.random() < setCfg('frost', sets.frost).stunChance) { this.stunEnemy(e, setCfg('frost', sets.frost).stun); this.freezeFx(e); }
    if (o.kb) {
      const k = o.kb * (1 - e.def.knockbackResist) * (this.hazards.onIce(e.x, e.y) ? DEPT_TUNING.ice.knockbackMult : 1) * (stats && sets.cleaning >= 2 && ITEMS[stats.type].family === 'cleaning' ? setCfg('cleaning', sets.cleaning).knockbackMult : 1);
      e.kx += (o.kbX ?? 0) * k * 3; e.ky += (o.kbY ?? 0) * k * 3;
      // Cleaning L2: teal spritz on its boosted knockback (direct hits only).
      if (!o.isDot && stats && stats.pattern !== 'aura' && stats.pattern !== 'puddle' && sets.cleaning >= 2 && ITEMS[stats.type].family === 'cleaning') this.fx.spark(e.x, e.y - 30, 3, 0x3fb7a6);
    }
    if (!o.isDot && !o.quiet) {
      // Short flash with a re-trigger gap so constant fire never leaves a sprite solid white.
      if (now - e.lastFlashAt > 0.16) {
        e.lastFlashAt = now;
        e.flashT = 0.06;
        if (e.def.behavior === 'boss') e.sprite.setTint(0xffb8ae); else e.sprite.setTintFill(0xffffff);
      }
      this.fx.spark(e.x, e.y - 30, 3, armored ? 0xaab2c2 : stats?.recipes.includes('toastMode') ? 0xf5bd45 : 0xffffff);
      if (armored) { this.fx.label(e.x, e.y - e.sprite.displayHeight - 10, lang() === 'de' ? '-Panzer' : '-armor', '#AAB2C2', 16); play('cap_ping', { rate: 0.7 }); }
      if (e.def.behavior === 'boss') play('boss_hit');
    }
    if (crit || now - e.lastHitNumberAt > 0.14 || dmg >= 10) {
      e.lastHitNumberAt = now;
      this.fx.number(e.x, e.y - e.sprite.displayHeight * 0.9, dmg, crit ? '#F45F52' : o.isDot ? '#F5BD45' : '#FFF2D5', crit ? 28 : o.isDot ? 16 : 22);
    }
    // Double Bag: one delayed second strike per direct hit (echoes never echo).
    if (stats && stats.echo > 0 && !o.isDot && !o.echo && !o.fromPopper && !o.chained) {
      this.time.delayedCall(ECHO.delay * 1000, () => {
        if (!e.alive || !this.combatActive()) return;
        this.fx.popImage('fx_echo', e.x + Phaser.Math.Between(-12, 12), e.y - 40, 0.6);
        this.damageEnemy(e, baseDmg * stats.echo, stats, { echo: true, quiet: o.quiet });
      });
    }
    // Electric set: direct hits may arc to nearby enemies (not aura/puddle ticks; chained hits never chain or echo again).
    if (stats && stats.chainChance > 0 && !o.isDot && stats.pattern !== 'aura' && stats.pattern !== 'puddle' && !o.chained && Math.random() < stats.chainChance) {
      const hit = new Set([e.id]);
      let from: Enemy = e;
      const pts = [{ x: e.x, y: e.y - 30 }];
      for (let j = 0; j < stats.chainJumps; j++) {
        const n = pickRicochetTarget(from, this.enemies.filter((x) => x.alive && x.state !== 'spawn'), hit, SETS.electric.range);
        if (!n) break;
        hit.add(n.id);
        this.fx.spark(n.x, n.y - 30, 4, 0x9be8ff);
        pts.push({ x: n.x, y: n.y - 30 });
        this.damageEnemy(n, baseDmg * SETS.electric.damageMult, stats, { chained: true, quiet: o.quiet });
        from = n;
      }
      if (pts.length > 1) this.arcFx(pts);
    }
    if (e.hp <= 0) {
      this.killEnemy(e, true);
      // Kitchen L2: kitchen weapon kills sometimes heal. Blast L2: weapon kills sometimes pop (popper blasts never re-trigger).
      if (stats && sets.kitchen >= 2 && ITEMS[stats.type].family === 'kitchen' && Math.random() < setCfg('kitchen', sets.kitchen).healChance) {
        s.hp = Math.min(s.build.maxHp, s.hp + setCfg('kitchen', sets.kitchen).heal);
        this.healHeartFx(e.x, e.y - 30);
        store.changed();
      }
      if (stats && sets.blast >= 2 && !o.fromPopper && Math.random() < setCfg('blast', sets.blast).killChance) this.popperBlast(e.x, e.y, { damage: setCfg('blast', sets.blast).damage, radius: setCfg('blast', sets.blast).radius }, true);
      // Party Popper: kills explode; popper kills never pop again.
      if (stats?.popper && !o.fromPopper) this.popperBlast(e.x, e.y, stats.popper);
    }
  }

  /** Kitchen L2 heal: a heart flies from the kill to the goblin, then the +N pops. */
  private healHeartFx(x: number, y: number): void {
    const h = this.add.text(x, y, '♥', { fontFamily: 'Arial, sans-serif', fontSize: '26px', color: '#F45F52', stroke: '#30203F', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fx);
    const k = { v: 0 };
    this.tweens.add({
      targets: k, v: 1, duration: 350, ease: 'Quad.In',
      onUpdate: () => h.setPosition(x + (this.player.x - x) * k.v, y + (this.player.y - 60 - y) * k.v).setScale(1 - 0.4 * k.v),
      onComplete: () => { h.destroy(); this.fx.number(this.player.x, this.player.y - 90, SETS.kitchen.heal, '#8FCB57', 20); play('ding', { rate: 1.3, volume: 0.6 }); },
    });
  }

  /** Electric set: one jagged bolt through the chain, fades out fast. */
  private arcFx(pts: { x: number; y: number }[]): void {
    const g = this.add.graphics().setDepth(DEPTH.fx);
    const path: { x: number; y: number }[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], segs = Phaser.Math.Between(3, 4), len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      for (let j = 1; j < segs; j++) { const f = j / segs, off = Phaser.Math.Between(-12, 12); path.push({ x: a.x + (b.x - a.x) * f + nx * off, y: a.y + (b.y - a.y) * f + ny * off }); }
      path.push(b);
    }
    for (const [w, c] of [[3, 0xf5e26b], [1, 0xffffff]] as const) g.lineStyle(w, c, 1).strokePoints(path as Phaser.Types.Math.Vector2Like[] as Phaser.Math.Vector2[]);
    this.tweens.add({ targets: g, alpha: 0, duration: 140, onComplete: () => g.destroy() });
    play('zap', { rate: 1.4, volume: 0.5 });
  }

  /** Frost L2: marks the enemy frozen (ice block drawn by updateEnemy). */
  private freezeFx(e: Enemy): void {
    if (!e.alive || e.def.behavior === 'boss') return;
    e.frozenT = setCfg('frost', store.state.build.sets.frost).stun;
    play('frost', { rate: 1.3, volume: 0.5 });
  }

  /** Heat L2: ignite roll succeeded. */
  private igniteFx(e: Enemy): void {
    for (let i = 0; i < 3; i++) this.fx.flame(e.x + Phaser.Math.Between(-14, 14), e.y - 20 - i * 10);
    this.fx.ring('fx_pulse', e.x, e.y, 60, 200, 0xff7a3d);
  }

  popperBlast(x: number, y: number, pop: { damage: number; radius: number }, setPop = false): void {
    this.fx.confetti(x, y - 30);
    this.fx.ring('fx_pulse', x, y, pop.radius * 2.2, 260, setPop ? 0xff8fc8 : 0xf5bd45);
    if (setPop) this.fx.shake(0.003, 90);
    play('pop', { rate: 0.9 + Math.random() * 0.3 });
    for (const o of this.enemies) {
      if (!o.alive || o.state === 'spawn') continue;
      if ((o.x - x) ** 2 + (o.y - y) ** 2 > (pop.radius + o.def.radius) ** 2) continue;
      this.damageEnemy(o, pop.damage, null, { fromPopper: true, label: 'Party Popper', kb: 60, kbX: Math.sign(o.x - x), kbY: Math.sign(o.y - y) * 0.6 });
    }
  }

  /** True while weapons should keep acting (used by delayed repeats/echoes). */
  combatActive(): boolean {
    return store.state.phase === 'combat' && !this.ending;
  }

  /** Egg Carton blast: lightly hurts other groceries in the ring, then the egg dies without credit. */
  explodeEgg(e: Enemy): void {
    this.fx.puff(e.x, e.y - 20, 10);
    this.fx.shake(0.005, 140);
    play('pop');
    for (const o of this.enemies) {
      if (o === e || !o.alive || o.state === 'spawn' || o.def.behavior === 'boss') continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < EGG_BLAST.radius + o.def.radius) this.damageEnemy(o, EGG_BLAST.enemyDamage, null, { label: 'Egg Carton' });
    }
    this.killEnemy(e, false);
  }

  killEnemy(e: Enemy, credit: boolean): void {
    if (!e.alive) return;
    e.alive = false;
    e.state = 'dying';
    e.ice?.destroy(); e.ice = undefined; e.frozenT = 0;
    e.tag?.destroy(); e.tag = undefined;
    const tint = ({ milk: 0xfff2d5, banana: 0xf6d24a, soda: 0xe2473f, spitter: 0x7cc4e8, baguette: 0xd9954a, egg: 0xfff2d5, melon: 0x8fcb57, slice: 0xf45f52, turkey: 0xcff3ff, beans: 0xb9895a, cereal: 0xe8b04a, honey: 0xf5bd45, giftcard: 0xf45f52, expired: 0xd5ebdd, gum: 0xff7fb8, boss: 0xf5bd45 } as const)[e.def.id];
    this.fx.puff(e.x, e.y - 24, e.def.behavior === 'boss' ? 14 : 4);
    this.fx.crumbsAt(e.x, e.y - 30, e.def.behavior === 'boss' ? 24 : 7, tint);
    if (e.def.trail && !this.ending) this.gum.drop(0, e.x, e.y, GUM.trapRadiusMult);
    this.tweens.killTweensOf(e.sprite);
    e.sprite.clearTint();
    this.tweens.add({
      targets: e.sprite, scaleX: e.sprite.scaleX * 1.35, scaleY: e.sprite.scaleY * 0.3, alpha: 0, angle: Phaser.Math.Between(-25, 25), duration: 240, ease: 'Back.In',
      onComplete: () => { e.sprite.destroy(); e.shadow.destroy(); this.enemies = this.enemies.filter((x) => x !== e); },
    });
    this.tweens.add({ targets: e.shadow, alpha: 0, duration: 240 });
    if (!credit) return;
    play('enemy_death', { rate: 0.9 + Math.random() * 0.25 });
    const s = store.state;
    s.stats.kills++;
    noteEnemy(s, e.def.id, { elite: e.elite });
    const thief = e.def.id === 'giftcard';
    const coins = thief ? Math.round(e.def.coins * GIFTCARD.coinMult * this.dept.coinMult * MODIFIERS[s.modifier].coinMult * SHIFTS[store.state.shift].coinMult) : e === this.boss
      ? bossTuning(store.state.shift).coins
      : e.mini ? MINI_BOSS.coins
      : killCoins(e.def.coins * (e.elite ? ELITE.coinMult : 1), this.dept.coinMult * MODIFIERS[s.modifier].coinMult * SHIFTS[store.state.shift].coinMult * this.aisleEvent.coinMult() * s.build.killCoinMult, flow.rng);
    // Bosses always pay out in full; regular groceries drop each coin only sometimes.
    for (let i = 0; i < coins; i++) if (thief || e.def.behavior === 'boss' || flow.rng() < ECONOMY.killCoinChance) this.dropCoin(e.x, e.y, enemyT(e.def.id).name);
    const B = DEPT_TUNING.bread;
    if (this.dept.breadHeal && this.breadDropped + B.heal <= B.capPerAisle && flow.rng() < B.chance) {
      this.breadDropped += B.heal;
      this.dropCoin(e.x, e.y, '', true);
    }
    if (s.build.coinChance > 0 && Math.random() < s.build.coinChance) this.dropCoin(e.x, e.y, t('coinCoupon'));
    // Pickpocket Elites cough up everything they absorbed.
    for (let i = 0; i < e.loot; i++) this.dropCoin(e.x, e.y, t('coinStolen'));
    // Splitter Elites leave two small non-elite copies.
    if (e.affix === 'splitter' && !this.ending) {
      for (let i = 0; i < AFFIX.splitter.count; i++) {
        const a = (i / AFFIX.splitter.count) * Math.PI * 2 + Math.random();
        const sp = createEnemy(this, e.def.id, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 9, this.plan.hpScale, this.plan.speedScale, false, this.plan.dmgScale, AFFIX.splitter.scale);
        sp.kx = Math.cos(a) * 240; sp.ky = Math.sin(a) * 240;
        this.enemies.push(sp);
      }
    }
    if (e.def.id === 'melon') {
      for (let i = 0; i < MELON_SLICES; i++) {
        const a = (i / MELON_SLICES) * Math.PI * 2 + Math.random();
        noteEnemy(store.state, 'slice');
        const sl = createEnemy(this, 'slice', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 10, this.plan.hpScale, this.plan.speedScale, false, this.plan.dmgScale);
        sl.kx = Math.cos(a) * 260; sl.ky = Math.sin(a) * 260;
        this.enemies.push(sl);
      }
    }
    if (e === this.boss) this.bossDefeated();
    else if (e === this.mini) this.miniDefeated();
  }

  /** Nearest loose floor coin within `r` (Pickpocket Elites home in on it). */
  coinTarget(x: number, y: number, r: number): { x: number; y: number } | null {
    let best: Coin | null = null, bd = r * r;
    for (const c of this.coins) {
      if (!c.active || c.bread || c.pull || c.z > 4) continue;
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  /** Removes one loose floor coin within `r` of the point; true if one was taken. */
  absorbCoin(x: number, y: number, r: number): boolean {
    for (const c of this.coins) {
      if (!c.active || c.bread || c.pull || c.z > 4) continue;
      if ((c.x - x) ** 2 + (c.y - y) ** 2 > r * r) continue;
      c.active = false; c.img.setVisible(false);
      return true;
    }
    return false;
  }

  private dropCoin(x: number, y: number, label: string, bread = false): void {
    const c = this.coins.find((k) => !k.active);
    if (!c) { if (!bread) addCoins(store.state, 1, label); return; } // pool exhausted: credit directly, never lose money
    c.bread = bread;
    c.img.setTexture(bread ? 'bread_crumb' : 'coin');
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 70;
    Object.assign(c, { active: true, x, y, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 180 + Math.random() * 80, label, pull: false });
    c.img.setVisible(true).setAlpha(1);
  }

  private updateCoins(dt: number): void {
    const p = this.player;
    const radius = store.state.build.pickupRadius;
    this.coinStreakT -= dt;
    if (this.coinStreakT <= 0) this.coinStreak = 0;
    for (const c of this.coins) {
      if (!c.active) continue;
      if (c.z > 0 || c.vz > 0) {
        c.vz -= 700 * dt; c.z = Math.max(0, c.z + c.vz * dt);
        if (c.z === 0) { c.vz = c.vz < -120 ? -c.vz * 0.35 : 0; c.vx *= 0.5; c.vy *= 0.5; }
      }
      const dx = p.x - c.x, dy = p.y - 20 - c.y;
      const d = Math.hypot(dx, dy);
      if (c.pull || d < radius) {
        c.pull = true;
        const sp = 420 + (radius - Math.min(d, radius)) * 3;
        c.vx = (dx / (d || 1)) * sp; c.vy = (dy / (d || 1)) * sp;
      } else {
        const fr = this.hazards.onIce(c.x, c.y) ? 0.6 : 3; // coins skate on ice
        c.vx *= Math.exp(-fr * dt); c.vy *= Math.exp(-fr * dt);
        c.x += this.hazards.beltPush(c.x, c.y) * dt;
      }
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (!c.pull) for (const o of this.obstacles) { const q = pushOutCircle(c.x, c.y, 8, o); if (q) { c.x = q.x; c.y = q.y; c.vx *= -0.3; c.vy *= -0.3; } }
      if (d < 26 && c.pull) {
        c.active = false;
        c.img.setVisible(false);
        if (c.bread) {
          const s = store.state;
          s.hp = Math.min(s.build.maxHp, s.hp + DEPT_TUNING.bread.heal);
          this.fx.number(this.player.x, this.player.y - 90, DEPT_TUNING.bread.heal, '#8FCB57', 20);
          play('buy', { rate: 1.4 });
          store.changed();
          continue;
        }
        addCoins(store.state, 1, c.label);
        this.coinStreak = Math.min(this.coinStreak + 1, 10);
        this.coinStreakT = 0.6;
        play('coin', { rate: 1 + this.coinStreak * 0.04 });
        store.changed();
        continue;
      }
      c.img.setPosition(c.x, c.y - 12 - c.z).setDepth(DEPTH.world + c.y).setScale(0.8 * (0.85 + 0.15 * Math.abs(Math.sin(this.time.now / 160 + c.x))), 0.8);
    }
  }

  hurtPlayer(dmg: number): boolean {
    const p = this.player;
    if (store.state.phase !== 'combat' || this.ending || p.dead) return true;
    if (p.invulnT > 0 || p.protectT > 0 || store.state.labGod) return true;
    const dead = damagePlayer(store.state, dmg);
    p.invulnT = PLAYER.invuln + store.state.build.invulnBonus;
    p.hurtT = 0.45;
    play('hurt');
    this.fx.spark(p.x, p.y - 50, 6, 0xf45f52);
    this.fx.shake(0.004, 110);
    store.changed();
    if (dead) this.playerDied();
    return true;
  }

  enemySwipe(e: Enemy): void {
    const p = this.player;
    const a = Math.atan2(e.dirY, e.dirX);
    const fx = this.add.image(e.x, e.y - 30, 'fx_sweep').setRotation(a + Math.PI).setScale(0.8).setTint(0xd9954a).setDepth(DEPTH.fx - 2);
    this.tweens.add({ targets: fx, alpha: 0, scale: 1.1, duration: 200, onComplete: () => fx.destroy() });
    const near = this.playerNear(e.x, e.y);
    const dx = near.x - e.x, dy = near.y - e.y;
    const d = near.d;
    const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - a));
    if (d < e.def.attackRange + 26 + p.radius && diff < Phaser.Math.DegToRad(e.def.arcDeg / 2 + 10)) this.hurtPlayer(e.def.attackDamage);
  }

  spawnEnemyShot(key: string, x: number, y: number, a: number, speed: number, life: number, damage: number): void {
    this.arsenal.spawnEnemyShot(key, x, y, a, speed, life, damage);
  }

  // ───────────────────────────── main loop ─────────────────────────────

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const s = store.state;
    const now = this.time.now / 1000;
    this.animT += dt;
    const combat = s.phase === 'combat' && !this.ending;

    if (combat) {
      this.waveTime += dt;
      s.stats.timeSeconds += dt;
      this.updatePlayer(dt);
      const regen = s.build.regen + this.aisleEvent.regenBonus();
      if (regen > 0 && s.hp < s.build.maxHp && !this.player.dead) {
        s.hp = Math.min(s.build.maxHp, s.hp + regen * dt);
        if ((this.regenFxT -= dt) <= 0) { this.regenFxT = 1.5; this.fx.spark(this.player.x, this.player.y - 70, 1, 0x8fcb57); }
        if (Math.floor(this.waveTime * 2) !== Math.floor((this.waveTime - dt) * 2)) store.changed();
      }
      this.updateDirector();
      if (this.wave.boss && !this.enraged && this.waveTime > bossTuning(store.state.shift).enrageAfter + 1.6) {
        this.enraged = true;
        showBanner(t('bossFurious'), t('bossFuriousSub'));
      }
      if (!this.wave.boss && !this.miniDue && s.modifier !== 'stockroom' && this.waveTime >= this.wave.duration) this.beginCheckout();
    } else if (s.phase === 'title') {
      this.idleRig(dt);
    }

    for (const e of this.enemies) if (e.state !== 'dying') updateEnemy(this, e, combat || this.ending === 'victory' ? dt : 0, now);
    if (combat) {
      for (const e of this.enemies) if (e.alive && e.state !== 'spawn') e.x += this.hazards.beltPush(e.x, e.y) * dt;
      this.player.x += this.hazards.beltPush(this.player.x, this.player.y) * dt;
      this.clampToArena(this.player, this.player.radius * 2);
      if (this.player.shoveT <= 0) this.pushPlayerOut();
      this.separate();
      this.contactDamage();
    }
    this.arsenal.update(this.ending ? dt : dt, combat && !this.player.dead);
    this.updateCoins(dt);
    this.hazards.update(dt, combat);
    this.aisleEvent.update(dt, combat);
    this.gum.update(dt);
    this.drawOverlays();
    this.syncRig(dt);

    this.hudT -= dt;
    if (this.hudT <= 0 && (s.phase === 'combat')) {
      this.hudT = 0.05;
      hud.tick({
        timeLeft: this.wave.boss || this.miniDue || s.modifier === 'stockroom' ? -1 : Math.max(0, this.wave.duration - this.waveTime),
        elapsed: this.waveTime,
        shoveCd: Math.max(0, this.player.shoveCd), shoveMax: s.build.shoveCooldown,
        boss: this.boss ? { hp: Math.max(0, this.boss.hp), max: this.boss.maxHp, enraged: this.enraged, name: t('managerCaps') }
          : this.mini ? { hp: Math.max(0, this.mini.hp), max: this.mini.maxHp, enraged: false, name: t('miniBossBar', { name: enemyT(this.mini.def.id).name.toUpperCase() }) } : null,
      });
    }
  }

  /** DEV: bot/automation input override. */
  devInput: { x: number; y: number; shove?: boolean } | null = null;

  private input01(): { x: number; y: number } {
    if (import.meta.env.DEV && this.devInput) return this.devInput;
    const k = this.keys;
    let x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    let y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    const l = Math.hypot(x, y);
    if (l > 0) { x /= l; y /= l; }
    return { x, y };
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    const s = store.state;
    p.invulnT -= dt; p.protectT -= dt; p.hurtT -= dt; p.shoveCd -= dt;
    const inp = this.input01();
    if (inp.x !== 0) p.facing = inp.x > 0 ? 1 : -1;

    const devShove = import.meta.env.DEV && this.devInput?.shove;
    if (devShove) this.devInput!.shove = false;
    if ((Phaser.Input.Keyboard.JustDown(this.keys.space) || devShove) && p.shoveCd <= 0 && p.shoveT <= 0) {
      const dx = inp.x || (inp.y ? 0 : p.facing), dy = inp.y;
      const l = Math.hypot(dx, dy) || 1;
      p.shoveDX = dx / l; p.shoveDY = dy / l;
      p.shoveT = PLAYER.shove.time;
      this.shoveMult = this.hazards.onIce(p.x, p.y) ? DEPT_TUNING.ice.shoveMult : 1;
      const reach = PLAYER.shove.distance * this.shoveMult * s.build.shoveDistMult;
      this.vaulting = this.obstacles.some((o) => segmentHitsRect(p.x, p.y, p.x + p.shoveDX * reach, p.y + p.shoveDY * reach, o, p.radius));
      p.shoveCd = s.build.shoveCooldown;
      p.shoveTracker = newHitTracker(Infinity);
      p.shoveHit = false;
      play('shove');
      this.fx.puff(p.x - p.shoveDX * 40, p.y, 3);
    }

    if (p.shoveT > 0) {
      const step = Math.min(dt, p.shoveT);
      p.shoveT -= dt;
      p.x += p.shoveDX * (PLAYER.shove.distance * this.shoveMult * s.build.shoveDistMult / PLAYER.shove.time) * step;
      p.y += p.shoveDY * (PLAYER.shove.distance * this.shoveMult * s.build.shoveDistMult / PLAYER.shove.time) * step;
      p.protectT = Math.max(p.protectT, PLAYER.shove.protect);
      const wall = this.clampToArena(p, p.radius * 2);
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (e.def.radius + p.radius + 24) ** 2) continue;
        if (!tryHit(p.shoveTracker, e.id)) continue;
        p.shoveHit = true;
        this.damageEnemy(e, s.build.shoveDamage, null, { kb: PLAYER.shove.knockback, kbX: p.shoveDX, kbY: p.shoveDY, label: 'shove' });
        if (s.build.shoveStun > 0) { this.stunEnemy(e, s.build.shoveStun); this.fx.ring('fx_pulse', e.x, e.y, 70, 220, 0xf5bd45); }
      }
      if (wall) p.shoveT = 0;
      if (p.shoveT <= 0) {
        // Landing inside a prop? Keep gliding along the dash until clear (then settle against anything left).
        for (let i = 0; i < 80 && this.overlapsObstacle(); i++) { p.x += p.shoveDX * 6; p.y += p.shoveDY * 6; }
        this.clampToArena(p, p.radius * 2);
        this.pushPlayerOut();
        this.vaulting = false;
      }
      if (p.shoveT <= 0 && p.shoveHit && this.arsenal.expressCheckout(Math.atan2(p.shoveDY, p.shoveDX))) {
        play('ding');
        this.fx.popImage('fx_receipt_burst', p.x + p.shoveDX * 50, p.y - 50, 0.9);
      }
    } else {
      const speed = PLAYER.speed * s.build.moveSpeedMult * this.aisleEvent.playerSlow() * this.gum.slow();
      const slip = this.aisleEvent.slipAccel(p.x, p.y);
      if (slip > 0) { // ice: velocity eases toward the input instead of snapping
        const k = Math.min(1, slip * dt);
        p.vx += (inp.x * speed - p.vx) * k;
        p.vy += (inp.y * speed - p.vy) * k;
      } else {
        p.vx = inp.x * speed;
        p.vy = inp.y * speed;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.clampToArena(p, p.radius * 2);
      this.pushPlayerOut();
    }
    setWheel(p.shoveT > 0 ? 1 : Math.hypot(inp.x, inp.y));
  }

  private overlapsObstacle(): boolean {
    const p = this.player, a = -PLAYER.body.back * p.facing, b = PLAYER.body.front * p.facing;
    return this.obstacles.some((o) => pushOutCapsule(p.x, p.y, Math.min(a, b), Math.max(a, b), p.radius, o));
  }

  private separate(): void {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive) continue;
        const r = (a.def.radius + b.def.radius) * 0.9;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > r || Math.abs(dy) > r) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (r - d) / 2;
        const ra = b.def.behavior === 'boss' ? 1.8 : a.def.behavior === 'boss' ? 0.2 : 1;
        a.x -= (dx / d) * push * ra; a.y -= (dy / d) * push * ra;
        b.x += (dx / d) * push * (2 - ra); b.y += (dy / d) * push * (2 - ra);
      }
    }
  }

  /** Closest point of the player's hitbox capsule (goblin → cart) to (x, y). */
  playerNear(x: number, y: number): { x: number; y: number; d: number } {
    const p = this.player, f = p.facing;
    const ax = p.x - PLAYER.body.back * f, bx = p.x + PLAYER.body.front * f;
    const t = Phaser.Math.Clamp((x - ax) / (bx - ax), 0, 1);
    const cx = ax + (bx - ax) * t;
    return { x: cx, y: p.y, d: Math.hypot(x - cx, y - p.y) };
  }

  private contactDamage(): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const r = e.def.radius + p.radius * 0.6;
      const near = this.playerNear(e.x, e.y);
      const dx = e.x - near.x, dy = e.y - near.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r * r) continue;
      const charging = e.state === 'attack' && (e.def.behavior === 'charger' || (e.def.behavior === 'boss' && e.bossMove === 'charge'));
      this.hurtPlayer(e.def.contactDamage + (charging ? 3 : 0));
      // Keep groceries from stacking inside the cart.
      const d = Math.sqrt(d2) || 1;
      if (e.def.behavior !== 'boss') { e.x = near.x + (dx / d) * r; e.y = near.y + (dy / d) * r; }
    }
  }

  private drawOverlays(): void {
    const g = this.telegraphs;
    g.clear();
    for (const e of this.enemies) drawTelegraph(g, e, this);
    const b = this.bars;
    b.clear();
    for (const e of this.enemies) {
      if (!e.alive || e.mini || (!e.elite && (e.hp >= e.maxHp || !SHOW_HP_BAR.includes(e.def.id)))) continue; // mini uses the HUD boss bar
      const w = 40, x = e.x - w / 2, y = e.y - e.sprite.displayHeight - 8;
      b.fillStyle(0x30203f, 0.85).fillRect(x - 2, y - 2, w + 4, 8);
      b.fillStyle(0xf45f52, 1).fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }
    // Elites: pulsing gold ring under the feet.
    for (const e of this.enemies) {
      if (!e.alive || !e.elite) continue;
      const pulse = 0.65 + 0.35 * Math.sin(this.time.now / 160 + e.id);
      const ac = e.affix ? AFFIX[e.affix].color : 0xf5bd45;
      b.fillStyle(ac, 0.2 + 0.1 * pulse).fillEllipse(e.x, e.y + 2, e.def.radius * 2.8, e.def.radius * 1.1);
      b.lineStyle(3, 0xf5bd45, pulse).strokeEllipse(e.x, e.y + 2, e.def.radius * 2.4, e.def.radius * 0.9);
      // Little crown above the affix label.
      const cx = e.x, cy = e.y - e.sprite.displayHeight - 34;
      b.fillStyle(0xf5bd45, 1).fillPoints([{ x: cx - 9, y: cy + 8 }, { x: cx - 9, y: cy - 2 }, { x: cx - 4.5, y: cy + 3 }, { x: cx, y: cy - 5 }, { x: cx + 4.5, y: cy + 3 }, { x: cx + 9, y: cy - 2 }, { x: cx + 9, y: cy + 8 }], true);
      b.lineStyle(1.5, 0x30203f, 1).strokePoints([{ x: cx - 9, y: cy + 8 }, { x: cx - 9, y: cy - 2 }, { x: cx - 4.5, y: cy + 3 }, { x: cx, y: cy - 5 }, { x: cx + 4.5, y: cy + 3 }, { x: cx + 9, y: cy - 2 }, { x: cx + 9, y: cy + 8 }], true);
    }
    // Price Check marks: a little coral price tag above marked groceries.
    const t = this.time.now / 1000;
    for (const e of this.enemies) {
      if (!e.alive || (e.markedUntil ?? 0) <= t) continue;
      const x = e.x, y = e.y - e.sprite.displayHeight - 18;
      b.fillStyle(0xf45f52, 1).fillTriangle(x - 9, y, x + 9, y, x, y + 9);
      b.fillStyle(0xfff2d5, 1).fillCircle(x, y + 2, 2.5);
    }
  }

  private idleRig(dt: number): void {
    const p = this.player;
    p.x = 640 + Math.sin(this.animT * 0.6) * 160;
    p.facing = Math.cos(this.animT * 0.6) > 0 ? 1 : -1;
    void dt;
  }

  private syncRig(dt: number): void {
    const p = this.player;
    const moving = Math.hypot(p.vx, p.vy) > 10 || p.shoveT > 0 || store.state.phase === 'title';
    const { legs, torso, head, arm, wheels, body, accHead, accTorso } = this.parts;
    const bob = moving ? Math.abs(Math.sin(this.animT * 14)) * 3 : Math.sin(this.animT * 3) * 1;
    legs.setTexture(moving && Math.floor(this.animT * 8) % 2 ? sk('goblin_legs_b') : sk('goblin_legs_a'));
    torso.y = -26 - bob * 0.6;
    head.y = -60 - bob;
    if (accHead) accHead.y = head.y;
    if (accTorso) accTorso.y = torso.y;
    arm.y = -48 - bob * 0.6;
    const headTex = p.dead || p.hurtT > 0 ? sk('goblin_head_hurt') : p.shoveT > 0 || p.shoveCd > store.state.build.shoveCooldown - 0.3 ? sk('goblin_head_shove') : sk('goblin_head');
    if (head.texture.key !== headTex) head.setTexture(headTex);
    if (moving) for (const w of wheels) w.rotation += dt * (p.shoveT > 0 ? 30 : 12);
    body.y = moving ? -Math.abs(Math.sin(this.animT * 22)) * 1.2 : 0;
    body.angle = p.shoveT > 0 ? 4 : 0;
    const hop = this.vaulting && p.shoveT > 0 ? Math.sin(Math.PI * (1 - p.shoveT / PLAYER.shove.time)) * 34 : 0;
    this.rig.setPosition(p.x, p.y - hop).setDepth(DEPTH.world + p.y);
    this.rig.scaleX = 0.95 * p.facing;
    this.shadow.setPosition(p.x + p.facing * 4, p.y + 2);
    const blink = p.invulnT > 0 && Math.floor(p.invulnT * 20) % 2 === 0;
    this.rig.setAlpha(blink ? 0.35 : 1);
  }

  // ───────────────────────────── stockroom ─────────────────────────────

  /** Stockroom aisle: no groceries, three crates, three free items; picking one ends the aisle. */
  private openStockroom(): void {
    this.offerCrates(rollStockroom(store.state, flow.rng), undefined, () => { if (!this.ending) this.beginCheckout(); });
  }

  /** Crates + pick-one overlay (stockroom, mid-shift boss loot). `done` runs shortly after the pick. */
  private offerCrates(offers: ShopOffer[], labels: { title: string; hint: string } | undefined, done: () => void): void {
    const crates = Array.from({ length: Math.min(offers.length, ROOMS.stockroom.crates) }, (_, i) => {
      const x = ARENA.w * (0.3 + 0.2 * i), y = 520 + (i === 1 ? -40 : 0);
      return this.add.image(x, y, 'ob_tv_boxes').setOrigin(0.5, 0.9).setDepth(DEPTH.world + y);
    });
    this.time.delayedCall(900, () => showStockroom(offers, (o) => {
      const shelved = takeStockroomItem(store.state, o);
      store.changed();
      play('ding');
      this.fx.label(this.player.x, this.player.y - 90, shelved ? itemT(o.type).name : t('coinStockroom'), '#FFF2D5', 26);
      crates.forEach((c, i) => this.time.delayedCall(80 * i, () => { this.fx.puff(c.x, c.y - 20, 6); c.destroy(); }));
      this.time.delayedCall(1100, done);
    }, labels));
  }

  // ───────────────────────────── endings ─────────────────────────────

  private beginCheckout(): void {
    this.hazards.stop();
    this.aisleEvent.stop();
    this.gum.clear();
    this.ending = 'checkout';
    store.state.phase = 'checkout';
    store.changed();
    showBanner(t('checkoutBanner'), t('checkoutSub'));
    play('ding');
    setWheel(0);
    this.arsenal.clearAll(true);
    this.groups.forEach((g) => (g.done = true));
    const alive = this.enemies.filter((e) => e.alive);
    alive.forEach((e, i) => this.time.delayedCall(40 * i, () => this.killEnemy(e, false))); // no kill credit
    // Coins still on the floor get swept up at the end.
    this.time.delayedCall(Math.max(1700, 40 * alive.length + 900), () => {
      this.coins.forEach((c) => { if (c.active) { c.active = false; c.img.setVisible(false); this.fx.puff(c.x, c.y, 1); if (!c.bread) addCoins(store.state, 1, t('coinSwept')); } });
      flow.endWave();
    });
  }

  private bossDefeated(): void {
    this.hazards.stop();
    this.gum.clear();
    this.ending = 'victory';
    showBanner(t('bossDefeated'), t('bossDefeatedSub'));
    this.fx.shake(0.012, 400);
    if (!settings.reducedMotion) {
      this.tweens.timeScale = 0.35;
      this.time.delayedCall(260, () => (this.tweens.timeScale = 1));
    }
    const b = this.boss!;
    for (let i = 0; i < 6; i++) this.time.delayedCall(120 * i, () => {
      this.fx.popImage('fx_receipt_burst', b.x + Phaser.Math.Between(-80, 80), b.y - Phaser.Math.Between(40, 160), 1);
      this.fx.puff(b.x + Phaser.Math.Between(-60, 60), b.y - 60, 4);
      play('ding', { rate: 1 + i * 0.1 });
    });
    this.arsenal.clearAll(true);
    this.groups.forEach((g) => (g.done = true));
    this.enemies.filter((e) => e.alive).forEach((e) => this.killEnemy(e, false));
    this.time.delayedCall(700, () => this.coins.forEach((c) => (c.pull = c.active)));
    this.time.delayedCall(2200, () => {
      this.coins.forEach((c) => { if (c.active) { c.active = false; c.img.setVisible(false); addCoins(store.state, 1, c.label); } });
      flow.victory();
    });
  }

  private playerDied(): void {
    this.hazards.stop();
    this.aisleEvent.stop();
    this.gum.clear();
    const p = this.player;
    p.dead = true;
    this.ending = 'defeat';
    setWheel(0);
    this.fx.puff(p.x, p.y - 40, 10);
    this.tweens.add({ targets: this.rig, angle: p.facing * 18, y: p.y + 6, duration: 400, ease: 'Bounce.Out' });
    showBanner(t('wipedBanner'), t('wipedSub'));
    this.time.delayedCall(1300, () => flow.defeat());
  }

  // ───────────────────────────── dev only ─────────────────────────────

  private devHooks(): void {
    const w = window as unknown as Record<string, unknown>;
    w.__arena = this;
  }

  /** DEV: end the current wave immediately. */
  devEndWave(): void {
    if (store.state.phase === 'combat' && !this.wave.boss) this.waveTime = this.wave.duration;
  }

  /** DEV: spawn N enemies + fire many projectiles for perf measurement. */
  devStress(n = 70, shots = 150): void {
    for (let i = 0; i < n; i++) {
      const id = (['milk', 'banana', 'soda', 'spitter', 'baguette'] as EnemyId[])[i % 5];
      const e = createEnemy(this, id, Phaser.Math.Between(ARENA.left + 40, ARENA.right - 40), Phaser.Math.Between(ARENA.top + 20, ARENA.bottom - 20), 50, 0.2);
      this.enemies.push(e);
    }
    const st = store.state.build.weapons[0];
    for (let i = 0; i < shots; i++) {
      this.arsenal['spawn']('proj_toast', this.player.x, this.player.y, (i / shots) * Math.PI * 2, 60, 30, 0, st, 999);
    }
  }
}

