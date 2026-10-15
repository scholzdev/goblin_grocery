import Phaser from 'phaser';
import { AFFIX, BOSS, ELITE, MINI_BOSS, ELITE_AFFIXES, ENEMIES, EGG_BLAST, EXPIRED, GIFTCARD, GUM, HONEY, SPITTER, SPLITTER_EXCLUDED, type EliteAffix } from '../data/enemies';
import { bossTuning } from '../data/waves';
import { store } from '../state/store';
import type { EnemyDef, EnemyId } from '../types';
import { healTargets, newStatus, slowFactor, tickBurn, type StatusFx } from '../systems/combat';
import { pushOutCircle } from '../systems/obstacles';
import { lang, t } from '../i18n';
import { play } from '../audio/sfx';
import { DEPTH } from './fx';
import { ARENA, type ArenaScene } from './ArenaScene';

export type EnemyState = 'spawn' | 'walk' | 'tell' | 'attack' | 'recover' | 'stun' | 'dying';
export type BossMove = 'volley' | 'charge' | 'summon';

export interface Enemy {
  id: number;
  def: EnemyDef;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  x: number; y: number;
  kx: number; ky: number;          // knockback velocity
  hp: number; maxHp: number;
  speed: number;
  status: StatusFx;
  state: EnemyState;
  stateT: number;
  atkCd: number;
  dirX: number; dirY: number;      // locked attack direction
  flashT: number;
  animT: number;
  facing: 1 | -1;
  alive: boolean;
  bossMove?: BossMove;
  bossStep?: number;
  lastHitNumberAt: number;
  lastFlashAt: number;
  critCoinDropped?: boolean;
  /** Price Check mark: takes extra damage from everything until this time (s). */
  markedUntil?: number;
  /** Frostbite Nails hit counter. */
  nailHits?: number;
  /** Cereal Box: shots its cardboard front has blocked so far. */
  shieldBlocked?: number;
  /** Elite variant: bigger, tougher, gold-ringed, pays extra. */
  elite: boolean;
  /** Splitter copy: scale factor vs the base type (0 = normal). */
  small: number;
  /** Behavior timer: honey heal / expired blink / gum puddle countdown, giftcard time alive. */
  auxT: number;
  /** Expired Milk blink target. */
  tx: number; ty: number;
  /** Honey Jar tether display. */
  links?: Enemy[]; linkT: number;
  /** Frost set freeze: seconds left + the ice-block overlay while it lasts. */
  frozenT?: number; ice?: Phaser.GameObjects.Graphics;
  /** Elite affix (every Elite has one) + its bookkeeping. */
  affix?: EliteAffix;
  lastHitT: number;                // seconds (scene clock) of the last non-DoT hit, for Tough
  loot: number;                    // Pickpocket: coins absorbed so far
  trailT: number;                  // Swift afterimage timer
  tag?: Phaser.GameObjects.Text;   // affix name above the HP bar
  /** Mid-shift boss (giant themed grocery with Manager moves). */
  mini?: boolean;
}

export const pickAffix = (id: EnemyId): EliteAffix => {
  const pool = ELITE_AFFIXES.filter((a) => a !== 'splitter' || !SPLITTER_EXCLUDED.includes(id));
  return pool[Math.floor(Math.random() * pool.length)];
};

const SCALE: Record<EnemyId, number> = { milk: 0.78, banana: 0.8, soda: 0.72, spitter: 0.78, baguette: 0.8, egg: 0.78, melon: 0.9, slice: 0.5, turkey: 0.8, beans: 0.78, cereal: 0.82, honey: 0.76, giftcard: 0.74, expired: 0.78, gum: 0.76, boss: 0.95 };
const TELL_TEX: Partial<Record<EnemyId, string>> = { banana: 'enemy_banana_tell', spitter: 'enemy_spitter_tell', baguette: 'enemy_baguette_tell', egg: 'enemy_egg_tell', boss: 'boss_tell' };
const frameKey = (id: EnemyId, f: 0 | 1) => (id === 'boss' ? `boss_${f ? 'b' : 'a'}` : `enemy_${id}_${f ? 'b' : 'a'}`);

let nextId = 1;

export function createEnemy(scene: ArenaScene, id: EnemyId, x: number, y: number, hpScale: number, speedScale: number, elite = false, dmgScale = 1, small = 0, mini = false): Enemy {
  const base = ENEMIES[id];
  // Aisle damage scaling and elites get their own def copy so every e.def reader picks it up.
  const dm = dmgScale * (elite ? ELITE.contactMult : 1);
  const def = mini
    // Mid-shift boss: the themed grocery's look with Manager behavior (every boss check keys on behavior).
    ? { ...base, ...MINI_BOSS.def, behavior: 'boss' as const, radius: base.radius * MINI_BOSS.scale, contactDamage: Math.round(base.contactDamage * dm), attackDamage: Math.round(MINI_BOSS.def.attackDamage * dm) }
    : elite || dm !== 1 || small ? { ...base, radius: base.radius * (elite ? ELITE.scale : 1), contactDamage: Math.round(base.contactDamage * dm), attackDamage: Math.round(base.attackDamage * dm) } : base;
  const affix = elite ? pickAffix(id) : undefined;
  // `small` (Splitter copies): scale / HP of the base type; the def copy shrinks the hit radius too.
  const hp = mini ? Math.round(MINI_BOSS.hp * hpScale) : Math.max(1, Math.round(base.hp * hpScale * (elite ? ELITE.hpMult : 1) * (small ? AFFIX.splitter.hpMult : 1)));
  if (small) def.radius = base.radius * small;
  const sprite = scene.add.image(x, y, frameKey(id, 0)).setOrigin(0.5, 0.95).setScale(0);
  const shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.decal).setAlpha(0);
  shadow.setDisplaySize(def.radius * 2.6, def.radius * 0.9);
  const e: Enemy = {
    id: nextId++, def, sprite, shadow, x, y, kx: 0, ky: 0,
    hp, maxHp: hp, elite, affix, lastHitT: -99, loot: 0, trailT: 0, small, speed: def.speed * speedScale * (affix === 'swift' ? AFFIX.swift.speedMult : 1),
    status: newStatus(), state: 'spawn', stateT: 0.3, atkCd: def.attackCooldown * (0.4 + Math.random() * 0.6),
    dirX: 1, dirY: 0, flashT: 0, animT: Math.random(), facing: 1, alive: true, lastHitNumberAt: 0, lastFlashAt: 0,
    auxT: id === 'expired' ? EXPIRED.interval * (0.5 + Math.random() * 0.5) : id === 'honey' ? 0.5 : id === 'gum' ? 0.6 : 0, tx: x, ty: y, linkT: 0,
  };
  if (mini) e.mini = true;
  scene.tweens.add({ targets: sprite, scale: SCALE[id] * (elite ? ELITE.scale : 1) * (small || 1) * (mini ? MINI_BOSS.scale : 1), duration: 260, ease: 'Back.Out' });
  if (affix) {
    e.tag = scene.add.text(x, y, t(`affix_${affix}`), { fontFamily: '"Luckiest Guy", "Arial Black", sans-serif', fontSize: '15px', color: '#' + AFFIX[affix].color.toString(16).padStart(6, '0'), stroke: '#30203F', strokeThickness: 4 })
      .setOrigin(0.5, 1).setDepth(DEPTH.bars + 1).setAlpha(0);
  }
  scene.tweens.add({ targets: shadow, alpha: 1, duration: 200 });
  if (def.behavior === 'boss') { e.bossMove = 'volley'; e.bossStep = 0; e.atkCd = 1.8; }
  return e;
}

/** One simulation step for an enemy. Returns nothing; damage/spawns go through scene helpers. */
export function updateEnemy(scene: ArenaScene, e: Enemy, dt: number, now: number): void {
  if (!e.alive) return;
  const p = scene.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist, ny = dy / dist;
  const slow = slowFactor(e.status, now);
  const speed = e.speed * slow * scene.groundSlow(e) * (e.def.behavior === 'boss' && scene.enraged ? 1.3 : 1);
  let mx = 0, my = 0; // desired move direction

  // Burn ticks at a fixed interval.
  const burn = tickBurn(e.status, now);
  if (burn > 0) {
    scene.damageEnemy(e, burn, null, { isDot: true });
    if (!e.alive) return;
  }
  if (e.status.burnUntil > now && Math.random() < dt * 10) scene.fx.flame(e.x + Phaser.Math.Between(-10, 10), e.y - 30);

  e.stateT -= dt;
  e.atkCd -= dt;
  e.linkT -= dt;
  if (e.affix && e.state !== 'spawn') affixTick(scene, e, dt, now);
  const d = e.def;
  if (d.behavior === 'thief' && e.state !== 'spawn' && (e.auxT += dt) >= GIFTCARD.escapeAfter) {
    scene.fx.puff(e.x, e.y - 24, 6);
    scene.fx.label(e.x, e.y - 80, lang() === 'de' ? 'entwischt!' : 'escaped!', '#FFF2D5', 22);
    play('pop', { rate: 1.4 });
    scene.killEnemy(e, false); // escapes: no credit, no coins, never blocks the wave
    return;
  }

  switch (e.state) {
    case 'spawn':
      if (e.stateT <= 0) e.state = 'walk';
      if (d.behavior === 'boss') return; // drop-in tween owns the sprite
      break;
    case 'walk': {
      let tx = nx, ty = ny;
      if (e.affix === 'pickpocket') { // heads for loose coins first
        const c = scene.coinTarget(e.x, e.y, AFFIX.pickpocket.radius);
        if (c) { const l = Math.hypot(c.x - e.x, c.y - e.y) || 1; tx = (c.x - e.x) / l; ty = (c.y - e.y) / l; }
      }
      const way = d.behavior === 'boss' ? { x: nx, y: ny } : scene.steer(e, d.radius, tx, ty);
      mx = way.x; my = way.y;
      if (d.behavior === 'charger' && e.atkCd <= 0 && dist < d.attackRange) startTell(e, d.tell);
      if (d.behavior === 'swiper' && e.atkCd <= 0 && scene.playerNear(e.x, e.y).d < d.attackRange + p.radius + 10) {
        startTell(e, d.tell); e.dirX = nx; e.dirY = ny; play('swipe_tell');
      }
      if (d.behavior === 'spitter') {
        const pref = d.preferredDistance;
        if (dist < pref - 50) { mx = -nx; my = -ny; }
        else if (dist < pref + 50) { mx = -ny * 0.6; my = nx * 0.6; } // strafe
        if (e.atkCd <= 0 && dist < d.attackRange) startTell(e, d.tell);
      }
      if (d.behavior === 'exploder' && scene.playerNear(e.x, e.y).d < d.attackRange) startTell(e, d.tell);
      if (d.behavior === 'boss') bossThink(scene, e, dist);
      if (d.behavior === 'healer') {
        if (dist < HONEY.keepAway - 40) { mx = -nx; my = -ny; }
        else if (dist < HONEY.keepAway + 40) { mx = -ny * 0.4; my = nx * 0.4; }
        if ((e.auxT -= dt) <= 0) honeyHeal(scene, e);
      }
      if (d.behavior === 'thief') {
        const mxa = clampUnit((ARENA.left + 150 - e.x) / 150) - clampUnit((e.x - (ARENA.right - 150)) / 150);
        const mya = clampUnit((ARENA.top + 110 - e.y) / 110) - clampUnit((e.y - (ARENA.bottom - 110)) / 110);
        const fx = -nx + mxa * 1.8 - ny * 0.5, fy = -ny + mya * 1.8 + nx * 0.5; // away, off the walls, slightly sideways
        const fl = Math.hypot(fx, fy) || 1;
        mx = fx / fl; my = fy / fl;
      }
      if (d.behavior === 'teleporter' && (e.auxT -= dt) <= 0) {
        const spot = blinkSpot(scene);
        e.tx = spot.x; e.ty = spot.y;
        startTell(e, EXPIRED.tell);
        play('swipe_tell', { rate: 1.6 });
      }
      if (d.trail && (e.auxT -= dt) <= 0) {
        e.auxT = GUM.interval;
        if (scene.gum.count(e.id) < GUM.maxPerGum) scene.gum.drop(e.id, e.x, e.y + 2);
      }
      break;
    }
    case 'tell':
      if (d.behavior === 'charger' || (d.behavior === 'boss' && e.bossMove === 'charge')) { e.dirX = nx; e.dirY = ny; }
      if (e.stateT <= 0) { beginAttack(scene, e); if (!e.alive) return; }
      break;
    case 'attack':
      if (d.behavior === 'charger' || (d.behavior === 'boss' && e.bossMove === 'charge')) {
        const ls = d.lungeSpeed * (scene.enraged ? 1.15 : 1);
        e.x += e.dirX * ls * dt; e.y += e.dirY * ls * dt;
        if (d.behavior === 'boss' && Math.random() < dt * 30) scene.fx.puff(e.x - e.dirX * 60, e.y, 1);
        const hitWall = scene.clampToArena(e, d.radius);
        if (e.stateT <= 0 || hitWall) {
          if (d.behavior === 'boss') {
            e.state = 'stun'; e.stateT = scene.halfHp(e) ? 0.75 : 1.1; // readable damage window
            if (hitWall) { scene.fx.shake(0.006, 160); play('boss_hit'); scene.fx.spark(e.x, e.y - 60, 10, 0xf5bd45); }
          } else { e.state = 'recover'; e.stateT = 0.35; }
        }
      } else if (e.stateT <= 0) { e.state = 'recover'; e.stateT = 0.3; }
      break;
    case 'recover':
      if (d.behavior !== 'charger') { mx = nx * 0.3; my = ny * 0.3; }
      if (e.stateT <= 0) e.state = 'walk';
      break;
    case 'stun': {
      const w = d.behavior === 'boss' ? 50 : 14;
      if (Math.random() < dt * 8) scene.fx.spark(e.x + Phaser.Math.Between(-w, w), e.y - e.sprite.displayHeight, 1, 0xf5bd45);
      if (e.stateT <= 0) {
        e.state = 'walk';
        // At half HP the manager chains a volley straight out of a charge.
        if (d.behavior === 'boss' && scene.halfHp(e)) { e.bossMove = 'volley'; startTell(e, d.tell * 0.7); }
      }
      break;
    }
    case 'dying':
      return;
  }

  // Integrate movement + knockback.
  e.x += mx * speed * dt + e.kx * dt;
  e.y += my * speed * dt + e.ky * dt;
  const decay = Math.exp(-9 * dt);
  e.kx *= decay; e.ky *= decay;
  scene.clampToArena(e, d.radius);
  if (d.behavior !== 'boss' && scene.pushEnemyOut(e, d.radius) && e.state === 'attack' && d.behavior === 'charger') {
    e.stateT = 0; e.kx -= e.dirX * 140; e.ky -= e.dirY * 140; // lunge bumps into the prop
  }
  if (Math.abs(mx) > 0.05) e.facing = mx > 0 ? 1 : -1;
  else if (e.state === 'tell' || e.state === 'walk') e.facing = nx > 0 ? 1 : -1;

  // Visuals.
  const moving = Math.abs(mx) + Math.abs(my) > 0.1;
  e.animT += dt * (moving ? 7 * slow : 2);
  const tellTex = TELL_TEX[d.id];
  if (d.behavior === 'teleporter') e.sprite.setAlpha(e.state === 'tell' ? 0.3 + 0.4 * Math.abs(Math.sin(now * 28)) : 1);
  const tex = (e.state === 'tell' || (e.state === 'attack' && d.behavior !== 'chase')) && tellTex ? tellTex : frameKey(d.id, (Math.floor(e.animT) % 2) as 0 | 1);
  if (e.sprite.texture.key !== tex) e.sprite.setTexture(tex);
  const s = SCALE[d.id] * (e.elite ? ELITE.scale : 1) * (e.small || 1) * (e.mini ? MINI_BOSS.scale : 1);
  const squash = e.state === 'tell' ? 0.06 * Math.sin(now * 40) : Math.sin(e.animT * Math.PI) * 0.035;
  e.sprite.setScale(s * e.facing * (1 + squash), s * (1 - squash));
  e.sprite.setPosition(e.x + (e.state === 'tell' ? Math.sin(now * 70) * 1.5 : 0), e.y).setDepth(DEPTH.world + e.y);
  e.shadow.setPosition(e.x, e.y + 2);
  if (e.flashT > 0) {
    e.flashT -= dt;
    if (e.flashT <= 0) e.sprite.clearTint();
  } else if (slow < 1) e.sprite.setTint(0xcfefff);
  else if (e.sprite.isTinted) e.sprite.clearTint();
  if (e.frozenT) updateIce(scene, e, dt);
  if (e.tag) e.tag.setPosition(e.x, e.y - e.sprite.displayHeight - 14).setAlpha(e.state === 'spawn' ? 0 : 1);
}

/** Elite affix upkeep: Swift trail, Tough regen, Pickpocket coin absorption. */
function affixTick(scene: ArenaScene, e: Enemy, dt: number, now: number): void {
  if (e.affix === 'swift') {
    if ((e.trailT -= dt) <= 0 && e.state !== 'dying') {
      e.trailT = 0.09;
      const g = scene.add.image(e.x, e.y, e.sprite.texture.key).setOrigin(0.5, 0.95).setScale(e.sprite.scaleX, e.sprite.scaleY).setTint(AFFIX.swift.color).setAlpha(0.35).setDepth(DEPTH.world + e.y - 1);
      scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }
  } else if (e.affix === 'tough') {
    if (e.hp < e.maxHp && now - e.lastHitT >= AFFIX.tough.idle) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * AFFIX.tough.regenPct * dt);
      if (Math.random() < dt * 2) scene.fx.spark(e.x + Phaser.Math.Between(-10, 10), e.y - 30, 1, AFFIX.tough.color);
    }
  } else if (e.affix === 'pickpocket') {
    while (scene.absorbCoin(e.x, e.y, AFFIX.pickpocket.absorbRadius + e.def.radius)) {
      e.loot++;
      scene.fx.spark(e.x, e.y - 30, 2, 0xf5bd45);
    }
  }
}

/** Frost set: translucent ice block around the sprite while frozen, shatters when it ends. */
function updateIce(scene: ArenaScene, e: Enemy, dt: number): void {
  e.frozenT = Math.max(0, e.frozenT! - dt);
  if (!e.frozenT) { e.ice?.destroy(); e.ice = undefined; scene.fx.frostBurst(e.x, e.y - 20, 6); return; }
  if (!e.ice) {
    const w = e.sprite.displayWidth * 0.9, h = e.sprite.displayHeight * 0.95;
    e.ice = scene.add.graphics();
    e.ice.fillStyle(0xd4ecff, 0.45).fillRoundedRect(-w / 2, -h, w, h + 6, 8).lineStyle(2, 0x2a6aa8, 1).strokeRoundedRect(-w / 2, -h, w, h + 6, 8);
  }
  e.ice.setPosition(e.x, e.y).setDepth(DEPTH.world + e.y + 1);
}

const clampUnit = (v: number): number => Math.min(1, Math.max(0, v));

/** Honey Jar tick: heal nearby groceries and flash a golden tether to each. */
function honeyHeal(scene: ArenaScene, e: Enemy): void {
  e.auxT = HONEY.interval;
  const hits = healTargets(e, scene.enemies);
  if (!hits.length) return;
  for (const h of hits) { h.target.hp += h.amount; scene.fx.spark(h.target.x, h.target.y - 44, 2, 0xf5bd45); }
  scene.fx.spark(e.x, e.y - 40, 3, 0xf5bd45);
  e.links = hits.map((h) => h.target);
  e.linkT = 0.4;
}

/** Where Expired Milk blinks: ~110 px from the player at a random angle, 60+ px clear of props. */
function blinkSpot(scene: ArenaScene): { x: number; y: number } {
  const p = scene.player, a0 = Math.random() * Math.PI * 2;
  let spot = { x: p.x, y: p.y };
  for (let i = 0; i < 12; i++) {
    const a = a0 + (i * Math.PI) / 6;
    const x = Phaser.Math.Clamp(p.x + Math.cos(a) * EXPIRED.ringDist, ARENA.left + 40, ARENA.right - 40);
    const y = Phaser.Math.Clamp(p.y + Math.sin(a) * EXPIRED.ringDist, ARENA.top + 20, ARENA.bottom - 10);
    spot = { x, y };
    if (scene.obstacles.every((o) => !pushOutCircle(x, y, EXPIRED.clearance, o))) break;
  }
  return spot;
}

function startTell(e: Enemy, t: number): void {
  e.state = 'tell';
  e.stateT = t;
}

function beginAttack(scene: ArenaScene, e: Enemy): void {
  const d = e.def;
  e.state = 'attack';
  e.atkCd = d.attackCooldown * (d.behavior === 'boss' ? scene.bossCooldownMult(e) : 1);
  switch (d.behavior) {
    case 'charger': e.stateT = d.lungeTime; break;
    case 'spitter': {
      e.stateT = 0.2;
      const a = Math.atan2(scene.player.y - e.y, scene.player.x - e.x);
      for (let i = 0; i < SPITTER.shots; i++) { // a fan of bubbles: weave through the gaps
        const ai = a + Phaser.Math.DegToRad(SPITTER.spreadDeg) * (i - (SPITTER.shots - 1) / 2);
        scene.spawnEnemyShot('proj_bubble', e.x + Math.cos(ai) * 24, e.y - 34, ai, d.projectileSpeed, d.projectileLife, d.attackDamage);
      }
      play('bubble');
      break;
    }
    case 'exploder': { // self-destruct: no kill credit
      e.stateT = 0;
      if (scene.playerNear(e.x, e.y).d < EGG_BLAST.radius + scene.player.radius * 0.6) scene.hurtPlayer(d.attackDamage);
      scene.explodeEgg(e);
      break;
    }
    case 'swiper': {
      e.stateT = 0.18;
      scene.enemySwipe(e);
      break;
    }
    case 'boss': {
      const T = e.mini ? { ...bossTuning(store.state.shift), ...MINI_BOSS.moves } : bossTuning(store.state.shift);
      if (e.bossMove === 'charge') { e.stateT = d.lungeTime; play('shove', { rate: 0.7 }); }
      else if (e.bossMove === 'volley') {
        e.stateT = 0.3;
        const base = Math.atan2(scene.player.y - e.y, scene.player.x - e.x);
        const n = T.volleyCount + (scene.halfHp(e) ? 2 : 0);
        const spread = Phaser.Math.DegToRad(T.volleySpreadDeg + (scene.halfHp(e) ? 20 : 0));
        for (let i = 0; i < n; i++) {
          const a = base + (i / (n - 1) - 0.5) * spread;
          scene.spawnEnemyShot('proj_receipt', e.x + Math.cos(a) * 50, e.y - e.sprite.displayHeight * 0.48, a, d.projectileSpeed, d.projectileLife, d.attackDamage);
        }
        play('ding', { rate: 0.8 });
      } else {
        e.stateT = 0.3;
        scene.summonMinions(T.summonCount + (scene.halfHp(e) ? 2 : 0));
      }
      break;
    }
    case 'teleporter': { // blink to the ring
      scene.fx.puff(e.x, e.y - 20, 4);
      e.x = e.tx; e.y = e.ty; e.kx = e.ky = 0;
      scene.fx.puff(e.x, e.y - 20, 4);
      play('pop', { rate: 1.5 });
      e.auxT = EXPIRED.interval;
      e.stateT = 0.2;
      break;
    }
    default: e.stateT = 0.2;
  }
}

const BOSS_CYCLE: BossMove[] = ['volley', 'charge', 'summon', 'charge', 'volley', 'summon'];

function bossThink(scene: ArenaScene, e: Enemy, dist: number): void {
  if (e.atkCd > 0) return;
  e.bossStep = ((e.bossStep ?? 0) + 1) % BOSS_CYCLE.length;
  e.bossMove = BOSS_CYCLE[e.bossStep];
  if (e.bossMove === 'charge' && dist < 120) e.bossMove = 'volley';
  startTell(e, e.def.tell * (e.bossMove === 'summon' ? 0.75 : 1));
  play(e.bossMove === 'summon' ? 'ding' : 'swipe_tell', { rate: 0.6 });
  scene.bossBark(e.bossMove);
}

/** Floor telegraphs drawn into the shared graphics layer each frame. */
export function drawTelegraph(g: Phaser.GameObjects.Graphics, e: Enemy, scene: ArenaScene): void {
  if (e.alive && e.linkT > 0 && e.links) { // Honey Jar tether
    g.lineStyle(3, 0xf5bd45, 0.8 * Math.min(1, e.linkT / 0.4));
    for (const t of e.links) if (t.alive) g.lineBetween(e.x, e.y - 34, t.x, t.y - 34);
  }
  if (!e.alive || e.state !== 'tell') return;
  const d = e.def;
  const k = 1 - Math.max(0, e.stateT) / Math.max(0.01, d.tell);
  if (d.behavior === 'charger' || (d.behavior === 'boss' && e.bossMove === 'charge')) {
    const len = d.lungeSpeed * d.lungeTime;
    const w = d.behavior === 'boss' ? 110 : 34;
    const a = Math.atan2(e.dirY, e.dirX);
    const pts = rectPts(e.x, e.y, a, len, w);
    g.fillStyle(0xf45f52, 0.12 + 0.18 * k).fillPoints(pts, true);
    g.lineStyle(3, 0xf45f52, 0.75).strokePoints(pts, true, true);
    if (d.behavior === 'boss') { // conveyor stripes
      for (let i = 1; i < 8; i++) {
        const t = ((i / 8) + scene.time.now / 1200) % 1;
        const cx = e.x + Math.cos(a) * len * t, cy = e.y + Math.sin(a) * len * t;
        const ox = Math.cos(a + Math.PI / 2) * w / 2, oy = Math.sin(a + Math.PI / 2) * w / 2;
        g.lineStyle(4, 0x30203f, 0.35).lineBetween(cx - ox, cy - oy, cx + ox, cy + oy);
      }
    }
  } else if (d.behavior === 'swiper') {
    const a = Math.atan2(e.dirY, e.dirX);
    const half = Phaser.Math.DegToRad(d.arcDeg / 2);
    const r = d.attackRange + 26;
    g.fillStyle(0xf45f52, 0.15 + 0.25 * k);
    g.slice(e.x, e.y, r, a - half, a + half, false).fillPath();
    g.lineStyle(3, 0x30203f, 0.8);
    g.beginPath(); g.slice(e.x, e.y, r, a - half, a + half, false); g.strokePath();
    g.fillStyle(0xf45f52, 0.35).slice(e.x, e.y, r * k, a - half, a + half, false).fillPath();
  } else if (d.behavior === 'exploder') {
    g.fillStyle(0xf45f52, 0.12 + 0.2 * k).fillCircle(e.x, e.y, EGG_BLAST.radius);
    g.fillStyle(0xf45f52, 0.3).fillCircle(e.x, e.y, EGG_BLAST.radius * k);
    g.lineStyle(3, 0xf45f52, 0.8).strokeCircle(e.x, e.y, EGG_BLAST.radius);
  } else if (d.behavior === 'teleporter') { // dashed landing ring, rotating
    g.lineStyle(3, 0x9081b6, 0.9);
    const spin = scene.time.now / 400;
    for (let i = 0; i < 12; i++) {
      const a0 = spin + (i / 12) * Math.PI * 2, a1 = a0 + 0.32;
      g.lineBetween(e.tx + Math.cos(a0) * 34, e.ty + Math.sin(a0) * 14, e.tx + Math.cos(a1) * 34, e.ty + Math.sin(a1) * 14);
    }
    g.fillStyle(0x9081b6, 0.12 + 0.2 * k).fillEllipse(e.tx, e.ty, 68, 28);
  } else if (d.behavior === 'spitter') {
    g.lineStyle(2, 0x3e6fd0, 0.6).strokeCircle(e.x, e.y - 34, 10 + 10 * k);
  } else if (d.behavior === 'boss' && e.bossMove === 'volley') {
    const base = Math.atan2(scene.player.y - e.y, scene.player.x - e.x);
    const spread = Phaser.Math.DegToRad(BOSS.volleySpreadDeg);
    g.lineStyle(3, 0xf45f52, 0.25 + 0.4 * k);
    for (let i = 0; i < 5; i++) {
      const a = base + (i / 4 - 0.5) * spread;
      g.lineBetween(e.x, e.y - 40, e.x + Math.cos(a) * 260, e.y - 40 + Math.sin(a) * 260);
    }
  } else if (d.behavior === 'boss') {
    g.lineStyle(4, 0xf5bd45, 0.5 + 0.4 * k).strokeEllipse(e.x, e.y, 220 * (0.6 + k * 0.4), 80 * (0.6 + k * 0.4));
  }
}

function rectPts(x: number, y: number, a: number, len: number, w: number): Phaser.Math.Vector2[] {
  const c = Math.cos(a), s = Math.sin(a), px = -s * w / 2, py = c * w / 2;
  return [
    new Phaser.Math.Vector2(x + px, y + py), new Phaser.Math.Vector2(x + c * len + px, y + s * len + py),
    new Phaser.Math.Vector2(x + c * len - px, y + s * len - py), new Phaser.Math.Vector2(x - px, y - py),
  ];
}
