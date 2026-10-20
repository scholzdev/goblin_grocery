import { beforeEach, describe, expect, it, vi } from 'vitest';

// flow reads `location` when src/lab.ts loads, and vitest runs in node.
vi.hoisted(() => { (globalThis as { location?: unknown }).location = { search: '' }; });

import { flow } from '../src/flow';
import { store } from '../src/state/store';
import { profile } from '../src/state/profile';
import { BOSS_WAVE } from '../src/data/waves';
import type { DepartmentId, RunState } from '../src/types';

const fakeGame = { scene: { getScene: () => ({ scene: { restart: () => {} } }) } };

beforeEach(() => {
  profile.stats = { runs: 0, wins: 0, losses: 0, kills: 0, coins: 0, bestWave: 0, combos: 0, deptClears: {}, bestShift: {}, bestOvertime: 0 };
  profile.unlocked = [];
  profile.coupons = 0;
});

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
