import { beforeEach, describe, expect, it, vi } from 'vitest';

// ArenaScene cannot boot headless, but killEnemy only touches a few scene parts. Phaser is a stub and the scene a bare prototype instance.
vi.hoisted(() => { Object.assign(globalThis, { location: { search: '' }, window: globalThis, matchMedia: () => ({ matches: true }) }); });
vi.mock('phaser', () => {
  const stub: object = new Proxy(function () {}, { get: (_t, k) => (k === 'prototype' ? {} : stub) });
  return { default: stub };
});

import { ArenaScene } from '../src/scenes/ArenaScene';
import type { Enemy } from '../src/scenes/enemies';
import { store } from '../src/state/store';
import { createRun } from '../src/state/run';
import { t } from '../src/i18n';

type Arena = ArenaScene & { dropCoin: ReturnType<typeof vi.fn> };

function arena(): Arena {
  const noop = (): void => {};
  return Object.assign(Object.create(ArenaScene.prototype), {
    fx: { puff: noop, crumbsAt: noop }, gum: { drop: noop }, tweens: { killTweensOf: noop, add: noop },
    ending: '', boss: null, mini: null, player: { shoveCd: 0 }, dept: { coinMult: 1, breadHeal: false }, breadDropped: 0,
    aisleEvent: { coinMult: () => 1 }, hooks: { onKill: [], emit: noop }, rng: () => 0.5,
    dropCoin: vi.fn(),
  });
}

function pickpocket(loot: number): Enemy {
  return {
    alive: true, state: 'chase', def: { id: 'cereal', coins: 1, behavior: 'chase' }, affix: 'pickpocket', elite: true, loot, x: 400, y: 400,
    sprite: { clearTint: () => {}, scaleX: 1, scaleY: 1 }, shadow: {},
  } as unknown as Enemy;
}

const stolenDrops = (a: Arena): number => a.dropCoin.mock.calls.filter((c) => c[2] === t('coinStolen')).length;

beforeEach(() => {
  store.state = createRun(1);
  store.state.phase = 'combat';
});

describe('a Pickpocket elite gives back the coins it stole', () => {
  it('when it dies without kill credit (checkout, mini-boss and boss ends)', () => {
    const a = arena();
    a.killEnemy(pickpocket(12), false);
    expect(stolenDrops(a)).toBe(12);
  });

  it('once when it dies with kill credit', () => {
    const a = arena();
    a.killEnemy(pickpocket(12), true);
    expect(stolenDrops(a)).toBe(12);
  });
});
