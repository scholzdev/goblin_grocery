import { describe, expect, it } from 'vitest';
import { recordHit } from '../src/systems/damageStats';
import { createRun, damagePlayer, drainPlayer } from '../src/state/run';
import { combatRng } from '../src/systems/rng';
import { arena, at, far } from './content/helpers';
import type { HitSource, RunStats } from '../src/types';

// What hurt the goblin (docs/audit/mechanics.md proposal 4): `RunStats.taken` per `how:by` source and the last hit, fed where HP is lost.

const swipe: HitSource = { how: 'swipe', by: 'baguette', affix: 'swift' };
const vent: HitSource = { how: 'hazard', by: 'vents' };
const book = (): Pick<RunStats, 'taken' | 'lastHit'> => ({ taken: {} });

describe('recordHit', () => {
  it('sums the HP lost per source key and remembers the last hit', () => {
    const s = book();
    recordHit(s, swipe, 6);
    recordHit(s, vent, 4);
    recordHit(s, { how: 'swipe', by: 'baguette' }, 3);
    expect(s.taken).toEqual({ 'swipe:baguette': 9, 'hazard:vents': 4 });
    expect(s.lastHit).toEqual({ how: 'swipe', by: 'baguette' });
  });

  it('a hit that took no HP is not booked and does not become the last hit', () => {
    const s = book();
    recordHit(s, swipe, 5);
    recordHit(s, { how: 'self', by: 'ghostpepper' }, 0);
    expect(s.taken).toEqual({ 'swipe:baguette': 5 });
    expect(s.lastHit).toEqual(swipe);
  });
});

describe('damage taken in a run', () => {
  it('starts empty', () => {
    const s = createRun(1);
    expect(s.stats.taken).toEqual({});
    expect(s.stats.lastHit).toBeUndefined();
  });

  it('damagePlayer books the HP each hit took, the killing blow without its overkill', () => {
    const s = createRun(1);
    const hp = s.hp;
    damagePlayer(s, 10, swipe);
    expect(damagePlayer(s, 999, vent)).toBe(true);
    expect(s.stats.taken).toEqual({ 'swipe:baguette': 10, 'hazard:vents': hp - 10 });
    expect(s.stats.lastHit).toEqual(vent);
  });

  it('drainPlayer books self-damage under the item, and nothing once the 1 HP floor stops it', () => {
    const s = createRun(1);
    s.hp = 3;
    drainPlayer(s, 5, 'ghostpepper');
    expect(s.hp).toBe(1);
    expect(s.stats.taken).toEqual({ 'self:ghostpepper': 2 });
    drainPlayer(s, 5, 'ghostpepper');
    expect(s.stats.taken).toEqual({ 'self:ghostpepper': 2 });
  });

  it('a burn tick after the killing blow does not take the blame', () => {
    const s = createRun(1);
    damagePlayer(s, 999, swipe);
    drainPlayer(s, 1, 'ghostpepper');
    expect(s.stats.lastHit).toEqual(swipe);
    expect(Object.keys(s.stats.taken)).toEqual(['swipe:baguette']);
  });
});

describe('the self-damage items name themselves in ctx.drain', () => {
  it('Ghost Pepper burns as ghostpepper', () => {
    const { fake } = arena([at('toaster'), far('ghostpepper')], { hp: 40, maxHp: 40 });
    fake.hurt(5);
    fake.tick(2);
    expect(fake.callsOf('drain').length).toBeGreaterThan(0);
    expect(new Set(fake.callsOf('drain').map((c) => c.by))).toEqual(new Set(['ghostpepper']));
  });

  it('Scratch Ticket loses as scratchticket', () => {
    const seed = [...Array(50).keys()].map((i) => i + 1).find((s) => combatRng(s, 1)() >= 0.2)!;
    const { fake } = arena([at('toaster'), far('scratchticket')], { seed, aisle: 1, hp: 40, maxHp: 40 });
    fake.hooks.emit('onAisleStart', { aisle: 1, boss: false, department: 'main', modifier: 'none' });
    expect(fake.callsOf('drain').map((c) => c.by)).toEqual(['scratchticket']);
  });
});
