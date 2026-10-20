import { ENTRIES, ARENA, PLAYER_START } from '../data/arena';
import { DEPARTMENTS, DEPT_TUNING } from '../data/departments';
import { AFFIX, BOSS, BOSS_KITS, ELITE, ELITE_AFFIXES, ELITE_EXCLUDED, ENEMIES, MINI_BOSS, SPLITTER_EXCLUDED, THEME_SUMMONS, affixArmor, bossFor, miniBossDef, type EliteAffix, type MiniVariant } from '../data/enemies';
import { MODIFIERS, ROOMS } from '../data/modifiers';
import { ECONOMY, SHIFTS, WAVE_RAMP, bossTuning, eliteChance, waveDef } from '../data/waves';
import { PLAYER } from '../data/items';
import { Enemy } from '../engine/ids';
import { FakeCtx } from '../engine/fakeCtx';
import { buildHooks } from '../engine/hooks';
import { FakeArsenal } from '../engine/patterns/fakeHost';
import type { BossKit, BossMove } from '../engine/define';
import type { CombatEnemy } from '../engine/ctx';
import { applyWeaken, cleanseAura, giftcardCoins, healTargets, killCoinMult, killCoins, slowFactor, tickBurn, tickPoison, weakenedDamage } from '../systems/combat';
import { totalDamage, type DamageStats } from '../systems/damageStats';
import { combatRng, type Rng } from '../systems/rng';
import { waveSpawnPlan } from '../systems/shop';
import { addCoins } from '../state/run';
import type { EnemyDef, EnemyId, RunState } from '../types';

// The build-lab combat proxy (docs/buildlab.md). One aisle played headless: the real weapon patterns, statuses, reactions, armor, affinity and
// item hooks run on a FakeCtx; the real wave plan, elites, affixes, mini-boss and boss are spawned; enemy AI is replaced by a small model
// (walk to the cart, then attack) whose damage is turned into discrete hits through the real player hit path (FakeCtx.hurt: i-frames, onPlayerHit
// hooks such as Bubble Wrap). Everything tunable lives in PROXY.

export const PROXY = {
  /** Fixed step (s). The arena runs at the display rate (capped at 20 fps worth of dt); 0.05 keeps the weapons' cadence honest and a run fast. */
  dt: 0.05,
  /**
   * Contact: at most one attempt per i-frame window (`contactInterval`) when enemies touch the cart; each of the first `contactCap` touching
   * enemies lands it with this chance. A real player kites, dashes and steps out of reach, so a stationary cart that took every attempt (1.0) would
   * die in seconds. It is the knob of overall difficulty; see docs/buildlab.md for how it was set.
   */
  exposure: 0.015,
  /** The telegraphed melee attacks (baguette swipe, egg blast, a boss charge) are dodged less often than a walker's touch: they land with this chance. */
  attackExposure: 0.1,
  /** A kiting player is touched by only a few bodies at once: only this many touching enemies roll per window, however big the crowd. */
  contactCap: 3,
  /** Bosses (the mini-boss and the Manager) are slow, telegraphed and kited: their exposure (contact, charge, shots) is this share of the normal one. */
  bossExposureMult: 0.5,
  /** Per enemy projectile that reaches the cart (they are slow and readable: dodging them is the main skill of the game). */
  shotExposure: 0.05,
  /** Seconds between contact attempts (= PLAYER.invuln, the player's i-frames after a hit). */
  contactInterval: PLAYER.invuln,
  /** Extra reach (px) of the cart hitbox: a capsule 42 px behind to 46 px ahead of the goblin; an enemy touches it from about this much further than a point. */
  contactReach: 30,
  /** Spread (rad, +/-) of the angle around the cart at which an enemy stops to attack, so a group forms a crescent instead of one point. */
  angleJitter: 0.9,
  /** A boss "special" move (slush, ring, lanes, belt) is modelled as a volley of this many shots. */
  specialShots: 6,
  /** Bosses charge: the lunge lands its hit with `attackExposure` and leaves the boss stunned this long (s; the real window is 1.1, or 0.75 under half HP). */
  chargeStun: 1.1,
  /** An aisle that only ends when its boss dies (mini-boss, final boss) counts as lost (the cart is ground down) after this many seconds. */
  bossCap: 150,
  /** `mode: 'clear'` (diagnostics, tests): the extra seconds after the aisle length a fight may run to measure the time-to-clear. */
  clearOvertime: 30,
};

export type AisleKind = 'fight' | 'mini' | 'boss';

export interface AisleDamage extends DamageStats {
  /** Damage per source: the weapon's item id, or `burn` / `poison` / a label (Party Popper, Egg Carton ...). */
  bySource: Record<string, number>;
}

export interface AisleResult {
  aisle: number;
  kind: AisleKind;
  department: string;
  modifier: string;
  /** Simulated seconds. */
  seconds: number;
  /** Enemies that entered the aisle (splits and summons included). */
  spawned: number;
  /** Kills that paid out. */
  kills: number;
  /** Alive when the aisle ended (swept without credit), the boss excluded. */
  leftover: number;
  /** Gift Cards that got away. */
  escaped: number;
  /** When the last enemy of the plan died, or null if some were still alive at the end ("wipe pressure"). */
  clearTime: number | null;
  /** Everything that spawned died. */
  cleared: boolean;
  hpBefore: number;
  hpAfter: number;
  /** HP lost to enemies (after i-frames, Bubble Wrap etc.). */
  damageTaken: number;
  /** Coins earned (kills, hooks), all assumed picked up. */
  coins: number;
  dealt: number;
  dps: number;
  died: boolean;
  /** A boss aisle hit PROXY.bossCap without the boss dying (counts as dying). */
  stalled: boolean;
  miniDefeated: boolean;
  bossDefeated: boolean;
  damage: AisleDamage;
}

export interface AisleOpts {
  /** `game` (default): the aisle ends like the real one (length passed, or the boss dies). `clear`: runs until everything is dead (diagnostics). */
  mode?: 'game' | 'clear';
  /** Test hook: every enemy starts with this Weaken (share of its damage removed) for the whole aisle. */
  weaken?: number;
  /** Test hook: spawn these instead of the wave plan (no director, no mini-boss; the aisle ends when they are all dead). */
  only?: { id: EnemyId; count: number; hpScale?: number }[];
}

interface Group { at: number; ids: EnemyId[]; entry: number; told: boolean; done: boolean }

interface Foe {
  e: CombatEnemy & { shieldBlocked?: number };
  d: EnemyDef;
  affix?: EliteAffix;
  mini?: MiniVariant;
  kit?: BossKit;
  small: number;
  speed: number;
  ang: number;
  stop: number;
  atkCd: number;
  /** > 0 while winding up an attack (tell). */
  tellT: number;
  aux: number;
  lastHp: number;
  idle: number;
  bossStep: number;
  bossMove: BossMove;
  /** Removed without kill credit (escaped, exploded, aisle over). */
  noCredit: boolean;
  done: boolean;
}

const isBoss = (f: Foe): boolean => f.d.behavior === 'boss';
const SPIT = ENEMIES.spitter.tune, EGG = ENEMIES.egg.tune, HONEY = ENEMIES.honey.tune, GIFT = ENEMIES.giftcard.tune, SANI = ENEMIES.sanitizer.tune;

/** Port of scenes/enemies.ts `pickAffix` (that module imports Phaser). */
const pickAffix = (id: EnemyId, rng: Rng): EliteAffix => {
  const pool = ELITE_AFFIXES.filter((a) => a !== 'splitter' || !SPLITTER_EXCLUDED.includes(id));
  return pool[Math.floor(rng() * pool.length)];
};
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Play one aisle of `state` (its build, hp, aisle number, department, modifier). Mutates `state`: hp, kills, coins, damage totals; `flow` is the run's shop/spawn rng. */
export function playAisle(state: RunState, flow: Rng, opts: AisleOpts = {}): AisleResult {
  const mode = opts.mode ?? 'game';
  const wave = waveDef(state.wave), dept = DEPARTMENTS[state.department], plan = waveSpawnPlan(state);
  const mod = MODIFIERS[state.modifier], shift = SHIFTS[state.shift], boss = wave.boss;
  const build = state.build;
  const fake = new FakeCtx({ seed: state.seed, aisle: state.wave, build, hp: state.hp, maxHp: build.maxHp, boss, player: { x: PLAYER_START.x, y: PLAYER_START.y } });
  fake.attach(buildHooks(state.inventory, build.recipes, build.sets, fake));
  const arsenal = new FakeArsenal(fake, build);
  fake.arsenal = arsenal;
  arsenal.electricalRate = dept.electricalRate;
  arsenal.applyLooks();
  if (fake.hooks.onAisleStart.length) fake.hooks.emit('onAisleStart', { aisle: state.wave, boss, department: dept.id, modifier: state.modifier });
  const lab = combatRng(state.seed ^ 0x1ab5, state.wave); // spots and exposure rolls: a stream of its own, so the weapons' crit rolls do not depend on the damage model
  const px = PLAYER_START.x, py = PLAYER_START.y;
  const mults = { dept: dept.coinMult, modifier: mod.coinMult, shift: shift.coinMult, event: 1, kill: build.killCoinMult };

  const foes: Foe[] = [];
  let waveTime = 0, spawned = 0, kills = 0, escaped = 0, coins = 0, damageTaken = 0, breadDropped = 0;
  let enraged = false, miniDue = false, miniDefeated = false, bossDefeated = false;
  const ref: { boss: Foe | null; mini: Foe | null } = { boss: null, mini: null };
  const hpBefore = fake.run.hp;

  // ── the wave plan (ArenaScene.planWave, same draw order) ──
  const groups: Group[] = [];
  const ids = Object.keys(plan.mix) as EnemyId[];
  const weights = ids.map((id) => plan.mix[id]!);
  const sum = weights.reduce((a, b) => a + b, 0);
  const pick = (): EnemyId => {
    let r = flow() * sum;
    for (let i = 0; i < ids.length; i++) if ((r -= weights[i]) <= 0) return ids[i];
    return ids[0];
  };
  let bossAt = -1, miniAt = -1;
  if (!opts.only) {
    const sizes: number[] = [];
    let left = plan.total;
    while (left > 0) {
      const n = Math.min(left, wave.group[0] + Math.floor(flow() * (wave.group[1] - wave.group[0] + 1)));
      sizes.push(n);
      left -= n;
    }
    const start = boss ? 4 : 1.2, end = boss ? 14 : wave.duration - 6;
    sizes.forEach((n, i) => {
      const u = (i / Math.max(1, sizes.length - 1)) ** (boss ? 1 : WAVE_RAMP.densityPow);
      const at = start + u * (end - start) + (flow() - 0.5) * 0.6;
      groups.push({ at, ids: Array.from({ length: n }, pick), entry: -1, told: false, done: false });
    });
    if (boss) bossAt = 1.6;
    if (wave.index === MINI_BOSS.aisle && state.modifier !== 'stockroom') { miniDue = true; miniAt = MINI_BOSS.at; }
  }
  const kind: AisleKind = boss ? 'boss' : miniDue ? 'mini' : 'fight';

  const pickEntry = (): number => {
    const far = ENTRIES.map((e, i) => ({ i, d: Math.hypot(e.x - px, e.y - py) })).filter((e) => e.d > 320);
    const pool = far.length ? far : ENTRIES.map((_, i) => ({ i, d: 0 }));
    return pool[Math.floor(flow() * pool.length)].i;
  };
  const ramp = (amount: number): number => (boss ? 1 : 1 + amount * Math.min(1, wave.index / WAVE_RAMP.fullAtWave) * Math.min(1, waveTime / wave.duration));

  // ── enemies (scenes/enemies.ts createEnemy) ──
  const createFoe = (id: EnemyId, x: number, y: number, hpScale: number, speedScale: number, elite = false, dmgScale = 1, small = 0, mini: MiniVariant | null = null): Foe => {
    const base = ENEMIES[id];
    const dm = dmgScale * (elite ? ELITE.contactMult : 1);
    const affix = elite ? pickAffix(id, () => fake.rng()) : undefined;
    const d: EnemyDef = mini ? miniBossDef(base, mini, dm)
      : elite || dm !== 1 || small ? { ...base, radius: base.radius * (elite ? ELITE.scale : 1), contactDamage: Math.round(base.contactDamage * dm), attackDamage: Math.round(base.attackDamage * dm), ...(affix === 'plated' ? { armor: affixArmor(base.armor, affix) } : {}) } : { ...base };
    const hp = mini ? Math.round(MINI_BOSS.hp * hpScale) : Math.max(1, Math.round(base.hp * hpScale * (elite ? ELITE.hpMult : 1) * (small ? AFFIX.splitter.hpMult : 1)));
    if (small) d.radius = base.radius * small;
    const e = fake.spawnEnemy({
      x, y, hp, maxHp: hp, elite,
      def: { id, radius: d.radius, behavior: d.behavior, knockbackResist: d.knockbackResist, ...(d.armor ? { armor: d.armor } : {}), ...(d.weak ? { weak: d.weak } : {}), ...(d.resist ? { resist: d.resist } : {}), ...(d.shield ? { shield: true } : {}) } as CombatEnemy['def'],
    }) as Foe['e'];
    if (opts.weaken) applyWeaken(e.status, opts.weaken, 1e9, 0);
    const ang = Math.atan2(y - py, x - px) + (lab() - 0.5) * 2 * PROXY.angleJitter;
    const contact = d.radius + PLAYER.radius * 0.6 + PROXY.contactReach;
    const stop = d.behavior === 'spitter' ? d.preferredDistance : d.behavior === 'healer' ? HONEY.keepAway : d.behavior === 'exploder' ? d.attackRange * 0.9 : contact;
    const f: Foe = {
      e, d, affix, small, mini: mini ?? undefined, kit: mini ? mini.kit : d.behavior === 'boss' ? BOSS_KITS[id] : undefined,
      speed: d.speed * speedScale * (affix === 'swift' ? AFFIX.swift.speedMult : 1), ang, stop,
      atkCd: d.behavior === 'boss' ? 1.8 : d.attackCooldown * (0.4 + fake.rng() * 0.6), tellT: 0,
      aux: id === Enemy.honey ? 0.5 : id === Enemy.sanitizer ? SANI.cleanseInterval : 0, lastHp: hp, idle: 0, bossStep: 0, bossMove: 'volley', noCredit: false, done: false,
    };
    foes.push(f);
    spawned++;
    return f;
  };
  const spawnWaveEnemy = (id: EnemyId, x: number, y: number): void => {
    const elite = flow() < eliteChance(id, wave, state.shift) + (boss || ELITE_EXCLUDED.includes(id) ? 0 : mod.eliteBonus);
    createFoe(id, x, y, plan.hpScale * ramp(WAVE_RAMP.hp), plan.speedScale * ramp(WAVE_RAMP.speed), elite, plan.dmgScale);
  };

  const summon = (n: number, types: EnemyId[]): void => {
    const entries = [pickEntry(), pickEntry()];
    for (let k = 0; k < 2; k++) {
      const gids = Array.from({ length: Math.ceil(n / 2) }, () => {
        const p = flow() < 0.5 ? THEME_SUMMONS[state.theme] ?? types : types;
        return p[Math.floor(flow() * p.length)];
      });
      groups.push({ at: waveTime + 0.8, ids: gids, entry: entries[k], told: true, done: false });
    }
  };

  const alive = (): number => { let n = 0; for (const f of foes) if (f.e.alive) n++; return n; };

  const updateDirector = (): void => {
    for (const g of groups) {
      if (g.done) continue;
      if (!g.told && waveTime >= g.at - 0.8) { g.entry = pickEntry(); g.told = true; }
      if (g.told && waveTime >= g.at && alive() + g.ids.length <= ECONOMY.maxActiveEnemies) {
        const en = ENTRIES[g.entry];
        g.ids.forEach((id, k) => {
          const a = (k / g.ids.length) * Math.PI * 2;
          spawnWaveEnemy(id, en.x + Math.cos(a) * 18 * Math.min(1, k), en.y + Math.sin(a) * 12 * Math.min(1, k));
        });
        g.done = true;
      }
    }
    if (bossAt >= 0 && waveTime >= bossAt) {
      bossAt = -1;
      ref.boss = createFoe(bossFor(state.theme), 640, 330, shift.bossHpMult, 1, false, plan.dmgScale);
    }
    if (miniAt >= 0 && waveTime >= miniAt) {
      miniAt = -1;
      const v = MINI_BOSS.variants[Math.floor(flow() * MINI_BOSS.variants.length)];
      const id = v.byTheme[state.theme] ?? v.byTheme.main!;
      ref.mini = createFoe(id, 640, 330, shift.bossHpMult, 1, false, plan.dmgScale, 0, v);
    }
  };

  // ── damage to the player ──
  const hurt = (dmg: number): void => {
    const before = fake.run.hp;
    fake.hurt(dmg);
    damageTaken += Math.max(0, before - fake.run.hp);
  };
  const bossShots = new WeakSet<object>();
  const exposureOf = (f: Foe): number => PROXY.exposure * (isBoss(f) ? PROXY.bossExposureMult : 1);
  const attackExposureOf = (f: Foe): number => PROXY.attackExposure * (isBoss(f) ? PROXY.bossExposureMult : 1);
  const halfHp = (f: Foe): boolean => f.e.hp <= f.e.maxHp / 2;
  const fireShots = (f: Foe, n: number, spreadDeg: number, damage: number, speed: number, life: number): void => {
    const base = Math.atan2(py - f.e.y, px - f.e.x), spread = (spreadDeg * Math.PI) / 180;
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? base + (i / (n - 1) - 0.5) * spread : base;
      const s = fake.spawnHostileShot({ x: f.e.x, y: f.e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, damage });
      if (isBoss(f)) bossShots.add(s);
    }
  };
  const bossMoves = (f: Foe) => {
    const T = bossTuning(state.shift), k = f.kit?.moves ?? {};
    if (f.mini) return { ...T, ...k };
    return { ...T, volleyCount: (k.volleyCount ?? BOSS.volleyCount) + T.volleyCount - BOSS.volleyCount, volleySpreadDeg: k.volleySpreadDeg ?? T.volleySpreadDeg, summonCount: (k.summonCount ?? BOSS.summonCount) + T.summonCount - BOSS.summonCount, summonTypes: k.summonTypes ?? T.summonTypes };
  };
  const bossCooldown = (f: Foe): number => f.d.attackCooldown * (halfHp(f) ? bossTuning(state.shift).halfHpCooldownMult : 1) * (enraged ? bossTuning(state.shift).enrageCooldownMult : 1);
  const executeBossMove = (f: Foe, now: number): void => {
    const T = bossMoves(f), d = f.d;
    f.atkCd = bossCooldown(f);
    if (f.bossMove === 'volley') fireShots(f, T.volleyCount + (halfHp(f) ? 2 : 0), T.volleySpreadDeg + (halfHp(f) ? 20 : 0), weakenedDamage(f.e, d.attackDamage, now), d.projectileSpeed, d.projectileLife);
    else if (f.bossMove === 'special') fireShots(f, PROXY.specialShots, 360, weakenedDamage(f.e, d.attackDamage, now), d.projectileSpeed, d.projectileLife);
    else if (f.bossMove === 'summon') summon(T.summonCount + (halfHp(f) ? 2 : 0), T.summonTypes);
    else { // charge: one lunge; the boss is then stunned (a damage window)
      if (lab() < attackExposureOf(f)) hurt(weakenedDamage(f.e, d.contactDamage + 3, now));
      f.e.state = 'stun'; f.e.stateT = halfHp(f) ? 0.75 : PROXY.chargeStun;
    }
  };

  // ── one enemy, one step ──
  const contactors: Foe[] = [];
  let contactT = 0;
  const think = (f: Foe, dt: number, now: number): void => {
    const e = f.e, d = f.d;
    const burn = tickBurn(e.status, now);
    if (burn > 0) { fake.hit(e, burn, null, { isDot: true }); if (!e.alive) return; }
    const poison = tickPoison(e.status, now);
    if (poison > 0) { fake.hit(e, poison, null, { isDot: true, poison: true }); if (!e.alive) return; }
    if (f.affix === 'tough') { // regen after `idle` s without taking damage
      if (e.hp < f.lastHp) f.idle = 0; else f.idle += dt;
      if (f.idle >= AFFIX.tough.idle) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * AFFIX.tough.regenPct * dt);
      f.lastHp = e.hp;
    }
    f.atkCd -= dt;
    if (d.id === Enemy.sanitizer && (f.aux -= dt) <= 0) { f.aux += SANI.cleanseInterval; cleanseAura(e, fake.enemies, SANI.cleanseRadius, now); }
    if (d.behavior === 'healer' && (f.aux -= dt) <= 0) {
      f.aux = HONEY.interval;
      for (const h of healTargets(e, fake.enemies)) h.target.hp += h.amount;
    }
    if (d.behavior === 'thief' && (f.aux += dt) >= GIFT.escapeAfter) { f.noCredit = true; e.alive = false; e.state = 'dying'; escaped++; return; }
    if (e.state === 'stun') {
      e.stateT = (e.stateT ?? 0) - dt;
      if (e.stateT <= 0) e.state = 'walk';
    } else {
      const dx = px - e.x, dy = py - e.y, dist = Math.hypot(dx, dy) || 1;
      // winding up an attack: no movement
      if (f.tellT > 0) {
        f.tellT -= dt;
        if (f.tellT <= 0) {
          if (isBoss(f)) executeBossMove(f, now);
          else if (d.behavior === 'spitter') { f.atkCd = d.attackCooldown; fireShots(f, SPIT.shots, SPIT.spreadDeg * (SPIT.shots - 1), weakenedDamage(e, d.attackDamage, now), d.projectileSpeed, d.projectileLife); }
          else if (d.behavior === 'swiper') { f.atkCd = d.attackCooldown; if (dist < d.attackRange + PLAYER.radius + 10 && lab() < attackExposureOf(f)) hurt(weakenedDamage(e, d.attackDamage, now)); }
          else if (d.behavior === 'exploder') {
            if (dist < EGG.radius + PLAYER.radius * 0.6 && lab() < attackExposureOf(f)) hurt(weakenedDamage(e, d.attackDamage, now));
            for (const o of foes) if (o !== f && o.e.alive && !isBoss(o) && Math.hypot(o.e.x - e.x, o.e.y - e.y) < EGG.radius + o.d.radius) fake.hit(o.e, EGG.enemyDamage, null, { label: 'Egg Carton', tags: ['blast'] });
            f.noCredit = true; e.alive = false; e.state = 'dying';
            return;
          }
        }
      } else {
        // decide: attack or move
        if (isBoss(f)) {
          if (f.atkCd <= 0) {
            const cycle = f.kit?.cycle ?? BOSS_KITS.boss.cycle;
            f.bossStep = (f.bossStep + 1) % cycle.length;
            f.bossMove = cycle[f.bossStep];
            if (f.bossMove === 'charge' && dist < 120) f.bossMove = 'volley';
            f.tellT = d.tell * (f.bossMove === 'summon' ? 0.75 : 1);
          }
        } else if (d.behavior === 'spitter') { if (f.atkCd <= 0 && dist < d.attackRange) f.tellT = d.tell; }
        else if (d.behavior === 'swiper') { if (f.atkCd <= 0 && dist < d.attackRange + PLAYER.radius + 10) f.tellT = d.tell; }
        else if (d.behavior === 'exploder') { if (dist < d.attackRange) f.tellT = d.tell; }
        if (f.tellT <= 0) {
          let mx = 0, my = 0;
          if (d.behavior === 'thief') { // flees: away from the cart, off the walls, slightly sideways (enemies.ts)
            const nx = dx / dist, ny = dy / dist, cu = (v: number) => clamp(v, 0, 1);
            const mxa = cu((ARENA.left + 150 - e.x) / 150) - cu((e.x - (ARENA.right - 150)) / 150), mya = cu((ARENA.top + 110 - e.y) / 110) - cu((e.y - (ARENA.bottom - 110)) / 110);
            const fx = -nx + mxa * 1.8 - ny * 0.5, fy = -ny + mya * 1.8 + nx * 0.5, fl = Math.hypot(fx, fy) || 1;
            mx = fx / fl; my = fy / fl;
          } else {
            const tx = px + Math.cos(f.ang) * f.stop - e.x, ty = py + Math.sin(f.ang) * f.stop - e.y, td = Math.hypot(tx, ty);
            if (td > 1) { const step = Math.min(td, 1); mx = (tx / td) * step; my = (ty / td) * step; }
          }
          const sp = f.speed * slowFactor(e.status, now) * (isBoss(f) && enraged ? 1.3 : 1) * (state.modifier === 'coldRoom' ? 1 - ROOMS.coldRoom.enemySlow : 1);
          e.x += mx * sp * dt; e.y += my * sp * dt;
        }
        if (dist <= d.radius + PLAYER.radius * 0.6 + PROXY.contactReach && contactors.length < PROXY.contactCap) contactors.push(f);
      }
    }
    e.x += e.kx * dt; e.y += e.ky * dt; // knockback some hooks write (the fake does not apply a hit's `kb`)
    const decay = Math.exp(-9 * dt);
    e.kx *= decay; e.ky *= decay;
    e.x = clamp(e.x, ARENA.left + d.radius * 0.5, ARENA.right - d.radius * 0.5); e.y = clamp(e.y, ARENA.top, ARENA.bottom);
  };

  // ── a kill (ArenaScene.killEnemy with credit) ──
  const award = (n: number): void => { coins += n; };
  const onDeath = (f: Foe): void => {
    const e = f.e, d = f.d;
    kills++;
    const thief = d.id === Enemy.giftcard;
    const n = thief ? giftcardCoins(d.coins, GIFT.coinMult, mults) : f === ref.boss ? bossTuning(state.shift).coins : f.mini ? MINI_BOSS.coins : killCoins(d.coins * (f.e.elite ? ELITE.coinMult : 1), killCoinMult(mults), flow);
    for (let i = 0; i < n; i++) if (thief || d.behavior === 'boss' || flow() < ECONOMY.killCoinChance) award(1);
    const B = DEPT_TUNING.bread;
    if (dept.breadHeal && breadDropped + B.heal <= B.capPerAisle && flow() < B.chance) { breadDropped += B.heal; fake.run.hp = Math.min(fake.run.maxHp, fake.run.hp + B.heal); }
    if (f.affix === 'splitter') {
      for (let i = 0; i < AFFIX.splitter.count; i++) {
        const a = (i / AFFIX.splitter.count) * Math.PI * 2 + fake.rng();
        const sp = createFoe(d.id, e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 9, plan.hpScale, plan.speedScale, false, plan.dmgScale, AFFIX.splitter.scale);
        sp.e.kx = Math.cos(a) * 240; sp.e.ky = Math.sin(a) * 240;
      }
    }
    if (d.id === Enemy.melon) {
      for (let i = 0; i < ENEMIES.melon.tune.slices; i++) {
        const a = (i / ENEMIES.melon.tune.slices) * Math.PI * 2 + fake.rng();
        const sl = createFoe(Enemy.slice, e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 10, plan.hpScale, plan.speedScale, false, plan.dmgScale);
        sl.e.kx = Math.cos(a) * 260; sl.e.ky = Math.sin(a) * 260;
      }
    }
    if (f === ref.boss) bossDefeated = true;
    if (f === ref.mini) miniDefeated = true;
  };
  const reap = (): void => {
    for (let i = 0; i < foes.length; i++) { // (kills may append: splits, slices)
      const f = foes[i];
      if (f.e.alive || f.done) continue;
      f.done = true;
      if (!f.noCredit) onDeath(f);
    }
  };

  // ── the loop ──
  const only = opts.only;
  if (only) for (const o of only) for (let i = 0; i < o.count; i++) {
    const a = lab() * Math.PI * 2, r = 320 + lab() * 120;
    createFoe(o.id, px + Math.cos(a) * r, py + Math.sin(a) * r * 0.6, o.hpScale ?? 1, 1, false, 1);
  }
  const dt = PROXY.dt;
  const endAt = mode === 'clear' ? wave.duration + PROXY.clearOvertime : wave.duration;
  const hardCap = PROXY.bossCap;
  let clearTime: number | null = null, stalled = false, died = false;
  const p = fake.player;
  for (;;) {
    const now = fake.time;
    waveTime += dt;
    if (build.regen > 0 && fake.run.hp < build.maxHp) fake.run.hp = Math.min(build.maxHp, fake.run.hp + build.regen * dt);
    if (!only) updateDirector();
    if (!enraged && ((ref.boss && waveTime > bossTuning(state.shift).enrageAfter + 1.6) || (ref.mini && waveTime > MINI_BOSS.at + MINI_BOSS.enrageAfter))) enraged = true;
    contactors.length = 0;
    for (const f of foes) if (f.e.alive) think(f, dt, now);
    // enemy projectiles in flight
    for (const s of fake.hostileShots) {
      if (!s.active) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }
      if (Math.hypot(s.x - px, s.y - py) <= 12 + PLAYER.radius * 0.6 + PROXY.contactReach) { s.active = false; if (lab() < PROXY.shotExposure * (bossShots.has(s) ? PROXY.bossExposureMult : 1)) hurt(s.damage); }
    }
    if ((contactT -= dt) <= 0 && contactors.length) { // one attempt per i-frame window
      contactT = PROXY.contactInterval;
      for (const f of contactors) if (lab() < exposureOf(f)) { hurt(weakenedDamage(f.e, f.d.contactDamage, now)); break; }
    }
    p.invulnT = Math.max(0, p.invulnT - dt); p.protectT = Math.max(0, p.protectT - dt); p.hurtT = Math.max(0, p.hurtT - dt);
    arsenal.step(dt, !p.dead);
    reap();
    for (const c of fake.calls) if (c.kind === 'dropCoin') award(1);
    fake.clear();
    if (fake.hostileShots.length > 64) { const keep = fake.hostileShots.filter((s) => s.active); fake.hostileShots.length = 0; fake.hostileShots.push(...keep); }
    // compact: the dead leave the arena (their kills were credited by reap)
    if (foes.some((f) => f.done)) {
      const keep = foes.filter((f) => !f.done);
      foes.length = 0; foes.push(...keep);
      const ek = fake.enemies.filter((e) => e.alive);
      fake.enemies.length = 0; fake.enemies.push(...ek);
    }
    // end conditions
    if (p.dead || fake.run.hp <= 0) { died = true; break; }
    if (bossDefeated || (miniDue && miniDefeated)) break;
    const live = alive();
    if (clearTime === null && live === 0 && groups.every((g) => g.done) && bossAt < 0 && miniAt < 0) clearTime = round2(waveTime);
    if (only) { if (live === 0 || waveTime >= endAt) break; continue; }
    if (boss || miniDue) { if (waveTime >= hardCap) { stalled = true; died = true; break; } continue; }
    if (mode === 'clear') { if (clearTime !== null || waveTime >= endAt) break; continue; }
    if (waveTime >= wave.duration) break;
  }

  // sweep: whatever is alive is removed without credit
  const leftover = foes.reduce((n, f) => n + (f.e.alive && !isBoss(f) ? 1 : 0), 0);
  for (const f of foes) if (f.e.alive) { f.noCredit = true; f.e.alive = false; }
  award(fake.run.money); // coins that hooks added through ctx.addCoins
  addCoins(state, coins, 'kills');
  state.stats.kills += kills;
  state.hp = died ? 0 : fake.run.hp;
  if (died) state.phase = 'defeat';

  // damage book-keeping
  const dmg = fake.dmgLog.damage, uidType = new Map(build.weapons.map((w) => [w.uid, w.type as string]));
  const bySource: Record<string, number> = {};
  for (const [k, v] of Object.entries(fake.dmgLog.damageByWeapon)) { const name = uidType.get(k) ?? k; bySource[name] = (bySource[name] ?? 0) + v; }
  mergeDamage(state, fake.dmgLog.damageByWeapon, dmg, uidType);
  const dealt = totalDamage(dmg);
  return {
    aisle: state.wave, kind, department: state.department, modifier: state.modifier, seconds: round2(waveTime), spawned, kills, leftover, escaped,
    clearTime, cleared: clearTime !== null, hpBefore: round2(hpBefore), hpAfter: round2(state.hp), damageTaken: round2(damageTaken), coins, dealt: round2(dealt),
    dps: round2(dealt / Math.max(waveTime, 0.001)), died, stalled, miniDefeated, bossDefeated,
    damage: { ...structuredClone(dmg), bySource },
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Add one aisle's damage log to the run totals (`RunStats.damageByWeapon` keyed by item id, `RunStats.damage`). */
function mergeDamage(state: RunState, byUid: Record<string, number>, d: DamageStats, uidType: Map<string, string>): void {
  const st = state.stats;
  for (const [k, v] of Object.entries(byUid)) { const name = uidType.get(k) ?? k; st.damageByWeapon[name] = (st.damageByWeapon[name] ?? 0) + v; }
  const t = st.damage;
  for (const k of Object.keys(d.byType) as (keyof DamageStats['byType'])[]) t.byType[k] += d.byType[k];
  t.dot += d.dot; t.weak += d.weak; t.resisted += d.resisted; t.shred += d.shred; t.mark += d.mark;
  for (const k of Object.keys(d.reactions) as (keyof DamageStats['reactions'])[]) t.reactions[k] += d.reactions[k];
}
