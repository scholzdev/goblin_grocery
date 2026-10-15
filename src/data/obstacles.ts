import type { DepartmentId } from '../types';
import type { Rect } from '../systems/obstacles';
import { ICE_RADII, ICE_SPOTS, VENT_SPOTS, CABLE_ROWS, BELTS, ARENA } from './arena';
import { DEPT_TUNING } from './departments';

// Themed aisle obstacles: solid props the goblin walks around or dashes (Space shove) over. Rects are ground footprints (centre x,y).
export type ObstacleKind =
  | 'gondola' | 'display' | 'chest_freezer' | 'bread_rack' | 'flour_sacks' | 'tv_boxes' | 'cable_spool' | 'lane_divider' | 'bargain_bin' | 'manager_desk'
  | 'can_stack' | 'icecream_case' | 'kiosk' | 'cart_stack';
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
};

export const o = (kind: ObstacleKind, x: number, y: number): Obstacle => ({ kind, x, y, w: OBSTACLE_KINDS[kind].w, h: OBSTACLE_KINDS[kind].h });

/** Layouts of the non-themed aisles (clearance, boss); one is picked per wave. Themed aisles use their zone's layouts (data/zones.ts). Tests keep them clear of the start, entries, hazards and each other. */
export const OBSTACLES: Partial<Record<DepartmentId, Obstacle[][]>> = {
  clearance: [
    [o('bargain_bin', 300, 330), o('bargain_bin', 980, 330), o('bargain_bin', 300, 620), o('bargain_bin', 980, 620)],
    [o('bargain_bin', 430, 410), o('bargain_bin', 850, 590), o('bargain_bin', 1000, 330)],
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
