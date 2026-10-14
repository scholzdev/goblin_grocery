import { SVG_ASSETS } from './assets';
// Arena geometry shared by the scene, hazards and obstacle layouts (kept Phaser-free so tests can import it).
export const ARENA = { w: 1280, h: 800, left: 78, right: 1202, top: 196, bottom: 758 };
export const PLAYER_START = { x: 640, y: 500 };

/** Where groceries walk in: two top aisles, two side aisles, two front gaps. */
export const ENTRIES = [
  { x: 344, y: 200 }, { x: 968, y: 200 }, // top aisles
  { x: 84, y: 482 }, { x: 1196, y: 482 },   // side aisles
  { x: 430, y: 752 }, { x: 850, y: 752 },   // front
];

// Hazard footprints per department (shared with src/scenes/hazards.ts); the first N are used, N grows with the aisle.
export const ICE_SPOTS = [{ x: 330, y: 330 }, { x: 960, y: 340 }, { x: 420, y: 640 }, { x: 900, y: 640 }, { x: 640, y: 290 }, { x: 190, y: 520 }];
export const ICE_RADII = { rx: 104, ry: 54 };
export const VENT_SPOTS = [{ x: 300, y: 470 }, { x: 980, y: 470 }, { x: 640, y: 690 }, { x: 640, y: 330 }, { x: 180, y: 660 }];
export const CABLE_ROWS = [{ y: 300, x0: 180, x1: 700 }, { y: 520, x0: 560, x1: 1100 }, { y: 690, x0: 160, x1: 640 }, { y: 410, x0: 200, x1: 760 }, { y: 620, x0: 700, x1: 1160 }];
export const BELTS = [{ y: 360, dir: 1 as const }, { y: 610, dir: -1 as const }];

// Arena-edge dressing: drawn by ArenaScene.buildEnvironment and solid for goblin, groceries and coins (see EDGE_SOLIDS).
export const SIDE_UNITS = { xs: [30, 1250], bottoms: [400, 810], w: 96, h: 220 }; // shelf sprite 96x220, origin (0.5,1)
/** Props [x, y, scale]: the first three stand in the front row, the last two in the top corners (sprite origin 0.5,0.95). */
export const DECO_SPOTS: [number, number, number][] = [[210, 812, 1], [640, 812, 1], [1070, 812, 1], [1140, 250, 0.85], [150, 238, 0.85]];
const PROP_FOOT = 0.8; // share of a prop's sprite width that is solid (its base, not the shadow)
const propW = (key: string, scale: number) => (SVG_ASSETS.find((a) => a.key === key)?.w ?? 100) * scale * PROP_FOOT;

type Box = { x: number; y: number; w: number; h: number };
/** Centre-based ground rects of the edge dressing for a theme's prop list (DECO_SPOTS[i] draws props[i % len]), same shape as obstacles.
 *  Not part of OBSTACLES (layout tests / vault planning stay per-layout). */
export function edgeSolids(props: string[]): Box[] {
  return [
    ...SIDE_UNITS.xs.flatMap((x) => SIDE_UNITS.bottoms.map((b) => ({ x, y: b - SIDE_UNITS.h / 2, w: SIDE_UNITS.w, h: SIDE_UNITS.h }))),
    ...DECO_SPOTS.map(([x, y, sc], i) => {
      const w = propW(props[i % props.length], sc);
      // front props: only the top ~25px of the art reaches above ARENA.bottom; corner props: bottom 44px of the art
      return i < 3 ? { x, y: (ARENA.bottom - 23 + y) / 2, w, h: y - (ARENA.bottom - 23) } : { x, y: y - 16, w, h: 44 };
    }),
  ];
}
