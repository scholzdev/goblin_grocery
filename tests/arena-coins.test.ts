import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { Object.assign(globalThis, { location: { search: '' }, window: globalThis, matchMedia: () => ({ matches: true }) }); });
vi.mock('phaser', () => {
  const stub: object = new Proxy(function () {}, { get: (_t, k) => (k === 'prototype' ? {} : stub) });
  return { default: stub };
});
vi.mock('../src/ui/hud', () => ({ showBanner: vi.fn(), hud: {} }));
vi.mock('../src/flow', () => ({ flow: { defeat: vi.fn(), victory: vi.fn(), endWave: vi.fn() } }));

import { ArenaScene } from '../src/scenes/ArenaScene';
import { PhaserCtx } from '../src/scenes/phaserCtx';
import { buildHooks, EMPTY_HOOKS } from '../src/engine/hooks';
import { createRun, recomputeBuild } from '../src/state/run';
import { store } from '../src/state/store';
import { flow } from '../src/flow';

const coin = (extra = {}) => ({
  active: true, bread: false, pull: false, x: 1000, y: 200, z: 0, vx: 0, vy: 0, vz: 0, label: 'Milk',
  img: { setVisible: vi.fn(), setPosition() { return this; }, setDepth() { return this; }, setScale() { return this; } },
  ...extra,
});

function arena(coins = [coin()]) {
  const timers: { ms: number; fn: () => void }[] = [];
  const a = Object.assign(Object.create(ArenaScene.prototype), {
    coins, player: { x: 200, y: 200, dead: false, facing: 1 }, coinStreak: 0, coinStreakT: 0,
    obstacles: [], hooks: EMPTY_HOOKS, ending: '', rig: {}, groups: [], enemies: [], boss: { def: { id: 'boss' }, x: 600, y: 400 },
    fx: { puff: vi.fn(), number: vi.fn(), shake: vi.fn() },
    hazards: { onIce: () => false, beltPush: () => 0, stop: vi.fn() },
    aisleEvent: { stop: vi.fn() }, gum: { clear: vi.fn() }, arsenal: { clearAll: vi.fn() },
    tweens: { add: vi.fn(), timeScale: 1 }, time: { now: 0, delayedCall: (ms: number, fn: () => void) => timers.push({ ms, fn }) },
  }) as {
    coins: ReturnType<typeof coin>[]; player: { dead: boolean }; hooks: typeof EMPTY_HOOKS;
    updateCoins(dt: number): void; playerDied(): void; beginCheckout(): void; bossDefeated(): void;
  };
  a.hooks = buildHooks(store.state.inventory, store.state.build.recipes, store.state.build.sets, new PhaserCtx(a as unknown as ArenaScene));
  return { a, timers };
}

beforeEach(() => { store.state = createRun(1); store.state.phase = 'combat'; vi.clearAllMocks(); });

function equipMagnet(): void {
  store.state.inventory.placed.push({ uid: 'magnet', type: 'magnet', x: 4, y: 0, rot: 0 });
  recomputeBuild(store.state);
}

describe('arena coin collection', () => {
  it('the magnet brings a faraway coin all the way in and credits it exactly once', () => {
    equipMagnet();
    const { a } = arena();
    const before = store.state.money;
    for (let i = 0; i < 100; i++) { a.hooks.emit('onTick', 0.05); a.updateCoins(0.05); }
    expect(a.coins[0].active).toBe(false);
    expect(store.state.money).toBe(before + 1);
    expect(store.state.coinLog).toContainEqual({ label: 'Milk', amount: 1 });
  });

  it('without a magnet, remote coins remain on the floor during combat', () => {
    const { a } = arena();
    a.updateCoins(0.05);
    expect(a.coins[0]).toMatchObject({ active: true, pull: false });
  });

  it('large pickup radii and slow frames cannot make a pulled coin overshoot and oscillate', () => {
    store.state.build.pickupRadius = 1000;
    const { a } = arena([coin({ x: 231, y: 180, pull: true })]);
    const before = store.state.money;
    a.updateCoins(0.05);
    expect(a.coins[0].active).toBe(false);
    expect(store.state.money).toBe(before + 1);
  });

  it.each(['checkout', 'victory', 'defeat'] as const)('%s settles every remaining coin before leaving, never counting bread as gold', (ending) => {
    equipMagnet();
    const { a, timers } = arena([coin(), coin(), coin({ bread: true }), coin({ active: false })]);
    const before = store.state.money;
    const earned = store.state.stats.coinsEarned;
    const exit = ending === 'checkout' ? flow.endWave : ending === 'victory' ? flow.victory : flow.defeat;
    vi.mocked(exit).mockImplementation(() => {
      expect(store.state.money).toBe(before + 2);
      expect(store.state.stats.coinsEarned).toBe(earned + 2);
    });
    if (ending === 'checkout') a.beginCheckout();
    else if (ending === 'victory') a.bossDefeated();
    else a.playerDied();
    const finish = timers.find((t) => t.ms === (ending === 'checkout' ? 1700 : ending === 'victory' ? 2200 : 1300))!;
    finish.fn();
    a.updateCoins(0.05);
    expect(a.coins.every((c) => !c.active)).toBe(true);
    expect(store.state.money).toBe(before + 2);
    expect(exit).toHaveBeenCalledOnce();
  });

  it('bread pulled into a dead player cannot revive them or become a coin', () => {
    const { a } = arena([coin({ bread: true, x: 200, y: 180, pull: true })]);
    a.player.dead = true; store.state.hp = 0;
    const before = store.state.money;
    a.updateCoins(0.05);
    expect(store.state.hp).toBe(0);
    expect(store.state.money).toBe(before);
  });
});
