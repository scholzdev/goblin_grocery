import { beforeEach, describe, expect, it, vi } from 'vitest';

// flow reads `location` when src/lab.ts loads, and vitest runs in node.
vi.hoisted(() => { (globalThis as { location?: unknown }).location = { search: '' }; });

import { flow } from '../src/flow';
import { store } from '../src/state/store';
import { nearUnlocks, profile, unlockProgress, unlockedItems } from '../src/state/profile';
import { newUid, recomputeBuild } from '../src/state/run';
import { BOSS_WAVE } from '../src/data/waves';
import { UNLOCKS } from '../src/data/unlocks';
import type { DepartmentId, ItemTypeId, RunState } from '../src/types';

const fakeGame = { scene: { getScene: () => ({ scene: { restart: () => {} } }) } };

beforeEach(() => {
  profile.stats = { runs: 0, wins: 0, losses: 0, kills: 0, coins: 0, bestWave: 0, combos: 0, deptClears: {}, bestShift: {}, bestOvertime: 0 };
  profile.unlocked = [];
  profile.coupons = 0;
  profile.goalBest = {};
});

/** The goal's `need` (the spec's N), read from the table so retuning it does not break these tests. */
function target(id: string): number {
  const u = UNLOCKS.find((x) => x.id === id)!;
  if (u.type !== 'goal') throw new Error(`${id} is not a goal unlock`);
  return u.target;
}

/** A fresh run that is lost in aisle 1 after returning `kills` groceries. */
function loseWith(kills: number, flags: Partial<RunState> = {}): void {
  flow.init(fakeGame as never);
  flow.startRun();
  Object.assign(store.state, flags);
  store.state.stats.kills = kills;
  flow.defeat();
}

function place(s: RunState, type: ItemTypeId, x: number, y: number): void {
  s.inventory.placed.push({ uid: newUid(s), type, x, y, rot: 0 });
  recomputeBuild(s);
}

/** A bakery run standing in the boss aisle. */
function atBoss(): RunState {
  flow.init(fakeGame as never);
  flow.startRun('toaster', 0, 'toaster', 'bakery');
  const s = store.state;
  s.route = [...Array<DepartmentId>(BOSS_WAVE - 1).fill('bakery'), 'boss'];
  s.mods = s.route.map(() => 'none');
  s.zones = s.route.map(() => null);
  s.wave = BOSS_WAVE;
  s.department = 'boss';
  s.stats.wavesCleared = BOSS_WAVE - 1;
  return s;
}

/** From the shop after an aisle, through the first door into the next aisle. */
function nextAisle(): void {
  flow.leaveShop();
  flow.chooseDoor(store.state.doors![0]);
}

describe('overtime reaches the lifetime stats', () => {
  it('adds the kills, coins and aisle clears after the boss once, and unlocks what they earn', () => {
    const s = atBoss();
    s.stats.kills = 100;
    flow.victory();
    expect(profile.stats.kills, 'counted at victory').toBe(100);
    expect(profile.unlocked, 'Spray needs 150 lifetime kills').not.toContain('spray');

    flow.overtime();
    nextAisle();
    s.stats.kills += 30;
    flow.endWave();
    nextAisle();
    s.stats.kills += 30;
    flow.defeat();

    expect(s.wave, 'died in the second overtime aisle').toBe(BOSS_WAVE + 2);
    expect(profile.stats.kills).toBe(160);
    expect(profile.stats.coins, 'every coin of the run, the boss clear bonus included').toBe(s.stats.coinsEarned);
    expect([profile.stats.runs, profile.stats.wins, profile.stats.losses], 'still one won run').toEqual([1, 1, 0]);
    expect(profile.stats.deptClears.bakery, 'the aisles before the boss and the first overtime aisle').toBe(BOSS_WAVE);
    expect(profile.stats.deptClears.boss).toBe(1);
    expect(profile.stats.bestOvertime).toBe(1);
    expect(profile.unlocked).toContain('spray');
    expect(flow.lastResult!.fresh.unlocks).toContain('spray');
  });
});

describe('goal unlocks', () => {
  it('a run that meets a goal unlocks it and the end screen reports it', () => {
    loseWith(target('energy'));
    expect(profile.unlocked).toContain('energy');
    expect(flow.lastResult!.fresh.unlocks).toContain('energy');
    expect(unlockedItems()).toContain('energy');
  });

  it('counts the best single run, not the lifetime total: a short run raises the best, a better run unlocks', () => {
    const need = target('energy');
    loseWith(need - 50);
    expect(profile.goalBest.energy).toBe(need - 50);
    expect(profile.unlocked).not.toContain('energy');
    expect(flow.lastResult!.near, 'shown under Almost there').toContainEqual({ id: 'energy', ratio: (need - 50) / need, cur: need - 50, need });

    loseWith(60);
    expect(profile.stats.kills, 'the lifetime total passed the need').toBeGreaterThanOrEqual(need);
    expect(profile.goalBest.energy, 'a worse run keeps the best').toBe(need - 50);
    expect(profile.unlocked).not.toContain('energy');

    loseWith(need + 10);
    expect(profile.unlocked).toContain('energy');
    expect(flow.lastResult!.fresh.unlocks).toContain('energy');
    expect(nearUnlocks().map((n) => n.id)).not.toContain('energy');
  });

  it('a win goal still counts what the cart gained in overtime', () => {
    const s = atBoss();
    flow.victory();
    expect(profile.goalBest.laser, 'won with the starting weapon only').toBe(1);
    flow.overtime();
    nextAisle();
    place(s, 'pan', 0, 3);
    place(s, 'nailgun', 3, 3);
    expect(s.build.weapons.length).toBe(target('laser'));
    flow.defeat();
    expect(profile.unlocked).toContain('laser');
    expect(flow.lastResult!.fresh.unlocks).toContain('laser');
  });

  it('goldstar measures the best tier above ★1, so its progress starts at 0: a ★1 cart is 0 of 2, a ★2 item 1 of 2', () => {
    const goldstar = UNLOCKS.find((u) => u.id === 'goldstar')!;
    loseWith(10);
    expect(unlockProgress(goldstar), 'only ★1 items').toEqual([0, 2]);
    flow.init(fakeGame as never);
    flow.startRun();
    store.state.inventory.placed[0].tier = 2;
    recomputeBuild(store.state);
    flow.defeat();
    expect(unlockProgress(goldstar), 'a ★2 item').toEqual([1, 2]);
  });

  it('lab and bot runs leave goalBest alone', () => {
    loseWith(100, { lab: true });
    loseWith(100, { bot: true });
    expect(profile.goalBest).toEqual({});
    loseWith(100);
    expect(profile.goalBest.energy, 'the same run outside the lab counts').toBe(100);
  });

  it('a save without goalBest loads, and an item unlocked under its old condition stays unlocked', async () => {
    const saved = { v: 1, stats: { runs: 9, kills: 600 }, recipes: [], unlocked: ['energy'] };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved), setItem: () => {} });
    vi.resetModules();
    const m = await import('../src/state/profile');
    const run = await import('../src/state/run');
    expect(m.profile.goalBest).toEqual({});
    m.recordRun(run.createRun(1), false);
    expect(m.profile.goalBest.energy, 'the weak run is measured').toBe(0);
    expect(m.unlockedItems()).toContain('energy');
    expect(m.nearUnlocks().map((n) => n.id)).not.toContain('energy');
    vi.unstubAllGlobals();
  });
});
