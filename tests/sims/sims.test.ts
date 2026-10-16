import { describe, expect, it } from 'vitest';
import { createSimRegistry, simRegistry } from '../../src/sims/_registry';
import { SIM_DEFAULTS, SimError, defineSim, layoutCart, simDummies, validateSim, type SimDef } from '../../src/sims/_sim';
import { createSimRun } from '../../src/state/sim';
import { setLevels } from '../../src/data/sets';
import { ITEMS } from '../../src/data/items';
import { footprint } from '../../src/systems/inventory';
import { BOSS_WAVE } from '../../src/data/waves';
import { mulberry32 } from '../../src/systems/rng';
import type { ItemTypeId, SetId } from '../../src/types';

const sim = (id: string): SimDef => simRegistry.get(id)!;
const base = (over: Partial<SimDef> = {}): SimDef => defineSim({ id: 'tmp', cart: [{ id: 'toaster' }], ...over });

describe('sim registry', () => {
  it('finds the starter sims, id = file name', () => {
    expect(simRegistry.ids).toEqual(expect.arrayContaining(['example', 'kitchen-heat', 'electric-l1', 'electric-l3', 'frost-cleaning', 'blast', 'dash-tools', 'snacks-defense', 'elites', 'wave3', 'boss']));
    for (const id of simRegistry.ids) expect(sim(id).id).toBe(id);
  });
  it('every sim validates', () => {
    expect(simRegistry.problems).toEqual([]);
  });
  it('reports a wrong id, a broken file and keeps going', () => {
    const r = createSimRegistry({ './a.ts': base({ id: 'b' }), './c.ts': { nope: 1 }, './d.ts': base({ id: 'd' }) });
    expect(r.ids).toEqual(['a', 'c', 'd']);
    expect(r.problemsOf('a')[0]).toMatch(/must equal the file name "a"/);
    expect(r.problemsOf('c')[0]).toMatch(/no default export/);
    expect(r.problemsOf('d')).toEqual([]);
    expect(r.get('c')).toBeUndefined();
  });
});

describe('validateSim', () => {
  it('accepts the minimal sim', () => expect(validateSim(base(), 'tmp')).toEqual([]));
  it('rejects a bad id', () => {
    expect(validateSim(base({ id: 'Bad Id' }))).not.toEqual([]);
    expect(validateSim(base({ id: 'x' }), 'y').join()).toMatch(/file name "y"/);
  });
  it('rejects unknown ids and out-of-range values', () => {
    expect(validateSim(base({ cart: [{ id: 'nope' as ItemTypeId }] })).join()).toMatch(/unknown item "nope"/);
    expect(validateSim(base({ cart: [{ id: 'toaster', tier: 4 as 3 }] })).join()).toMatch(/tier 4/);
    expect(validateSim(base({ cart: [{ id: 'goldstar', tier: 2 }] })).join()).toMatch(/legendary/);
    expect(validateSim(base({ aisle: 16 })).join()).toMatch(/aisle 16/);
    expect(validateSim(base({ doorMod: 'zzz' as never })).join()).toMatch(/doorMod/);
    expect(validateSim(base({ event: 'zzz' as never })).join()).toMatch(/event/);
    expect(validateSim(base({ department: 'boss' as never })).join()).toMatch(/department/);
    expect(validateSim(base({ cart: [{ id: 'toaster', flavor: 'frost' }] })).join()).toMatch(/flavor/);
    expect(validateSim(base({ enemies: [{ id: 'zzz' as never }] })).join()).toMatch(/unknown enemy/);
  });
  it('rejects an overlap', () => {
    const e = validateSim(base({ cart: [{ id: 'toaster', at: [0, 0] }, { id: 'pan', at: [1, 0] }] }));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/cart\[1\] pan at \[1,0\]/);
  });
  it('rejects out of bounds', () => {
    expect(validateSim(base({ cart: [{ id: 'toaster', at: [6, 0] }] })).join()).toMatch(/toaster at \[6,0\]/); // 7 columns: the 2nd cell is at x = 7
    expect(validateSim(base({ cartSize: [3, 3], cart: [{ id: 'pan', at: [0, 1] }] })).join()).toMatch(/pan at/);
    expect(validateSim(base({ cart: [{ id: 'toaster', at: [-1, 0] }] }))).not.toEqual([]);
  });
  it('rejects a cart that does not fit', () => {
    expect(validateSim(base({ cartSize: [1, 1], cart: [{ id: 'toaster' }] })).join()).toMatch(/no free spot/);
  });
  it('rejects an affix the enemy cannot have', () => {
    expect(validateSim(base({ enemies: [{ id: 'cereal', affix: 'bogus' as never }] })).join()).toMatch(/unknown affix/);
    expect(validateSim(base({ enemies: [{ id: 'egg', affix: 'swift' }] })).join()).toMatch(/never be an elite/);
    expect(validateSim(base({ enemies: [{ id: 'boss', affix: 'elite' }] })).join()).toMatch(/never be an elite/);
    expect(validateSim(base({ enemies: [{ id: 'honey', affix: 'splitter' }] })).join()).toMatch(/cannot be a Splitter/);
    expect(validateSim(base({ enemies: [{ id: 'cereal', affix: 'splitter' }, { id: 'honey', affix: 'swift' }, { id: 'milk', affix: 'elite' }] }))).toEqual([]);
  });
  it('rejects enemies with waves:true', () => {
    expect(validateSim(base({ waves: true, enemies: [{ id: 'milk' }] })).join()).toMatch(/waves: false/);
    expect(validateSim(base({ waves: true, enemies: [] }))).toEqual([]);
  });
  it('rejects bad enemy positions and counts', () => {
    expect(validateSim(base({ enemies: [{ id: 'milk', at: [10, 10] }] })).join()).toMatch(/outside the arena/);
    expect(validateSim(base({ enemies: [{ id: 'milk', count: 0 }] })).join()).toMatch(/count/);
    expect(validateSim(base({ enemies: [{ id: 'milk', mini: 99 }] })).join()).toMatch(/mini/);
    expect(validateSim(base({ enemies: [{ id: 'milk', spread: 'blob' as never }] })).join()).toMatch(/spread/);
  });
});

describe('auto-place', () => {
  it('fills the first free spot, scanning rotations, and never overlaps', () => {
    const cart = (['toaster', 'pan', 'vacuum', 'laser', 'mop', 'microwave'] as ItemTypeId[]).map((id) => ({ id }));
    const { slots, errors } = layoutCart({ cart });
    expect(errors).toEqual([]);
    expect(slots[0]).toMatchObject({ type: 'toaster', x: 0, y: 0, rot: 0 });
    const cells = slots.flatMap((s) => footprint({ uid: 'u', type: s!.type, x: s!.x, y: s!.y, rot: s!.rot, tier: s!.tier }).map((c) => `${c.x},${c.y}`));
    expect(new Set(cells).size).toBe(cells.length);
  });
  it('uses a rotation when the upright shape does not fit', () => {
    const { slots } = layoutCart({ cartSize: [1, 3], cart: [{ id: 'toaster' }] }); // 2x1 only fits turned
    expect(slots[0]).toMatchObject({ x: 0, y: 0, rot: 1 });
  });
  it('places entries with `at` first, so auto items cannot steal their cells', () => {
    const { slots, errors } = layoutCart({ cart: [{ id: 'pan' }, { id: 'toaster', at: [0, 0] }] });
    expect(errors).toEqual([]);
    expect(slots[1]).toMatchObject({ x: 0, y: 0 });
    expect(slots[0]).not.toMatchObject({ x: 0, y: 0 });
  });
});

describe('createSimRun', () => {
  it('places exactly the listed items, no starter weapon left over', () => {
    for (const id of simRegistry.ids) {
      const s = createSimRun(sim(id));
      expect(s.inventory.placed.map((i) => i.type).sort(), id).toEqual(sim(id).cart.map((e) => e.id).sort());
      expect(s.inventory.shelf.filter(Boolean).map((i) => i!.type).sort(), id).toEqual((sim(id).shelf ?? []).map((e) => e.id).sort());
      expect(new Set([...s.inventory.placed, ...s.inventory.shelf.filter(Boolean)].map((i) => i!.uid)).size).toBe(s.inventory.placed.length + (sim(id).shelf?.length ?? 0));
    }
  });
  it('keeps the toaster starter out of a cart without one', () => {
    const s = createSimRun(base({ cart: [{ id: 'pan' }] }));
    expect(s.inventory.placed).toHaveLength(1);
    expect(s.inventory.placed[0].type).toBe('pan');
    expect(s.build.weapons.map((w) => w.type)).toEqual(['pan']);
  });
  it('computes the build and applies tiers and the fixed fields', () => {
    const s = createSimRun(sim('elites'));
    expect(s.inventory.placed[0].tier).toBe(3);
    expect(s.build.weapons[0].tier).toBe(3);
    expect(s).toMatchObject({ lab: true, labSandbox: true, labGod: true, phase: 'combat', money: 999, seed: 1, wave: 1, shop: null });
    expect(s.hp).toBe(s.build.maxHp);
  });
  it('is deterministic for a fixed seed, including the shop', () => {
    const a = createSimRun(base({ start: 'shop', seed: 5 })), b = createSimRun(base({ start: 'shop', seed: 5 }));
    expect(a).toEqual(b);
    expect(a.phase).toBe('shop');
    expect(a.shop!.offers.length).toBeGreaterThan(0);
  });
  it('honours the scenario fields', () => {
    const s = createSimRun(sim('example'));
    expect(s).toMatchObject({ money: 500, seed: 7, shopLevel: 2, wave: 2, theme: 'frozen', department: 'frozen', modifier: 'quiet', labEvent: 'wetFloor' });
    expect(s.inventory).toMatchObject({ cols: 6, rows: 4 });
    expect(s.inventory.shelf.filter(Boolean).map((i) => [i!.type, i!.tier])).toEqual([['bell', 1], ['battery', 2]]);
    expect(s.inventory.placed.find((i) => i.type === 'jellybeans')!.flavor).toBe('frost');
    expect(createSimRun(base({ god: false })).labGod).toBe(false);
  });
  it('keeps Jelly Beans flavors after the shop opened', () => {
    const s = createSimRun(base({ start: 'shop', seed: 3, cart: [{ id: 'jellybeans', flavor: 'blast' }, { id: 'toaster' }] }));
    expect(s.inventory.placed.find((i) => i.type === 'jellybeans')!.flavor).toBe('blast');
  });
  it('waves:true reaches the real aisle through the shop and door', () => {
    const w = createSimRun(sim('wave3'), mulberry32(1));
    expect(w).toMatchObject({ phase: 'combat', wave: 3, labSandbox: false, department: 'main', modifier: 'none', labEvent: 'random' });
    const b = createSimRun(sim('boss'));
    expect(b).toMatchObject({ phase: 'combat', wave: BOSS_WAVE, department: 'boss' });
    expect(createSimRun(base({ waves: true, aisle: 3, start: 'shop' }))).toMatchObject({ phase: 'shop', wave: 2 });
  });
  it('start:shop stays in the shop', () => {
    expect(createSimRun(base({ start: 'shop' })).phase).toBe('shop');
  });
  it('throws a SimError with the problems for an invalid sim', () => {
    try { createSimRun(base({ cart: [{ id: 'toaster', at: [0, 0] }, { id: 'toaster', at: [0, 0] }] })); expect.unreachable(); }
    catch (e) { expect(e).toBeInstanceOf(SimError); expect((e as SimError).problems).toHaveLength(1); }
  });
});

describe('starter sims', () => {
  const lv = (id: string): Record<SetId, number> => setLevels(createSimRun(sim(id)).inventory.placed);
  it('reach the stated set levels', () => {
    expect(lv('kitchen-heat')).toMatchObject({ kitchen: 3, heat: 3 });
    expect(lv('electric-l1').electric).toBe(1);
    expect(lv('electric-l3').electric).toBe(3);
    expect(lv('frost-cleaning')).toMatchObject({ frost: 3, cleaning: 3 });
    expect(lv('blast').blast).toBe(3);
    expect(lv('dash-tools').tools).toBe(3);
    expect(lv('snacks-defense').snacks).toBe(3);
  });
  it('put every module next to a weapon', () => {
    for (const id of simRegistry.ids) {
      const s = createSimRun(sim(id));
      const weapons = new Set(s.build.weapons.map((w) => w.uid));
      for (const m of s.inventory.placed.filter((i) => ITEMS[i.type].kind === 'module')) {
        const touching = s.build.adjacency.some(([a, b]) => (a === m.uid && weapons.has(b)) || (b === m.uid && weapons.has(a)));
        expect(touching, `${id}: ${m.type} touches no weapon`).toBe(true);
      }
    }
  });
  it('have the stated enemies', () => {
    const count = (id: string, enemy: string) => simDummies(sim(id)).filter((d) => d.id === enemy).length;
    expect(count('kitchen-heat', 'milk')).toBe(12);
    expect(count('electric-l3', 'cereal')).toBe(8);
    expect(count('frost-cleaning', 'cereal')).toBe(6);
    expect(count('blast', 'milk')).toBe(12);
    expect(count('dash-tools', 'cereal')).toBe(6);
    expect(count('dash-tools', 'spitter')).toBe(2);
    for (const id of ['snacks-defense', 'blast', 'kitchen-heat']) expect(simDummies(sim(id)).every((d) => !d.immortal)).toBe(true);
    expect(simDummies(sim('elites')).map((d) => d.affix).sort()).toEqual(['pickpocket', 'splitter', 'swift', 'tough']);
    expect(sim('snacks-defense').god).toBe(false);
    expect(simDummies(sim('wave3'))).toEqual([]);
    expect(sim('wave3')).toMatchObject({ waves: true, aisle: 3, department: 'main' });
    expect(sim('boss')).toMatchObject({ waves: true, aisle: 8 });
  });
});

describe('simDummies', () => {
  it('expands counts with defaults (immortal, not still) and shares one group', () => {
    const d = simDummies({ enemies: [{ id: 'milk', count: 3, spread: 'cluster' }, { id: 'cereal' }] });
    expect(d).toHaveLength(4);
    expect(d[0]).toMatchObject({ id: 'milk', still: false, immortal: true, place: { spread: 'cluster', slot: 0, of: 3, group: 0 } });
    expect(d[2].place).toMatchObject({ slot: 2, of: 3, group: 0 });
    expect(d[3].place).toBeUndefined();
  });
  it('carries at, affix, still, immortal and mini', () => {
    const [d] = simDummies({ enemies: [{ id: 'melon', at: [300, 300], affix: 'tough', still: true, immortal: false, mini: 1 }] });
    expect(d).toMatchObject({ id: 'melon', still: true, immortal: false, mini: 1, affix: 'tough', place: { at: [300, 300], spread: 'random' } });
  });
});

describe('defaults', () => {
  it('are the documented ones', () => {
    expect(SIM_DEFAULTS).toMatchObject({ character: 'toaster', aisle: 1, department: 'main', doorMod: 'none', event: 'none', shift: 0, waves: false, start: 'arena', god: true, money: 999, seed: 1, cartSize: [7, 5], shopLevel: 1 });
  });
});
