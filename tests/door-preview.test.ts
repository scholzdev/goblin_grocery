import { describe, expect, it } from 'vitest';
import type { ZoneId } from '../src/data/zones';
import { chooseDoor, createRun, finishWave, leaveShop, openShop, startNextWave } from '../src/state/run';
import { mulberry32 } from '../src/systems/rng';
import { previewAisle, waveSpawnPlan, type AisleDoor } from '../src/systems/shop';
import type { DepartmentId, RunState } from '../src/types';

// The route screen previews the aisle behind each door (docs/audit/mechanics.md proposal 9).

/** Route screen after shop `wave`. The aisle just played was a Rush door in another zone, so a preview that reads it instead of the door is wrong. */
const atRoute = (theme: DepartmentId, wave: number, doors: AisleDoor[], doorZones: (ZoneId | null)[], lastZone: ZoneId | null = null): RunState => {
  const s = createRun(1, 'toaster', 0, 'toaster', theme);
  Object.assign(s, { wave, phase: 'route', modifier: 'rush', zone: lastZone, doors, doorZones });
  return s;
};

/** The plan of the aisle the door really starts. */
const entered = (s: RunState, id: AisleDoor) => {
  const c = structuredClone(s);
  expect(chooseDoor(c, id).ok, `door ${id} opens`).toBe(true);
  startNextWave(c);
  return waveSpawnPlan(c);
};

describe('door preview', () => {
  it('equals the spawn plan of the aisle chooseDoor and startNextWave start, for every door kind', () => {
    const doors: [AisleDoor, ZoneId | null][] = [
      ['none', 'freezer_row'], ['rush', 'icecream_island'], ['quiet', 'freezer_row'], ['event', 'icecream_island'],
      ['clearance', null], ['stockroom', null], ['coldRoom', null], ['vipAisle', null],
    ];
    for (const [id, zone] of doors) {
      const s = atRoute('frozen', 4, [id], [zone], 'walk_in');
      expect(previewAisle(s, id).plan, id).toEqual(entered(s, id));
    }
    const boss = atRoute('bakery', 7, ['boss'], [null]);
    expect(previewAisle(boss, 'boss').plan).toEqual(entered(boss, 'boss'));
    const two = atRoute('frozen', 4, ['quiet', 'none'], ['walk_in', 'freezer_row']);
    expect(previewAisle(two, 'none').plan, 'second door reads its own zone').toEqual(entered(two, 'none'));
  });

  it('lists the 3 most common groceries in order of expected count; the zone tilt can reorder them', () => {
    // Bakery aisle 5: banana 2 x 1.5 = 3, baguette 1.5 x 1.8 = 2.7, milk 2 x 1 = 2, egg 1.8; Oven Line tilts baguettes x1.5 to 4.05.
    const s = atRoute('bakery', 4, ['quiet', 'none'], [null, 'oven_line']);
    expect(previewAisle(s, 'quiet').top).toEqual(['banana', 'baguette', 'milk']);
    expect(previewAisle(s, 'none').top).toEqual(['baguette', 'banana', 'milk']);
    expect(previewAisle(atRoute('frozen', 4, ['stockroom'], [null]), 'stockroom').top, 'the Stockroom has no groceries').toEqual([]);
  });

  it('shows the elite odds the door sets', () => {
    const s = atRoute('frozen', 4, ['none', 'clearance', 'vipAisle', 'stockroom'], [null, null, null, null]);
    expect(['none', 'clearance', 'vipAisle', 'stockroom'].map((d) => previewAisle(s, d as AisleDoor).elites)).toEqual(['some', 'more', 'all', 'none']);
    expect(previewAisle(atRoute('frozen', 1, ['rush'], [null]), 'rush').elites, 'no Elites before aisle 3').toBe('none');
    expect(previewAisle(atRoute('frozen', 7, ['boss'], [null]), 'boss').elites, 'no Elites in the boss aisle').toBe('none');
  });

  it('shows the floor hazard of the aisle: the zone shifts the spot count, the Stockroom has none', () => {
    // Bakery vents: 3, +1 from aisle 4 on; Oven Line +2 (capped at the 5 vents), Cake Counter -1.
    const s = atRoute('bakery', 4, ['none', 'quiet', 'rush'], ['oven_line', 'bread_racks', 'cake_counter']);
    expect(['none', 'quiet', 'rush'].map((d) => previewAisle(s, d as AisleDoor).hazard).map(({ kind, spots }) => [kind, spots])).toEqual([['vents', 5], ['vents', 4], ['vents', 3]]);
    const f = atRoute('frozen', 2, ['coldRoom', 'stockroom'], [null, null]);
    expect([previewAisle(f, 'coldRoom').hazard.kind, previewAisle(f, 'coldRoom').hazard.spots]).toEqual(['ice', 4]);
    expect(previewAisle(f, 'stockroom').hazard.kind).toBe('none');
    expect(previewAisle(atRoute('main', 2, ['none'], [null]), 'none').hazard.kind).toBe('none');
  });

  it('changes nothing: the state stays equal and the run plays out the same with the same seed', () => {
    const s = atRoute('frozen', 4, ['none', 'clearance', 'vipAisle'], ['freezer_row', null, null]);
    const before = structuredClone(s);
    for (const d of s.doors as AisleDoor[]) previewAisle(s, d);
    expect(s).toEqual(before);

    const play = (peek: boolean) => {
      const r = createRun(7, 'toaster', 0, 'toaster', 'electronics'), rng = mulberry32(7);
      r.wave = 3;
      openShop(r, rng);
      leaveShop(r, rng);
      if (peek) for (const d of r.doors!) if (d !== 'shortcut') previewAisle(r, d);
      chooseDoor(r, r.doors![0]);
      startNextWave(r);
      const plan = waveSpawnPlan(r);
      finishWave(r);
      openShop(r, rng);
      return { plan, offers: r.shop!.offers, next: rng() };
    };
    expect(play(true)).toEqual(play(false));
  });
});
