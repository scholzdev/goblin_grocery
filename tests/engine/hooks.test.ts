import { describe, expect, it, vi } from 'vitest';
import { FakeCtx } from '../../src/engine/fakeCtx';
import { defineCombo, defineItem, defineSet } from '../../src/engine/define';
import { buildHooks, compileHooks, EMPTY_HOOKS, hookSourcesFor, type ContentLookup, type HookCtx } from '../../src/engine/hooks';
import { validateContent } from '../../src/engine/registry';
import { computeBuild } from '../../src/systems/synergies';
import { build, type Spec } from '../golden/carts';
import type { SetId } from '../../src/types';

// Compiled dispatch of the runtime (combat) hooks: what a cart compiles to, in which order, with which tier/tune, and the
// empty fast path. Fixture content goes through a `ContentLookup` (real ids so they can sit in a cart); the registry is untouched.

const text = (name: string) => ({ en: { name, blurb: 'x', rules: 'x' }, de: { name, blurb: 'x', rules: 'x' } });
const comboText = { en: { name: 'T', short: 's', summary: 's', detail: 'd' }, de: { name: 'T', short: 's', summary: 's', detail: 'd' } };
const item = (id: string, hooks: Record<string, unknown>, extra: Record<string, unknown> = {}) => defineItem({ id, kind: 'module', shape: '1x1', price: 5, text: text(id), hooks, ...extra } as never);
const lookup = (items: unknown[] = [], combos: unknown[] = [], sets: unknown[] = []): ContentLookup => ({ items: () => items as never, combos: () => combos as never, sets: () => sets as never });
const noSets = { kitchen: 0, cleaning: 0, tools: 0, snacks: 0, checkout: 0, heat: 0, frost: 0, blast: 0, electric: 0 } as Record<SetId, 0 | 1 | 2 | 3>;

/** Compile a cart of specs (item 0 = the weapon, the rest touch it unless they say otherwise) against fixture content. */
function compile(specs: Spec[], content: ContentLookup, ctx = new FakeCtx()) {
  const inv = build(specs, 8, 6), b = computeBuild(inv);
  return { inv, b, ctx, table: buildHooks(inv, b.recipes, b.sets, ctx, content) };
}

describe('compileHooks: empty fast path', () => {
  it('a cart with no runtime hooks compiles to empty lists and emitting is a no-op', () => {
    const { table } = compile([{ type: 'toaster' }, { type: 'fan' }], lookup([item('fan', {}), item('fuel', { onHit() { throw new Error('not placed'); } })]));
    expect(table.size).toBe(0);
    expect(table.hit).toBe(false);
    for (const list of [table.onHit, table.onKill, table.onTick, table.modifyDamage, table['pattern:sweep'], table.onPlayerHit]) expect(list).toHaveLength(0);
    expect(() => table.emit('onHit', {} as never)).not.toThrow();
  });

  it('EMPTY_HOOKS (the title scene / before an aisle is built) is empty and needs no ctx', () => {
    expect(EMPTY_HOOKS.size).toBe(0);
    expect(() => EMPTY_HOOKS.emit('onTick', 0.016)).not.toThrow();
  });

  it('an emit with no handlers never touches the ctx', () => {
    const ctx = new FakeCtx();
    const spy = vi.spyOn(ctx, 'rng');
    const { table } = compile([{ type: 'toaster' }], lookup(), ctx);
    table.emit('onKill', { enemy: ctx.spawnEnemy(), hit: null });
    expect(spy).not.toHaveBeenCalled();
    expect(ctx.calls).toEqual([]);
  });

  it('hit is true only while a hit hook (modifyDamage/onHit/onCrit/onKill) is registered', () => {
    const only = (name: string) => compile([{ type: 'toaster' }, { type: 'fuel' }], lookup([item('fuel', { [name]() {} })])).table;
    for (const n of ['modifyDamage', 'onHit', 'onCrit', 'onKill']) expect(only(n).hit, n).toBe(true);
    for (const n of ['onTick', 'onDashHit', 'onPlayerHit', 'pattern:sweep']) { const t = only(n); expect(t.hit, n).toBe(false); expect(t.size, n).toBe(1); }
  });
});

describe('compileHooks: which content is active', () => {
  it('compiles only placed items; the table has one flat array per hook', () => {
    const fuel = item('fuel', { onHit() {}, onKill() {} }), ice = item('ice', { onHit() {} });
    const { table } = compile([{ type: 'toaster' }, { type: 'fuel' }], lookup([fuel, ice]));
    expect(table.onHit.map((h) => h.id)).toEqual(['fuel']);
    expect(table.onKill.map((h) => h.id)).toEqual(['fuel']);
    expect(table.size).toBe(2);
  });

  it('a combo\'s hooks are active only while the combo is matched', () => {
    const toastMode = defineCombo({ id: 'toastMode', requires: ['toaster', 'fan', 'fuel'], text: comboText, hooks: { onHit() {} } } as never);
    const content = lookup([], [toastMode]);
    const on = compile([{ type: 'toaster' }, { type: 'fan' }, { type: 'fuel' }], content);
    expect(on.b.recipes.map((r) => r.id)).toContain('toastMode');
    expect(on.table.onHit.map((h) => [h.id, h.c.kind])).toEqual([['toastMode', 'combo']]);
    const off = compile([{ type: 'toaster' }, { type: 'fan' }], content);
    expect(off.b.recipes.map((r) => r.id)).not.toContain('toastMode');
    expect(off.table.size).toBe(0);
  });

  it('a combo belongs to its weapon (touches), not to every weapon in the cart', () => {
    const toastMode = defineCombo({ id: 'toastMode', requires: ['toaster', 'fan', 'fuel'], text: comboText, hooks: { onHit() {} } } as never);
    const { table, inv } = compile([{ type: 'toaster' }, { type: 'fan' }, { type: 'fuel' }, { type: 'pan', near: [], apart: [0, 1, 2] }], lookup([], [toastMode]));
    const c = table.onHit[0].c, pan = inv.placed.find((p) => p.type === 'pan')!;
    expect(c.touches('u0')).toBe(true);
    expect(c.touches(pan.uid)).toBe(false);
    expect(c.tier).toBe(1);
  });

  it('a set is active from level 1, with its level as the tier', () => {
    const kitchen = defineSet({ id: 'kitchen', tune: { heal: [1, 2, 3] }, text: { en: { name: 'K', bonus: ['a', 'b', 'c'] }, de: { name: 'K', bonus: ['a', 'b', 'c'] } }, hooks: { onKill() {} } } as never);
    const inv = build([{ type: 'toaster' }]);
    expect(hookSourcesFor(inv, [], noSets, lookup([], [], [kitchen])).sources).toEqual([]);
    const lvl2 = buildHooks(inv, [], { ...noSets, kitchen: 2 }, new FakeCtx(), lookup([], [], [kitchen]));
    expect(lvl2.onKill).toHaveLength(1);
    expect(lvl2.onKill[0].c.kind).toBe('set');
    expect(lvl2.onKill[0].c.tier).toBe(2);
    expect(lvl2.onKill[0].c.tune()).toEqual({ heal: 2 });
    expect(lvl2.onKill[0].c.touches('anything')).toBe(true);
  });
});

describe('compileHooks: order', () => {
  const log: string[] = [];
  const tag = (id: string) => () => { log.push(id); };

  it('sorts by `order`, then registration order (items, then combos, then sets)', () => {
    const items = [item('fan', { order: 5, onHit: tag('fan') }), item('fuel', { onHit: tag('fuel') }), item('ice', { order: -5, onHit: tag('ice') }), item('battery', { onHit: tag('battery') })];
    const toastMode = defineCombo({ id: 'toastMode', requires: ['toaster', 'fan', 'fuel'], text: comboText, hooks: { onHit: tag('toastMode') } } as never);
    const kitchen = defineSet({ id: 'kitchen', text: { en: { name: 'K', bonus: ['a', 'b', 'c'] }, de: { name: 'K', bonus: ['a', 'b', 'c'] } }, hooks: { onHit: tag('kitchen') } } as never);
    const inv = build([{ type: 'toaster' }, { type: 'fan' }, { type: 'fuel' }, { type: 'ice' }, { type: 'battery' }], 8, 6), b = computeBuild(inv);
    const table = buildHooks(inv, b.recipes, { ...noSets, kitchen: 1 }, new FakeCtx(), lookup(items, [toastMode], [kitchen]));
    log.length = 0;
    table.emit('onHit', {} as never);
    expect(log).toEqual(['ice', 'fuel', 'battery', 'toastMode', 'kitchen', 'fan']);
  });

  it('`order` applies to all of one owner\'s hooks; each hook name has its own list', () => {
    const items = [item('fuel', { order: 2, onHit: tag('fuel:hit'), onKill: tag('fuel:kill') }), item('fan', { onHit: tag('fan:hit'), onKill: tag('fan:kill') })];
    const { table } = compile([{ type: 'toaster' }, { type: 'fan' }, { type: 'fuel' }], lookup(items));
    log.length = 0;
    table.emit('onKill', { enemy: undefined as never, hit: null });
    table.emit('onHit', {} as never);
    expect(log).toEqual(['fan:kill', 'fuel:kill', 'fan:hit', 'fuel:hit']);
  });
});

describe('compileHooks: tier, tune and scratch state', () => {
  const probe = (seen: { tier?: number; tune?: unknown; c?: HookCtx }[]) => item('fuel', { onHit(_ev: unknown, _ctx: unknown, c: HookCtx) { seen.push({ tier: c.tier, tune: c.tune(), c }); } }, { tune: { dps: [2.5, 3.75, 5], duration: 3 } });

  it('resolves the tune at the item\'s tier', () => {
    for (const [tier, dps] of [[1, 2.5], [2, 3.75], [3, 5]] as const) {
      const seen: { tier?: number; tune?: unknown }[] = [];
      const { table } = compile([{ type: 'toaster' }, { type: 'fuel', tier }], lookup([probe(seen)]));
      table.emit('onHit', {} as never);
      expect(seen).toEqual([{ tier, tune: { dps, duration: 3 }, c: expect.anything() }]);
    }
  });

  it('uses the best copy in the cart, Gold Star lift included (same tier as the build hooks)', () => {
    const seen: { tier?: number; tune?: unknown }[] = [];
    const { table } = compile([{ type: 'toaster' }, { type: 'fuel' }, { type: 'fuel', tier: 2, near: [0] }, { type: 'goldstar', near: [1], apart: [0] }], lookup([probe(seen)]));
    table.emit('onHit', {} as never);
    expect(seen[0].tier).toBe(2); // the ★2 copy beats the ★1 + Gold Star (= 2) copy; equal, never added up
    const lifted: { tier?: number; tune?: unknown }[] = [];
    compile([{ type: 'toaster' }, { type: 'fuel' }, { type: 'goldstar', near: [1], apart: [0] }], lookup([probe(lifted)])).table.emit('onHit', {} as never);
    expect(lifted[0].tier).toBe(2);
    expect(lifted[0].tune).toEqual({ dps: 3.75, duration: 3 });
  });

  it('tune() is the same frozen object on every call (no allocation per hit)', () => {
    const seen: { c?: HookCtx }[] = [];
    const { table } = compile([{ type: 'toaster' }, { type: 'fuel' }], lookup([probe(seen)]));
    table.emit('onHit', {} as never);
    const c = seen[0].c!;
    expect(c.tune()).toBe(c.tune());
    expect(Object.isFrozen(c.tune())).toBe(true);
  });

  it('touches(uid): the weapons the item sits against (and the item itself)', () => {
    const { table, inv } = compile([{ type: 'toaster' }, { type: 'fuel' }, { type: 'pan', near: [], apart: [0, 1] }], lookup([probe([])]));
    table.emit('onHit', {} as never);
    const c = table.onHit[0].c, pan = inv.placed.find((p) => p.type === 'pan')!;
    expect(c.touches('u0')).toBe(true);
    expect(c.touches(pan.uid)).toBe(false);
  });

  it('owned(id) is the best effective tier of any placed item', () => {
    const { table } = compile([{ type: 'toaster' }, { type: 'fuel' }, { type: 'fan', tier: 3 }], lookup([probe([])]));
    const c = table.onHit[0].c;
    expect(c.owned('fan')).toBe(3);
    expect(c.owned('fuel')).toBe(1);
    expect(c.owned('ice')).toBe(0);
  });

  it('state is shared by one owner\'s hooks and starts fresh with every compile', () => {
    const a = item('fuel', { onHit(_e: unknown, _x: unknown, c: HookCtx) { c.state.n = (c.state.n ?? 0) + 1; }, onKill(_e: unknown, _x: unknown, c: HookCtx) { c.state.n = (c.state.n ?? 0) + 10; } });
    const first = compile([{ type: 'toaster' }, { type: 'fuel' }], lookup([a])).table;
    first.emit('onHit', {} as never); first.emit('onKill', {} as never); first.emit('onHit', {} as never);
    expect(first.onHit[0].c.state.n).toBe(12);
    expect(first.onKill[0].c).toBe(first.onHit[0].c);
    const second = compile([{ type: 'toaster' }, { type: 'fuel' }], lookup([a])).table;
    expect(second.onHit[0].c.state.n).toBeUndefined();
  });

  it('compileHooks takes explicit sources (no cart needed)', () => {
    const calls: string[] = [];
    const ctx = new FakeCtx();
    const table = compileHooks([{ id: 'x', kind: 'item', tier: 3, tune: { n: [1, 2, 3] }, weapons: null, hooks: { onTick(dt, c, h) { calls.push(`${dt}:${c === ctx}:${h.tier}:${h.tune().n}`); } } }], ctx);
    table.emit('onTick', 0.5);
    expect(calls).toEqual(['0.5:true:3:3']);
  });
});

describe('end to end through FakeCtx', () => {
  // A throwaway item (Fuel's id, fixture hooks): +50% damage, burns every hit it did not kill, pays a coin per kill and heals on a crit.
  const fixture = item('fuel', {
    modifyDamage(hit: { dmg: number }, _ctx: unknown, c: HookCtx<{ mult: number }>) { hit.dmg *= c.tune().mult; },
    onHit(hit: { enemy: never; killed: boolean }, ctx: FakeCtx, c: HookCtx<{ dps: number; duration: number }>) { if (!hit.killed) ctx.ignite(hit.enemy, { dps: c.tune().dps, duration: c.tune().duration, tick: 0.5 }); },
    onCrit(_hit: unknown, ctx: FakeCtx) { ctx.heal(2); },
    onKill(kill: { enemy: { x: number; y: number } }, ctx: FakeCtx) { ctx.dropCoin(kill.enemy, 'fixture'); ctx.sound('ding'); },
  }, { tune: { mult: [1.5, 2, 2.5], dps: [2.5, 3.75, 5], duration: 3 } });

  const setup = (tier: number, opts: ConstructorParameters<typeof FakeCtx>[0] = {}) => {
    const ctx = new FakeCtx({ hp: 50, maxHp: 100, ...opts });
    const { table, b } = compile([{ type: 'toaster' }, { type: 'fuel', tier }], lookup([fixture]), ctx);
    ctx.attach(table);
    return { ctx, table, stats: b.weapons[0] };
  };

  it('modifyDamage and onHit run through the hit pipeline with the tier-resolved tune', () => {
    const { ctx } = setup(2);
    const e = ctx.spawnEnemy({ hp: 100 });
    ctx.hit(e, 10);
    expect(e.hp).toBe(100 - 10 * 2); // ★2: x2
    expect(ctx.callsOf('ignite')).toEqual([{ at: 0, kind: 'ignite', enemy: e.id, burn: { dps: 3.75, duration: 3, tick: 0.5 } }]);
    expect(e.status.burnDps).toBe(3.75); // the fake applies the status like the scene does
  });

  it('onKill fires for the killing hit only, after onHit saw `killed`', () => {
    const { ctx } = setup(1);
    const e = ctx.spawnEnemy({ hp: 10, x: 30, y: 40 });
    ctx.hit(e, 10);
    expect(e.alive).toBe(false);
    expect(ctx.callsOf('ignite')).toEqual([]); // onHit knew the hit was lethal
    expect(ctx.callsOf('dropCoin')).toEqual([{ at: 0, kind: 'dropCoin', x: 30, y: 40, label: 'fixture' }]);
    expect(ctx.callsOf('sound').map((c) => c.name)).toEqual(['ding']);
    ctx.hit(e, 10); // dead enemies are skipped
    expect(ctx.callsOf('dropCoin')).toHaveLength(1);
  });

  it('crits (seeded rng) emit onCrit; the same seed gives the same fight', () => {
    const run = (seed: number) => {
      const { ctx, stats } = setup(1, { seed, aisle: 3 });
      stats.critChance = 0.5;
      const e = ctx.spawnEnemy({ hp: 10000 });
      for (let i = 0; i < 40; i++) ctx.hit(e, 1, stats);
      return { hp: e.hp, heals: ctx.callsOf('heal').length };
    };
    const a = run(7), b = run(7), c = run(8);
    expect(a).toEqual(b);
    expect(a.heals).toBeGreaterThan(5);
    expect(a.heals).toBeLessThan(35);
    expect(c).not.toEqual(a);
  });

  it('a hook that deals damage re-enters the pipeline (poppers never re-trigger)', () => {
    const popper = item('popper', {
      onKill(kill: { enemy: { x: number; y: number } }, ctx: FakeCtx, c: HookCtx) { void c; ctx.popperBlast(kill.enemy, { damage: 5, radius: 100 }); },
      onHit(hit: { opts: { fromPopper?: boolean } }, ctx: FakeCtx) { if (hit.opts.fromPopper) ctx.sound('pop'); },
    });
    const ctx = new FakeCtx();
    const { table } = compile([{ type: 'toaster' }, { type: 'popper' }], lookup([popper]), ctx);
    ctx.attach(table);
    const dying = ctx.spawnEnemy({ hp: 1, x: 0 }), near = ctx.spawnEnemy({ hp: 20, x: 50 }), far = ctx.spawnEnemy({ hp: 20, x: 500 });
    ctx.hit(dying, 1);
    expect(near.hp).toBe(15);
    expect(far.hp).toBe(20);
    expect(ctx.callsOf('popperBlast')).toHaveLength(1);
    expect(ctx.callsOf('sound')).toHaveLength(1); // the blast hit `near` (and not `dying`, already dead)
  });
});

describe('hook validation', () => {
  it('the registry rejects hook names that would never fire', () => {
    const f = item('fuel', { onHitt() {} }, { shape: '1x2' });
    const errs = validateContent({ items: { 'items/fuel.ts': f } }).join('\n');
    expect(errs).toMatch(/hooks\.onHitt is not a hook/);
    expect(validateContent({ items: { 'items/fuel.ts': item('fuel', { onHit: 3 }) } }).join('\n')).toMatch(/hooks\.onHit must be a function/);
    expect(validateContent({ items: { 'items/fuel.ts': item('fuel', { order: NaN, onHit() {} }) } }).join('\n')).toMatch(/hooks\.order must be a finite number/);
  });
});
