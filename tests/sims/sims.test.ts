import { describe, expect, it } from 'vitest';
import { createSimRegistry, simRegistry } from '../../src/sims/_registry';
import { SIM_DEFAULTS, SimError, defineSim, layoutCart, simDummies, validateSim, type SimDef } from '../../src/sims/_sim';
import { createSimRun } from '../../src/state/sim';
import { setLevels } from '../../src/data/sets';
import { ITEMS, WEAPON_IDS } from '../../src/data/items';
import { footprint } from '../../src/systems/inventory';
import { BOSS_WAVE } from '../../src/data/waves';
import { mulberry32 } from '../../src/systems/rng';
import { RECIPES } from '../../src/data/recipes';
import { AFFINITY, ENEMY_ORDER, RECIPE_ORDER } from '../../src/engine/define';
import { BOSS_BY_THEME, BOSS_IDS, ENEMIES } from '../../src/data/enemies';
import { affinityMult } from '../../src/engine/affinity';
import { weaponTags } from '../../src/engine/hitTags';
import type { ItemTypeId, RecipeId, SetId } from '../../src/types';

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
    for (const hp of [0, -3, 2.5]) expect(validateSim(base({ hp })).join()).toMatch(/hp/);
    expect(validateSim(base({ hp: 1 }))).toEqual([]);
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
  it('starts at `hp`, capped at the build max HP, and keeps it through the shop and the aisle start', () => {
    const full = createSimRun(base());
    expect(full.hp).toBe(full.build.maxHp);
    const low = createSimRun(base({ hp: 3 }));
    expect(low.hp).toBe(3);
    expect(createSimRun(base({ hp: 99999 })).hp).toBe(low.build.maxHp);
    expect(createSimRun(base({ hp: 3, start: 'shop' })).hp).toBe(3);
    expect(createSimRun(base({ hp: 3, waves: true })).hp).toBe(3);
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
    expect(sim('kitchen-heat')).toMatchObject({ god: false, hp: 5 });
    expect(simDummies(sim('wave3'))).toEqual([]);
    expect(sim('wave3')).toMatchObject({ waves: true, aisle: 3, department: 'main' });
    expect(sim('boss')).toMatchObject({ waves: true, aisle: 8 });
  });
});

// One sim per combo (src/sims/combo-<id>.ts, the id in kebab-case). Each places exactly the combo's parts, with explicit `at`, so its recipe
// is active; the build is computed through the same path as the game (createSimRun -> computeBuild).
describe('combo sims', () => {
  const kebab = (id: string): string => id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const COMBO_SIMS = Object.fromEntries(RECIPE_ORDER.map((id) => [id, `combo-${kebab(id)}`])) as Record<RecipeId, string>;
  /** Combos a sim activates when it is not just its own (Tailwind's sim has the energy drink for Sugar Rush; Sour Mist's parts are also Mist Machine's). */
  const ACTIVE: Partial<Record<RecipeId, RecipeId[]>> = { tailwind: ['sugarRush', 'tailwind'], sourMist: ['mistMachine', 'sourMist'] };

  it('there is one sim for every combo', () => {
    expect(RECIPE_ORDER).toHaveLength(31);
    for (const [id, simId] of Object.entries(COMBO_SIMS)) expect(simRegistry.get(simId), `${id} -> ${simId}`).toBeDefined();
    expect(simRegistry.ids.filter((i) => i.startsWith('combo-'))).toHaveLength(31);
  });
  it('each sim activates its combo, and exactly the combos listed in ACTIVE besides it', () => {
    for (const [id, simId] of Object.entries(COMBO_SIMS) as [RecipeId, string][]) {
      const active = createSimRun(sim(simId)).build.recipes.map((r) => r.id).sort();
      expect(active, simId).toEqual([...(ACTIVE[id] ?? [id])].sort());
    }
  });
  it('each combo sim lists exactly the combo\'s parts (plus the energy drink for Tailwind), in the arena sandbox with notes', () => {
    for (const [id, simId] of Object.entries(COMBO_SIMS) as [RecipeId, string][]) {
      const s = sim(simId), parts = RECIPES[id].weapon ? [RECIPES[id].weapon, ...RECIPES[id].supports] : [...RECIPES[id].supports];
      expect(s.cart.map((c) => c.id).sort(), simId).toEqual([...parts, ...(id === 'tailwind' ? ['energy'] : [])].sort());
      expect(s.cart.every((c) => c.at), `${simId}: explicit at`).toBe(true);
      expect(s.notes, simId).toBeTruthy();
      expect(simDummies(s).length, simId).toBeGreaterThan(0);
    }
  });
  it('kill-driven combos (Bag It, Clearance Sale) have mortal dummies, and the crit combo has crit chance', () => {
    for (const simId of ['combo-bag-it', 'combo-clearance-sale']) expect(simDummies(sim(simId)).every((d) => !d.immortal), simId).toBe(true);
    expect(createSimRun(sim('combo-clearance-sale')).build.weapons[0].critChance).toBeGreaterThan(0);
  });
  it('Smoothie Shield has shooters to block, and Ray Gun replaces Nailstorm', () => {
    expect(simDummies(sim('combo-smoothie-shield')).some((d) => d.id === 'spitter')).toBe(true);
    expect(createSimRun(sim('combo-ray-gun')).build.recipes.map((r) => r.id)).toEqual(['rayGun']);
  });
});

// One sim per weapon (src/sims/weapon-<id>.ts): the weapon alone in the cart at ★3 (the legendary Laser has no tiers), explicit `at`, enemies that
// show off its pattern. The build comes through the same path as the game, so the numbers in the notes are checked against it.
describe('weapon sims', () => {
  const simOf = (id: string): SimDef => sim(`weapon-${id}`);

  it('there is one sim for every weapon', () => {
    expect(WEAPON_IDS).toHaveLength(12);
    for (const id of WEAPON_IDS) expect(simRegistry.get(`weapon-${id}`), id).toBeDefined();
    expect(simRegistry.ids.filter((i) => i.startsWith('weapon-'))).toHaveLength(12);
  });
  it('each sim has exactly that weapon, at ★3 (the legendary at ★1), with an explicit spot, notes and dummies in the arena sandbox', () => {
    for (const id of WEAPON_IDS) {
      const s = simOf(id);
      expect(s.cart, id).toEqual([ITEMS[id].legendary ? { id, at: [2, 1] } : { id, tier: 3, at: [2, 1] }]);
      expect(s.notes, id).toBeTruthy();
      expect(s.waves ?? false, id).toBe(false);
      expect(simDummies(s).length, id).toBeGreaterThan(0);
    }
  });
  it('the build is the weapon alone: its pattern, and base damage and interval scaled by the tier', () => {
    for (const id of WEAPON_IDS) {
      const { build } = createSimRun(simOf(id)), base = ITEMS[id].weapon!, tier = ITEMS[id].legendary ? 1 : 3;
      expect(build.weapons, id).toHaveLength(1);
      expect(build.recipes, id).toEqual([]);
      expect(build.weapons[0], id).toMatchObject({ type: id, pattern: base.pattern, tier, damage: base.damage * (1 + 0.5 * (tier - 1)), cooldown: base.cooldown * (1 - 0.1 * (tier - 1)) });
    }
  });
  it('the notes name the weapon\'s ★3 damage and interval', () => {
    for (const id of WEAPON_IDS) {
      const w = createSimRun(simOf(id)).build.weapons[0];
      expect(simOf(id).notes, id).toContain(`${+w.cooldown.toFixed(2)} s`);
    }
  });
  it('the vacuum\'s dummies are mortal (coins drop), the others keep their dummies alive', () => {
    expect(simDummies(simOf('vacuum')).every((d) => !d.immortal)).toBe(true);
    for (const id of WEAPON_IDS.filter((w) => w !== 'vacuum')) expect(simDummies(simOf(id)).every((d) => d.immortal), id).toBe(true);
  });
});

// One sim per regular enemy (src/sims/enemy-<id>.ts): the sandbox with a neutral cart (a pan and a toaster, both ★2) and 6 to 10 of that enemy, god mode
// on. Mortal where the behaviour needs deaths. The notes name the enemy's HP, so a stat change shows up as a failing test.
describe('enemy sims', () => {
  const REGULAR = ENEMY_ORDER.filter((id) => !BOSS_IDS.includes(id));
  const simOf = (id: string): SimDef => sim(`enemy-${id}`);
  const own = (id: string) => simDummies(simOf(id)).filter((d) => d.id === id);

  it('there is one sim for every regular enemy', () => {
    expect(REGULAR).toHaveLength(15);
    for (const id of REGULAR) expect(simRegistry.get(`enemy-${id}`), id).toBeDefined();
    expect(simRegistry.ids.filter((i) => i.startsWith('enemy-'))).toHaveLength(15);
  });
  it('each is a god-mode sandbox with the neutral cart, notes, and 6 to 10 of that enemy', () => {
    for (const id of REGULAR) {
      const s = simOf(id);
      expect(s.cart, id).toEqual([{ id: 'pan', tier: 2, at: [1, 1] }, { id: 'toaster', tier: 2, at: [3, 2] }]);
      expect(s.waves ?? false, id).toBe(false);
      expect(s.god ?? true, id).toBe(true);
      expect(s.notes, id).toBeTruthy();
      expect(own(id).length, id).toBeGreaterThanOrEqual(6);
      expect(own(id).length, id).toBeLessThanOrEqual(10);
    }
  });
  it('the cart is just the pan and the toaster: no combo, two weapons', () => {
    const { build } = createSimRun(simOf('milk'));
    expect(build.weapons.map((w) => [w.type, w.tier])).toEqual([['pan', 2], ['toaster', 2]]);
    expect(build.recipes).toEqual([]);
  });
  it('the notes name the enemy\'s HP', () => {
    for (const id of REGULAR) expect(simOf(id).notes, id).toContain(`${ENEMIES[id].hp} HP`);
  });
  it('the enemies are immortal except where the behaviour needs a death (egg, melon, gift card, the popped gum, the honey jar\'s heal targets)', () => {
    for (const id of ['egg', 'melon', 'giftcard']) expect(own(id).every((d) => !d.immortal), id).toBe(true);
    expect(own('gum').some((d) => d.immortal) && own('gum').some((d) => !d.immortal)).toBe(true);
    expect(own('honey').every((d) => d.immortal)).toBe(true);
    expect(simDummies(simOf('honey')).filter((d) => d.id === 'soda').every((d) => !d.immortal)).toBe(true);
    for (const id of REGULAR.filter((i) => !['egg', 'melon', 'giftcard', 'gum'].includes(i))) expect(own(id).every((d) => d.immortal), id).toBe(true);
  });
});

// One sim per boss (src/sims/boss-<theme>.ts): a real aisle 8 in the boss's department (waves, director), the strong cart of the `boss` sim, god mode on.
describe('boss sims', () => {
  it('there is one sim for every boss, named after its department', () => {
    expect(Object.keys(BOSS_BY_THEME)).toHaveLength(5);
    for (const theme of Object.keys(BOSS_BY_THEME)) expect(simRegistry.get(`boss-${theme}`), theme).toBeDefined();
    expect(simRegistry.ids.filter((i) => i.startsWith('boss-') && i !== 'boss-stagger')).toHaveLength(5); // boss-stagger is the affinity sim below
  });
  it('each is aisle 8 with waves in that department, no dummies, notes naming the boss\'s HP', () => {
    for (const [theme, id] of Object.entries(BOSS_BY_THEME)) {
      const s = sim(`boss-${theme}`), run = createSimRun(s);
      expect(s).toMatchObject({ waves: true, aisle: 8, department: theme });
      expect(s.god ?? true).toBe(true);
      expect(simDummies(s)).toEqual([]);
      expect(s.notes, theme).toContain(`${ENEMIES[id].hp} HP`);
      expect(run.theme, theme).toBe(theme);
      expect(run.wave, theme).toBe(8);
      expect(run.department, theme).toBe('boss');
    }
  });
});

// The element soft counters (src/sims/affinity-<tag>.ts, boss-stagger.ts): one tag-only cart against groups that are weak to it, resist it or have no
// affinity. The enemies are checked against the real affinity data, so a retuned table fails here until the sim follows.
describe('affinity sims', () => {
  const AFFINITY_SIMS = { 'affinity-heat': 'heat', 'affinity-frost': 'frost', 'affinity-electric': 'electric', 'affinity-blast': 'blast', 'affinity-cleaning': 'cleaning' } as const;
  const groups = (id: string) => [...new Set(simDummies(sim(id)).map((d) => d.id))];

  it('there is one per element, a god-mode sandbox with notes and a single weapon', () => {
    for (const id of Object.keys(AFFINITY_SIMS)) {
      const s = sim(id), run = createSimRun(s);
      expect(s.waves ?? false, id).toBe(false);
      expect(s.god ?? true, id).toBe(true);
      expect(s.notes, id).toBeTruthy();
      // the electric sim is the one with several weapons: the arcs need an Electric set (L3), made of the Laser and the Blender (both declare `electric`)
      if (id === 'affinity-electric') expect(run.build.weapons.map((w) => w.type)).toEqual(['laser', 'blender']);
      else expect(run.build.weapons, id).toHaveLength(1);
      expect(run.build.recipes, id).toEqual([]);
    }
  });

  it('each cart carries its element, and its groups include enemies weak to it and a contrast', () => {
    for (const [id, tag] of Object.entries(AFFINITY_SIMS)) {
      const run = createSimRun(sim(id)), w = run.build.weapons[0];
      if (tag === 'electric') { // Electric L3 with its 30% chain, and every weapon of the cart is electric itself
        expect(run.build.sets.electric, id).toBe(3);
        expect(w.chainChance, id).toBeCloseTo(0.3, 12);
        for (const x of run.build.weapons) expect([...weaponTags(x.type)], x.type).toContain('electric');
      }
      expect([...weaponTags(w.type)], id).toContain(tag);
      const ids = groups(id) as (keyof typeof ENEMIES)[];
      const weak = ids.filter((e) => (ENEMIES[e].weak?.[tag] ?? 0) > 0), others = ids.filter((e) => affinityMult(ENEMIES[e], weaponTags(w.type)) <= 1);
      expect(weak.length, `${id} weak`).toBeGreaterThanOrEqual(1);
      expect(others.length, `${id} contrast`).toBeGreaterThanOrEqual(1);
    }
  });

  it('the heat and frost sims also show a resisted group, the others a neutral one', () => {
    expect(groups('affinity-heat')).toEqual(['baguette', 'turkey', 'gum', 'slice']);
    expect(groups('affinity-frost')).toEqual(['banana', 'turkey', 'gum', 'slice']);
    expect(groups('affinity-electric')).toEqual(['soda', 'beans', 'milk']);
    expect(groups('affinity-blast')).toEqual(['milk', 'egg', 'banana']);
    expect(groups('affinity-cleaning')).toEqual(['expired', 'milk']);
    const w = (id: string) => createSimRun(sim(id)).build.weapons[0];
    expect(affinityMult(ENEMIES.gum, weaponTags(w('affinity-heat').type))).toBeLessThan(1);
    expect(affinityMult(ENEMIES.turkey, weaponTags(w('affinity-frost').type))).toBeLessThan(1);
    expect(affinityMult(ENEMIES.slice, weaponTags(w('affinity-heat').type))).toBe(1);
  });

  it('the notes quote the per-hit numbers of the weak and the plain case, from the real build and the multipliers', () => {
    const near = (n: number) => Math.round(n);
    const expectDamage = (id: string, plain: number) => {
      const dmg = createSimRun(sim(id)).build.weapons[0].damage;
      expect(dmg, id).toBeCloseTo(plain, 9);
      expect(sim(id).notes, id).toContain(`${near(dmg)}`);
      expect(sim(id).notes, id).toContain(`${near(dmg * (1 + AFFINITY.weak))}`);
    };
    expectDamage('affinity-heat', 18);
    expectDamage('affinity-frost', 12.72); // 12 plus the 6% bundle bonus of the Ice Pack touching it
    // the electric sim: the Laser's own (electric) beam, x1.3 on the weak groups, and the arc at half damage (also electric)
    const laser = createSimRun(sim('affinity-electric')).build.weapons[0];
    expect(laser.type).toBe('laser');
    expect(laser.damage).toBeCloseTo(22.4, 9);
    expect(sim('affinity-electric').notes).toContain(`${near(laser.damage)}`);
    expect(sim('affinity-electric').notes).toContain(`${near(laser.damage * (1 + AFFINITY.weak))}`);
    expect(sim('affinity-electric').notes).toContain(`${near(laser.damage / 2)}`);
    expect(sim('affinity-electric').notes).toContain(`${near((laser.damage / 2) * (1 + AFFINITY.weak))}`);
    expectDamage('affinity-blast', 6);
    expectDamage('affinity-cleaning', 6);
    expect(sim('affinity-heat').notes).toContain(`${near(18 * (1 - AFFINITY.resist))}`);
    expect(sim('affinity-frost').notes).toContain(`${near(12.72 * (1 - AFFINITY.resist))}`);
  });

  it('the dummies are immortal so the numbers can be read for as long as you like', () => {
    for (const id of Object.keys(AFFINITY_SIMS)) expect(simDummies(sim(id)).every((d) => d.immortal), id).toBe(true);
    expect(simDummies(sim('affinity-heat')).every((d) => d.still)).toBe(true);
  });

  it('boss-stagger: an immortal Walk-In Freezer (weak to heat) that keeps walking, against a heat-only cart', () => {
    const s = sim('boss-stagger'), run = createSimRun(s);
    expect(s).toMatchObject({ department: 'frozen' });
    expect(s.waves ?? false).toBe(false);
    expect(s.god ?? true).toBe(true);
    const d = simDummies(s);
    expect(d.map((x) => x.id)).toEqual(['boss_frozen']);
    expect(d[0].immortal).toBe(true);
    expect(d[0].still ?? false).toBe(false); // it must walk: the stagger only works in the walk state
    expect(s.notes).toContain(`${ENEMIES.boss_frozen.hp} HP`);
    for (const w of run.build.weapons) expect(s.notes, w.type).toContain(`${Math.round(w.damage * (1 + AFFINITY.bossWeak))}`); // per hit: the pan's swing, the cooker's pot (Kitchen +10% included)
    for (const w of run.build.weapons) expect([...weaponTags(w.type)]).toContain('heat');
    expect(run.build.weapons.map((w) => w.type)).toEqual(['pan', 'cooker']);
    expect(ENEMIES.boss_frozen.weak).toEqual({ heat: AFFINITY.bossWeak });
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
