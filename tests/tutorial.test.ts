import { describe, expect, it } from 'vitest';
import { advance, freshProgress, pick, skipAll, STEPS, type Progress, type Snap } from '../src/ui/tutorial-core';

const snap = (o: Partial<Snap> = {}): Snap => ({
  lab: false, phase: 'combat', shown: null, ms: 0, kills: 0, moved: false, dashed: false, moneyUp: false,
  bought: false, supported: false, mergePair: false, boss: false, flags: [], ...o,
});
const show = (p: Progress, s: Snap) => pick(p, s)?.id;

describe('tutorial step machine', () => {
  it('walks the combat steps on the right signals', () => {
    let p = freshProgress();
    expect(show(p, snap())).toBe('move');
    p = advance(p, snap({ shown: 'move' }));
    expect(p.seen).toEqual([]);
    p = advance(p, snap({ moved: true, shown: 'move' }));
    expect(show(p, snap())).toBe('weapons');
    p = advance(p, snap({ kills: 1, shown: 'weapons' }));
    expect(show(p, snap())).toBe('dash');
    p = advance(p, snap({ dashed: true, shown: 'dash' }));
    expect(show(p, snap())).toBe('coins');
    expect(advance(p, snap({ shown: 'coins', ms: 7900 }))).toBe(p);
    p = advance(p, snap({ shown: 'coins', ms: 8000 }));
    expect(show(p, snap())).toBe('survive');
  });

  it('coins step also ends when money went up', () => {
    const p = { done: false, seen: ['move', 'weapons', 'dash'] };
    expect(advance(p, snap({ moneyUp: true, shown: 'coins' })).seen).toContain('coins');
  });

  it('shop steps follow purchases and adjacency; steps outrun by the player are skipped', () => {
    let p = freshProgress();
    p = advance(p, snap({ phase: 'shop' })); // never played the combat steps: all skipped
    expect(p.seen).toEqual(['move', 'weapons', 'dash', 'coins', 'survive']);
    expect(show(p, snap({ phase: 'shop' }))).toBe('buy');
    p = advance(p, snap({ phase: 'shop', bought: true, shown: 'buy' }));
    expect(show(p, snap({ phase: 'shop' }))).toBe('place');
    p = advance(p, snap({ phase: 'shop', supported: true, shown: 'place' }));
    expect(show(p, snap({ phase: 'shop' }))).toBe('combos');
    p = advance(p, snap({ phase: 'shop', shown: 'combos', ms: 8000 }));
    expect(show(p, snap({ phase: 'route' }))).toBe('door');
  });

  it('place step times out after 15 s', () => {
    const p = { done: false, seen: ['move', 'weapons', 'dash', 'coins', 'survive', 'buy'] };
    expect(advance(p, snap({ phase: 'shop', shown: 'place', ms: 15000 })).seen).toContain('place');
  });

  it('door step finishes when the route screen closes and completes the tutorial', () => {
    const p = { done: false, seen: STEPS.slice(0, -1).map((e) => e.id) };
    expect(advance(p, snap({ phase: 'route', shown: 'door', ms: 3000 }))).toBe(p);
    const q = advance(p, snap({ phase: 'combat', shown: 'door', ms: 3000 }));
    expect(q.done).toBe(true);
  });

  it('shows one-time tips after the tutorial and only once', () => {
    const p = { done: true, seen: [...STEPS.map((e) => e.id)] };
    expect(show(p, snap({ flags: ['elite'] }))).toBe('elite');
    expect(show(p, snap({ phase: 'shop', mergePair: true }))).toBe('merge');
    expect(show(p, snap({ boss: true }))).toBe('boss');
    const q = advance(p, snap({ flags: ['elite'], shown: 'elite', ms: 7000 }));
    expect(show(q, snap({ flags: ['elite'] }))).toBeUndefined();
  });

  it('does nothing in the lab and outside the run', () => {
    const p = freshProgress();
    expect(pick(p, snap({ lab: true }))).toBeNull();
    expect(advance(p, snap({ lab: true, moved: true, phase: 'shop' }))).toBe(p);
    expect(pick(p, snap({ phase: 'title' }))).toBeNull();
  });

  it('skip hides everything; replay (fresh) starts over', () => {
    const p = skipAll();
    expect(p.done).toBe(true);
    expect(pick(p, snap({ flags: ['elite'], boss: true }))).toBeNull();
    expect(show(freshProgress(), snap())).toBe('move');
  });
});

it('door step completes even when a combat tip is already pickable', () => {
  const p = { done: false, seen: STEPS.slice(0, -1).map((e) => e.id) };
  const q = advance(p, snap({ phase: 'combat', shown: 'door', ms: 450, flags: ['obstacles'] }));
  expect(q.seen).toContain('door');
  expect(q.done).toBe(true);
});
