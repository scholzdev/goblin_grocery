import { describe, expect, it, vi } from 'vitest';

// Dispatch points of computeBuild: every phase must call content hooks at its position. The registry is replaced by fixture content
// (ids of real items, so they can sit in a cart; where an id is real content too, the fixture replaces its build hooks); the lookups (`contentItem`, ...) stay real,
// so ITEMS and RECIPES remain the real tables.
const { calls, tunes, fixtures } = vi.hoisted(() => {
  const calls: string[] = [];
  const tunes: string[] = [];
  const text = (name: string) => ({ en: { name, blurb: 'x', rules: 'x' }, de: { name, blurb: 'x', rules: 'x' } });
  const item = (id: string, build: unknown, extra: Record<string, unknown> = {}) => ({ id, kind: 'passive', sets: ['snacks'], shape: '1x1', price: 5, text: text(id), build, ...extra });
  const fixtures = {
    items: [
      // base: the weapon item itself; sees the weapon's own tier
      item('toaster', { phase: 'base', weapon: (w: { damage: number }, c: { tier: number }) => { calls.push(`base:${c.tier}`); w.damage += 100; } }, { kind: 'weapon', weapon: {} }),
      // module: Ice Pack's slot in BUFF_ORDER; returning false = skipped (no buff recorded)
      item('ice', { phase: 'module', weapon: (w: { range: number }) => { calls.push('module:ice'); w.range += 1; return false; } }, { kind: 'module', buff: 'ice' }),
      // module that applies
      item('battery', { phase: 'module', weapon: (w: { cooldown: number }, c: { tier: number }) => { calls.push(`module:battery:${c.tier}`); w.cooldown = 7; } }, { kind: 'module', buff: 'battery' }),
      // flavor: reads its touching instances
      item('jellybeans', { phase: 'flavor', weapon: (w: { uid: string }, c: { touching: (w: { uid: string }) => unknown[]; tuneOf: (id: string, tier: number) => Record<string, number> }) => { calls.push(`flavor:${c.touching(w).length}`); tunes.push(`${c.tuneOf('fuel', 2).dps}:${c.tuneOf('fuel', 3).dps}:${Object.keys(c.tuneOf('toaster', 1)).length}`); } }, { kind: 'module' }),
      // global-mod / post-combo / final, cart-wide (placed anywhere)
      item('powerstrip', { phase: 'global-mod', weapon: (w: { cooldown: number }) => { calls.push('global-mod'); w.cooldown += 0.5; } }),
      item('fortune', { phase: 'post-combo', weapon: (w: { critChance: number }) => { calls.push('post-combo'); w.critChance += 0.5; } }),
      item('piggy', { phase: 'final', weapon: (w: { damage: number }) => { calls.push('final'); w.damage *= 2; } }),
      // player hooks: order decides who runs first
      item('lunchbox', { phase: 'final', order: 1, player: (b: { maxHp: number }) => { calls.push('player:lunchbox'); b.maxHp += 10; } }),
      // the curse: a high-order player hook that multiplies the total the others built (computeBuild only rounds afterwards)
      item('expiredmilk', { phase: 'final', order: 100, player: (b: { maxHp: number }) => { calls.push('player:expiredmilk'); b.maxHp *= 0.9; } }),
      item('magnet', { phase: 'final', order: 0, player: (b: { pickupRadius: number }, c: { tier: number }) => { calls.push(`player:magnet:${c.tier}`); b.pickupRadius = 1; } }),
    ],
    sets: [
      { id: 'kitchen', text: { en: { name: 'K', bonus: ['a', 'b', 'c'] }, de: { name: 'K', bonus: ['a', 'b', 'c'] } }, build: { phase: 'set', weapon: (w: { tick: number }, c: { tier: number }) => { calls.push(`set:${c.tier}`); w.tick += 1000; } } },
    ],
    combos: [
      { id: 'toastMode', requires: ['toaster', 'fan', 'fuel'], text: { en: { name: 'T', short: 's', summary: 's', detail: 'd' }, de: { name: 'T', short: 's', summary: 's', detail: 'd' } },
        build: { phase: 'combo', weapon: (w: { count: number }) => { calls.push('combo'); w.count = 99; } } },
    ],
  };
  return { calls, tunes, fixtures };
});

vi.mock('../../src/engine/registry', async (original) => {
  const real = await original<typeof import('../../src/engine/registry')>();
  // Real lookups (so ITEMS / RECIPES / text keep working, hotsauce is still content); the build tables see only the fixtures.
  return { ...real, contentItems: () => fixtures.items, contentSets: () => fixtures.sets, contentCombos: () => fixtures.combos } as never;
});

import { computeBuild } from '../../src/systems/synergies';
import { cart } from '../cart';
import { build } from '../golden/carts';
import type { Spec } from '../golden/carts';

describe('computeBuild dispatch', () => {
  const run = (...args: Parameters<typeof cart>) => { const inv = cart(...args); calls.length = 0; return computeBuild(inv); }; // cart() itself calls computeBuild

  it('runs a base hook for the weapon item itself, with the weapon tier', () => {
    const w = run('toaster', []).weapons[0];
    expect(calls).toEqual(['base:1']);
    expect(w.damage).toBeCloseTo((9 + 100) * 1); // base 9 + 100, no other effects
  });

  it('runs module hooks at their BUFF_ORDER slot, with the effective tier, and honors `false`', () => {
    const inv = cart('toaster', ['ice', 'battery']);
    inv.placed.find((p) => p.type === 'battery')!.tier = 2;
    calls.length = 0;
    const w = computeBuild(inv).weapons[0];
    expect(calls.filter((c) => c.startsWith('module'))).toEqual(['module:battery:2', 'module:ice']); // battery comes before ice in BUFF_ORDER
    expect(w.buffs).toEqual(['battery']); // ice returned false: not recorded
    expect(w.cooldown).toBe(7);
    expect(w.range).toBe(455 + 1); // the ice hook ran (and nothing else touched range)
    expect(w.slow).toBeNull(); // the legacy ice branch did not also run
  });

  it('runs the other phases in order: base, module, flavor, global-mod, set, combo, post-combo, final', () => {
    const specs: Spec[] = [{ type: 'toaster' }, { type: 'fan' }, { type: 'fuel' }, { type: 'ice' }, { type: 'battery' }, { type: 'jellybeans' }, { type: 'powerstrip', near: [] }, { type: 'fortune', near: [] }, { type: 'piggy', near: [] }];
    const inv = build(specs, 8, 6);
    calls.length = 0;
    computeBuild(inv);
    expect(calls.filter((c) => !c.startsWith('player')).map((c) => c.split(':')[0])).toEqual(['base', 'module', 'module', 'flavor', 'global-mod', 'set', 'combo', 'post-combo', 'final']);
  });

  it('applies the hooks\' edits (set hook only above level 0, combo hook replaces the legacy recipe)', () => {
    const w = run('toaster', ['fan', 'fuel', 'powerstrip', 'fortune', 'piggy']).weapons[0];
    expect(calls).toContain('combo');
    expect(w.count).toBe(99); // the legacy Toast Mode would have set 3
    expect(w.recipes).toEqual(['toastMode']);
    expect(w.critChance).toBeCloseTo(0.5); // the fixture hook only (the real Fortune Cookie hook is replaced by the fixture)
    expect(calls.some((c) => c.startsWith('set'))).toBe(false); // no set above level 0
  });

  it('runs a set hook when its level is above 0, with the level as tier', () => {
    run('toaster', ['sample', 'ice']); // toaster (kitchen), sample (kitchen), ice (kitchen): Kitchen L2
    expect(calls.filter((c) => c.startsWith('set'))).toEqual(['set:2']);
  });

  it('gives flavor-style hooks the touching instances of their item', () => {
    run('toaster', ['jellybeans']);
    expect(calls).toContain('flavor:1');
  });

  it('gives hooks other content items\' tunes through ctx.tuneOf (resolved per tier; empty for a legacy item)', () => {
    const inv = cart('toaster', ['jellybeans']); // cart() builds while placing
    tunes.length = 0;
    computeBuild(inv);
    expect(tunes).toEqual(['3.75:5:0']); // Fuel Can dps [2.5, 3.75, 5] at ★2 and ★3; the Toaster is not content
  });

  it('runs player hooks after all weapons, by order, only for owned items', () => {
    const b = run('toaster', ['lunchbox', 'magnet']);
    expect(calls.filter((c) => c.startsWith('player'))).toEqual(['player:magnet:1', 'player:lunchbox']);
    expect(b.pickupRadius).toBe(1);
    expect(b.maxHp).toBe(40 + 10); // 10 = the fixture hook (the real Lunchbox hook is replaced by the fixture)
    expect(run('toaster', []).maxHp).toBe(40);
    expect(calls.filter((c) => c.startsWith('player'))).toEqual([]);
  });

  it('rounds the finished max HP once, after a high-order hook (the Expired Milk curse) multiplied the total', () => {
    expect(run('toaster', ['lunchbox', 'expiredmilk']).maxHp).toBe(Math.round((40 + 10) * 0.9)); // 40 base + the fixture hook (the fixtures replace the real sets too: no Snacks bonus here)
    expect(calls.filter((c) => c.startsWith('player'))).toEqual(['player:lunchbox', 'player:expiredmilk']);
  });
});
