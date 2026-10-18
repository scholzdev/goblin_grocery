import { describe, expect, it } from 'vitest';
import { BOSS_WAVE, ECONOMY } from '../src/data/waves';
import { ITEMS } from '../src/data/items';
import { mulberry32 } from '../src/systems/rng';
import { firstFit } from '../src/systems/inventory';
import { DpsMeter, METER_WINDOW } from '../src/systems/dpsMeter';
import { createLabRun, labAddItem, labAisle, labApply, labClear, openShop } from '../src/state/run';
import { captureSlot, parseSlots, restoreSlot, slotItems, LAB_SLOT_COUNT } from '../src/state/lab';
import { LAB_FIELDS, labFieldOpen, labValue } from '../src/ui/labFields';
import type { ItemTypeId, LabOpts, RunState } from '../src/types';

const base: LabOpts = { aisle: 3, dept: 'frozen', shift: 0, starter: 'toaster', weapon: 'toaster', money: 500, cart: [4, 4], shelf: 4, shopLevel: 1, god: false, event: 'random', mod: 'none', sandbox: true };

function lab(o: Partial<LabOpts> = {}): RunState {
  const s = createLabRun(1, { ...base, ...o });
  openShop(s, mulberry32(1));
  return s;
}

describe('labApply', () => {
  it('a sandbox sits on the aisle and runs the chosen department and modifier (no door to walk through)', () => {
    const s = lab({ mod: 'rush' });
    expect([s.wave, s.labSandbox, s.department, s.theme, s.modifier]).toEqual([3, true, 'frozen', 'frozen', 'rush']);
    expect(labAisle(s)).toBe(3);
  });

  it('a real-aisle lab parks one aisle earlier and keeps its modifier for the door', () => {
    const s = lab({ sandbox: false, mod: 'rush' });
    expect([s.wave, labAisle(s), s.modifier]).toEqual([2, 3, 'none']);
    expect(s.labMod).toBe('rush');
  });

  it('switching the mode keeps the aisle', () => {
    const s = lab({ sandbox: false, aisle: 5 });
    labApply(s, { sandbox: true });
    expect(labAisle(s)).toBe(5);
    labApply(s, { sandbox: false });
    expect([s.wave, labAisle(s)]).toEqual([4, 5]);
  });

  it('moving to the boss aisle forces the boss department and no modifier, leaving it restores the department', () => {
    const s = lab({ mod: 'rush' });
    labApply(s, { aisle: BOSS_WAVE });
    expect([s.department, s.labDept, s.modifier, s.theme]).toEqual(['boss', 'boss', 'none', 'frozen']);
    labApply(s, { aisle: 4 });
    expect([s.department, s.modifier]).toEqual(['frozen', 'rush']);
  });

  it('aisles past the boss are overtime, and back again', () => {
    const s = lab();
    labApply(s, { aisle: BOSS_WAVE + 2 });
    expect(s.overtime).toBe(true);
    labApply(s, { aisle: 2 });
    expect(s.overtime).toBeUndefined();
  });

  it('a new department re-rolls the zone of that department', () => {
    const s = lab({ dept: 'main' });
    labApply(s, { dept: 'bakery' });
    expect([s.theme, s.department, s.route]).toEqual(['bakery', 'bakery', ['bakery']]);
    expect(s.zones).toEqual([s.zone]);
  });

  it('only the fields in the patch change (money stays when the patch has none)', () => {
    const s = lab();
    s.money = 77;
    labApply(s, { god: true, event: 'wetFloor', shift: 2, shopLevel: 3, starter: 'pan' });
    expect([s.money, s.labGod, s.labEvent, s.shift, s.shopLevel, s.starter]).toEqual([77, true, 'wetFloor', 2, 3, 'pan']);
    expect([s.wave, s.department]).toEqual([3, 'frozen']);
  });

  it('a smaller cart keeps what fits and moves the rest to the shelf; a smaller shelf drops what has no room', () => {
    const s = lab({ cart: ECONOMY.cartSizes[2], shelf: ECONOMY.shelfSizes[0] });
    labClear(s);
    const [c, r] = ECONOMY.cartSizes[2];
    for (let i = 0; i < c * r && labAddItem(s, 'battery', 1, 'cart').ok; i++);
    expect(s.inventory.placed.length).toBe(c * r);
    labApply(s, { cart: [4, 4] });
    expect(s.inventory.placed).toHaveLength(16);
    expect(s.inventory.shelf.filter(Boolean)).toHaveLength(Math.min(s.inventory.shelf.length, c * r - 16));
    expect(s.inventory.placed.every((i) => i.x < 4 && i.y < 4)).toBe(true);
    labApply(s, { shelf: 2 });
    expect(s.inventory.shelf).toHaveLength(2);
    expect(s.inventory.shelf.every(Boolean)).toBe(true);
  });
});

describe('labAddItem into the cart', () => {
  it('fills the cart front to back, recomputes the build and falls back to the shelf when it is full', () => {
    const s = lab({ cart: [6, 1], shelf: 2 });
    labClear(s);
    expect(labAddItem(s, 'fan', 1, 'cart')).toEqual({ ok: true, where: 'cart' });
    expect(s.inventory.placed[0]).toMatchObject({ type: 'fan', x: 0, y: 0 });
    labAddItem(s, 'toaster', 1, 'cart');
    expect(s.build.weapons.map((w) => w.type)).toContain('toaster');
    let where = 'cart';
    for (let i = 0; i < 12 && where === 'cart'; i++) { const r = labAddItem(s, 'battery', 1, 'cart'); where = r.ok ? r.where : 'none'; }
    expect(where).toBe('shelf');
    expect(s.inventory.shelf[0]?.type).toBe('battery');
  });

  it('tries the rotations: the fan is two tall by default, so a one-row cart gets it turned', () => {
    const s = lab({ cart: [3, 1] });
    labClear(s);
    expect(firstFit(s.inventory, 'fan', 1)).toMatchObject({ x: 0, y: 0, rot: 1 });
    expect(firstFit({ ...s.inventory, cols: 1, rows: 1 }, 'fan', 1)).toBeNull();
  });

  it('fails when cart and shelf are both full, and outside the cart editor', () => {
    const s = lab({ cart: [4, 4], shelf: 1 });
    labClear(s);
    while (labAddItem(s, 'battery', 1, 'cart').ok);
    expect(labAddItem(s, 'battery', 1, 'cart')).toEqual({ ok: false, reason: 'Staging shelf is full' });
    s.phase = 'combat';
    expect(labAddItem(s, 'battery', 1, 'cart').ok).toBe(false);
  });

  it('legendaries stay tier 1 in the cart too', () => {
    const legend = (Object.keys(ITEMS) as ItemTypeId[]).find((k) => ITEMS[k].legendary)!;
    const s = lab();
    labClear(s);
    labAddItem(s, legend, 3, 'cart');
    expect((s.inventory.placed[0] ?? s.inventory.shelf[0])!.tier).toBe(1);
  });
});

describe('loadout slots', () => {
  it('restores the cart, the shelf and their sizes, with fresh uids', () => {
    const s = lab({ cart: [5, 4], shelf: 6 });
    labClear(s);
    labAddItem(s, 'fan', 2, 'cart');
    labAddItem(s, 'toaster', 1, 'shelf');
    const slot = JSON.parse(JSON.stringify(captureSlot(s)));
    expect(slotItems(slot)).toBe(2);
    labApply(s, { cart: [4, 4], shelf: 4 });
    labClear(s);
    expect(restoreSlot(s, slot)).toEqual({ ok: true });
    expect([s.inventory.cols, s.inventory.rows, s.inventory.shelf.length]).toEqual([5, 4, 6]);
    expect(s.inventory.placed[0]).toMatchObject({ type: 'fan', tier: 2 });
    expect(s.inventory.shelf[0]?.type).toBe('toaster');
    const uids = [...s.inventory.placed, ...s.inventory.shelf.filter(Boolean)].map((i) => i!.uid);
    expect(new Set(uids).size).toBe(2);
    expect(uids).not.toEqual(slot.placed.map((i: { uid: string }) => i.uid));
  });

  it('is only restored in the cart editor', () => {
    const s = lab();
    const slot = captureSlot(s);
    s.phase = 'combat';
    expect(restoreSlot(s, slot).ok).toBe(false);
  });

  it('parses storage into a fixed number of slots and treats damage as empty', () => {
    const s = lab();
    const good = captureSlot(s);
    const slots = parseSlots(JSON.stringify([good, { cols: 'x' }]));
    expect(slots).toHaveLength(LAB_SLOT_COUNT);
    expect(slots[0]).toEqual(good);
    expect(slots.slice(1)).toEqual([null, null]);
    expect(parseSlots('not json')).toEqual([null, null, null]);
    expect(parseSlots(null)).toEqual([null, null, null]);
  });
});

describe('DpsMeter', () => {
  const by = (v: number) => ({ toaster: v });

  it('reads nothing before the first hit', () => {
    const m = new DpsMeter();
    m.reset(10, 0, {});
    m.observe(11, 0, {});
    expect(m.read()).toMatchObject({ total: 0, rolling: 0, average: 0, peak: 0, seconds: 0, sources: [] });
  });

  it('counts from the baseline, per source, and reports the average over the time between first and last hit', () => {
    const m = new DpsMeter();
    m.reset(100, 500, { toaster: 400, fan: 100 });
    m.observe(101, 500, { toaster: 400, fan: 100 });
    m.observe(102, 560, { toaster: 430, fan: 130 });
    m.observe(103, 620, { toaster: 490, fan: 130 });
    m.observe(110, 620, { toaster: 490, fan: 130 });
    const r = m.read();
    expect(r.total).toBe(120);
    expect(r.sources).toEqual([['toaster', 90], ['fan', 30]]);
    expect(r.average).toBeCloseTo(120 / 2); // first hit between t=101 and 102, last at t=103
    expect(r.rolling).toBe(0); // the window has moved past every hit
    expect(r.peak).toBeGreaterThan(0);
  });

  it('rolling DPS covers the last window and drops older damage', () => {
    const m = new DpsMeter();
    m.reset(0, 0, {});
    for (let t = 1; t <= 20; t++) m.observe(t, t < 10 ? t * 10 : 90, by(t < 10 ? t * 10 : 90)); // 10 damage per second for 9 s, then nothing
    expect(m.read().rolling).toBe(0);
    const n = new DpsMeter();
    n.reset(0, 0, {});
    for (let t = 1; t <= 12; t++) n.observe(t, t * 10, by(t * 10));
    expect(n.read().rolling).toBeCloseTo(10, 5);
    expect(METER_WINDOW).toBe(5);
  });

  it('peak never falls and survives a quiet spell', () => {
    const m = new DpsMeter();
    m.reset(0, 0, {});
    m.observe(1, 100, by(100));
    m.observe(2, 200, by(200));
    const peak = m.read().peak;
    expect(peak).toBeGreaterThan(0);
    m.observe(30, 200, by(200));
    expect(m.read().peak).toBe(peak);
  });

  it('restarts when the clock or the total goes backwards (a new run)', () => {
    const m = new DpsMeter();
    m.reset(0, 0, {});
    m.observe(5, 500, by(500));
    m.observe(1, 20, by(20));
    expect(m.read()).toMatchObject({ total: 0, seconds: 0 });
  });
});

describe('lab setup fields', () => {
  it('every control value parses back into the field it came from', () => {
    for (const key of Object.keys(LAB_FIELDS) as (keyof typeof LAB_FIELDS)[]) {
      const patch = LAB_FIELDS[key].parse(labValue(base, key));
      expect(patch[key], key).toEqual(base[key]);
    }
  });

  it('the mode control maps to the sandbox flag', () => {
    expect(LAB_FIELDS.sandbox.parse('dummies')).toEqual({ sandbox: true });
    expect(LAB_FIELDS.sandbox.parse('aisle')).toEqual({ sandbox: false });
    expect(labValue({ ...base, sandbox: false }, 'sandbox')).toBe('aisle');
  });

  it('only fields that make sense live are open in the arena', () => {
    expect(labFieldOpen('dept', 'arena')).toBe(true);
    expect(labFieldOpen('cart', 'arena')).toBe(false);
    expect(labFieldOpen('cart', 'shop')).toBe(true);
    expect(labFieldOpen('weapon', 'shop')).toBe(false);
    expect(labFieldOpen('weapon', 'title')).toBe(true);
  });

  it('cart sizes in the control are the real ones', () => {
    const opts = LAB_FIELDS.cart.options!(base).map(([v]) => v);
    expect(opts).toContain('4x4');
    for (const [c, r] of ECONOMY.cartSizes) expect(opts).toContain(`${c}x${r}`);
  });
});
