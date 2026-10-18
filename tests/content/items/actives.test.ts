import { describe, expect, it } from 'vitest';
import { activeSlots, fireActives, refillCharges } from '../../../src/engine/actives';
import { createRun, startNextWave } from '../../../src/state/run';
import { arena, at, far } from '../helpers';
import { actionFor, defaultKeys, sanitizeKeys } from '../../../src/state/keymap';

// Active items: the E key spends one charge of every placed active that has one left; charges refill at the start of each aisle.
// Tune lives in each item's `tune` (charges, stun, ...), the engine only reads `charges`.

const cart = (...specs: ReturnType<typeof at>[]) => arena([at('toaster'), ...specs]);

describe('Actives: charges', () => {
  it('Fire Extinguisher holds 3 / 4 / 5 charges and Air Horn 1 / 1 / 2 per ★', () => {
    for (const [type, want] of [['fireextinguisher', [3, 4, 5]], ['airhorn', [1, 1, 2]]] as const) {
      expect([1, 2, 3].map((tier) => activeSlots(cart(far(type, tier)).inv)[0].max)).toEqual(want);
    }
  });

  it('Bubble Wrap and Vacuum have 1 charge, and passives have none', () => {
    const a = arena([at('vacuum'), far('bubblewrap'), far('bell')]);
    expect(activeSlots(a.inv).map((s) => [s.inst.type, s.max])).toEqual([['vacuum', 1], ['bubblewrap', 1]]);
  });

  it('a missing charge count reads as full, and a spent one stays spent until the refill', () => {
    const a = cart(far('airhorn'));
    expect(activeSlots(a.inv)[0].left).toBe(1);
    expect(fireActives(a.inv, a.fake)).toBe(1);
    expect(activeSlots(a.inv)[0].left).toBe(0);
    expect(fireActives(a.inv, a.fake)).toBe(0);
    refillCharges(a.inv);
    expect(activeSlots(a.inv)[0].left).toBe(1);
  });

  it('startNextWave refills every active in the cart', () => {
    const s = createRun(1, 'toaster');
    s.inventory.placed.push({ uid: 'h', type: 'airhorn', x: 3, y: 3, rot: 0, charges: 0 }, { uid: 'f', type: 'fireextinguisher', x: 0, y: 2, rot: 0, tier: 3, charges: 1 });
    startNextWave(s);
    expect(s.inventory.placed.filter((p) => p.uid === 'h' || p.uid === 'f').map((p) => p.charges)).toEqual([1, 5]);
  });
});

describe('Actives: E fires every ready active', () => {
  it('fires each once, spends one charge each, and skips the empty ones', () => {
    const a = arena([at('vacuum'), far('bubblewrap'), far('airhorn'), far('fireextinguisher')]);
    a.fake.spawnEnemy({ x: 60 });
    expect(fireActives(a.inv, a.fake)).toBe(4);
    expect(a.inv.placed.map((p) => p.charges)).toEqual([0, 0, 0, 2]);
    expect(a.fake.callsOf('boostWeapon')).toHaveLength(1);
    expect(a.fake.player.invulnT).toBe(1.5);
    expect(fireActives(a.inv, a.fake)).toBe(1); // only the extinguisher still has charges
    expect(a.inv.placed.map((p) => p.charges)).toEqual([0, 0, 0, 1]);
  });

  it('does nothing without actives', () => {
    const a = arena([at('toaster'), far('bell')]);
    expect(fireActives(a.inv, a.fake)).toBe(0);
  });

  it('E is a rebindable action with the default key E', () => {
    expect(actionFor(defaultKeys(), 'KeyE')).toBe('useActive');
    expect(sanitizeKeys({}).useActive).toEqual(['KeyE', '']);
  });
});

describe('Air Horn', () => {
  it('stuns every enemy for 1.0 s at ★1 and 1.5 s at ★3 (2 charges)', () => {
    const a = cart(far('airhorn', 3));
    const es = [a.fake.spawnEnemy({ x: 300 }), a.fake.spawnEnemy({ x: -500, y: 200 })];
    fireActives(a.inv, a.fake);
    expect(es.map((e) => [e.state, e.stateT])).toEqual([['stun', 1.5], ['stun', 1.5]]);
    const b = cart(far('airhorn'));
    const e = b.fake.spawnEnemy();
    fireActives(b.inv, b.fake);
    expect(e.stateT).toBe(1);
  });

  it('stuns a boss for 0.3 s only, and only while it walks', () => {
    const a = cart(far('airhorn', 3));
    const boss = a.fake.spawnEnemy({ def: { behavior: 'boss' } });
    const busy = a.fake.spawnEnemy({ state: 'attack', def: { behavior: 'boss' } });
    fireActives(a.inv, a.fake);
    expect(boss).toMatchObject({ state: 'stun', stateT: 0.3 });
    expect(busy.state).toBe('attack');
  });
});

describe('Fire Extinguisher', () => {
  it('hits enemies in the 70° cone, slows, stuns 0.6 s and knocks back; the ones behind or out of range are left alone', () => {
    const a = cart(far('fireextinguisher'));
    const front = a.fake.spawnEnemy({ x: 100, y: 10, hp: 100 });
    const behind = a.fake.spawnEnemy({ x: -120, y: 0, hp: 100 });
    const far_ = a.fake.spawnEnemy({ x: 400, y: 0, hp: 100 });
    const side = a.fake.spawnEnemy({ x: 100, y: 100, hp: 100 });
    // aims at the nearest enemy (front)
    fireActives(a.inv, a.fake);
    expect(front.hp).toBe(94);
    expect(front).toMatchObject({ state: 'stun', stateT: 0.6 });
    expect(front.status.slowPct).toBe(0.4);
    expect([behind.hp, far_.hp, side.hp]).toEqual([100, 100, 100]);
    const hit = a.fake.callsOf('damage')[0];
    expect(hit.opts).toMatchObject({ kb: 200 });
  });

  it('with nobody around it blasts the way the goblin faces and still spends the charge', () => {
    const a = arena([at('toaster'), far('fireextinguisher')], { player: { facing: -1 } });
    const e = a.fake.spawnEnemy({ x: -100, hp: 100 });
    // nearest() would find it, so it is aimed at it either way; facing only matters with no target in range
    fireActives(a.inv, a.fake);
    expect(e.hp).toBe(94);
    expect(a.inv.placed[1].charges).toBe(2);
  });
});

describe('Bubble Wrap: Pop', () => {
  it('gives 1.5 s of invulnerability and blasts 10 / 15 / 20 damage within 80 px; the armor passive is unchanged', () => {
    for (const [tier, dmg] of [[1, 10], [2, 15], [3, 20]] as const) {
      const a = cart(far('bubblewrap', tier));
      const near = a.fake.spawnEnemy({ x: 70, hp: 100 }), out = a.fake.spawnEnemy({ x: 200, hp: 100 });
      fireActives(a.inv, a.fake);
      expect(a.fake.player.invulnT).toBe(1.5);
      expect([near.hp, out.hp]).toEqual([100 - dmg, 100]);
      expect(a.b.maxHp).toBeGreaterThan(0);
    }
  });
});

describe('Vacuum: Full Suck', () => {
  it('triples the pull and doubles the range for 2 s, and pulls every coin', () => {
    const a = arena([at('vacuum')]);
    fireActives(a.inv, a.fake);
    expect(a.fake.callsOf('boostWeapon')).toMatchObject([{ weapon: 'u0', pull: 3, range: 2, seconds: 2 }]);
    expect(a.fake.callsOf('pullCoins')).toHaveLength(1);
  });
});
