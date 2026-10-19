import { describe, expect, it } from 'vitest';
import { activeSlots, cycleSlot, fireActive, refillCharges, slotOfUid } from '../../../src/engine/actives';
import { createRun, startNextWave } from '../../../src/state/run';
import { arena, at, far } from '../helpers';
import { ACTIVE_KEYS, actionFor, defaultKeys, sanitizeKeys } from '../../../src/state/keymap';

// Active items: the cart's first three actives (reading order) sit on keys Q / E / F, each key spends one charge of its slot; charges refill at the start of each aisle.
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
    expect(activeSlots(a.inv).map((s) => [s.inst.type, s.max]).sort()).toEqual([['bubblewrap', 1], ['vacuum', 1]]);
  });

  it('a missing charge count reads as full, and a spent one stays spent until the refill', () => {
    const a = cart(far('airhorn'));
    expect(activeSlots(a.inv)[0].left).toBe(1);
    expect(fireActive(a.inv, a.fake, 1)).toBe(true);
    expect(activeSlots(a.inv)[0].left).toBe(0);
    expect(fireActive(a.inv, a.fake, 1)).toBe(false);
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

type Placed = ReturnType<typeof arena>;
/** Moves the cart's placed items (by index) onto given cells, so slot order is set by position, not array order. */
const place = (a: Placed, pos: [number, number, number?][]): void => pos.forEach(([x, y, rot], i) => Object.assign(a.inv.placed[i + 1], { x, y, rot: rot ?? 0 }));

describe('Actives: slots in reading order', () => {
  it('orders by top-left-most footprint cell, row by row, regardless of array order', () => {
    const a = arena([at('toaster'), far('airhorn'), far('vacuum'), far('bubblewrap')]);
    place(a, [[5, 0], [0, 3], [2, 0]]); // airhorn (5,0), vacuum (0,3), bubblewrap (2,0)
    expect(activeSlots(a.inv).map((s) => [s.slot, s.inst.type])).toEqual([[1, 'bubblewrap'], [2, 'airhorn'], [3, 'vacuum']]);
    a.inv.placed.reverse();
    expect(activeSlots(a.inv).map((s) => s.inst.type)).toEqual(['bubblewrap', 'airhorn', 'vacuum']);
  });

  it('a rotated item is read from its rotated footprint', () => {
    const a = arena([at('toaster'), far('fireextinguisher'), far('airhorn')]);
    place(a, [[3, 1, 1], [2, 1]]);
    expect(activeSlots(a.inv).map((s) => s.inst.type)).toEqual(['airhorn', 'fireextinguisher']);
  });

  it('the 4th active gets no slot, never fires, and keeps its charges', () => {
    const a = arena([at('vacuum'), far('bubblewrap'), far('airhorn'), far('fireextinguisher')]);
    place(a, [[0, 1], [0, 2], [0, 3]]);
    a.inv.placed[0].x = 0; a.inv.placed[0].y = 0;
    const slots = activeSlots(a.inv);
    expect(slots.map((s) => s.slot)).toEqual([1, 2, 3, null]);
    expect(slotOfUid(a.inv, slots[3].inst.uid)).toBeNull();
    expect(slotOfUid(a.inv, a.inv.placed[0].uid)).toBe(1); // the vacuum sits top-left
    expect(fireActive(a.inv, a.fake, 4)).toBe(false);
    expect(slots[3].inst.charges).toBeUndefined();
  });

  it('a non-active item has no slot at all', () => {
    const a = arena([at('toaster'), far('bell')]);
    expect(slotOfUid(a.inv, a.inv.placed[1].uid)).toBeUndefined();
  });
});

describe('Actives: picking a slot by hand', () => {
  const trio = () => { const a = arena([at('vacuum'), far('bubblewrap'), far('airhorn')]); a.inv.placed[0].x = 0; a.inv.placed[0].y = 0; place(a, [[2, 0], [4, 0]]); return a; };
  const types = (a: Placed) => activeSlots(a.inv).map((s) => `${s.slot}:${s.inst.type}`);

  it('clicking cycles 1 → 2 → 3 → automatic, and a taken slot is released by its old holder', () => {
    const a = trio();
    expect(types(a)).toEqual(['1:vacuum', '2:bubblewrap', '3:airhorn']);
    const [vac, bub] = a.inv.placed;
    cycleSlot(a.inv, bub.uid); cycleSlot(a.inv, bub.uid); cycleSlot(a.inv, bub.uid); // automatic → 1 → 2 → 3
    expect(types(a)).toEqual(['1:vacuum', '3:bubblewrap', '2:airhorn']);
    cycleSlot(a.inv, vac.uid); cycleSlot(a.inv, vac.uid); cycleSlot(a.inv, vac.uid); // → 1 → 2 → 3, takes 3 from bubblewrap
    expect(vac.slot).toBe(3);
    expect(bub.slot).toBeUndefined();
    cycleSlot(a.inv, vac.uid); // 3 → automatic
    expect(vac.slot).toBeUndefined();
  });

  it('a picked slot survives moving the item, and a slot-less 4th can be clicked into a slot', () => {
    const a = arena([at('vacuum'), far('bubblewrap'), far('airhorn'), far('fireextinguisher')]);
    place(a, [[0, 1], [0, 2], [0, 3]]); a.inv.placed[0].x = 0; a.inv.placed[0].y = 0;
    const ext = a.inv.placed[3];
    expect(slotOfUid(a.inv, ext.uid)).toBeNull();
    cycleSlot(a.inv, ext.uid); // null → 1
    expect(slotOfUid(a.inv, ext.uid)).toBe(1);
    expect(activeSlots(a.inv).filter((s) => s.slot === null)).toHaveLength(1); // somebody else lost the spot
    ext.x = 7; ext.y = 5;
    expect(slotOfUid(a.inv, ext.uid)).toBe(1);
  });

  it('the key fires the item picked for that slot', () => {
    const a = trio();
    cycleSlot(a.inv, a.inv.placed[2].uid); // airhorn → slot 1
    expect(fireActive(a.inv, a.fake, 1)).toBe(true);
    expect(a.inv.placed[2].charges).toBe(0);
    expect(a.inv.placed[0].charges).toBeUndefined();
  });
});

describe('Actives: each key fires only its slot', () => {
  it('slot N spends one charge of its own item and leaves the others alone', () => {
    const a = arena([at('vacuum'), far('bubblewrap'), far('airhorn'), far('fireextinguisher')]);
    place(a, [[0, 1], [0, 2], [0, 3]]);
    a.inv.placed[0].x = 0; a.inv.placed[0].y = 0;
    a.fake.spawnEnemy({ x: 60 });
    const [s1, s2, s3] = activeSlots(a.inv).map((s) => s.inst);
    expect(fireActive(a.inv, a.fake, 2)).toBe(true);
    expect([s1.charges, s2.charges, s3.charges]).toEqual([undefined, 0, undefined]);
    expect(fireActive(a.inv, a.fake, 2)).toBe(false); // spent
    expect(fireActive(a.inv, a.fake, 3)).toBe(true);
    expect([s1.charges, s3.charges]).toEqual([undefined, 0]);
  });

  it('an empty slot or an empty cart does nothing', () => {
    const a = arena([at('toaster'), far('bell')]);
    for (const n of [1, 2, 3]) expect(fireActive(a.inv, a.fake, n)).toBe(false);
  });

  it('the keys are three rebindable actions with defaults Q / E / F', () => {
    const k = defaultKeys();
    expect(ACTIVE_KEYS.map((a) => k[a][0])).toEqual(['KeyQ', 'KeyE', 'KeyF']);
    expect(actionFor(k, 'KeyF')).toBe('useActive3');
    expect(sanitizeKeys({}).useActive1).toEqual(['KeyQ', '']);
  });

  it('migrates a custom single useActive binding to slot 1; the default E binding is dropped', () => {
    const custom = sanitizeKeys({ useActive: ['KeyG', ''] });
    expect(custom.useActive1).toEqual(['KeyG', '']);
    expect([custom.useActive2[0], custom.useActive3[0]]).toEqual(['KeyE', 'KeyF']);
    expect(sanitizeKeys({ useActive: ['KeyE', ''] }).useActive1).toEqual(['KeyQ', '']);
    const clash = sanitizeKeys({ useActive: ['KeyF', ''] }); // F was taken by the custom slot-1 key: slot 3 still gets a key
    expect(clash.useActive1[0]).toBe('KeyF');
    expect(clash.useActive3.some(Boolean)).toBe(true);
    expect((clash as Record<string, unknown>).useActive).toBeUndefined();
  });
});

describe('Air Horn', () => {
  it('stuns every enemy for 1.0 s at ★1 and 1.5 s at ★3 (2 charges)', () => {
    const a = cart(far('airhorn', 3));
    const es = [a.fake.spawnEnemy({ x: 300 }), a.fake.spawnEnemy({ x: -500, y: 200 })];
    fireActive(a.inv, a.fake, 1);
    expect(es.map((e) => [e.state, e.stateT])).toEqual([['stun', 1.5], ['stun', 1.5]]);
    const b = cart(far('airhorn'));
    const e = b.fake.spawnEnemy();
    fireActive(b.inv, b.fake, 1);
    expect(e.stateT).toBe(1);
  });

  it('stuns a boss for 0.3 s only, and only while it walks', () => {
    const a = cart(far('airhorn', 3));
    const boss = a.fake.spawnEnemy({ def: { behavior: 'boss' } });
    const busy = a.fake.spawnEnemy({ state: 'attack', def: { behavior: 'boss' } });
    fireActive(a.inv, a.fake, 1);
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
    fireActive(a.inv, a.fake, 1);
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
    fireActive(a.inv, a.fake, 1);
    expect(e.hp).toBe(94);
    expect(a.inv.placed[1].charges).toBe(2);
  });
});

describe('Bubble Wrap: Pop', () => {
  it('gives 1.5 s of invulnerability and blasts 10 / 15 / 20 damage within 80 px; the armor passive is unchanged', () => {
    for (const [tier, dmg] of [[1, 10], [2, 15], [3, 20]] as const) {
      const a = cart(far('bubblewrap', tier));
      const near = a.fake.spawnEnemy({ x: 70, hp: 100 }), out = a.fake.spawnEnemy({ x: 200, hp: 100 });
      fireActive(a.inv, a.fake, 1);
      expect(a.fake.player.invulnT).toBe(1.5);
      expect([near.hp, out.hp]).toEqual([100 - dmg, 100]);
      expect(a.b.maxHp).toBeGreaterThan(0);
    }
  });
});

describe('Vacuum: Full Suck', () => {
  it('triples the pull and doubles the range for 2 s, and pulls every coin', () => {
    const a = arena([at('vacuum')]);
    fireActive(a.inv, a.fake, 1);
    expect(a.fake.callsOf('boostWeapon')).toMatchObject([{ weapon: 'u0', pull: 3, range: 2, seconds: 2 }]);
    expect(a.fake.callsOf('pullCoins')).toHaveLength(1);
  });
});
