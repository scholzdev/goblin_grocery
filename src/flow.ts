import type Phaser from 'phaser';
import type { ArenaScene } from './scenes/ArenaScene';
import { store } from './state/store';
import { BOT, labDummies, saveLab } from './lab';
import { createSimRun } from './state/sim';
import { restoreSlot, type LabSlot } from './state/lab';
import { SIM_DEFAULTS, simDummies, type SimDef } from './sims/_sim';
import { chooseDoor, createLabRun, labApply, createRun, finishWave, leaveShop, openShop, recomputeBuild, startNextWave } from './state/run';
import type { DoorId } from './data/modifiers';
import type { DepartmentId, LabOpts } from './types';
import { COUPON_COINS, dailySeed, emptyFresh, freshSince, nearUnlocks, noteDailyStart, recordFinish, recordOvertime, recordRun, snapProfile, unlockedItems, unseenUnlocks, useCoupon, type DailyResult, type Fresh, type Loyalty, type Near, type ProfileSnap } from './state/profile';
import { mulberry32, type Rng } from './systems/rng';
import { applyStock } from './systems/stock';
import { ITEM_IDS } from './data/items';
import { submitRun } from './state/settings';
import { BOSS_WAVE } from './data/waves';
import { play, stopLoops } from './audio/sfx';
import type { RunState, StarterId, StarterWeapon } from './types';

// Game flow: title → wave → checkout → shop → … → boss → victory/defeat → restart.
let game: Phaser.Game;
let rng: Rng = Math.random;
/** The lab setup as the bench last edited it (the title form is its first value), and the loadout as combat started, for "Back to Lab". */
let labOpts: LabOpts | null = null;
/** The sim this run came from (src/sims), for "restart sim"; null in normal runs and the plain Test Lab. */
let activeSim: SimDef | null = null;
/** Profile as the run (or overtime) began, to diff for the end screen's "Newly unlocked". */
let runSnap: ProfileSnap | null = null;
let labSnap: { inventory: RunState['inventory']; money: number; nextUid: number } | null = null;

export const flow = {
  paused: false,
  pauseReason: '' as '' | 'menu' | 'blur' | 'loadout',
  lastResult: null as null | { score: number; newBest: boolean; fresh: Fresh; near: Near[]; shown?: boolean; loyalty?: Loyalty; daily?: DailyResult },

  init(g: Phaser.Game): void {
    game = g;
    store.state = createRun(1);
  },

  get rng(): Rng {
    return rng;
  },

  get sim(): SimDef | null {
    return activeSim;
  },

  arena(): Phaser.Scene {
    return game.scene.getScene('Arena');
  },

  startRun(starter: StarterId = store.state?.starter ?? 'toaster', shift = store.state?.shift ?? 0, weapon: StarterWeapon = store.state?.weapon ?? 'toaster', theme: DepartmentId = store.state?.theme ?? 'main', opts: { daily?: boolean } = {}): void {
    if (opts.daily) { starter = 'toaster'; shift = 0; weapon = 'toaster'; theme = 'main'; }
    const seed = opts.daily ? dailySeed() : (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    activeSim = null;
    store.state = createRun(seed, starter, shift, weapon, theme);
    if (opts.daily) { store.state.daily = true; noteDailyStart(); }
    else if (!BOT && useCoupon()) { store.state.money += COUPON_COINS; store.state.voucher = true; }
    applyStock(store.state, opts.daily ? ITEM_IDS : unlockedItems(), opts.daily ? [] : unseenUnlocks());
    // Bot runs offer every unlocked item; only shop 1's openers and the featured combos come from the stock.
    if (BOT) { store.state.bot = true; store.state.pool = unlockedItems(); }
    runSnap = snapProfile();
    rng = mulberry32(seed);
    store.state.phase = 'combat';
    this.lastResult = null;
    this.restartArena();
    store.emit('run-start');
    store.changed();
  },

  /** Test Lab: park the run in the shop before the chosen aisle; `restore` brings back the loadout of the last attempt (Reset starts clean). */
  startLab(o: LabOpts, restore = false): void {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const s = createLabRun(seed, o);
    store.state = s;
    labOpts = o;
    activeSim = null;
    if (!restore) { labSnap = null; labDummies.length = 0; }
    rng = mulberry32(seed);
    openShop(s, rng);
    if (restore && labSnap) {
      Object.assign(s, structuredClone(labSnap));
      recomputeBuild(s);
      s.hp = s.build.maxHp;
    }
    this.lastResult = null;
    this.restartArena();
    store.emit('run-start');
    store.emit('shop-open');
    store.changed();
  },

  /** The running lab's setup (null in a sim or a normal run), the one the bench edits. */
  get labSetup(): LabOpts | null {
    return store.state.lab && !activeSim ? labOpts : null;
  },

  /** Test Lab bench: change setup fields of the running lab. In the arena the fight restarts with the same dummies. */
  labTune(patch: Partial<LabOpts>): void {
    const s = store.state;
    if (!s.lab || !labOpts || (s.phase !== 'shop' && !s.labSandbox)) return;
    labOpts = { ...labOpts, ...patch };
    saveLab(labOpts);
    labApply(s, patch);
    if (s.phase === 'shop') labSnap = structuredClone({ inventory: s.inventory, money: s.money, nextUid: s.nextUid }); // "Back to Lab" keeps the resized cart
    if (s.phase === 'combat') {
      (this.arena() as ArenaScene).labKeepDummies();
      this.restartArena();
    }
    store.changed();
  },

  /** Test Lab bench: put a saved cart in place of the current one. The slot's cart and shelf sizes go through `labTune`, so Setup shows what the cart really is. */
  labLoad(slot: LabSlot): boolean {
    const s = store.state;
    if (!restoreSlot(s, slot).ok) return false;
    this.labTune({ cart: [slot.cols, slot.rows], shelf: slot.shelf.length });
    return true;
  },

  /** Test Lab bench: throw away cart, shelf and dummies and start the current setup again. */
  labReset(): void {
    if (labOpts) this.startLab(labOpts);
  },

  labBack(): void {
    if (activeSim) this.restartSim();
    else if (labOpts) this.startLab(labOpts, true);
  },

  /** Sims: start the scenario from scratch with its (fixed) seed: the dummy sandbox, a real aisle, or the cart editor. Throws SimError if it is invalid. */
  startSim(sim: SimDef): void {
    rng = mulberry32(sim.seed ?? SIM_DEFAULTS.seed);
    const s = createSimRun(sim, rng);
    store.state = s;
    activeSim = sim;
    labOpts = null;
    labSnap = null;
    labDummies.length = 0;
    labDummies.push(...simDummies(sim));
    this.lastResult = null;
    this.restartArena();
    store.emit('run-start');
    if (s.phase === 'shop') store.emit('shop-open');
    store.changed();
  },

  restartSim(): void {
    if (activeSim) this.startSim(activeSim);
  },

  /** Lab sandbox: arena → cart editor, keeping the alive dummies for the way back (no wave clear, no coins). */
  labToShop(): void {
    const s = store.state;
    if (!s.labSandbox || s.phase !== 'combat') return;
    (this.arena() as ArenaScene).labKeepDummies();
    openShop(s, rng);
    stopLoops();
    store.changed();
    store.emit('shop-open');
  },

  /** Lab sandbox: cart editor → same aisle again; the arena respawns the kept dummies. */
  labToArena(): void {
    const s = store.state;
    if (!s.labSandbox || s.phase !== 'shop') return;
    labSnap = structuredClone({ inventory: s.inventory, money: s.money, nextUid: s.nextUid });
    s.phase = 'combat';
    s.shop = null;
    s.coinLog = [];
    s.hp = s.build.maxHp;
    this.restartArena();
    store.changed();
  },

  restartArena(): void {
    this.paused = false;
    this.pauseReason = '';
    game.scene.getScene('Arena').scene.restart();
  },

  /** Called by the arena once the checkout transition finished. */
  endWave(): void {
    const s = store.state;
    finishWave(s);
    openShop(s, rng);
    stopLoops();
    store.changed();
    store.emit('shop-open');
  },

  /** Shop → route screen (pick the next department). */
  leaveShop(): void {
    const s = store.state;
    if (s.lab) labSnap = structuredClone({ inventory: s.inventory, money: s.money, nextUid: s.nextUid });
    if (!leaveShop(s, rng).ok) return;
    if (s.lab && s.doors!.length === 1) this.chooseDoor(s.doors![0]); else store.changed(); // a lab aisle has one door (the route screen shows only with the Staff Only door)
  },

  chooseDoor(id: DoorId): void {
    if (!chooseDoor(store.state, id).ok) return;
    startNextWave(store.state);
    this.restartArena();
    store.changed();
  },

  victory(): void {
    const s = store.state;
    s.phase = 'victory';
    s.stats.bossDefeated = true;
    s.stats.wavesCleared = BOSS_WAVE - 1;
    this.finish(s, true);
  },

  /** Victory card → keep the same run going; the boss aisle's checkout/shop flow runs as after any wave. */
  overtime(): void {
    const s = store.state;
    s.overtime = true;
    runSnap = snapProfile();
    this.lastResult = null;
    this.endWave();
  },

  defeat(): void {
    const s = store.state;
    s.phase = 'defeat';
    this.finish(s, false);
  },

  finish(s: RunState, won: boolean): void {
    stopLoops();
    const score = scoreOf(s, won);
    if (s.lab || s.bot) { // lab and bot runs never touch the profile or the best receipts
      this.lastResult = { score, newBest: false, fresh: emptyFresh(), near: [] };
      play(won ? 'victory' : 'defeat');
      store.changed();
      store.emit('run-end');
      return;
    }
    if (s.overtime) { // the run was already counted at victory
      const past = Math.max(0, s.wave - BOSS_WAVE - 1);
      recordOvertime(past);
      const { daily } = recordFinish(s, won, score);
      this.lastResult = { score, newBest: false, fresh: runSnap ? freshSince(runSnap) : emptyFresh(), near: nearUnlocks(), daily };
      play('defeat');
      store.changed();
      store.emit('run-end');
      return;
    }
    const newBest = submitRun({ score, wave: s.wave, won, date: new Date().toISOString().slice(0, 10) });
    const got = recordRun(s, won).map((u) => u.id);
    const fresh = runSnap ? freshSince(runSnap) : emptyFresh();
    fresh.unlocks = [...new Set([...fresh.unlocks, ...got])];
    const { loyalty, daily } = recordFinish(s, won, score);
    this.lastResult = { score, newBest, fresh, near: nearUnlocks(), loyalty, daily };
    play(won ? 'victory' : 'defeat');
    store.changed();
    store.emit('run-end');
  },

  toTitle(): void {
    activeSim = null;
    store.state = createRun(1);
    this.restartArena();
    store.changed();
  },

  pause(reason: 'menu' | 'blur' | 'loadout'): void {
    if (store.state.phase !== 'combat' && store.state.phase !== 'checkout') return;
    if (this.paused) return;
    this.paused = true;
    this.pauseReason = reason;
    game.scene.pause('Arena');
    stopLoops();
    store.emit('pause');
  },

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseReason = '';
    game.scene.resume('Arena');
    store.emit('pause');
  },
};

export function scoreOf(s: RunState, won: boolean): number {
  return s.stats.kills * 10 + s.stats.wavesCleared * 250 + s.stats.coinsEarned * 2 + (won ? 3000 + Math.max(0, s.hp) * 25 : 0);
}
