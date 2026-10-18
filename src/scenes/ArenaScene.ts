import Phaser from 'phaser';import { t, lang, type UIKey } from '../i18n';
import { deptT, enemyT, itemT } from '../i18n/data';
import { store } from '../state/store';
import { flow } from '../flow';
import { waveDef, eliteChance, bossTuning, ECONOMY, SHIFTS, WAVE_RAMP } from '../data/waves';
import { SHOW_HP_BAR, ENEMIES, ELITE, THEME_SUMMONS, ELITE_EXCLUDED, AFFIX, MINI_BOSS, bossFor, isBossId, type BossMove } from '../data/enemies';
import { GumPuddles } from './gum';
import { CRIT, PLAYER, STARTER_LOOKS } from '../data/items';
import { dashCooldownAfterKill, firstHitCrit } from '../systems/signatures';
import { punchHit, punchKill, punchTick, punchView, rollPunchCard } from '../systems/contracts';
import { isDashHit } from '../engine/hitTags';
import { addCoins, damagePlayer, payPunchCard, takeStockroomItem } from '../state/run';
import { hitArmor, newHitTracker, shredGain, shredStacks, tryHit, weakenedDamage, weakenMult, type HitTracker } from '../systems/combat';
import { isWet, wetElectricMult } from '../engine/wet';
import type { EnemyId, ShopOffer, WaveDef, WeaponStats } from '../types';
import { play, setWheel } from '../audio/sfx';
import { musicFor, playMusic } from '../audio/music';
import { settings } from '../state/settings';
import { hud, showBanner } from '../ui/hud';
import { Fx, DEPTH } from './fx';
import { combatRng, type Rng } from '../systems/rng';
import { clampPoint, spreadPoint, type Pt } from '../systems/spread';
import { EMPTY_HOOKS, buildHooks, type HitEvent, type HitOpts, type HookTable } from '../engine/hooks';
import { applyHitStatuses, scheduleEcho } from '../engine/onHitStatuses';
import { applyKillEffects } from '../engine/onKillEffects';
import { markedDamage } from '../engine/marks';
import type { AppliedStatus } from '../engine/reactions';
import { ELEMENT_COLORS, colorNum, damageType, numberStyle } from '../engine/damageType';
import { recordDamage } from '../systems/damageStats';
import { affinityMult, markMult, resistTag, statusDurationMult, tryStagger, weakTag } from '../engine/affinity';
import { AFFINITY, type AffinityTag } from '../engine/define';
import { hitTags } from '../engine/hitTags';
import { contentSetTune } from '../engine/registry';
import { Enemy as EnemyIds } from '../engine/ids';
import { PhaserCtx } from './phaserCtx';
import { createEnemy, drawTelegraph, updateEnemy, type Enemy } from './enemies';
import { Arsenal } from './weapons';
import { PlayerOverlay } from './playerOverlay';
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
import { giftcardCoins, killCoinMult, killCoins } from '../systems/combat';
import type { DepartmentDef } from '../types';
import { CRATE, DASH_PROPS, OBSTACLES, OBSTACLE_KINDS, PROP_TUNING, crateSpots, type Obstacle } from '../data/obstacles';
import { ZONES, type ZoneDef } from '../data/zones';
import { type Rect, inLane, pushOutCapsule, pushOutCircle, rectsOverlap, segmentHitsRect, steerAround } from '../systems/obstacles';

import { isDown, resetKeyboard, takePressed } from '../input/keyboard';
import { padMove, takePadActive, takePadShove } from '../input/gamepad';
import { activeSlots, fireActives } from '../engine/actives';
import { ARENA, ENTRIES, SIDE_UNITS, DECO_SPOTS, edgeSolids } from '../data/arena';
import { labDummies, type LabDummy } from '../lab';
export { ARENA };


interface Player {
  x: number; y: number; radius: number; facing: 1 | -1;
  vx: number; vy: number;
  invulnT: number; protectT: number; hurtT: number;
  /** Tin Foil Hat: > 0 while dashing and for its grace after (enemy shots reflect). Written by the hat's onDashStart / onTick hooks. */
  reflectT: number;
  shoveT: number; shoveCd: number; chainT: number; springHit: boolean; shoveDX: number; shoveDY: number; shoveTracker: HitTracker; shoveHit: boolean;
  dead: boolean;
  /** Walking-speed multipliers registered by hooks (Sugar Rush, Tailwind), see `PlayerView.speedMods`. */
  speedMods: Record<string, (now: number) => number>;
}

interface Coin { bread: boolean; img: Phaser.GameObjects.Image; active: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; label: string; pull: boolean }

interface SpawnGroup { at: number; ids: EnemyId[]; entry: number; told: boolean; done: boolean }

/** The mix `devStress` spawns. */
const STRESS_ENEMIES: EnemyId[] = [EnemyIds.milk, EnemyIds.banana, EnemyIds.soda, EnemyIds.spitter, EnemyIds.baguette];

export class ArenaScene extends Phaser.Scene {
  player!: Player;
  enemies: Enemy[] = [];
  fx!: Fx;
  arsenal!: Arsenal;
  overlay!: PlayerOverlay;
  enraged = false;
  dept!: DepartmentDef;
  hazards!: Hazards;
  obstacles: Rect[] = [];
  private vaulting = false;
  aisleEvent!: AisleEvents;
  private plan!: ReturnType<typeof waveSpawnPlan>;
  /** Seeded combat rng (run seed + aisle index, see systems/rng.ts), separate from `flow.rng`: every gameplay roll in the arena draws from it. */
  rng!: Rng;
  /** What runtime hooks get to touch (docs/item-hooks-refactor.md §5). */
  ctx!: PhaserCtx;
  /** The runtime content hooks of this aisle's cart, compiled in `create` (empty = every emit is free). */
  hooks: HookTable = EMPTY_HOOKS;
  private breadDropped = 0;

  wave!: WaveDef;
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
  private animT = 0;
  private ending: '' | 'checkout' | 'victory' | 'defeat' = '';
  private boss: Enemy | null = null;
  /** Mid-shift boss while alive; `miniDue` holds the aisle open until its loot is picked. */
  private mini: Enemy | null = null;
  /** Conveyor Kiosk shove: horizontal player push (px/s) and seconds left. */
  bossPush = { v: 0, t: 0 };
  private miniDue = false;
  /** Free Sample heal budget: HP healed by crits in the current second. */
  private coinStreak = 0;
  private coinStreakT = 0;
  gum!: GumPuddles;
  private hudT = 0;
  private shoveMult = 1;
  /** Toast Goblin: uids of the weapons that already landed their first direct hit this aisle. */
  private firstHitDone = new Set<string>();
  /** Props the dash interacts with in this aisle (see DASH_PROPS); `hit` = already toppled / broken. */
  private dashProps: { o: Obstacle; img: Phaser.GameObjects.Image; hit: boolean }[] = [];

  constructor() {
    super('Arena');
  }

  create(): void {
    const s = store.state;
    this.rng = combatRng(s.seed, s.wave);
    this.enemies = [];
    this.groups = [];
    this.coins = [];
    this.markers = [];
    this.props.clear();
    this.enraged = false;
    this.ending = '';
    this.boss = null;
    this.mini = null;
    this.bossPush.t = 0;
    this.miniDue = false;
    this.waveTime = 0;
    this.wave = waveDef(s.wave);
    this.dept = DEPARTMENTS[s.phase === 'title' ? 'main' : s.department];
    this.plan = waveSpawnPlan(s);
    this.breadDropped = 0;
    this.firstHitDone.clear();
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
    this.overlay = new PlayerOverlay(this);
    this.buildPlayer();
    this.arsenal.setBuild(s.build.weapons);
    this.ctx = new PhaserCtx(this);
    this.rebuildHooks();
    for (let i = 0; i < 140; i++) {
      this.coins.push({ bread: false, img: this.add.image(0, 0, 'coin').setVisible(false).setScale(0.8), active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, label: '', pull: false });
    }

    this.events.on(Phaser.Scenes.Events.RESUME, resetKeyboard);

    if (s.phase === 'combat') {
      if (s.labSandbox) this.labSpawnAll(labDummies); else this.planWave();
      playMusic(musicFor(this.dept.id, this.wave.boss, s.modifier));
      const room = s.modifier === 'stockroom' || s.modifier === 'coldRoom' || s.modifier === 'vipAisle' ? s.modifier : null;
      s.punch = s.labSandbox ? undefined : rollPunchCard(s.seed, s.inventory, { aisle: s.wave, boss: this.wave.boss, total: this.plan.total, fight: s.modifier !== 'stockroom' }) ?? undefined; // Punch Card: this aisle's goal
      const goal = s.punch ? t('pcBanner', { goal: t(`pcText_${s.punch.goal}` as UIKey, { n: s.punch.target }) }) : '';
      if (room) showBanner(t(`modName_${room}`), goal || t(`roomSub_${room}`));
      else showBanner(this.wave.boss ? t('finalAisle') : deptT(this.dept.id).name, goal || (this.wave.boss ? t('bossAwaits', { name: enemyT(bossFor(s.theme)).name }) : this.dept.hazard === 'none' ? t('surviveCheckout') : deptT(this.dept.id).blurb));
      if (s.skipped) { hud.bark(t('doorStaffOn', { n: s.skipped })); s.skipped = undefined; } // came through the Staff Only door
      if (s.modifier === 'stockroom' && !this.wave.boss) this.openStockroom();
    }
    if (s.phase === 'combat' && this.hooks.onAisleStart.length) this.hooks.emit('onAisleStart', { aisle: s.wave, boss: this.wave.boss, department: this.dept.id, modifier: s.modifier });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hideStockroom());
    if (import.meta.env.DEV) this.devHooks();
  }

  // ───────────────────────────── environment ─────────────────────────────

  private buildEnvironment(): void {
    const th = this.dept.theme;
    // Floor and dressing extend far past the arena so any screen aspect is filled with store, not bars.
    const PAD = 700;
    this.add.tileSprite(-PAD, -PAD, ARENA.w + PAD * 2, ARENA.h + PAD * 2, th.floor).setOrigin(0).setDepth(DEPTH.floor);
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
    this.dashProps = [];
    this.obstacles = [...layout.filter((o) => DASH_PROPS[o.kind] !== 'spring'), ...edgeSolids(this.dept.theme.props)];
    if (layout.length) store.emit('tut:obstacles');
    for (const o of layout) {
      const img = this.add.image(o.x, o.y + o.h / 2, OBSTACLE_KINDS[o.kind].tex).setOrigin(0.5, 0.9).setDepth(DASH_PROPS[o.kind] === 'spring' ? DEPTH.decal : DEPTH.world + o.y + o.h / 2);
      if (DASH_PROPS[o.kind]) this.dashProps.push({ o, img, hit: false });
    }
  }

  /** The dash ran into a prop: topple cans down the lane, burst a candy display into coins, or ride a spring mat for extra reach. */
  private hitDashProp(dp: { o: Obstacle; img: Phaser.GameObjects.Image; hit: boolean }): void {
    const p = this.player, kind = DASH_PROPS[dp.o.kind], { x, y } = dp.o;
    if (kind === 'spring') {
      if (p.springHit) return;
      p.springHit = true;
      p.shoveT += PROP_TUNING.spring.bonusTime;
      play('ding', { rate: 1.5 });
      this.fx.puff(x, y, 3);
      return;
    }
    dp.hit = true;
    this.obstacles = this.obstacles.filter((o) => o !== dp.o);
    dp.img.destroy();
    this.fx.shake(0.003, 90);
    if (kind === 'break') {
      play('boom', { volume: 0.5 });
      this.fx.crumbsAt(x, y - 20, 12, 0xf45f52);
      for (let i = 0; i < PROP_TUNING.break.coins; i++) this.dropCoin(x, y, t('coinDisplay'));
      return;
    }
    const T = PROP_TUNING.topple;
    play('boom', { volume: 0.6 });
    for (let i = 0; i <= 5; i++) this.fx.crumbsAt(x + p.shoveDX * T.length * i / 5, y + p.shoveDY * T.length * i / 5, 3, 0x8fcb57);
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn' || !inLane(x, y, p.shoveDX, p.shoveDY, T.length, T.halfWidth, e.x, e.y, e.def.radius)) continue;
      this.damageEnemy(e, T.damage, null, { kb: T.knockback, kbX: p.shoveDX, kbY: p.shoveDY, label: 'Can Pyramid' });
    }
  }

  /** Dash landing: the onDashEnd hooks (Slam Bumper shockwave, then the combos: Pot Slam blast, then Express Checkout's bonus sweep). */
  private dashLanding(): void {
    const p = this.player;
    if (this.hooks.onDashEnd.length) this.hooks.emit('onDashEnd', { x: p.x, y: p.y, dx: p.shoveDX, dy: p.shoveDY, hit: p.shoveHit });
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
      reflectT: 0, shoveT: 0, shoveCd: 0, chainT: 0, springHit: false, shoveDX: 1, shoveDY: 0, shoveTracker: newHitTracker(Infinity), shoveHit: false, dead: false, speedMods: {},
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
    const shown = this.chooseProps(s.build.weapons, s.build.recipes.flatMap((r) => [...(r.weaponUid ? [r.weaponUid] : []), ...r.supportUids]));
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
    const id = bossFor(store.state.theme);
    noteEnemy(store.state, id);
    const e = createEnemy(this, id, 640, 330, SHIFTS[store.state.shift].bossHpMult, 1, false, this.plan.dmgScale);
    e.state = 'spawn';
    e.stateT = 1.2;
    e.sprite.setY(-100); // createEnemy's grow-in tween still scales it up on the way down
    this.tweens.add({ targets: e.sprite, y: 330, duration: 700, ease: 'Bounce.Out', onComplete: () => { this.fx.shake(0.01, 250); this.fx.puff(640, 330, 10); play('boss_hit'); } });
    this.enemies.push(e);
    this.boss = e;
    showBanner(enemyT(id).name.toUpperCase(), t('watchFloor'));
  }

  /** Mid-shift boss: a giant grocery from the run's theme drops in; the aisle ends when it falls. */
  private spawnMini(): void {
    if (this.ending) return;
    const v = MINI_BOSS.variants[Math.floor(flow.rng() * MINI_BOSS.variants.length)];
    const id = v.byTheme[store.state.theme] ?? v.byTheme.main!;
    const e = createEnemy(this, id, 640, 330, SHIFTS[store.state.shift].bossHpMult, 1, false, this.plan.dmgScale, 0, v);
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
    if (this.ending) return; // died in the same frame: defeat wins
    this.hazards.stop();
    this.aisleEvent.stop();
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
    this.time.delayedCall(600, () => this.pullCoins());
    this.time.delayedCall(1300, () => this.offerCrates(rollMiniCrates(store.state, flow.rng), { title: t('miniCratesTitle'), hint: t('miniCratesHint') }, () => {
      this.miniDue = false;
      this.ending = '';
      this.beginCheckout();
    }));
  }

  summonMinions(n: number, types: EnemyId[] = bossTuning(store.state.shift).summonTypes): void {
    const entries = [this.pickEntry(), this.pickEntry()];
    for (let k = 0; k < 2; k++) {
      const ids = Array.from({ length: Math.ceil(n / 2) }, () => {
        const pool = flow.rng() < 0.5 ? THEME_SUMMONS[store.state.theme] ?? types : types;
        return pool[Math.floor(flow.rng() * pool.length)];
      });
      this.groups.push({ at: this.waveTime + 0.8, ids, entry: entries[k], told: true, done: false });
      this.tellEntry(entries[k]);
    }
  }

  bossBark(move: BossMove, e: Enemy): void {
    const id = e.def.id;
    const key: UIKey = e.mini ? { volley: 'miniVolley', charge: 'miniCharge', summon: 'miniSummon', special: 'miniSummon' }[move] as UIKey
      : id === EnemyIds.boss ? { volley: 'bossVolley', charge: 'bossCharge', summon: 'bossSummon', special: 'bossSummon' }[move] as UIKey
      : `bk_${id}_${move}` as UIKey; // per-boss lines (i18n bk_<boss id>_<move>)
    hud.bark(t(key));
  }

  /** Stun from hazards. The boss shrugs it off to keep its patterns readable. */
  private regenFxT = 0;

  /** Leaf Blower slam: a blown grocery stopped by the arena edge or a prop takes impact damage once. */
  slamEnemy(e: Enemy): void {
    const dmg = e.blownDmg ?? 0;
    e.blownUntil = 0; // the slam lands once; a slide goes on (no steering) until `slideUntil`
    this.fx.puff(e.x, e.y - 10, 2);
    this.fx.spark(e.x, e.y - 30, 4, 0xcfefff);
    this.fx.shake(0.003, 80);
    this.damageEnemy(e, dmg, null, { label: 'Slam', tags: ['cleaning'] }); // the Leaf Blower's slam
  }

  /** Ice Sheet: shoves a grocery away from the goblin and marks it as blown, so the Leaf Blower's slam (`slamEnemy`) lands when it stops at a wall, a prop or another enemy. Bosses are immune. */
  slideEnemy(e: Enemy, seconds: number, slam: number, speed: number): number {
    if (!e.alive || e.def.behavior === 'boss') return 0;
    const now = this.time.now / 1000, dx = e.x - this.player.x, dy = e.y - this.player.y, d = Math.hypot(dx, dy) || 1;
    const k = 1 - e.def.knockbackResist;
    e.kx = (dx / d) * speed * k; e.ky = (dy / d) * speed * k;
    e.slideUntil = now + seconds; e.blownUntil = now + seconds; e.blownDmg = slam;
    e.slideTouch = new Set(this.enemies.filter((o) => o !== e && o.alive && Math.hypot(o.x - e.x, o.y - e.y) < o.def.radius + e.def.radius).map((o) => o.id)); // already in contact: not a collision
    return seconds;
  }

  /**
   * Stun from hazards and hooks. The boss shrugs it off to keep its patterns readable (see `staggerEnemy`). `tag` is the element of a frost or
   * electric stun: the time scales with the enemy's affinity (engine/affinity). Returns the seconds applied, 0 if refused.
   */
  stunEnemy(e: Enemy, t: number, tag?: AffinityTag, bossSeconds = 0): number {
    if (!e.alive) return 0;
    if (e.def.behavior === 'boss') { // only a walking boss can be stunned, and only for the cap: it must not cut a tell or attack short
      if (bossSeconds <= 0 || e.state !== 'walk') return 0;
      e.state = 'stun';
      e.stateT = Math.max(e.stateT, bossSeconds);
      e.staggered = true;
      return bossSeconds;
    }
    const dur = t * statusDurationMult(e.def, tag);
    e.state = 'stun';
    e.stateT = Math.max(e.stateT, dur);
    return dur;
  }

  /**
   * Weakness stagger: a boss (or mini-boss) knocked out of its walk for `AFFINITY.stagger.time`. Bypasses the boss guard of `stunEnemy`, which stays
   * for every other stun. The caller (`damageEnemy`) already checked `tryStagger`: walking only, the cooldown, a weak-tag hit. `staggered` keeps the
   * half-HP volley chain of a charge recovery from firing when it ends.
   */
  staggerEnemy(e: Enemy, tag: AffinityTag | null): void {
    if (!e.alive || e.state !== 'walk') return;
    e.state = 'stun';
    e.stateT = Math.max(e.stateT, AFFINITY.stagger.time);
    e.staggered = true;
    this.fx.label(e.x, e.y - e.sprite.displayHeight - 30, t('weakFlash'), tag ? ELEMENT_COLORS[tag] : '#FFF2D5', 24);
    this.fx.ring('fx_pulse', e.x, e.y, 120, 220, tag ? colorNum(ELEMENT_COLORS[tag]) : 0xffffff);
    play('cap_ping', { rate: 1.2, volume: 0.6 });
  }

  /** A status the pattern code applied directly (a burning pool's tick) reports it here, so the element reactions see it like a `ctx.ignite` (engine/reactions). */
  reactionApplied(e: Enemy, kind: AppliedStatus): void { this.ctx.reactor.applied(e, kind); }

  /** Every coin on the floor flies to the goblin (the end-of-aisle sweep, also Vacuum's Full Suck). */
  pullCoins(): void { this.coins.forEach((c) => (c.pull = c.active)); }

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
      const k = e.def.id === EnemyIds.honey ? d * 0.25 : d; // Honey Jars are priority targets
      if (k < bd) { bd = k; best = e; }
    }
    return best;
  }

  /** Compile the runtime content hooks of the current cart. Called in `create`; call again if the placed cart or recipes change mid-aisle. */
  rebuildHooks(): void {
    const s = store.state;
    this.hooks = buildHooks(s.inventory, s.build.recipes, s.build.sets, this.ctx);
    this.arsenal.applyLooks(); // the weapons' cosmetics come from the same hooks (`pattern:look`)
  }

  /** Integer in [min, max] from the combat rng (the seeded stand-in for Phaser.Math.Between). */
  rngBetween(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  clampToArena(o: { x: number; y: number }, r: number): boolean {
    const x = Phaser.Math.Clamp(o.x, ARENA.left + r * 0.5, ARENA.right - r * 0.5);
    const y = Phaser.Math.Clamp(o.y, ARENA.top, ARENA.bottom);
    const hit = x !== o.x || y !== o.y;
    o.x = x; o.y = y;
    return hit;
  }

  damageEnemy(e: Enemy, dmg: number, stats: WeaponStats | null, o: HitOpts): void {
    if (!e.alive) return;
    const now = this.time.now / 1000;
    const s = store.state;
    const H = this.hooks;
    const key = o.poison ? 'poison' : o.isDot ? 'burn' : stats?.uid ?? o.label ?? 'shove';
    // DAMAGE PIPELINE, in this order (runtime hooks slot into it, docs/item-hooks-refactor.md §4c):
    //   1. modifyDamage hooks   pre-crit, pre-armor: multiply hit.dmg (Five-Alarm Toast, order 10)
    //   2. element affinity (engine/affinity): x (1 + best weak - best resist) of the hit's tags (engine/hitTags) against this enemy
    //   (a reaction's own burst, `o.reaction`, takes a short path: the affinity and the mark, no modifyDamage, wet bonus, crit, armor, onHit, statuses, afterHit, stagger)
    //   2b. Wet: x WET_STATUS.electricMult when the hit carries `electric` and the enemy is wet (systems/combat wetElectricMult), same slot as the affinity
    //   3. the mark rule (engine/marks): x Price Check's damageMult while marked, for every source (Sale Flag marks too); the Manager's is bigger
    //   4. crit roll (combat rng): dmg x CRIT.mult, then onCrit hooks (Free Sample, then the Clearance Sale coin)
    //   5. armor (direct hits only), hp -= dmg, damageByWeapon
    //   6. onHit hooks, then applyHitStatuses (engine/onHitStatuses: burn, ignite, slow), afterHit hooks (the sets: Frost freeze, Cleaning
    //      knockback mult, Electric chain), the element reactions (engine/reactions: the statuses this hit applied and the hit itself, checked once), the boss weakness stagger, knockback, flash/number fx, scheduleEcho (Double Bag)
    //   7. kill: killEnemy (coins; onKill hooks fire inside it, after the bread drop: Coupon, Bag It's charge) -> afterKill hooks (the sets:
    //      Kitchen heal, Blast pop) -> applyKillEffects (engine/onKillEffects: Party Popper)
    // A hook runs before the engine lines of its slot.
    // The payload is one small object per hit; the engine modules (statuses, echo, kill effects) read it, the emits are guarded by `H.hit`.
    const tags = hitTags(stats, o);
    const hit: HitEvent = { enemy: e, base: dmg, dmg, stats, opts: o, source: key, now, tags, direct: !o.isDot && !o.echo && !o.fromPopper && !o.chained && !o.reaction, crit: false, armored: false, killed: false, kbMult: 1 };
    const rx = !!o.reaction, open = this.ctx.reactor.begin(e, o); // rx: a reaction's own burst (never crits, never reacts again)
    if (H.hit && !rx) { H.emit('modifyDamage', hit); dmg = hit.dmg; }
    const aff = affinityMult(e.def, tags); // element soft counters: after Five-Alarm (a modifyDamage hook), before the mark and the crit roll
    dmg *= aff;
    if (!rx) dmg *= wetElectricMult(e.status, tags, now); // Wet: an electric hit on a wet enemy, x WET_STATUS.electricMult, right after the affinity (before the mark and the crit)
    const unmarked = dmg;
    dmg = markedDamage(dmg, e.markedUntil, now, markMult(e.def)); // Price Check / Sale Flag mark
    const markBonus = dmg - unmarked;
    // Crits resolve here and only here (never on burn ticks).
    const rolled = !o.isDot && !rx && !!stats && stats.critChance > 0 && this.rng() < stats.critChance;
    // Toast Goblin: a weapon's first direct hit of the aisle always crits (after the roll, so the combat rng stream is the same for every goblin).
    const first = !!stats && !o.isDot && !rx && !o.echo && !o.fromPopper && !o.chained && firstHitCrit(store.state.starter, this.firstHitDone, stats.uid);
    const crit = rolled || first;
    if (crit) {
      dmg *= CRIT.mult;
      this.fx.popImage('fx_crit', e.x + Phaser.Math.Between(-10, 10), e.y - e.sprite.displayHeight - 6, 0.8);
      play('crit');
      hit.crit = true; hit.dmg = dmg;
      if (H.hit) { H.emit('onCrit', hit); dmg = hit.dmg; }
    }
    // Armor (Canned Beans, plated elites) and Shred: direct hits only; burn, puddles, auras and cones (isDot/quiet) pass through; the vacuum pulse is armored.
    // Shred stacks (engine/define SHRED) take armor off, and below zero they add damage (systems/combat shreddedArmorDamage).
    const soaked = hitArmor(e, dmg, o, now), armored = soaked < dmg * 0.5, shredBonus = shredGain(e, dmg, soaked, o);
    dmg = soaked;
    hit.dmg = dmg; hit.armored = armored;
    e.hp -= dmg;
    if (!o.isDot) e.lastHitT = now;
    // The breakdown (systems/damageStats) and the number's colour read the same facts: the display type, weak (aff > 1) or resisted (aff < 1).
    const wk = aff > 1 ? weakTag(e.def, tags) : null, rs = aff < 1 ? resistTag(e.def, tags) : null;
    const type = damageType(tags, e.def, { isDot: o.isDot, poison: o.poison, reaction: rx });
    recordDamage(s.stats, { source: key, dmg, type, isDot: !!o.isDot, weak: aff > 1, resisted: aff < 1, shred: shredBonus, mark: markBonus });
    hit.killed = e.hp <= 0;
    if (!rx) {
      if (H.hit) H.emit('onHit', hit);
      applyHitStatuses(hit, this.ctx); // burn, Heat L2 ignite, slow (stats-driven, shared by every source)
      if (H.afterHit.length) H.emit('afterHit', hit); // the sets: Frost freeze (needs the slow just applied), Cleaning knockback mult + spritz, Electric chain
      this.ctx.reactor.end(open, { dmg, tags }); // element reactions: the statuses applied above and this hit's own tags (engine/reactions)
    }
    if (e.def.behavior === 'boss' && e.hp > 0 && !o.isDot && !rx && tryStagger(e, tags, (e.markedUntil ?? 0) > now, now)) this.staggerEnemy(e, weakTag(e.def, tags, (e.markedUntil ?? 0) > now)); // a boss hit on its weak tag: a brief stagger (walk only, cooldown)
    if (o.kb) {
      const k = o.kb * (1 - e.def.knockbackResist) * (this.hazards.onIce(e.x, e.y) ? DEPT_TUNING.ice.knockbackMult : 1) * hit.kbMult;
      e.kx += (o.kbX ?? 0) * k * 3; e.ky += (o.kbY ?? 0) * k * 3;
      if (o.blow) { e.blownUntil = now + 0.6; e.blownDmg = o.blow; } // Leaf Blower: marked until it stops against a wall or prop
    }
    if (!o.isDot && !o.quiet) {
      // Short flash with a re-trigger gap so constant fire never leaves a sprite solid white.
      if (now - e.lastFlashAt > 0.16) {
        e.lastFlashAt = now;
        e.flashT = 0.06;
        if (e.def.behavior === 'boss') e.sprite.setTint(0xffb8ae); else e.sprite.setTintFill(0xffffff);
      }
      this.fx.spark(e.x, e.y - 30, 3, armored ? 0xaab2c2 : (stats && this.arsenal.looks.get(stats.uid)?.hitSpark) ?? 0xffffff);
      if (armored) { this.fx.label(e.x, e.y - e.sprite.displayHeight - 10, lang() === 'de' ? '-Panzer' : '-armor', '#AAB2C2', 16); play('cap_ping', { rate: 0.7 }); }
      if (e.def.behavior === 'boss') play('boss_hit');
    }
    if (crit || rx || now - e.lastHitNumberAt > 0.14 || dmg >= 10) {
      e.lastHitNumberAt = now;
      // The damage type's colour (engine/damageType; the "Damage colors" setting off keeps the old scheme): weak a size up and brighter, resisted a size down at half alpha, a crit big with the bold outline.
      const st = numberStyle({ type, crit, isDot: !!o.isDot, poison: !!o.poison, weak: wk, resisted: rs }, settings.damageColors);
      this.fx.number(e.x, e.y - e.sprite.displayHeight * 0.9, dmg, st.color, st.size, st);
    }
    scheduleEcho(hit, this.ctx); // Double Bag (stats.echo): one delayed second strike per direct hit
    if (e.dummy?.immortal && e.hp <= 0) e.hp = e.maxHp; // lab sandbox: unkillable dummies refill
    if (e.hp <= 0 && e.alive) { // (a reaction's burst on this very enemy may already have killed it)
      this.killEnemy(e, true, hit);
      if (H.afterKill.length) H.emit('afterKill', { enemy: e, hit }); // the sets: Kitchen L2 heal, then Blast L2 pop (in that order: both roll)
      applyKillEffects(hit, this.ctx); // Party Popper (stats.popper): kills explode; popper kills never pop again
    }
  }

  /** Kitchen L2 heal: a heart flies from the kill to the goblin, then the +N pops. */
  healHeartFx(x: number, y: number): void {
    const h = this.add.text(x, y, '♥', { fontFamily: 'Arial, sans-serif', fontSize: '26px', color: '#F45F52', stroke: '#30203F', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.fx);
    const k = { v: 0 };
    this.tweens.add({
      targets: k, v: 1, duration: 350, ease: 'Quad.In',
      onUpdate: () => h.setPosition(x + (this.player.x - x) * k.v, y + (this.player.y - 60 - y) * k.v).setScale(1 - 0.4 * k.v),
      onComplete: () => { h.destroy(); this.fx.number(this.player.x, this.player.y - 90, contentSetTune('kitchen', 1).heal, '#8FCB57', 20); play('ding', { rate: 1.3, volume: 0.6 }); },
    });
  }

  /** Electric set: one jagged bolt through the chain, fades out fast. */
  arcFx(pts: readonly { x: number; y: number }[]): void {
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
      if (Math.hypot(o.x - e.x, o.y - e.y) < ENEMIES.egg.tune.radius + o.def.radius) this.damageEnemy(o, ENEMIES.egg.tune.enemyDamage, null, { label: 'Egg Carton', tags: ['blast'] });
    }
    this.killEnemy(e, false);
  }

  killEnemy(e: Enemy, credit: boolean, hit: HitEvent | null = null): void {
    if (!e.alive) return;
    e.alive = false;
    e.state = 'dying';
    e.ice?.destroy(); e.ice = undefined; e.frozenT = 0;
    e.tag?.destroy(); e.tag = undefined;
    const tint = ({ milk: 0xfff2d5, banana: 0xf6d24a, soda: 0xe2473f, spitter: 0x7cc4e8, baguette: 0xd9954a, egg: 0xfff2d5, melon: 0x8fcb57, slice: 0xf45f52, turkey: 0xcff3ff, beans: 0xb9895a, cereal: 0xe8b04a, honey: 0xf5bd45, sanitizer: 0xbfe8ff, giftcard: 0xf45f52, expired: 0xd5ebdd, gum: 0xff7fb8, boss: 0xf5bd45, boss_frozen: 0xcff3ff, boss_bakery: 0xd9954a, boss_electronics: 0x7cc4e8, boss_checkout: 0x3fb7a6 } as const)[e.def.id];
    this.fx.puff(e.x, e.y - 24, e.def.behavior === 'boss' ? 14 : 4);
    this.fx.crumbsAt(e.x, e.y - 30, e.def.behavior === 'boss' ? 24 : 7, tint);
    if (e.def.trail && !this.ending) this.gum.drop(0, e.x, e.y, ENEMIES.gum.tune.trapRadiusMult);
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
    const dashKill = !!hit && isDashHit(hit.opts);
    if (s.punch && punchKill(s.punch, { tags: hit?.tags ?? [], dash: dashKill, elite: e.elite })) this.punchDone();
    this.player.shoveCd = dashCooldownAfterKill(s.starter, this.player.shoveCd, dashKill); // Night Shift
    const thief = e.def.id === EnemyIds.giftcard;
    const mults = { dept: this.dept.coinMult, modifier: MODIFIERS[s.modifier].coinMult, shift: SHIFTS[store.state.shift].coinMult, event: this.aisleEvent.coinMult(), kill: s.build.killCoinMult };
    const coins = thief ? giftcardCoins(e.def.coins, ENEMIES.giftcard.tune.coinMult, mults) : e === this.boss
      ? bossTuning(store.state.shift).coins
      : e.mini ? MINI_BOSS.coins
      : killCoins(e.def.coins * (e.elite ? ELITE.coinMult : 1), killCoinMult(mults), flow.rng);
    // Bosses always pay out in full; regular groceries drop each coin only sometimes.
    for (let i = 0; i < coins; i++) if (thief || e.def.behavior === 'boss' || flow.rng() < ECONOMY.killCoinChance) this.dropCoin(e.x, e.y, enemyT(e.def.id).name);
    const B = DEPT_TUNING.bread;
    if (this.dept.breadHeal && this.breadDropped + B.heal <= B.capPerAisle && flow.rng() < B.chance) {
      this.breadDropped += B.heal;
      this.dropCoin(e.x, e.y, '', true);
    }
    // onKill hooks (Coupon Book ...): after the regular coins and bread, before the Pickpocket loot, so a hook that rolls keeps its rng draw position.
    if (this.hooks.onKill.length) this.hooks.emit('onKill', { enemy: e, hit });
    // Pickpocket Elites cough up everything they absorbed.
    for (let i = 0; i < e.loot; i++) this.dropCoin(e.x, e.y, t('coinStolen'));
    // Splitter Elites leave two small non-elite copies.
    if (e.affix === 'splitter' && !this.ending) {
      for (let i = 0; i < AFFIX.splitter.count; i++) {
        const a = (i / AFFIX.splitter.count) * Math.PI * 2 + this.rng();
        const sp = createEnemy(this, e.def.id, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 9, this.plan.hpScale, this.plan.speedScale, false, this.plan.dmgScale, AFFIX.splitter.scale);
        sp.kx = Math.cos(a) * 240; sp.ky = Math.sin(a) * 240;
        this.enemies.push(sp);
      }
    }
    if (e.def.id === EnemyIds.melon) {
      for (let i = 0; i < ENEMIES.melon.tune.slices; i++) {
        const a = (i / ENEMIES.melon.tune.slices) * Math.PI * 2 + this.rng();
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

  /** Dev bot: the coins and bread crumbs on the floor (including the ones already flying to the player). */
  pickups(): { x: number; y: number; bread: boolean; pull: boolean }[] {
    return this.coins.filter((c) => c.active);
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

  dropCoin(x: number, y: number, label: string, bread = false): void {
    const c = this.coins.find((k) => !k.active);
    if (!c) { if (!bread) addCoins(store.state, 1, label); return; } // pool exhausted: credit directly, never lose money
    c.bread = bread;
    c.img.setTexture(bread ? 'bread_crumb' : 'coin');
    const a = this.rng() * Math.PI * 2;
    const sp = 40 + this.rng() * 70;
    Object.assign(c, { active: true, x, y, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 180 + this.rng() * 80, label, pull: false });
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
        if (this.hooks.onCoinPickup.length) this.hooks.emit('onCoinPickup', { label: c.label, streak: this.coinStreak });
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
    // Hooks may lower `dmg` and change the i-frames (Bubble Wrap: armor and +0.25 s).
    let invuln = PLAYER.invuln;
    if (this.hooks.onPlayerHit.length) { const ev = { dmg, invuln }; this.hooks.emit('onPlayerHit', ev); dmg = ev.dmg; invuln = ev.invuln; }
    const dead = damagePlayer(store.state, dmg);
    if (store.state.punch) punchHit(store.state.punch);
    p.invulnT = invuln;
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
    if (d < e.def.attackRange + 26 + p.radius && diff < Phaser.Math.DegToRad(e.def.arcDeg / 2 + 10)) this.hurtPlayer(this.enemyDmg(e, e.def.attackDamage));
  }

  /**
   * What `e`'s attack of `dmg` does to the player right now: its Weaken applied at the source (docs/item-hooks-refactor.md "Weaken"). Every enemy damage to the goblin
   * goes through here before `hurtPlayer` (contact, swipe, egg blast, the boss strikes), and a shot gets it as its `damage` when it is FIRED, so it keeps the
   * value for the whole flight. Hazards and events call `hurtPlayer` with their own damage, untouched.
   */
  enemyDmg(e: Enemy, dmg: number): number { return weakenedDamage(e, dmg, this.time.now / 1000); }

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
      if (this.hooks.onTick.length) this.hooks.emit('onTick', dt);
      if (s.punch && punchTick(s.punch, dt, this.timeLeft()) === 'done') this.punchDone();
      if (!s.labSandbox) this.updateDirector();
      if (this.wave.boss && !s.labSandbox && !this.enraged && this.waveTime > bossTuning(store.state.shift).enrageAfter + 1.6) {
        this.enraged = true;
        const bid = this.boss?.def.id;
        showBanner(!bid || bid === EnemyIds.boss ? t('bossFurious') : t('bossFuriousN', { name: enemyT(bid).name.toUpperCase() }), t('bossFuriousSub'));
      }
      if (this.mini && !this.enraged && this.waveTime > MINI_BOSS.at + MINI_BOSS.enrageAfter) {
        this.enraged = true; // `enraged` speeds up every boss-behavior enemy; only the giant is one here
        showBanner(t('miniFurious', { name: enemyT(this.mini.def.id).name }), t('bossFuriousSub'));
      }
      if (!this.wave.boss && !this.miniDue && !s.labSandbox && s.modifier !== 'stockroom' && this.waveTime >= this.wave.duration) this.beginCheckout();
    } else if (s.phase === 'title') {
      this.idleRig(dt);
    }

    for (const e of this.enemies) if (e.state !== 'dying') updateEnemy(this, e, combat || this.ending === 'victory' ? dt : 0, now);
    if (combat) {
      for (const e of this.enemies) if (e.alive && e.state !== 'spawn') e.x += this.hazards.beltPush(e.x, e.y) * dt;
      this.player.x += this.hazards.beltPush(this.player.x, this.player.y) * dt;
      if (this.bossPush.t > 0) { this.bossPush.t -= dt; this.player.x += this.bossPush.v * dt; }
      this.clampToArena(this.player, this.player.radius * 2);
      if (this.player.shoveT <= 0) this.pushPlayerOut();
      this.separate();
      this.contactDamage();
    }
    this.arsenal.update(this.ending ? dt : dt, combat && !this.player.dead);
    this.overlay.update(dt, now, combat && !this.player.dead);
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
        timeLeft: this.timeLeft(),
        elapsed: this.waveTime,
        actives: activeSlots(s.inventory).map((a) => ({ type: a.inst.type, left: a.left, max: a.max })),
        shoveCd: this.player.chainT > 0 ? 0 : Math.max(0, this.player.shoveCd), shoveMax: s.build.shoveCooldown,
        boss: this.boss ? { hp: Math.max(0, this.boss.hp), max: this.boss.maxHp, enraged: this.enraged, name: enemyT(this.boss.def.id).name.toUpperCase() }
          : this.mini ? { hp: Math.max(0, this.mini.hp), max: this.mini.maxHp, enraged: this.enraged, name: t('miniBossBar', { name: enemyT(this.mini.def.id).name.toUpperCase() }) } : null,
      });
      hud.contract(s.punch ? punchView(s.punch) : null);
    }
  }

  /** Seconds left on the aisle clock, or -1 when this aisle has none (boss, mini-boss, stockroom, sandbox). */
  private timeLeft(): number {
    const s = store.state;
    return this.wave.boss || this.miniDue || s.labSandbox || s.modifier === 'stockroom' ? -1 : Math.max(0, this.wave.duration - this.waveTime);
  }

  /** Punch Card goal met: coins now (the receipt lists them), the free reroll comes with the shop. */
  private punchDone(): void {
    payPunchCard(store.state);
    if (store.state.punch) hud.contract(punchView(store.state.punch)); // gold now, not on the next HUD tick
    hud.bark(t('pcDone'));
    play('ding');
    play('buy', { rate: 1.2 });
    this.fx.spark(this.player.x, this.player.y - 60, 10, 0xf5bd45);
    store.changed();
  }

  /** DEV: bot/automation input override. */
  devInput: { x: number; y: number; shove?: boolean } | null = null;

  private input01(): { x: number; y: number } {
    if (import.meta.env.DEV && this.devInput) return this.devInput;
    let x = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
    let y = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
    const l = Math.hypot(x, y);
    if (l > 0) { x /= l; y /= l; }
    const pad = padMove(); // analog stick/d-pad, merged with the keyboard and clamped to length 1
    if (pad.x || pad.y) {
      x += pad.x; y += pad.y;
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
    }
    return { x, y };
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    const s = store.state;
    p.invulnT -= dt; p.protectT -= dt; p.hurtT -= dt; p.shoveCd -= dt; p.chainT -= dt;
    const inp = this.input01();
    if (inp.x !== 0) p.facing = inp.x > 0 ? 1 : -1;

    const keyActive = takePressed('useActive'), padActive = takePadActive();
    if ((keyActive || padActive) && fireActives(s.inventory, this.ctx)) this.fx.shake(0.002, 90);

    const devShove = import.meta.env.DEV && this.devInput?.shove;
    if (devShove) this.devInput!.shove = false;
    const padShove = takePadShove(), keyShove = takePressed('shove');
    if ((keyShove || padShove || devShove) && (p.shoveCd <= 0 || p.chainT > 0) && p.shoveT <= 0) {
      const dx = inp.x || (inp.y ? 0 : p.facing), dy = inp.y;
      const l = Math.hypot(dx, dy) || 1;
      p.shoveDX = dx / l; p.shoveDY = dy / l;
      p.shoveT = PLAYER.shove.time;
      this.shoveMult = this.hazards.onIce(p.x, p.y) ? DEPT_TUNING.ice.shoveMult : 1;
      const reach = PLAYER.shove.distance * this.shoveMult * s.build.shoveDistMult;
      this.vaulting = this.obstacles.some((o) => segmentHitsRect(p.x, p.y, p.x + p.shoveDX * reach, p.y + p.shoveDY * reach, o, p.radius));
      // A dash inside the chain window is free (the running cooldown stays as it was). Every dash closes the window; Spare Wheel's
      // onDashStart hook (below) opens a new one after a normal dash.
      const chained = p.shoveCd > 0;
      p.chainT = 0;
      if (!chained) p.shoveCd = s.build.shoveCooldown;
      if (this.hooks.onDashStart.length) this.hooks.emit('onDashStart', { x: p.x, y: p.y, dx: p.shoveDX, dy: p.shoveDY, reach, chained });
      p.springHit = false;
      p.shoveTracker = newHitTracker(Infinity);
      p.shoveHit = false;
      play('shove');
      this.fx.puff(p.x - p.shoveDX * 40, p.y, 3);
    }

    if (p.shoveT > 0) {
      const step = Math.min(dt, p.shoveT), ox = p.x, oy = p.y;
      p.shoveT -= dt;
      p.x += p.shoveDX * (PLAYER.shove.distance * this.shoveMult * s.build.shoveDistMult / PLAYER.shove.time) * step;
      p.y += p.shoveDY * (PLAYER.shove.distance * this.shoveMult * s.build.shoveDistMult / PLAYER.shove.time) * step;
      p.protectT = Math.max(p.protectT, PLAYER.shove.protect);
      const wall = this.clampToArena(p, p.radius * 2);
      for (const dp of this.dashProps) {
        if (!dp.hit && (rectsOverlap({ x: p.x, y: p.y, w: 0, h: 0 }, dp.o, p.radius) || segmentHitsRect(ox, oy, p.x, p.y, dp.o, p.radius))) this.hitDashProp(dp);
      }
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (e.def.radius + p.radius + 24) ** 2) continue;
        if (!tryHit(p.shoveTracker, e.id)) continue;
        p.shoveHit = true;
        this.damageEnemy(e, s.build.shoveDamage, null, { kb: PLAYER.shove.knockback * s.build.shoveKnockMult, kbX: p.shoveDX, kbY: p.shoveDY, label: 'shove' });
        if (this.hooks.onDashHit.length) this.hooks.emit('onDashHit', { enemy: e, dx: p.shoveDX, dy: p.shoveDY, dmg: s.build.shoveDamage });
        // (Sale Flag's mark, Tip Jar's coin roll and the Tools set's stun are onDashHit hooks.)
      }
      if (wall) p.shoveT = 0;
      if (p.shoveT <= 0) {
        // Landing inside a prop? Keep gliding along the dash until clear (then settle against anything left).
        for (let i = 0; i < 80 && this.overlapsObstacle(); i++) { p.x += p.shoveDX * 6; p.y += p.shoveDY * 6; }
        this.clampToArena(p, p.radius * 2);
        this.pushPlayerOut();
        this.vaulting = false;
      }
      if (p.shoveT <= 0) this.dashLanding();
    } else {
      let speed = PLAYER.speed * s.build.moveSpeedMult;
      for (const k in p.speedMods) speed *= p.speedMods[k](this.time.now / 1000); // Sugar Rush, Tailwind: registered by their hooks
      speed *= this.aisleEvent.playerSlow();
      speed *= this.gum.slow();
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
      this.hurtPlayer(this.enemyDmg(e, e.def.contactDamage + (charging ? 3 : 0)));
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
    // Shred: one steel-and-orange diamond per stack beside the health bar's left end (stacks are -1 armor each, up to SHRED.cap).
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const n = shredStacks(e.status, t);
      if (!n) continue;
      const y = e.y - e.sprite.displayHeight - 6;
      for (let i = 0; i < n; i++) {
        const x = e.x - 20 - 9 - i * 9;
        const pts = [{ x, y: y - 5 }, { x: x + 5, y }, { x, y: y + 5 }, { x: x - 5, y }];
        b.fillStyle(0xf5a13d, 1).fillPoints(pts, true);
        b.lineStyle(1.5, 0x30203f, 1).strokePoints(pts, true);
      }
    }
    // Weaken: a lavender down-arrow right of the health bar (the enemy hits you for less), the mirror of the shred diamonds on the left.
    for (const e of this.enemies) {
      if (!e.alive || weakenMult(e.status, t) >= 1) continue;
      const x = e.x + 20 + 10, y = e.y - e.sprite.displayHeight - 6;
      const pts = [{ x: x - 3, y: y - 6 }, { x: x + 3, y: y - 6 }, { x: x + 3, y: y - 1 }, { x: x + 7, y: y - 1 }, { x, y: y + 7 }, { x: x - 7, y: y - 1 }, { x: x - 3, y: y - 1 }];
      b.fillStyle(0x9081b6, 1).fillPoints(pts, true);
      b.lineStyle(1.5, 0x30203f, 1).strokePoints(pts, true);
    }
    // Wet: three blue droplets dripping down the enemy's body (cosmetic, driven by the clock; the status itself does nothing on its own).
    for (const e of this.enemies) {
      if (!e.alive || !isWet(e.status, t)) continue;
      const top = e.y - e.sprite.displayHeight * 0.75;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 1.4 + i / 3) % 1, x = e.x + (i - 1) * 11, y = top + ph * e.sprite.displayHeight * 0.55;
        b.fillStyle(0x4e9bff, 1 - ph * 0.7).fillTriangle(x - 2.6, y, x + 2.6, y, x, y - 6);
        b.fillCircle(x, y + 0.5, 2.8);
      }
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
    // Footprints dodge props and the start; the art is anchored like an obstacle (bottom edge of the footprint).
    const crates = crateSpots(this.obstacles, Math.min(offers.length, ROOMS.stockroom.crates)).map((c) => {
      const y = c.y + CRATE.h / 2;
      return this.add.image(c.x, y, OBSTACLE_KINDS.tv_boxes.tex).setOrigin(0.5, 0.9).setDepth(DEPTH.world + y);
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
    const bid = this.boss!.def.id;
    showBanner(bid === EnemyIds.boss ? t('bossDefeated') : t('bossDefeatedN', { name: enemyT(bid).name.toUpperCase() }), t('bossDefeatedSub'));
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
    if (store.state.labSandbox) this.labDrag();
  }

  /** Lab sandbox: grab a dummy with the mouse and drop it anywhere in the arena. */
  private labDrag(): void {
    let held: Enemy | null = null, dx = 0, dy = 0;
    const pin = (p: Phaser.Input.Pointer) => {
      if (!held?.alive) { held = null; return; }
      held.x = p.worldX + dx; held.y = p.worldY + dy; held.kx = held.ky = 0;
      this.clampToArena(held, held.def.radius);
    };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const body = (e: Enemy) => Math.hypot(e.x - p.worldX, e.y - e.sprite.displayHeight * 0.4 - p.worldY); // aim at the sprite, not the feet
      held = this.enemies.filter((e) => e.alive && e.dummy && body(e) < Math.max(e.def.radius, e.sprite.displayWidth * 0.5))
        .sort((a, b) => body(a) - body(b))[0] ?? null;
      if (held) { dx = held.x - p.worldX; dy = held.y - p.worldY; this.input.setDefaultCursor('grabbing'); }
    });
    this.input.on('pointermove', pin);
    const tick = () => { if (held) pin(this.input.activePointer); }; // walking dummies stay pinned while held
    this.events.on('update', tick);
    this.events.once('shutdown', () => this.events.off('update', tick));
    this.input.on('pointerup', () => { held = null; this.input.setDefaultCursor('default'); });
  }

  /** Lab sandbox: spawn every dummy. Plain ones land at random spots; sim dummies with a `place` follow their cluster / ring / fixed spot. */
  private labSpawnAll(ds: LabDummy[]): void {
    const centers = new Map<number, Pt>();
    const box = { left: ARENA.left, right: ARENA.right, top: ARENA.top, bottom: ARENA.bottom };
    for (const d of ds) {
      const pl = d.place;
      if (!pl) { this.labSpawn(d); continue; }
      if (pl.spread === 'random') {
        this.labSpawn(d, pl.at && clampPoint({ x: pl.at[0] + this.rngBetween(-60, 60), y: pl.at[1] + this.rngBetween(-40, 40) }, box, 40));
        continue;
      }
      let c = centers.get(pl.group);
      if (!c) {
        if (pl.at) c = { x: pl.at[0], y: pl.at[1] };
        else if (pl.spread === 'ring') c = { x: this.player.x, y: this.player.y };
        else c = this.labSpot(160, 120);
        centers.set(pl.group, c);
      }
      this.labSpawn(d, clampPoint(spreadPoint(pl.spread, pl.slot, pl.of, c), box, 40));
    }
  }

  /** Random spot at least 240px from the player, `mx`/`my` away from the arena edge (the dummy default is 80/40). */
  private labSpot(mx = 80, my = 40): Pt {
    let x = 0, y = 0;
    for (let i = 0; i < 10; i++) {
      x = this.rngBetween(ARENA.left + mx, ARENA.right - mx);
      y = this.rngBetween(ARENA.top + my, ARENA.bottom - my);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 240) break;
    }
    return { x, y };
  }

  /** Lab sandbox: spawn one dummy away from the player (or at `pos`). Never this.boss/this.mini, so its death ends nothing. */
  labSpawn(d: LabDummy, pos?: Pt): void {
    const s = store.state;
    const { x, y } = pos ?? this.labSpot();
    const big = isBossId(d.id) || d.mini !== undefined;
    const e = createEnemy(this, d.id, x, y, big ? SHIFTS[s.shift].bossHpMult : this.plan.hpScale, big ? 1 : this.plan.speedScale, !!d.affix, this.plan.dmgScale, 0, d.mini === undefined ? null : MINI_BOSS.variants[d.mini], d.affix === 'elite' ? undefined : d.affix);
    e.dummy = d;
    this.enemies.push(e);
  }

  /** Lab sandbox: remove every enemy (dummies and whatever they summoned), no credit. */
  labDespawn(): void {
    this.enemies.filter((e) => e.alive).forEach((e) => this.killEnemy(e, false));
    labDummies.length = 0;
  }

  /** Lab sandbox: remember the alive dummies so the next arena respawns them. */
  labKeepDummies(): void {
    labDummies.splice(0, labDummies.length, ...this.enemies.filter((e) => e.alive && e.dummy).map((e) => e.dummy!));
  }

  /** DEV: end the current wave immediately. */
  devEndWave(): void {
    if (store.state.phase === 'combat' && !this.wave.boss) this.waveTime = this.wave.duration;
  }

  /** DEV: spawn N enemies + fire many projectiles for perf measurement. */
  devStress(n = 70, shots = 150): void {
    for (let i = 0; i < n; i++) {
      const id = STRESS_ENEMIES[i % STRESS_ENEMIES.length];
      const e = createEnemy(this, id, Phaser.Math.Between(ARENA.left + 40, ARENA.right - 40), Phaser.Math.Between(ARENA.top + 20, ARENA.bottom - 20), 50, 0.2);
      this.enemies.push(e);
    }
    const st = store.state.build.weapons[0];
    for (let i = 0; i < shots; i++) {
      this.arsenal['spawn']('proj_toast', this.player.x, this.player.y, (i / shots) * Math.PI * 2, 60, 30, 0, st, 999);
    }
  }
}

