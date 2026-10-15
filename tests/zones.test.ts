import { describe, expect, it } from 'vitest';
import { ZONES, ZONE_IDS, ZONE_TUNING, zonesOf } from '../src/data/zones';
import { DEPARTMENTS, DEPT_TUNING, THEMES } from '../src/data/departments';
import { CRATE, OBSTACLES, crateSpots, hazardRects } from '../src/data/obstacles';
import { ARENA, ENTRIES, PLAYER_START, edgeSolids } from '../src/data/arena';
import { BOSS_WAVE, WAVES } from '../src/data/waves';
import { DATA_DE } from '../src/i18n/data-de';
import { zoneT } from '../src/i18n/data';
import { setLang } from '../src/i18n/lang';
import { chooseDoor, createLabRun, createRun, leaveShop, openShop } from '../src/state/run';
import { rollZones, waveSpawnPlan } from '../src/systems/shop';
import { mulberry32 } from '../src/systems/rng';
import { rectsOverlap, type Rect } from '../src/systems/obstacles';
import type { RunState } from '../src/types';

const dist = (a: Rect, b: Rect) => Math.hypot(Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2), Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2));

describe('zones', () => {
  it('3 zones per theme, 2 layouts of 2-6 props each, ids match keys', () => {
    expect(ZONE_IDS).toHaveLength(15);
    for (const th of THEMES) expect(zonesOf(th), th).toHaveLength(3);
    for (const [id, z] of Object.entries(ZONES)) {
      expect(z.id).toBe(id);
      expect(z.layouts, id).toHaveLength(2);
      for (const lay of z.layouts) { expect(lay.length, id).toBeGreaterThanOrEqual(2); expect(lay.length, id).toBeLessThanOrEqual(6); }
      expect(Object.keys(z.tilt), id).toHaveLength(1);
    }
  });

  it('every layout stays clear of start, entries, max-count hazards, edges and each other', () => {
    for (const z of Object.values(ZONES)) {
      const hz = hazardRects(z.theme, 2 + Math.max(0, z.hazardExtra)); // aisle-7 ramp + zone bias
      for (const lay of z.layouts) lay.forEach((a, i) => {
        const tag = `${z.id}:${a.kind}@${a.x},${a.y}`;
        expect(dist(a, { ...PLAYER_START, w: 0, h: 0 }), tag + ' start').toBeGreaterThanOrEqual(140);
        for (const e of ENTRIES) expect(dist(a, { ...e, w: 0, h: 0 }), tag + ' entry').toBeGreaterThanOrEqual(90);
        for (const h of hz) expect(dist(a, h), tag + ' hazard').toBeGreaterThan(0);
        for (const b of lay.slice(i + 1)) expect(dist(a, b), tag + ' gap').toBeGreaterThanOrEqual(140);
        expect(a.x - a.w / 2 - (ARENA.left + 11), tag + ' left').toBeGreaterThanOrEqual(70);
        expect(ARENA.right - 11 - (a.x + a.w / 2), tag + ' right').toBeGreaterThanOrEqual(70);
        expect(a.y - a.h / 2 - ARENA.top, tag + ' top').toBeGreaterThanOrEqual(70);
        expect(ARENA.bottom - (a.y + a.h / 2), tag + ' bottom').toBeGreaterThanOrEqual(55);
      });
    }
  });

  const shop = (theme: RunState['theme'], seed = 1, wave = 2): RunState => {
    const s = createRun(seed, 'toaster', 0, 'toaster', theme);
    s.wave = wave; s.shopLevel = 3;
    openShop(s, mulberry32(1));
    return s;
  };

  it('aisle 1 zone is a deterministic zone of the theme', () => {
    for (const th of THEMES) for (let seed = 0; seed < 30; seed++) {
      const s = createRun(seed, 'toaster', 0, 'toaster', th);
      expect(ZONES[s.zone!].theme).toBe(th);
      expect(s.zones).toEqual([s.zone]);
      expect(createRun(seed, 'toaster', 0, 'toaster', th).zone).toBe(s.zone);
    }
    expect(new Set(Array.from({ length: 40 }, (_, i) => createRun(i).zone)).size).toBe(3);
  });

  it('rollZones: distinct, deterministic, none for boss / clearance', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = shop('frozen', seed);
      const z = rollZones(s, mulberry32(seed), ['none', 'rush', 'event']);
      expect(new Set(z).size).toBe(3);
      for (const id of z) expect(ZONES[id!].theme).toBe('frozen');
      expect(rollZones(s, mulberry32(seed), ['none', 'rush', 'event'])).toEqual(z);
      const c = rollZones(s, mulberry32(seed), ['quiet', 'clearance']);
      expect(c[1]).toBeNull(); expect(c[0]).not.toBeNull();
    }
    expect(rollZones(shop('main'), mulberry32(1), ['boss'])).toEqual([null]);
  });

  it('rollZones penalises repeats', () => {
    const s = shop('bakery');
    const used = zonesOf('bakery')[0].id;
    s.zones = [used, used];
    let hits = 0;
    for (let seed = 0; seed < 600; seed++) if (rollZones(s, mulberry32(seed), ['none'])[0] === used) hits++;
    const w = (n: number) => 1 / (1 + n) ** ZONE_TUNING.repeatPenalty;
    expect(hits / 600).toBeCloseTo(w(2) / (w(2) + 2 * w(0)), 1);
    expect(hits).toBeLessThan(120);
  });

  it('leaveShop rolls doorZones, chooseDoor applies and records the zone', () => {
    const s = shop('electronics');
    expect(leaveShop(s, mulberry32(9)).ok).toBe(true);
    expect(s.doorZones).toHaveLength(s.doors!.length);
    const i = s.doors!.length - 1, id = s.doors![i], zone = s.doorZones![i];
    expect(chooseDoor(s, id).ok).toBe(true);
    expect(s.zone).toBe(zone);
    expect(s.zones).toHaveLength(2);
    expect(s.zones[1]).toBe(zone);
    expect(s.doorZones).toBeNull();
    const b = shop('main', 1, BOSS_WAVE - 1); // shop before the boss
    leaveShop(b, mulberry32(2));
    expect(b.doors).toEqual(['boss']);
    chooseDoor(b, 'boss');
    expect([b.zone, b.zones[1]]).toEqual([null, null]);
  });

  it('lab runs get a zone on each door', () => {
    const s = createLabRun(4, { aisle: 3, dept: 'checkout', shift: 0, starter: 'toaster', weapon: 'toaster', money: 50, cart: [4, 4], shelf: 4, shopLevel: 1, god: false, keep: false });
    openShop(s, mulberry32(4));
    leaveShop(s, mulberry32(4));
    expect(ZONES[s.doorZones![0]!].theme).toBe('checkout');
  });

  it('waveSpawnPlan tilts the zone enemy and keeps the total', () => {
    const s = createRun(1, 'toaster', 0, 'toaster', 'frozen');
    s.wave = 5;
    s.zone = null;
    const base = waveSpawnPlan(s);
    s.zone = 'freezer_row';
    const p = waveSpawnPlan(s);
    expect(WAVES[4].mix.turkey).toBeGreaterThan(0);
    expect(p.mix.turkey).toBeCloseTo(base.mix.turkey! * ZONE_TUNING.tilt);
    expect(p.mix.milk).toBeCloseTo(base.mix.milk!);
    expect(p.total).toBe(base.total);
    s.department = 'boss';
    expect(waveSpawnPlan(s).mix).toEqual(waveSpawnPlan({ ...s, zone: null }).mix);
  });

  it('hazard bias ramps within the spot count', () => {
    const max = { frozen: 6, bakery: 5, electronics: 5 } as const;
    expect(DEPT_TUNING.ice.patches + 2 + 1).toBeGreaterThan(max.frozen);
    expect(hazardRects('bakery', 2 + ZONES.oven_line.hazardExtra)).toHaveLength(max.bakery);
  });

  it('German zone names and blurbs exist', () => {
    for (const id of ZONE_IDS) { expect(DATA_DE.zones[id].name, id).toBeTruthy(); expect(DATA_DE.zones[id].blurb, id).toBeTruthy(); expect(ZONES[id].blurb.split(' ').length).toBeLessThanOrEqual(8); expect(DATA_DE.zones[id].blurb.split(' ').length).toBeLessThanOrEqual(8); }
    setLang('de');
    expect(zoneT('cereal_wall').name).toBe('Müsliwand');
    setLang('en');
    expect(zoneT('cereal_wall').name).toBe('Cereal Wall');
  });

  it('rectsOverlap: touching is clear, padding grows the first rect', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(rectsOverlap(a, { x: 9, y: 0, w: 10, h: 10 })).toBe(true);
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsOverlap(a, { x: 12, y: 0, w: 10, h: 10 }, 3)).toBe(true);
  });

  it('crates in every layout: 3 spots clear of props, edge dressing, the start and each other, inside the arena', () => {
    const cases: [string, Rect[], string[]][] = [
      ...Object.values(ZONES).flatMap((z) => z.layouts.map((lay, i) => [`${z.id}#${i}`, lay, DEPARTMENTS[z.theme].theme.props] as [string, Rect[], string[]])),
      ...Object.entries(OBSTACLES).flatMap(([d, lays]) => lays!.map((lay, i) => [`${d}#${i}`, lay, DEPARTMENTS[d as keyof typeof DEPARTMENTS].theme.props] as [string, Rect[], string[]])),
      ['empty', [], DEPARTMENTS.main.theme.props],
    ];
    for (const [tag, lay, props] of cases) {
      const solids = [...lay, ...edgeSolids(props)];
      const spots = crateSpots(solids, 3);
      expect(spots, tag).toHaveLength(3);
      const rects = spots.map((p) => ({ ...p, w: CRATE.w, h: CRATE.h }));
      rects.forEach((r, i) => {
        for (const o of lay) expect(rectsOverlap(r, o, CRATE.margin - 1), `${tag} crate ${i} vs ${o.x},${o.y}`).toBe(false);
        for (const o of edgeSolids(props)) expect(rectsOverlap(r, o), `${tag} crate ${i} vs edge`).toBe(false);
        expect(rectsOverlap(r, { ...PLAYER_START, ...CRATE.startKeepOut }), `${tag} crate ${i} start`).toBe(false);
        rects.slice(i + 1).forEach((q) => expect(rectsOverlap(r, q), `${tag} crates`).toBe(false));
        expect(r.x - r.w / 2, tag).toBeGreaterThan(ARENA.left);
        expect(r.x + r.w / 2, tag).toBeLessThan(ARENA.right);
        expect(r.y - r.h / 2, tag).toBeGreaterThan(ARENA.top);
        expect(r.y + r.h / 2, tag).toBeLessThan(ARENA.bottom);
      });
      expect(crateSpots(solids, 3), tag + ' deterministic').toEqual(spots);
    }
  });
});
