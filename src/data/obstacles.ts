import type { DepartmentId } from '../types';
import type { Rect } from '../systems/obstacles';
import { ICE_RADII, ICE_SPOTS, VENT_SPOTS, CABLE_ROWS, BELTS, ARENA } from './arena';
import { DEPT_TUNING } from './departments';

// Themed aisle obstacles: solid props the goblin walks around or dashes (Space shove) over. Rects are ground footprints (centre x,y).
export type ObstacleKind =
  | 'gondola' | 'display' | 'chest_freezer' | 'bread_rack' | 'flour_sacks' | 'tv_boxes' | 'cable_spool' | 'lane_divider' | 'bargain_bin' | 'manager_desk';
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
};

const o = (kind: ObstacleKind, x: number, y: number): Obstacle => ({ kind, x, y, w: OBSTACLE_KINDS[kind].w, h: OBSTACLE_KINDS[kind].h });

/** 2-3 layouts per department; one is picked per wave. Tests keep them clear of the start, entries, hazards and each other. */
export const OBSTACLES: Record<DepartmentId, Obstacle[][]> = {
  main: [
    [o('gondola', 400, 470), o('gondola', 880, 560), o('display', 640, 330)],
    [o('display', 330, 600), o('display', 950, 600), o('gondola', 640, 320)],
  ],
  frozen: [
    [o('chest_freezer', 640, 320), o('chest_freezer', 250, 520), o('chest_freezer', 1030, 520)],
    [o('chest_freezer', 400, 480), o('chest_freezer', 880, 520)],
  ],
  bakery: [
    [o('bread_rack', 300, 330), o('bread_rack', 980, 330), o('flour_sacks', 640, 320)],
    [o('flour_sacks', 470, 610), o('bread_rack', 1000, 620), o('bread_rack', 240, 330)],
  ],
  electronics: [
    [o('tv_boxes', 900, 370), o('cable_spool', 380, 430), o('cable_spool', 1000, 650)],
    [o('tv_boxes', 300, 590), o('tv_boxes', 1000, 330), o('cable_spool', 1000, 610)],
  ],
  checkout: [
    [o('lane_divider', 420, 480), o('lane_divider', 860, 480)],
    [o('lane_divider', 640, 290), o('lane_divider', 270, 470), o('lane_divider', 1010, 470)],
  ],
  clearance: [
    [o('bargain_bin', 300, 330), o('bargain_bin', 980, 330), o('bargain_bin', 300, 620), o('bargain_bin', 980, 620)],
    [o('bargain_bin', 430, 410), o('bargain_bin', 850, 590), o('bargain_bin', 1000, 330)],
  ],
  boss: [
    [o('manager_desk', 400, 450), o('manager_desk', 880, 550)],
    [o('manager_desk', 300, 600), o('manager_desk', 980, 400)],
  ],
};

/** Bounding rects of a department's floor hazards (for layout validation). */
export function hazardRects(dept: DepartmentId): Rect[] {
  switch (dept) {
    case 'frozen': return ICE_SPOTS.slice(0, DEPT_TUNING.ice.patches).map((p) => ({ x: p.x, y: p.y, w: ICE_RADII.rx * 2, h: ICE_RADII.ry * 2 }));
    case 'bakery': return VENT_SPOTS.slice(0, DEPT_TUNING.vents.count).map((p) => ({ x: p.x, y: p.y, w: DEPT_TUNING.vents.radius * 2, h: DEPT_TUNING.vents.radius * 2 }));
    case 'electronics': return CABLE_ROWS.slice(0, DEPT_TUNING.cables.count).map((c) => ({ x: (c.x0 + c.x1) / 2, y: c.y, w: c.x1 - c.x0, h: 36 }));
    case 'checkout': return BELTS.map((b) => ({ x: ARENA.w / 2, y: b.y, w: ARENA.w - 300, h: DEPT_TUNING.conveyor.height }));
    default: return [];
  }
}
