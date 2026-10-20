import { describe, expect, it } from 'vitest';
import { createGreedyPolicy, type Policy, type PolicyFactory, type ShopAction } from '../../src/buildlab/policy';
import { BOSS_WAVE } from '../../src/data/waves';
import { PROXY } from '../../src/buildlab/combat';
import { canPlace } from '../../src/systems/inventory';
import { ITEMS, ITEM_IDS } from '../../src/data/items';
import { drawStock } from '../../src/systems/stock';
import { stockRng } from '../../src/systems/rng';
import { ALL_STARTERS, playRun, runBatch, runSeed } from '../../src/buildlab/run';
import { summarize, type Report, type RunRecord } from '../../src/buildlab/report';
import { newUid } from '../../src/state/run';
import type { Inventory, ItemInstance, RunState } from '../../src/types';

const strip = (r: Report) => JSON.stringify({ ...r, meta: { ...r.meta, durationMs: 0, gitRev: undefined } });

describe('build-lab run', () => {
  it('is deterministic: the same seed gives the same JSON (but durationMs / gitRev)', () => {
    const a = runBatch({ seed: 3, runs: 4 }), b = runBatch({ seed: 3, runs: 4 });
    expect(strip(b)).toBe(strip(a));
    expect(strip(runBatch({ seed: 4, runs: 4 }))).not.toBe(strip(a));
  });

  it('plays a full run to a win or a death, with the real flow of aisles', () => {
    for (let i = 0; i < 6; i++) {
      const r = playRun({ seed: runSeed(1, i) });
      expect(['win', 'dead']).toContain(r.result);
      expect(r.aisles.length).toBe(r.aislesPlayed);
      const aisles = [1];
      for (const e of r.shopLog) aisles.push(aisles.at(-1)! + (e.door === 'shortcut' ? 2 : 1)); // Staff Only skips the next aisle
      expect(r.aisles.map((a) => a.aisle)).toEqual(aisles);
      if (r.result === 'win') { expect(aisles.at(-1)).toBe(BOSS_WAVE); expect(r.aisles.at(-1)!.bossDefeated).toBe(true); }
      else { expect(r.diedAt).toBe(aisles.at(-1)); expect(r.aisles.at(-1)!.died).toBe(true); }
      expect(r.shopLog.length).toBe(r.aislesPlayed - 1); // a shop after every aisle but the last
    }
  });

  it('every placement the policy makes is valid', () => {
    const base = createGreedyPolicy();
    let moves = 0;
    const checking = (): Policy => ({
      ...base,
      decideShop(state, view) {
        const acts = base.decideShop(state, view);
        for (const a of acts) if (a.kind === 'move' && a.target.where === 'grid') {
          const it = [...state.inventory.placed, ...state.inventory.shelf].find((i) => i?.uid === a.uid)!;
          expect(canPlace(state.inventory, it.type, a.target.x, a.target.y, a.target.rot, it.uid, it.tier ?? 1).ok, `${it.type} at ${a.target.x},${a.target.y} r${a.target.rot}`).toBe(true);
          moves++;
        }
        return acts;
      },
    });
    const recs: RunRecord[] = [];
    for (let i = 0; i < 8; i++) recs.push(playRun({ seed: runSeed(2, i), policy: checking }));
    expect(moves).toBeGreaterThan(8);
    for (const r of recs) {
      expect(r.shopLog.flatMap((s) => s.steps).filter((s) => s.kind === 'move' && !s.ok)).toEqual([]);
      // the final cart: inside the grid, no overlaps, and the footprints the rules compute
      const inv: Inventory = { cols: r.finalBuild.cartSize[0], rows: r.finalBuild.cartSize[1], placed: [], shelf: [] };
      r.finalBuild.items.forEach((i, k) => {
        const inst = { uid: `f${k}`, type: i.id, x: i.x, y: i.y, rot: i.rot, tier: i.tier } as ItemInstance;
        expect(canPlace(inv, inst.type, inst.x, inst.y, inst.rot, undefined, inst.tier).ok, `${i.id} in ${JSON.stringify(r.finalBuild.items)}`).toBe(true);
        inv.placed.push(inst);
      });
    }
  });

  it('the mini-boss crates are picked through the policy and land on the shelf or in the cart', () => {
    const runs = Array.from({ length: 12 }, (_, i) => playRun({ seed: runSeed(4, i) }));
    const withCrate = runs.filter((r) => r.aisles.some((a) => a.kind === 'mini' && a.loot));
    expect(withCrate.length).toBeGreaterThan(0);
    for (const r of withCrate) {
      const mini = r.aisles.find((a) => a.kind === 'mini')!;
      expect(mini.loot!.offered).toContain(mini.loot!.item);
      expect(r.acquired.some((a) => a.from === 'crate' && a.item === mini.loot!.item)).toBe(true);
    }
  });

  it('stockroom doors are resolved through the policy', () => {
    const base = createGreedyPolicy();
    const stock = (): Policy => ({ ...base, chooseDoor: (doors, s, v) => (doors.includes('stockroom') ? 'stockroom' : base.chooseDoor(doors, s, v)) });
    let found: RunRecord | undefined;
    for (let i = 0; i < 80 && !found; i++) {
      const r = playRun({ seed: runSeed(5, i), policy: stock });
      if (r.aisles.some((a) => a.kind === 'stockroom')) found = r;
    }
    expect(found, 'no stockroom door in 80 runs').toBeDefined();
    const room = found!.aisles.find((a) => a.kind === 'stockroom')!;
    expect(room.loot!.offered).toContain(room.loot!.item);
    expect(room.spawned).toBe(0);
    expect(found!.acquired.some((a) => a.from === 'stockroom')).toBe(true);
  });

  it('writes the documented JSON shape', () => {
    const rep = runBatch({ seed: 9, runs: 3, starters: ['toaster', 'pan'] });
    const json = JSON.parse(JSON.stringify(rep)) as Report;
    expect(Object.keys(json)).toEqual(['meta', 'runs', 'summary']);
    expect(json.meta).toMatchObject({ seed: 9, runs: 6, starter: 'toaster,pan', proxy: PROXY });
    expect(typeof json.meta.durationMs).toBe('number');
    expect(json.runs).toHaveLength(6);
    const r = json.runs[0];
    expect(r).toMatchObject({ seed: expect.any(Number), starter: 'toaster', result: expect.stringMatching(/^(win|dead)$/) });
    for (const k of ['aisles', 'acquired', 'finalBuild', 'shopLog']) expect(r).toHaveProperty(k);
    expect(Object.keys(r.finalBuild)).toEqual(['items', 'shelf', 'combos', 'sets', 'cartSize', 'maxHp']);
    expect(r.finalBuild.items[0]).toMatchObject({ id: 'toaster', tier: expect.any(Number), x: expect.any(Number), y: expect.any(Number), rot: expect.any(Number) });
    const a = r.aisles[0];
    for (const k of ['aisle', 'kind', 'clearTime', 'cleared', 'damageTaken', 'hpAfter', 'kills', 'coins', 'dealt', 'dps', 'leftover', 'combos', 'sets', 'damage']) expect(a, k).toHaveProperty(k);
    for (const k of ['byType', 'dot', 'weak', 'resisted', 'shred', 'mark', 'reactions', 'bySource']) expect(a.damage, k).toHaveProperty(k);
    for (const k of ['winRate', 'avgAisleReached', 'itemPickRate', 'comboRate', 'setRate', 'reactionTotals', 'avgDpsByAisle']) expect(json.summary, k).toHaveProperty(k);
    expect(json.summary.runs).toBe(6);
    expect(Object.keys(json.summary.byStarter)).toEqual(['toaster', 'pan']);
    expect(Object.keys(json.summary.itemPickRate)).toContain('toaster');
    expect(json.summary.itemPickRate.toaster).toBe(1);
    // summarize works on any set of records
    expect(summarize(json.runs).winRate).toBe(json.summary.winRate);
  });

  it('counts the merges, rerolls and sales the shop rules carried out', () => {
    // Shop rolls cannot be steered, so the scripted policy puts the second copy on the shelf itself.
    const once = (acts: (s: RunState) => ShopAction[]): PolicyFactory => () => ({ ...createGreedyPolicy(), decideShop: (s, v) => (s.wave === 1 && v.round === 0 ? acts(s) : []) });
    const spareToaster = (s: RunState): string => {
      const uid = newUid(s);
      s.inventory.shelf[s.inventory.shelf.indexOf(null)] = { uid, type: 'toaster', x: 0, y: 0, rot: 0, tier: 1 };
      return uid;
    };
    const cartToaster = (s: RunState): string => s.inventory.placed.find((i) => i.type === 'toaster')!.uid;

    const merged = playRun({ seed: 7, policy: once((s) => [{ kind: 'merge', uid: spareToaster(s), targetUid: cartToaster(s) }]) });
    expect(merged.finalBuild.items.filter((i) => i.id === 'toaster'), 'two ★1 toasters became one ★2').toMatchObject([{ tier: 2 }]);
    expect(merged).toMatchObject({ merges: 1, rerolls: 0, sells: 0 });

    const refused = playRun({ seed: 7, policy: once((s) => [{ kind: 'merge', uid: cartToaster(s), targetUid: cartToaster(s) }]) });
    expect(refused.merges, 'an item cannot merge into itself').toBe(0);

    const traded = playRun({ seed: 7, policy: once((s) => [{ kind: 'reroll' }, { kind: 'sell', uid: spareToaster(s) }]) });
    expect(traded).toMatchObject({ merges: 0, rerolls: 1, sells: 1 });
  });

  it('every character can play, and shop items are real items', () => {
    for (const starter of ALL_STARTERS) {
      const r = playRun({ seed: runSeed(6, 0), starter });
      expect(r.starter).toBe(starter);
      for (const a of r.acquired) expect(ITEMS[a.item as keyof typeof ITEMS], a.item).toBeDefined();
    }
  });

  it('`stock` plays from the stock a real run with everything unlocked draws', () => {
    for (let i = 0; i < 4; i++) {
      const seed = runSeed(9, i), weapon = (['toaster', 'pan', 'nailgun'] as const)[i % 3];
      const { pool } = drawStock({ source: ITEM_IDS, weapon, theme: 'bakery', fresh: [] }, stockRng(seed));
      const r = playRun({ seed, weapon, theme: 'bakery', pool: 'stock' });
      const offered = [...r.shopLog.flatMap((e) => e.offers.map((o) => o.item)), ...r.acquired.map((a) => a.item)];
      for (const t of offered) expect(pool, `seed ${seed}: ${t}`).toContain(t);
    }
  });
});
