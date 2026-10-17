import { ITEM_IDS } from '../data/items';
import { STARTING_ITEMS } from '../data/unlocks';
import { BOSS_WAVE } from '../data/waves';
import { STARTER_ORDER } from '../engine/define';
import { newDamageStats } from '../systems/damageStats';
import { mulberry32, type Rng } from '../systems/rng';
import { rollMiniCrates, rollStockroom } from '../systems/shop';
import {
  buyOffer, chooseDoor, createRun, finishWave, leaveShop, mergeItems, moveItem, openShop, repair, reroll, sellItem, startNextWave, takeStockroomItem,
  upgradeCart, upgradeItem, upgradeShelf, upgradeShop,
} from '../state/run';
import type { Build, DepartmentId, OpResult, RunState, ShopOffer, StarterId, StarterWeapon } from '../types';
import { PROXY, playAisle, type AisleResult } from './combat';
import { SHOP_ROUNDS, createGreedyPolicy, type Policy, type PolicyFactory, type PolicyView, type ShopAction } from './policy';
import { summarize, type AisleRecord, type FinalBuild, type Report, type RunRecord, type ShopLogEntry, type ShopStep } from './report';

// The headless run (docs/buildlab.md): flow.ts without Phaser. The order of calls is flow's: createRun -> aisle -> finishWave -> openShop -> shop
// actions -> leaveShop -> chooseDoor -> startNextWave -> aisle ... Left out: profile / unlock recording, scoring, the end screens, audio, tutorial
// events, overtime after the boss, the daily seed and the loyalty voucher.

export interface RunOptions {
  seed: number;
  /** The character (perk). Default `toaster`. */
  starter?: StarterId;
  /** The starting weapon, picked independently of the character. Default `toaster`. */
  weapon?: StarterWeapon;
  /** Difficulty index (0 = Day Shift). */
  shift?: number;
  theme?: DepartmentId;
  /** `all`: every item may appear in shops (the Test Lab pool, the default). `starting`: only what a fresh profile has unlocked. */
  pool?: 'all' | 'starting';
  /** Default: the greedy policy. */
  policy?: PolicyFactory;
}

const sorted = (a: string[]): string[] => [...new Set(a)].sort();
const setsOf = (b: Build): Record<string, number> => Object.fromEntries(Object.entries(b.sets).filter(([, v]) => v > 0));

function snapshot(state: RunState): FinalBuild {
  const inv = state.inventory;
  return {
    items: inv.placed.map((i) => ({ id: i.type, tier: i.tier ?? 1, x: i.x, y: i.y, rot: i.rot })),
    shelf: inv.shelf.filter((s) => !!s).map((s) => ({ id: s!.type, tier: s!.tier ?? 1 })),
    combos: sorted(state.build.recipes.map((r) => r.id)),
    sets: setsOf(state.build),
    cartSize: [inv.cols, inv.rows],
    maxHp: state.build.maxHp,
  };
}

/** Apply one shop action with the real rules. */
function apply(state: RunState, a: ShopAction, flow: Rng): ShopStep {
  const money = state.money;
  const stepOf = (kind: string, r: OpResult, extra: Partial<ShopStep> = {}): ShopStep => ({ kind, ok: r.ok, ...extra, ...(r.ok ? { cost: money - state.money } : { reason: r.reason }) });
  switch (a.kind) {
    case 'buy': {
      const o = state.shop?.offers[a.slot];
      return stepOf('buy', buyOffer(state, a.slot), o ? { item: o.type, tier: o.tier } : {});
    }
    case 'reroll': return stepOf('reroll', reroll(state, flow));
    case 'merge': {
      const it = [...state.inventory.placed, ...state.inventory.shelf].find((i) => i?.uid === a.targetUid);
      return stepOf('merge', mergeItems(state, a.uid, a.targetUid), it ? { item: it.type, tier: (it.tier ?? 1) + 1 } : {});
    }
    case 'move': {
      const it = [...state.inventory.placed, ...state.inventory.shelf].find((i) => i?.uid === a.uid);
      return stepOf('move', moveItem(state, a.uid, a.target), it ? { item: it.type, tier: it.tier ?? 1 } : {});
    }
    case 'rotate': {
      const it = state.inventory.placed.find((i) => i.uid === a.uid);
      if (!it) return { kind: 'rotate', ok: false, reason: 'not in the cart' };
      return stepOf('rotate', moveItem(state, a.uid, { where: 'grid', x: it.x, y: it.y, rot: a.rot }), { item: it.type });
    }
    case 'upgradeItem': {
      const it = [...state.inventory.placed, ...state.inventory.shelf].find((i) => i?.uid === a.uid);
      return stepOf('upgradeItem', upgradeItem(state, a.uid), it ? { item: it.type, tier: it.tier ?? 1 } : {});
    }
    case 'upgradeCart': return stepOf('upgradeCart', upgradeCart(state));
    case 'upgradeShelf': return stepOf('upgradeShelf', upgradeShelf(state));
    case 'upgradeShop': return stepOf('upgradeShop', upgradeShop(state));
    case 'repair': return stepOf('repair', repair(state));
    case 'sell': {
      const it = [...state.inventory.placed, ...state.inventory.shelf].find((i) => i?.uid === a.uid);
      return stepOf('sell', sellItem(state, a.uid), it ? { item: it.type, tier: it.tier ?? 1 } : {});
    }
    case 'leave': return { kind: 'leave', ok: true };
  }
}

/** One shop visit: open it (flow.endWave), let the policy act, return the log entry. The caller leaves the shop. */
function shopVisit(state: RunState, flow: Rng, policy: Policy, view: PolicyView, acquired: RunRecord['acquired']): ShopLogEntry {
  const shop = state.wave;
  const entry: ShopLogEntry = { shop, hp: 0, moneyIn: 0, moneyOut: 0, shopLevel: 1, offers: [], steps: [] };
  finishWave(state);
  openShop(state, flow);
  entry.hp = Math.round(state.hp * 100) / 100;
  entry.moneyIn = state.money;
  for (let round = 0; round < SHOP_ROUNDS; round++) {
    view.round = round;
    const acts = policy.decideShop(state, view);
    if (!acts.length) break;
    let any = false, leave = false;
    for (const a of acts) {
      if (a.kind === 'leave') { leave = true; break; }
      const step = apply(state, a, flow);
      entry.steps.push(step);
      if (step.ok) { any = true; if (a.kind === 'buy' && step.item) acquired.push({ item: step.item, tier: step.tier ?? 1, from: 'shop' }); }
    }
    if (leave || !any) break;
  }
  entry.offers = state.shop!.offers.map((o) => ({ item: o.type, tier: o.tier, price: o.price, ...(o.double ? { double: true } : {}), bought: o.sold })); // the table as it was last rolled
  entry.moneyOut = state.money;
  entry.shopLevel = state.shopLevel;
  return entry;
}

const emptyDamage = () => ({ ...newDamageStats(), bySource: {} as Record<string, number> });

/** A stockroom aisle: no fight; take one of three free items. */
function stockroomAisle(state: RunState, flow: Rng, policy: Policy, view: PolicyView, acquired: RunRecord['acquired']): AisleRecord {
  const offers = rollStockroom(state, flow);
  const loot = take(state, offers, policy.pickStockroom(offers, state, view), acquired, 'stockroom');
  return {
    aisle: state.wave, kind: 'stockroom', department: state.department, modifier: state.modifier, seconds: 0, spawned: 0, kills: 0, leftover: 0, escaped: 0, clearTime: 0, cleared: true,
    hpBefore: state.hp, hpAfter: state.hp, damageTaken: 0, coins: 0, dealt: 0, dps: 0, died: false, stalled: false, miniDefeated: false, bossDefeated: false,
    damage: emptyDamage(), combos: sorted(state.build.recipes.map((r) => r.id)), sets: setsOf(state.build), weapons: state.build.weapons.length, loot,
  };
}

function take(state: RunState, offers: ShopOffer[], idx: number, acquired: RunRecord['acquired'], from: 'crate' | 'stockroom'): NonNullable<AisleRecord['loot']> {
  const o = offers[Math.max(0, Math.min(offers.length - 1, idx))];
  takeStockroomItem(state, o);
  acquired.push({ item: o.type, tier: o.tier, from });
  return { item: o.type, tier: o.tier, offered: offers.map((x) => x.type) };
}

/** Play one whole run. */
export function playRun(o: RunOptions): RunRecord {
  const starter = o.starter ?? 'toaster', weapon = o.weapon ?? 'toaster', shift = o.shift ?? 0, theme = o.theme ?? 'main';
  const state = createRun(o.seed, starter, shift, weapon, theme);
  state.unlocked = (o.pool ?? 'all') === 'all' ? [...ITEM_IDS] : [...STARTING_ITEMS];
  state.phase = 'combat';
  const flow = mulberry32(o.seed); // flow.rng: shop rolls, doors, spawns, kill coins
  const policy = (o.policy ?? (() => createGreedyPolicy()))();
  const view: PolicyView = { rng: mulberry32(o.seed ^ 0x51ed270b), round: 0 };
  const acquired: RunRecord['acquired'] = [{ item: weapon, tier: 1, from: 'start' }];
  const aisles: AisleRecord[] = [], shopLog: ShopLogEntry[] = [];
  let result: RunRecord['result'] = 'dead', diedAt: number | undefined, cause: RunRecord['cause'];

  for (;;) {
    const before = { combos: sorted(state.build.recipes.map((r) => r.id)), sets: setsOf(state.build), weapons: state.build.weapons.length };
    let rec: AisleRecord;
    if (state.modifier === 'stockroom' && state.wave !== BOSS_WAVE) rec = stockroomAisle(state, flow, policy, view, acquired);
    else {
      const res: AisleResult = playAisle(state, flow);
      rec = { ...res, ...before };
      if (res.miniDefeated && !res.died) {
        const offers = rollMiniCrates(state, flow);
        if (offers.length) rec.loot = take(state, offers, policy.pickCrate(offers, state, view), acquired, 'crate');
      }
    }
    aisles.push(rec);
    if (rec.died) { diedAt = state.wave; cause = rec.stalled ? 'stalled' : 'enemies'; break; }
    if (rec.bossDefeated) { result = 'win'; state.stats.bossDefeated = true; break; }
    const entry = shopVisit(state, flow, policy, view, acquired);
    if (!leaveShop(state, flow).ok) break;
    const doors = state.doors!;
    const pick = policy.chooseDoor(doors, state, view);
    const door = doors.includes(pick) ? pick : doors[0];
    entry.door = door;
    shopLog.push(entry);
    chooseDoor(state, door);
    startNextWave(state);
  }

  return {
    seed: o.seed, starter, weapon, shift, theme, result, ...(diedAt !== undefined ? { diedAt, cause } : {}), aislesPlayed: aisles.length, kills: state.stats.kills, coinsEarned: state.stats.coinsEarned,
    aisles, acquired, finalBuild: snapshot(state), shopLog,
  };
}

/** Seed of run `i` of a batch: the base seed mixed with the index, so neighbouring runs get unrelated streams. */
export const runSeed = (base: number, i: number): number => (Math.imul((base ^ 0x9e3779b9) >>> 0, 0x85ebca6b) + Math.imul(i + 1, 0xc2b2ae35)) >>> 0;

export interface BatchOptions {
  seed?: number;
  /** Runs per (starter, weapon) pair. */
  runs?: number;
  starters?: StarterId[];
  weapons?: StarterWeapon[];
  shift?: number;
  theme?: DepartmentId;
  pool?: 'all' | 'starting';
  policy?: PolicyFactory;
  /** Name stored in the meta (default: the policy's name). */
  now?: () => number;
}

export const ALL_STARTERS: StarterId[] = [...STARTER_ORDER];

/** Many runs and their summary. `meta.gitRev` is left to the caller (the CLI). */
export function runBatch(o: BatchOptions = {}): Report {
  const now = o.now ?? (() => Date.now());
  const t0 = now();
  const seed = o.seed ?? 1, runs = o.runs ?? 50, starters = o.starters ?? ['toaster'], weapons = o.weapons ?? ['toaster'];
  const policy = o.policy ?? (() => createGreedyPolicy());
  const records: RunRecord[] = [];
  let i = 0;
  for (const starter of starters) for (const weapon of weapons) for (let k = 0; k < runs; k++) {
    records.push(playRun({ seed: runSeed(seed, i++), starter, weapon, shift: o.shift, theme: o.theme, pool: o.pool, policy }));
  }
  return {
    meta: {
      seed, runs: records.length, starter: starters.length === ALL_STARTERS.length && starters.every((s, j) => s === ALL_STARTERS[j]) ? 'all' : starters.join(','), weapon: weapons.join(','),
      shift: o.shift ?? 0, theme: o.theme ?? 'main', pool: o.pool ?? 'all', policy: policy().name, proxy: PROXY, durationMs: now() - t0,
    },
    runs: records,
    summary: summarize(records),
  };
}
