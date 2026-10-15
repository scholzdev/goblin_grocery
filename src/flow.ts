import type Phaser from 'phaser';
import { store } from './state/store';
import { chooseDoor, createLabRun, createRun, finishWave, leaveShop, openShop, recomputeBuild, startNextWave } from './state/run';
import type { DoorId } from './data/modifiers';
import type { DepartmentId, LabOpts } from './types';
import { emptyFresh, freshSince, nearUnlocks, recordOvertime, recordRun, snapProfile, unlockedItems, type Fresh, type Near, type ProfileSnap } from './state/profile';
import { mulberry32, type Rng } from './systems/rng';
import { submitRun } from './state/settings';
import { BOSS_WAVE } from './data/waves';
import { play, stopLoops } from './audio/sfx';
import type { RunState, StarterId, StarterWeapon } from './types';

// Game flow: title → wave → checkout → shop → … → boss → victory/defeat → restart.
let game: Phaser.Game;
let rng: Rng = Math.random;
/** Last lab setup and the loadout as combat started, for "Back to Lab". */
let labOpts: LabOpts | null = null;
/** Profile as the run (or overtime) began, to diff for the end screen's "Newly unlocked". */
let runSnap: ProfileSnap | null = null;
let labSnap: { inventory: RunState['inventory']; money: number; nextUid: number } | null = null;

export const flow = {
  paused: false,
  pauseReason: '' as '' | 'menu' | 'blur' | 'loadout',
  lastResult: null as null | { score: number; newBest: boolean; fresh: Fresh; near: Near[]; shown?: boolean },

  init(g: Phaser.Game): void {
    game = g;
    store.state = createRun(1);
  },

  get rng(): Rng {
    return rng;
  },

  arena(): Phaser.Scene {
    return game.scene.getScene('Arena');
  },

  startRun(starter: StarterId = store.state?.starter ?? 'toaster', shift = store.state?.shift ?? 0, weapon: StarterWeapon = store.state?.weapon ?? 'toaster', theme: DepartmentId = store.state?.theme ?? 'main'): void {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    store.state = createRun(seed, starter, shift, weapon, theme);
    store.state.unlocked = unlockedItems();
    runSnap = snapProfile();
    rng = mulberry32(seed);
    store.state.phase = 'combat';
    this.lastResult = null;
    this.restartArena();
    store.emit('run-start');
    store.changed();
  },

  /** Test Lab: park the run in the shop before the chosen aisle; `restore` brings back the loadout of the last attempt. */
  startLab(o: LabOpts, restore = false): void {
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const s = createLabRun(seed, o);
    store.state = s;
    labOpts = o;
    if (!restore) labSnap = null;
    rng = mulberry32(seed);
    openShop(s, rng);
    if (restore && o.keep && labSnap) {
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

  labBack(): void {
    if (labOpts) this.startLab(labOpts, true);
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
    if (s.lab) this.chooseDoor(s.doors![0]); else store.changed();
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
    if (s.lab) { // lab runs never touch the profile or the best receipts
      this.lastResult = { score, newBest: false, fresh: emptyFresh(), near: [] };
      play(won ? 'victory' : 'defeat');
      store.changed();
      store.emit('run-end');
      return;
    }
    if (s.overtime) { // the run was already counted at victory
      const past = Math.max(0, s.wave - BOSS_WAVE - 1);
      recordOvertime(past);
      this.lastResult = { score, newBest: false, fresh: runSnap ? freshSince(runSnap) : emptyFresh(), near: nearUnlocks() };
      play('defeat');
      store.changed();
      store.emit('run-end');
      return;
    }
    const newBest = submitRun({ score, wave: s.wave, won, date: new Date().toISOString().slice(0, 10) });
    const got = recordRun(s, won).map((u) => u.id);
    const fresh = runSnap ? freshSince(runSnap) : emptyFresh();
    fresh.unlocks = [...new Set([...fresh.unlocks, ...got])];
    this.lastResult = { score, newBest, fresh, near: nearUnlocks() };
    play(won ? 'victory' : 'defeat');
    store.changed();
    store.emit('run-end');
  },

  toTitle(): void {
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
