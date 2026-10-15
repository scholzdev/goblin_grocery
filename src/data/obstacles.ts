import type { DepartmentId } from '../types';
import { rectsOverlap, type Pt, type Rect } from '../systems/obstacles';
import { ICE_RADII, ICE_SPOTS, VENT_SPOTS, CABLE_ROWS, BELTS, ARENA, PLAYER_START } from './arena';
import { DEPT_TUNING } from './departments';

// Themed aisle obstacles: solid props the goblin walks around or dashes (Space shove) over. Rects are ground footprints (centre x,y).
export type ObstacleKind =
  | 'gondola' | 'display' | 'chest_freezer' | 'bread_rack' | 'flour_sacks' | 'tv_boxes' | 'cable_spool' | 'lane_divider' | 'bargain_bin' | 'manager_desk'
  | 'can_stack' | 'icecream_case' | 'kiosk' | 'cart_stack'
  | 'can_bowl' | 'candy_display' | 'spring_mat';
export interface Obstacle extends Rect { kind: ObstacleKind }

/** Footprint size and texture key per kind. */
export const OBSTACLE_KINDS: Record<ObstacleKind, { w: number; h: number; tex: string }> = {
  gondola: { w: 150, h: 56, tex: 'ob_gondola' },
  display: { w: 90, h: 60, tex: 'ob_display' },
  chest_freezer: { w: 150, h: 60, tex: 'ob_chest_freezer' },
  bread_rack: { w: 100, h: 56, tex: 'ob_bread_rack' },
  flour_sacks: { w: 110, h: 56, tex: 'ob_flour_sacks' },
  tv_boxes: { w: 100, h: 56, tex: 'ob_tv_boxes' },
  cable_spool: { w: 90, h: 60, tex: 'ob_cable_spool' },
  lane_divider: { w: 160, h: 40, tex: 'ob_lane_divider' },
  bargain_bin: { w: 120, h: 60, tex: 'ob_bargain_bin' },
  manager_desk: { w: 130, h: 56, tex: 'ob_manager_desk' },
  // zone props reuse the dressing sprites (footprint ~0.8 of the art)
  can_stack: { w: 96, h: 56, tex: 'prop_cans' },
  icecream_case: { w: 88, h: 60, tex: 'prop_icecream' },
  kiosk: { w: 88, h: 60, tex: 'prop_tvbox' },
  cart_stack: { w: 48, h: 36, tex: 'prop_wetfloor' },
  // dash props: can_bowl and candy_display are solid until a dash hits them, spring_mat is a floor pad (see DASH_PROPS)
  can_bowl: { w: 96, h: 56, tex: 'ob_can_bowl' },
  candy_display: { w: 90, h: 60, tex: 'ob_candy_display' },
  spring_mat: { w: 130, h: 40, tex: 'ob_spring_mat' },
};

/** Props the Space dash interacts with: topple = bowls over groceries in line, break = bursts into coins, spring = floor pad that stretches the dash. */
export const DASH_PROPS: Partial<Record<ObstacleKind, 'topple' | 'break' | 'spring'>> = { can_bowl: 'topple', candy_display: 'break', spring_mat: 'spring' };
export const PROP_TUNING = {
  topple: { damage: 14, length: 300, halfWidth: 60, knockback: 260 },
  break: { coins: 3 },
  spring: { bonusTime: 0.12 }, // seconds added to the dash (~+75% distance)
};

export const o = (kind: ObstacleKind, x: number, y: number): Obstacle => ({ kind, x, y, w: OBSTACLE_KINDS[kind].w, h: OBSTACLE_KINDS[kind].h });

/** Layouts of the non-themed aisles (clearance, boss); one is picked per wave. Themed aisles use their zone's layouts (data/zones.ts). Tests keep them clear of the start, entries, hazards and each other. */
export const OBSTACLES: Partial<Record<DepartmentId, Obstacle[][]>> = {
  clearance: [
    [o('bargain_bin', 300, 330), o('bargain_bin', 980, 330), o('bargain_bin', 300, 620), o('bargain_bin', 980, 620)],
    [o('bargain_bin', 430, 410), o('bargain_bin', 850, 590), o('bargain_bin', 1000, 330), o('spring_mat', 360, 630)],
  ],
  boss: [
    [o('manager_desk', 400, 450), o('manager_desk', 880, 550)],
    [o('manager_desk', 300, 600), o('manager_desk', 980, 400)],
  ],
};

/** Bounding rects of a department's floor hazards (for layout validation); `extra` = spots added by aisle ramp / zone (see Hazards). */
export function hazardRects(dept: DepartmentId, extra = 0): Rect[] {
  switch (dept) {
    case 'frozen': return ICE_SPOTS.slice(0, DEPT_TUNING.ice.patches + extra).map((p) => ({ x: p.x, y: p.y, w: ICE_RADII.rx * 2, h: ICE_RADII.ry * 2 }));
    case 'bakery': return VENT_SPOTS.slice(0, DEPT_TUNING.vents.count + extra).map((p) => ({ x: p.x, y: p.y, w: DEPT_TUNING.vents.radius * 2, h: DEPT_TUNING.vents.radius * 2 }));
    case 'electronics': return CABLE_ROWS.slice(0, DEPT_TUNING.cables.count + extra).map((c) => ({ x: (c.x0 + c.x1) / 2, y: c.y, w: c.x1 - c.x0, h: 36 }));
    case 'checkout': return BELTS.map((b) => ({ x: ARENA.w / 2, y: b.y, w: ARENA.w - 300, h: DEPT_TUNING.conveyor.height }));
    default: return [];
  }
}

/** Loot crates (stockroom, mini-boss): footprint (same art as the TV-box obstacle), clearance around props, and the player-start keep-out. */
export const CRATE = { w: 100, h: 56, margin: 18, startKeepOut: { w: 180, h: 110 } };

/**
 * Centre-based footprints for `count` loot crates. Slot i prefers the classic row (30/50/70% across, y 520/480/520);
 * the nearest cell of a fixed grid that clears every obstacle, the player start and earlier crates wins.
 * Falls back to the preferred spot if the grid is somehow full. Pure and deterministic.
 */
export function crateSpots(obstacles: readonly Rect[], count: number): Pt[] {
  const start: Rect = { ...PLAYER_START, ...CRATE.startKeepOut };
  const cands: Pt[] = [];
  for (let y = ARENA.top + 70; y <= ARENA.bottom - 50; y += 36) for (let x = ARENA.left + 90; x <= ARENA.right - 90; x += 50) cands.push({ x, y });
  const chosen: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const want = { x: ARENA.w * (0.3 + 0.2 * i), y: (i === 1 ? 480 : 520) - CRATE.h / 2 };
    const fits = (c: Pt) => {
      const r: Rect = { ...c, w: CRATE.w, h: CRATE.h };
      return !obstacles.some((o) => rectsOverlap(r, o, CRATE.margin)) && !rectsOverlap(r, start) && !chosen.some((o) => rectsOverlap(r, o, CRATE.margin));
    };
    const near = (c: Pt) => Math.hypot(c.x - want.x, (c.y - want.y) * 1.5);
    const best = cands.filter(fits).sort((a, b) => near(a) - near(b))[0] ?? want;
    chosen.push({ ...best, w: CRATE.w, h: CRATE.h });
  }
  return chosen.map(({ x, y }) => ({ x, y }));
}
