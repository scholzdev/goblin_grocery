import { apply } from '../buildlab/run';
import { botDoors } from '../systems/shortcut';
import { createGenomePolicy, genomeFromJSON, type Genome } from '../buildlab/genome';
import { SHOP_ROUNDS, bestPlacement, mergePairs, type Policy, type PolicyView, type Scorer, type ShopAction } from '../buildlab/policy';
import type { ShopStep } from '../buildlab/report';
import { ARENA } from '../data/arena';
import { ELITE, ENEMIES } from '../data/enemies';
import { ITEMS, ITEM_IDS, PLAYER, cellsOf } from '../data/items';
import { MODIFIERS, type DoorId, type ModifierId } from '../data/modifiers';
import { ECONOMY, waveDef } from '../data/waves';
import { flow } from '../flow';
import type { ArenaScene } from '../scenes/ArenaScene';
import { cartUpgradeCost, shelfUpgradeCost, upgradeCost } from '../state/run';
import { store } from '../state/store';
import { currentRerollCost, repairCost } from '../systems/shop';
import { segmentHitsRect } from '../systems/obstacles';
import { mulberry32 } from '../systems/rng';
import { computeBuild } from '../systems/synergies';
import type { Build, EnemyId, Inventory, ItemTypeId, RunState } from '../types';
import { uiRoot } from '../ui/hud';
import genomeJson from './genome.json';

// The dev autoplayer (`?bot=1`, src/lab.ts BOT): plays whole runs on its own so the owner can watch. The shop is a rule layer around the build-lab's
// evolved genome policy (every action applied with the same `apply` the headless run uses, one at a time); the fight is botrun's kiting plus dash, coin pickup and a smoothed heading. Never loaded in a
// production build (main.ts imports it dynamically behind BOT). Bot runs do not touch the profile or the best receipts (flow.finish, noteEnemy).

const TICK_MS = 80;
const PANEL_MS = 250;
const ACTION_MS = 300;
const DOOR_MS = 600;
const RESTART_MS = 3000;
const CRATE_MS = 800;
const STUCK_MS = 30_000;
const LOG_LINES = 5;

// Fight tuning (px, px/s, ms). Enemies beyond SEE are ignored; the repulsion is 1 at contact, falling off squared.
const SEE = 220, SEE_BOSS = 300, SHOT_SEE = 160;
const REPEL = 2.5, SHOT_REPEL = 3, WALL = 90, WALL_PUSH = 1;
/** Coins pull once the closest enemy is beyond COIN_CALM (fading in from 100). */
const COIN_CALM = 150;
/** Dash when an enemy's gap to the hitbox is below DASH_GAP + its speed * DASH_SPEED (capped at DASH_MAX), or a shot heading for us is within SHOT_DASH. */
const DASH_GAP = 30, DASH_SPEED = 0.3, DASH_MAX = 100, SHOT_DASH = 55;
/** Stuck and cornered: under STUCK_PX moved over STUCK_TICKS ticks (~0.5 s) while commanding a move; CORNER = how near an enemy must be to dash out of it. */
const STUCK_TICKS = 6, STUCK_PX = 14, SIDESTEP_MS = 700, CORNER = 120;
/** Steering: no move under DEAD, keep the heading until the wish is HOLD_ANGLE off (or an enemy is within URGENT), then turn by TURN of the difference. */
const DEAD = 0.12, HOLD_ANGLE = 0.61, TURN = 0.25, TURN_URGENT = 0.6, URGENT = 90;

// Shop tuning. Repair heals ECONOMY.repairHp (10) for 6 + 2 per shop, once per visit; aisle damage ramps with WAVES[].dmgScale.
const REPAIR_FRAC = 0.75, RESERVE_FRAC = 0.9, RESERVE_FROM = 3;
/** Rerolls per visit, and the weight (genome `item.*`, after the defense boost) from which an offer counts as wanted. */
const MAX_REROLLS = 2, WANT = 0.8;
/** Defense: max HP should follow the aisle damage ramp (x HP_SLACK); a missing share of it boosts the weight of items that close the gap by up to DEFENSE_W. Regen counts REGEN_SECS seconds of an aisle. */
const HP_SLACK = 1.2, DEFENSE_W = 2, REGEN_SECS = 30;
/**
 * Need passes: while the cart is short of the aisle ahead
 * by PASS_GAP (share of the target; damage target = POWER_OK x the dps that just clears the aisle, toughness target above), a rule pass buys only what closes
 * that gap, the larger gap first. Damage: the best dps gain per coin among offers and weapon stars (a star is x1.5 damage, x0.9 cooldown), at least PASS_GAIN each.
 */
const PASS_GAP = 0.15, PASS_GAIN = 0.08, REROLL_FROM = 2; // shop 1 opens with the weapon's combo parts (the stock's openers): no rerolling those away
/** Doors: dps proxy / dps needed to clear the next aisle from which the harder doors (more enemies or elites) are allowed. */
const POWER_OK = 2, HARD_LOAD = 1.15;
const CHEAPEST = Math.min(...ITEM_IDS.map((id) => ITEMS[id].price));

const perkOf = (s: RunState) => PLAYER.starters[s.starter ?? 'toaster'].perk;
const mixAvg = (aisle: number, of: (id: EnemyId) => number): number => {
  const e = Object.entries(waveDef(aisle).mix) as [EnemyId, number][];
  return e.reduce((n, [id, w]) => n + w * of(id), 0) / Math.max(1e-9, e.reduce((n, [, w]) => n + w, 0));
};
/** Average damage of one hit in an aisle (contact or attack damage of the mix x the aisle's dmgScale). */
const hitOf = (aisle: number): number => mixAvg(aisle, (id) => ENEMIES[id].contactDamage || ENEMIES[id].attackDamage) * waveDef(aisle).dmgScale;
/** Bubble Wrap soaks its tier per hit (src/content/items/bubblewrap.ts); there is no armor field on the Build. */
const armorOf = (inv: Inventory): number => inv.placed.reduce((m, i) => (i.type === 'bubblewrap' ? Math.max(m, i.tier ?? 1) : m), 0);
/** HP-equivalents the cart brings into an aisle: max HP stretched by the armor (hit / (hit - armor)) plus the regen over REGEN_SECS. */
const toughness = (inv: Inventory, b: Build, aisle: number): number => {
  const hit = hitOf(aisle);
  return (b.maxHp * hit) / Math.max(1, hit - armorOf(inv)) + b.regen * REGEN_SECS;
};
const toughTarget = (aisle: number): number => (PLAYER.maxHp * HP_SLACK * waveDef(aisle).dmgScale) / waveDef(1).dmgScale;
/** Damage per second the weapons add up to (a proxy: no AoE, pierce or status), plus the milk aura. */
const dpsOf = (b: Build): number => b.stinkDps + b.weapons.reduce((n, w) => n + (w.damage * Math.max(1, w.count) * (1 + w.critChance)) / Math.max(0.1, w.cooldown), 0);
/** Damage per second that just clears an aisle's total enemy HP within its length (door modifiers scale the count and HP). */
const needDps = (aisle: number, mod: ModifierId = 'none'): number => {
  const w = waveDef(aisle), m = MODIFIERS[mod];
  return (w.total * m.countMult * mixAvg(aisle, (id) => ENEMIES[id].hp) * w.hpScale * m.hpMult) / w.duration;
};
/** How hard a door's aisle is: enemies x their HP x the damage they deal (elites: eliteBonus is their share, ELITE.hpMult / contactMult their stats), plus a tenth per star on the door card. */
const loadOf = (d: ModifierId): number => { const m = MODIFIERS[d]; return m.countMult * m.hpMult * (1 + m.eliteBonus * (ELITE.hpMult - 1)) * (1 + m.eliteBonus * (ELITE.contactMult - 1)) + 0.1 * m.risk; };

/** The cart (and its build) with `type` added at its best spot for `score`, or null when it fits nowhere. */
function withItem(s: RunState, type: ItemTypeId, tier: number, double: boolean | undefined, score: Scorer): { inv: Inventory; build: Build } | null {
  const p = bestPlacement(s, { type, tier, double }, score);
  if (!p) return null;
  const inv: Inventory = { ...s.inventory, placed: [...s.inventory.placed, { uid: '__probe', type, x: p.x, y: p.y, rot: p.rot, tier, ...(double ? { double: true } : {}) }] };
  return { inv, build: computeBuild(inv, perkOf(s)) };
}

const cartFree = (inv: Inventory): number => inv.cols * inv.rows - inv.placed.reduce((n, i) => n + cellsOf(i).length, 0);
/** The cart is the bottleneck: fewer than 3 free cells, or something on the shelf has no spot. */
const cartTight = (s: RunState): boolean => cartFree(s.inventory) < 3 || s.inventory.shelf.some((i) => i && !bestPlacement(s, i, () => 0));

interface Spend { items: number; merge: number; repair: number; upgrades: number; reroll: number }
const newSpend = (): Spend => ({ items: 0, merge: 0, repair: 0, upgrades: 0, reroll: 0 });
/** One shop visit as the dev log (`window.__botlog.shops`, read by tools/botwatch.mjs). */
interface ShopRec { run: number; aisle: number; hp: number; maxHp: number; moneyIn: number; moneyOut: number; income: number; spend: Spend; dps: number; need: number; tough: number; target: number; acts: string[] }

/** Memory of one shop visit: which rule is up, what was tried, the genome pass in use. */
interface Visit {
  phase: 'merge' | 'repair' | 'pass' | 'power' | 'room' | 'genome' | 'reroll' | 'leftover' | 'done';
  tried: Set<string>;
  rerolls: number;
  again: boolean;
  /** The need passes still to run (largest gap first), and whether the genome pass in progress is the defense pass (buys only items that add toughness). */
  queue: ('power' | 'defense')[] | null;
  defense: boolean;
  inner: Policy | null;
  round: number;
  weights: Record<string, number>;
  reserve: number;
}

const arena = (): ArenaScene | undefined => (window as unknown as { __arena?: ArenaScene }).__arena;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function startBot(): void {
  const genome = genomeFromJSON(genomeJson);
  const source = (genomeJson as { source?: string }).source ?? 'genome.json';
  let view: PolicyView = { rng: mulberry32(1), round: 0 };
  let run = 0, wins = 0, losses = 0;
  let busy = false;
  /** The phase step already handled (`seed:wave:phase`), so a tick never starts one twice. */
  let handled = '', handledAt = 0;
  let crateAt = 0;
  let door = '-';
  let error = '';
  const shopLog: string[] = [];

  const panel = document.createElement('pre');
  panel.id = 'botpanel';
  uiRoot().append(panel);

  const fail = (where: string, e: unknown): void => {
    error = `${where}: ${e instanceof Error ? e.message : String(e)}`;
    console.error('[bot]', where, e);
  };

  // ───────────────────────────── fight: kiting, dash, coins ─────────────────────────────

  type Pick = ReturnType<ArenaScene['pickups']>[number];
  /** Smoothed heading as an angle (`hasHeading` false = standing still), the 0.5 s position trail for stuck detection, and the sidestep when stuck. */
  let heading = 0, hasHeading = false;
  const trail: { x: number; y: number }[] = [];
  let sideUntil = 0, sideAng = 0;
  /** Floor pickups seen last tick (true = close enough that a vanish means we collected it). */
  let seen = new Map<Pick, boolean>();
  const tally = { wave: -1, coins: 0, runCoins: 0, bread: 0, runBread: 0, dashes: 0, runDashes: 0 };

  function resetMove(): void {
    hasHeading = false; trail.length = 0; sideUntil = 0; seen = new Map();
  }

  const angDiff = (a: number, b: number): number => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const inArena = (x: number, y: number, m: number): boolean => x > ARENA.left + m && x < ARENA.right - m && y > ARENA.top + m && y < ARENA.bottom - m;
  /** Would walking `len` px along `ang` hit a prop or the arena edge? */
  function blocked(a: ArenaScene, ang: number, len: number): boolean {
    const p = a.player, x = p.x + Math.cos(ang) * len, y = p.y + Math.sin(ang) * len;
    if (!inArena(x, y, p.radius * 2 - 4)) return true;
    return a.obstacles.some((o) => segmentHitsRect(p.x, p.y, x, y, o, p.radius));
  }

  /** The dash direction that lands farthest from every enemy and shot, without ending against the wall. */
  function dashAngle(a: ArenaScene, want: number | null): number {
    const p = a.player, reach = PLAYER.shove.distance * store.state.build.shoveDistMult;
    let best = -Infinity, pick = want ?? 0;
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const lx = Math.min(ARENA.right - 50, Math.max(ARENA.left + 50, p.x + Math.cos(ang) * reach));
      const ly = Math.min(ARENA.bottom - 50, Math.max(ARENA.top + 50, p.y + Math.sin(ang) * reach));
      let score = Math.min(300, Math.hypot(lx - p.x, ly - p.y) * 1.5);
      let near = 300;
      for (const e of a.enemies) if (e.alive && e.state !== 'spawn') near = Math.min(near, Math.hypot(lx - e.x, ly - e.y) - e.def.radius);
      for (const sh of a.arsenal.enemyShots) if (sh.active) near = Math.min(near, Math.hypot(lx - sh.x, ly - sh.y) - 20);
      score += near * 2 - Math.hypot(lx - (p.x + Math.cos(ang) * reach), ly - (p.y + Math.sin(ang) * reach)); // walls shorten the dash
      if (want !== null) score += Math.cos(angDiff(ang, want)) * 40;
      if (score > best) { best = score; pick = ang; }
    }
    return pick;
  }

  /** Count what vanished from the floor near us last tick (picked up, not swept), and the dashes. */
  function countPickups(a: ArenaScene, picks: Pick[]): void {
    const p = a.player, r = store.state.build.pickupRadius + 25;
    const now = new Map<Pick, boolean>();
    for (const c of picks) now.set(c, c.pull || Math.hypot(c.x - p.x, c.y - 20 - p.y) < r);
    for (const [c, near] of seen) {
      if (now.has(c) || !near) continue;
      if (c.bread) { tally.bread++; tally.runBread++; } else { tally.coins++; tally.runCoins++; }
    }
    seen = now;
  }

  /**
   * Walk away from enemies (soft, squared falloff, ignoring the far ones), sidestep shots, drift to the nearest safe coin or heal while nothing is close,
   * dash out of a squeeze. The heading is smoothed and sticky so it does not jitter; a stuck bot sidesteps.
   */
  function kite(a: ArenaScene): void {
    const p = a.player, s = store.state;
    if (!p) return;
    if (tally.wave !== s.wave) { tally.wave = s.wave; tally.coins = tally.bread = tally.dashes = 0; }
    const now = Date.now();
    const picks = a.pickups();
    countPickups(a, picks);

    // threats: summed repulsion; `near` = capsule distance to the closest enemy, `dashNow` = something is about to land on us
    let vx = 0, vy = 0, near = Infinity, dashNow = false, shotNear = Infinity;
    for (const e of a.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const n = a.playerNear(e.x, e.y); // hitbox capsule: steer away from the closest body point
      const dx = n.x - e.x, dy = n.y - e.y, d = n.d || 1;
      const boss = e.def.behavior === 'boss', range = boss ? SEE_BOSS : SEE;
      near = Math.min(near, d);
      if (d - e.def.radius < Math.min(DASH_MAX, DASH_GAP + e.speed * DASH_SPEED)) dashNow = true;
      if (d >= range) continue;
      const t = 1 - d / range, w = REPEL * t * t * (boss ? 1.5 : 1);
      vx += (dx / d) * w; vy += (dy / d) * w;
    }
    for (const sh of a.arsenal.enemyShots) {
      if (!sh.active) continue;
      const n = a.playerNear(sh.x, sh.y);
      const dx = n.x - sh.x, dy = n.y - sh.y, d = n.d || 1;
      if (d >= SHOT_SEE) continue;
      shotNear = Math.min(shotNear, d);
      const sp = Math.hypot(sh.vx, sh.vy), t = 1 - d / SHOT_SEE, w = SHOT_REPEL * t * t;
      if (sp > 1 && sh.vx * dx + sh.vy * dy > 0) { // coming our way: step off its line, to the side we are already on
        const side = Math.sign(sh.vx * dy - sh.vy * dx) || 1;
        vx += (-sh.vy / sp) * side * w; vy += (sh.vx / sp) * side * w;
        if (d < SHOT_DASH) dashNow = true;
      } else { vx += (dx / d) * w; vy += (dy / d) * w; }
    }
    // walls push back so it does not hug (and pin itself on) the edge
    const m = p.radius * 2;
    vx += (Math.max(0, ARENA.left + m + WALL - p.x) - Math.max(0, p.x - (ARENA.right - m - WALL))) / WALL * WALL_PUSH;
    vy += (Math.max(0, ARENA.top + m + WALL - p.y) - Math.max(0, p.y - (ARENA.bottom - m - WALL))) / WALL * WALL_PUSH;

    // loot: the nearest coin (or heal, worth more the more HP is missing), away from enemy clusters, only while nothing is close
    const calm = Math.min(1, Math.max(0, (near - 100) / (COIN_CALM - 100))) * (shotNear < 110 ? 0 : 1);
    let target: Pick | null = null, best = Infinity;
    const missing = 1 - s.hp / s.build.maxHp, pr = s.build.pickupRadius;
    for (const c of picks) {
      if (c.pull) continue;
      const d = Math.hypot(c.x - p.x, c.y - 20 - p.y);
      if (d < pr) continue; // the magnet gets it
      if (c.bread && missing < 0.12) continue;
      let score = d - (c.bread ? missing * 400 : 0);
      for (const e of a.enemies) if (e.alive) { const de = Math.hypot(c.x - e.x, c.y - e.y); if (de < 130) score += (130 - de) * 3; }
      if (score < best) { best = score; target = c; }
    }
    if (target && calm > 0) {
      const dx = target.x - p.x, dy = target.y - 20 - p.y, d = Math.hypot(dx, dy) || 1;
      const w = (target.bread ? 1.2 : 0.8) * calm;
      vx += (dx / d) * w; vy += (dy / d) * w;
    } else if (!Number.isFinite(near)) {
      const dx = 640 - p.x, dy = 480 - p.y, d = Math.hypot(dx, dy);
      if (d > 80) { vx += (dx / d) * 0.3; vy += (dy / d) * 0.3; } // nothing to do: wait near the middle
    } else {
      vx += (640 - p.x) * 0.0006; vy += (480 - p.y) * 0.0006;
    }

    // heading: smoothed, sticky; a dead zone means stand still
    let l = Math.hypot(vx, vy);
    if (l > 1) { vx /= l; vy /= l; l = 1; }
    const urgent = near < URGENT;
    if (l < DEAD) hasHeading = false;
    else {
      const want = Math.atan2(vy, vx);
      if (!hasHeading) { heading = want; hasHeading = true; }
      else {
        const diff = angDiff(heading, want);
        if (Math.abs(diff) > HOLD_ANGLE || urgent) heading += diff * (urgent ? TURN_URGENT : TURN);
      }
    }

    // stuck: commanded to move but hardly moved for ~0.5 s -> sidestep for a while (or dash if enemies are on us)
    let stuck = false;
    if (hasHeading && p.shoveT <= 0) {
      trail.push({ x: p.x, y: p.y });
      if (trail.length > STUCK_TICKS) trail.shift();
      stuck = trail.length >= STUCK_TICKS && Math.hypot(p.x - trail[0].x, p.y - trail[0].y) < STUCK_PX;
    } else trail.length = 0;
    if (stuck && now > sideUntil) {
      const a1 = heading + Math.PI / 2, a2 = heading - Math.PI / 2;
      const c1 = !blocked(a, a1, 70), c2 = !blocked(a, a2, 70);
      const toMid = Math.atan2(480 - p.y, 640 - p.x);
      sideAng = c1 !== c2 ? (c1 ? a1 : a2) : Math.abs(angDiff(a1, toMid)) < Math.abs(angDiff(a2, toMid)) ? a1 : a2;
      sideUntil = now + SIDESTEP_MS;
      trail.length = 0;
    }

    // dash: out of an enemy or shot that is about to land on us, or out of a corner
    const ready = (p.shoveCd <= 0 || p.chainT > 0) && p.shoveT <= 0 && !p.dead;
    if (ready && (dashNow || (stuck && near < CORNER))) {
      const ang = dashAngle(a, hasHeading ? heading : null);
      heading = ang; hasHeading = true; sideUntil = 0; trail.length = 0;
      tally.dashes++; tally.runDashes++;
      a.devInput = { x: Math.cos(ang), y: Math.sin(ang), shove: true };
      return;
    }

    // output: the sidestep (unless something is on top of us), else the heading, bent around props in the way
    let out = heading;
    if (now < sideUntil && near > 60) out = sideAng;
    else if (hasHeading && blocked(a, out, 55)) {
      const first = Math.sign(angDiff(heading, Math.atan2(vy, vx))) || 1;
      for (const k of [40, 80, 120, 160]) {
        const r1 = out + first * k * Math.PI / 180, r2 = out - first * k * Math.PI / 180;
        if (!blocked(a, r1, 55)) { out = r1; break; }
        if (!blocked(a, r2, 55)) { out = r2; break; }
      }
    }
    a.devInput = hasHeading ? { x: Math.cos(out), y: Math.sin(out) } : { x: 0, y: 0 };
  }

  /** The loot overlay (stockroom aisle, mid-shift boss crates) is DOM only: click the rarest card after a beat. */
  function pickCrate(): void {
    const cards = [...document.querySelectorAll<HTMLElement>('.stockroom [data-i]')];
    if (!cards.length) { crateAt = 0; return; }
    if (!crateAt) crateAt = Date.now();
    if (Date.now() - crateAt < CRATE_MS) return;
    const rank = (c: HTMLElement): number => (c.classList.contains('legendary') ? 9 : [3, 2, 1].find((t) => c.classList.contains(`r${t}`)) ?? 0);
    cards.sort((x, y) => rank(y) - rank(x)).at(0)?.click();
    crateAt = 0;
  }

  // ───────────────────────────── shop and route ─────────────────────────────

  // The shop is hybrid: rules first, the evolved genome second. Each visit runs, in order: (1) merge identical pairs (free power), (2) repair when HP is
  // under REPAIR_FRAC of max, (3) a weapon's next star when it pays, (4) a bigger cart when items do not fit, (5) the genome buys, places and merges with the
  // rest (its item weights get a defense boost by how far max HP / regen / armor trail the damage ramp, its own service and repair thresholds are off, a
  // small repair reserve is held back), rerolling at most MAX_REROLLS times when nothing wanted is on the table, (6) leftovers go to Loyalty, cart, shelf.

  const label = (s: ReturnType<typeof apply>): string => `${s.ok ? '' : 'x '}${s.kind}${s.item ? ` ${s.item}${(s.tier ?? 1) > 1 ? `*${s.tier}` : ''}` : ''}`;
  const weaponKey = (uid: string): string => `up:${uid}`;
  const botlog = ((window as unknown as { __botlog?: { shops: ShopRec[]; doors: string[] } }).__botlog ??= { shops: [], doors: [] });
  let spendNow: Spend | null = null, spendLast: Spend | null = null, income = 0, moneyOutLast = 0;

  /** Toughness the cart still lacks for the next aisle (HP-equivalents), and what each offer / shelf item would add to it. */
  const deficitOf = (s: RunState): number => Math.max(0, toughTarget(s.wave + 1) - toughness(s.inventory, s.build, s.wave + 1));
  function defGains(s: RunState): Map<ItemTypeId, number> {
    const aisle = s.wave + 1, cur = toughness(s.inventory, s.build, aisle), out = new Map<ItemTypeId, number>();
    const cands = [...(s.shop?.offers ?? []).filter((o) => !o.sold), ...s.inventory.shelf.filter((i) => i)] as { type: ItemTypeId; tier?: number; double?: boolean }[];
    const score: Scorer = (b) => b.maxHp + b.regen * REGEN_SECS;
    for (const c of cands) {
      const w = withItem(s, c.type, c.tier ?? 1, c.double, score);
      const g = w ? toughness(w.inv, w.build, aisle) - cur : 0;
      if (g >= 0.5) out.set(c.type, Math.max(out.get(c.type) ?? 0, g));
    }
    return out;
  }

  /** Genome item weights with the defense boost of every offer and shelf item that adds toughness (`defenseOnly`: everything else is 0, so only those are bought); the rule thresholds the rule layer owns are switched off. */
  function tuned(s: RunState, reserve: number, defenseOnly: boolean): Genome {
    const p = { ...genome.p }, deficit = deficitOf(s), gains = defGains(s);
    p['rule.repairMargin'] = 40; p['rule.customerReserve'] = p['rule.upgradeCartAbove'] = p['rule.upgradeShelfAbove'] = 120;
    p['rule.buyReserve'] = reserve; p['rule.maxRerolls'] = 0;
    if (defenseOnly) for (const id of ITEM_IDS) if (!gains.has(id)) p[`item.${id}`] = 0;
    for (const [type, g] of gains) {
      const boost = DEFENSE_W * Math.min(1, g / 10) * Math.min(1, Math.max(0.3, deficit / 12));
      p[`item.${type}`] = Math.max(p[`item.${type}`], genome.p[`item.${type}`] + boost); // genomeFromJSON clamps to the weight range
    }
    return genomeFromJSON({ p });
  }

  const powerGap = (s: RunState): number => Math.max(0, 1 - dpsOf(s.build) / (POWER_OK * needDps(s.wave + 1)));
  const defenseGap = (s: RunState): number => deficitOf(s) / toughTarget(s.wave + 1);

  /** One step of the damage pass: place a shelf item that adds dps, else buy / star the candidate with the best dps gain per coin within `budget`; null when none is worth it. */
  function powerStep(s: RunState, budget: number, tried: Set<string>): ShopAction | null {
    const dps: Scorer = (b) => dpsOf(b), cur = Math.max(1, dpsOf(s.build));
    for (const it of s.inventory.shelf) {
      const p = it && bestPlacement(s, it, dps);
      if (it && p && p.score > cur * 1.001) return { kind: 'move', uid: it.uid, target: { where: 'grid', x: p.x, y: p.y, rot: p.rot } };
    }
    let best: ShopAction | null = null, bestRate = 0;
    const take = (gain: number, cost: number, a: ShopAction): void => { if (gain / cur >= PASS_GAIN && gain / cost > bestRate) { bestRate = gain / cost; best = a; } };
    if (s.inventory.shelf.some((i) => !i)) for (const o of s.shop!.offers) {
      const w = !o.sold && o.price <= budget ? withItem(s, o.type, o.tier, o.double, dps) : null;
      if (w) take(dpsOf(w.build) - cur, o.price, { kind: 'buy', slot: o.slot });
    }
    for (const i of s.inventory.placed) {
      const cost = ITEMS[i.type].kind === 'weapon' ? upgradeCost(i) : null;
      if (cost === null || cost > budget || tried.has(weaponKey(i.uid))) continue;
      const inv: Inventory = { ...s.inventory, placed: s.inventory.placed.map((p) => (p === i ? { ...p, tier: (p.tier ?? 1) + 1 } : p)) };
      take(dpsOf(computeBuild(inv, perkOf(s))) - cur, cost, { kind: 'upgradeItem', uid: i.uid });
    }
    return best;
  }

  /** The next batch of shop actions from a fresh state, or [] when the visit is over (same protocol as a Policy, but the rule layer is in front). */
  function plan(s: RunState, v: Visit): ShopAction[] {
    const sh = s.shop!;
    for (;;) switch (v.phase) {
      case 'merge': {
        const a = mergePairs(s).filter((x) => x.kind === 'merge' && !v.tried.has(`${x.uid}>${x.targetUid}`));
        for (const x of a) if (x.kind === 'merge') v.tried.add(`${x.uid}>${x.targetUid}`);
        if (a.length) return a;
        v.phase = 'repair';
        break;
      }
      case 'repair': // also runs after each need pass: max HP may have grown, the missing share with it
        v.phase = 'pass';
        if (!sh.repairUsed && s.hp < s.build.maxHp * REPAIR_FRAC && s.money >= repairCost(s)) return [{ kind: 'repair' }];
        break;
      case 'pass': {
        v.queue ??= (['power', 'defense'] as const).map((k) => [k, k === 'power' ? powerGap(s) : defenseGap(s)] as const).filter(([, g]) => g >= PASS_GAP).sort((x, y) => y[1] - x[1]).map(([k]) => k);
        const next = v.queue.shift();
        v.phase = next === 'power' ? 'power' : 'room';
        if (next === 'defense') { v.defense = true; v.inner = null; v.phase = 'genome'; }
        break;
      }
      case 'power': {
        const a = powerGap(s) >= PASS_GAP * 0.5 ? powerStep(s, s.money - v.reserve, v.tried) : null;
        if (a?.kind === 'upgradeItem') v.tried.add(weaponKey(a.uid));
        if (a) return [a];
        if (powerGap(s) >= PASS_GAP && s.wave >= REROLL_FROM && v.rerolls < MAX_REROLLS && s.money - v.reserve - currentRerollCost(s) >= CHEAPEST && s.inventory.shelf.some((i) => !i)) { v.rerolls++; return [{ kind: 'reroll' }]; }
        v.phase = 'repair';
        break;
      }
      case 'room': {
        v.phase = 'genome';
        const cart = cartUpgradeCost(s);
        if (cart !== null && cart <= s.money - v.reserve && cartTight(s)) return [{ kind: 'upgradeCart' }];
        break;
      }
      case 'genome': {
        if (!v.inner) {
          const g = tuned(s, v.reserve, v.defense);
          v.weights = g.p; v.inner = createGenomePolicy(g, 'bot'); v.round = 0;
        }
        const acts = v.inner.decideShop(s, { rng: view.rng, round: v.round++ });
        const end = acts.findIndex((a) => a.kind === 'leave');
        if (end === 0 || !acts.length) { v.phase = 'reroll'; break; }
        return end < 0 ? acts : acts.slice(0, end);
      }
      case 'reroll': {
        const left = s.money - v.reserve - currentRerollCost(s);
        const wanted = sh.offers.some((o) => !o.sold && o.price <= s.money - v.reserve && (v.weights[`item.${o.type}`] ?? 1) >= WANT);
        // a defense pass never rerolls: the few items that add toughness are too rare on the table to be worth the coins
        if (!v.defense && s.wave >= REROLL_FROM && v.rerolls < MAX_REROLLS && left >= CHEAPEST && !wanted && s.inventory.shelf.some((i) => !i)) { v.rerolls++; v.inner = null; v.phase = 'genome'; return [{ kind: 'reroll' }]; }
        v.inner = null;
        v.phase = v.defense ? 'repair' : 'leftover';
        v.defense = false;
        break;
      }
      case 'leftover': {
        v.phase = v.again ? 'done' : 'genome';
        const acts: ShopAction[] = [];
        let m = s.money - v.reserve;
        const cart = cartUpgradeCost(s), shelf = shelfUpgradeCost(s);
        const deal = s.shop?.customer;
        if (deal?.status === 'offered' && deal.price <= m) { acts.push({ kind: 'acceptCustomer' }); m -= deal.price; }
        if (cart !== null && cart <= m && cartFree(s.inventory) < 6) { acts.push({ kind: 'upgradeCart' }); m -= cart; }
        if (shelf !== null && shelf <= m && s.inventory.shelf.every((i) => i)) acts.push({ kind: 'upgradeShelf' });
        if (acts.length && !v.again) { v.again = true; v.inner = null; return acts; }
        v.phase = 'done';
        break;
      }
      case 'done': return [];
    }
  }

  /** One shop visit, an action at a time so it can be watched; ends with leaveShop. */
  async function shop(): Promise<void> {
    const s = store.state;
    await sleep(DOOR_MS);
    const moneyIn = s.money, hpIn = s.hp;
    income = moneyIn - moneyOutLast;
    const spend = spendNow = newSpend();
    const acts: string[] = [];
    // a small repair reserve (half the next repair) only when the aisles hurt, HP is still short and the last aisle paid less than a repair costs: normally the next clear bonus covers it
    const v: Visit = { phase: 'merge', tried: new Set(), rerolls: 0, again: false, queue: null, defense: false, inner: null, round: 0, weights: {}, reserve: 0 };
    const nextRepair = ECONOMY.repairBase + ECONOMY.repairPerShop * (s.wave + 1);
    const reserveNow = (): number => (s.wave >= RESERVE_FROM && s.hp < s.build.maxHp * RESERVE_FRAC && income < nextRepair ? Math.ceil(nextRepair / 2) : 0);
    for (let round = 0; round < SHOP_ROUNDS; round++) {
      if (store.state !== s || s.phase !== 'shop') return;
      v.reserve = reserveNow();
      const batch = plan(s, v);
      if (!batch.length) break;
      let any = false;
      for (const a of batch) {
        await sleep(ACTION_MS);
        if (store.state !== s || s.phase !== 'shop') return;
        const step = apply(s, a, flow.rng);
        acts.push(label(step));
        shopLog.push(label(step));
        if (shopLog.length > LOG_LINES) shopLog.shift();
        if (step.ok) { any = true; addSpend(spend, a.kind, step); }
        store.changed();
      }
      if (!any && v.phase === 'genome') v.phase = 'reroll'; // the genome's whole batch failed: stop buying, do not retry it
    }
    moneyOutLast = s.money;
    spendLast = spend;
    const b = s.build, aisle = s.wave + 1;
    botlog.shops.push({
      run, aisle: s.wave, hp: Math.round(hpIn), maxHp: Math.round(b.maxHp), moneyIn, moneyOut: s.money, income, spend, dps: Math.round(dpsOf(b) * 10) / 10,
      need: Math.round(needDps(aisle) * 10) / 10, tough: Math.round(toughness(s.inventory, b, aisle)), target: Math.round(toughTarget(aisle)), acts,
    });
    await sleep(ACTION_MS);
    if (store.state === s && s.phase === 'shop') flow.leaveShop();
  }

  function addSpend(spend: Spend, kind: ShopAction['kind'], step: ShopStep): void {
    const c = step.cost ?? 0;
    if (kind === 'buy' || kind === 'sell') spend.items += c;
    else if (kind === 'reroll') spend.reroll += c;
    else if (kind === 'merge') spend.merge++;
    else if (kind === 'repair') spend.repair += c;
    else if (kind === 'upgradeItem' || kind === 'upgradeCart' || kind === 'upgradeShelf' || kind === 'acceptCustomer') spend.upgrades += c;
  }

  /** The door by the build's power: harder doors (more enemies, elites) only while dps and toughness are up to the next aisle and HP is healthy; weaker builds take the lightest aisle (a stockroom is free loot). The genome's door weights break ties. */
  function pickDoor(allDoors: DoorId[], s: RunState): DoorId {
    const doors = botDoors(allDoors, s);
    const aisle = s.wave + 1;
    if (doors.includes('boss')) return 'boss';
    const strong = dpsOf(s.build) >= POWER_OK * needDps(aisle) && toughness(s.inventory, s.build, aisle) >= 0.9 * toughTarget(aisle) && s.hp >= 0.6 * s.build.maxHp;
    let pool = doors;
    if (!strong) { const soft = doors.filter((d) => loadOf(d as ModifierId) <= HARD_LOAD); if (soft.length) pool = soft; }
    const score = (d: DoorId): number => {
      const m = MODIFIERS[d as ModifierId], load = loadOf(d as ModifierId);
      const base = strong ? m.coinMult * 2 - load + (m.forceLegendary ? 0.3 : 0) + m.freeRerolls * 0.1 : m.coinMult * 0.5 - load * 2.5;
      return base + (d === 'stockroom' ? 3 : 0) + 0.3 * (genome.p[`door.${d}`] ?? 1);
    };
    return pool.reduce((a, b) => (score(b) > score(a) ? b : a));
  }

  async function route(): Promise<void> {
    const s = store.state;
    await sleep(DOOR_MS);
    if (store.state !== s || s.phase !== 'route' || !s.doors) return;
    const pick = pickDoor(s.doors, s);
    const id = s.doors.includes(pick) ? pick : s.doors[0];
    door = id;
    botlog.doors.push(`run ${run} aisle ${s.wave + 1}: ${id} of [${s.doors.join(' ')}] power ${(dpsOf(s.build) / needDps(s.wave + 1)).toFixed(1)}x hp ${Math.round(s.hp)}/${Math.round(s.build.maxHp)}`);
    flow.chooseDoor(id);
  }

  async function ended(): Promise<void> {
    const s = store.state;
    if (s.phase === 'victory') wins++; else losses++;
    await sleep(RESTART_MS);
    if (store.state === s) newRun();
  }

  function newRun(): void {
    run++;
    spendNow = spendLast = null; income = moneyOutLast = 0;
    view = { rng: mulberry32(Date.now() >>> 0), round: 0 };
    shopLog.length = 0;
    door = '-';
    tally.runCoins = tally.runBread = tally.runDashes = 0;
    tally.wave = -1;
    resetMove();
    flow.startRun('toaster', 0, 'toaster', 'main');
  }

  // ───────────────────────────── the loop ─────────────────────────────

  function step(): void {
    const a = arena(), s = store.state;
    if (!a || !s) return;
    if (flow.paused && flow.pauseReason === 'blur' && !document.hidden) flow.resume(); // the tab lost focus; a watched bot keeps playing
    if (s.phase === 'title') { newRun(); return; }
    if (s.phase === 'combat') {
      if (!flow.paused) kite(a);
      pickCrate();
    } else { a.devInput = null; resetMove(); }
    if (s.phase === 'combat' || s.phase === 'checkout') { handled = ''; return; }
    const key = `${s.seed}:${s.wave}:${s.phase}`;
    if (key === handled && Date.now() - handledAt < STUCK_MS) return; // a handler that gave up is retried after a while
    handled = key; handledAt = Date.now();
    const go = s.phase === 'shop' ? shop : s.phase === 'route' ? route : ended;
    busy = true;
    go().catch((e) => {
      fail(s.phase, e);
      if (s.phase === 'shop' && store.state === s && s.phase === 'shop') flow.leaveShop();
    }).finally(() => { busy = false; });
  }

  setInterval(() => {
    if (busy) return;
    try { step(); } catch (e) { fail('tick', e); }
  }, TICK_MS);

  // ───────────────────────────── status panel ─────────────────────────────

  /** This visit's spend (the last one while fighting): items / merges / repair / upgrades (rerolls), income of the aisle, max HP. */
  const spendLine = (): string => {
    const p = spendNow ?? spendLast, m = store.state.build.maxHp;
    return `visit: ${p ? `items $${p.items}  merge ${p.merge}  repair $${p.repair}  upgrades $${p.upgrades}  reroll $${p.reroll}` : '-'}  income $${income}  maxHp ${Math.round(m)}`;
  };

  setInterval(() => {
    const s = store.state;
    if (!s) return;
    panel.textContent = [
      `BOT  run ${run}  W ${wins} / L ${losses}`,
      `${s.phase}  aisle ${s.wave}  hp ${Math.round(s.hp)}/${Math.round(s.build.maxHp)}  $${s.money}`,
      `coins ${tally.coins} (run ${tally.runCoins})  bread ${tally.bread} (${tally.runBread})  dashes ${tally.dashes} (${tally.runDashes})`,
      `door: ${door}  power ${(dpsOf(s.build) / needDps(s.wave + 1)).toFixed(1)}x  tough ${Math.round(toughness(s.inventory, s.build, s.wave + 1))}/${Math.round(toughTarget(s.wave + 1))}`,
      spendLine(),
      `shop: ${shopLog.length ? shopLog.join(' | ') : '-'}`,
      source,
      ...(error ? [`ERROR ${error}`] : []),
    ].join('\n');
  }, PANEL_MS);
}
