// Arena geometry shared by the scene, hazards and obstacle layouts (kept Phaser-free so tests can import it).
export const ARENA = { w: 1280, h: 800, left: 78, right: 1202, top: 196, bottom: 758 };
export const PLAYER_START = { x: 640, y: 500 };

/** Where groceries walk in: two top aisles, two side aisles, two front gaps. */
export const ENTRIES = [
  { x: 344, y: 200 }, { x: 968, y: 200 }, // top aisles
  { x: 84, y: 482 }, { x: 1196, y: 482 },   // side aisles
  { x: 430, y: 752 }, { x: 850, y: 752 },   // front
];

// Hazard footprints per department (shared with src/scenes/hazards.ts).
export const ICE_SPOTS = [{ x: 330, y: 330 }, { x: 960, y: 340 }, { x: 420, y: 640 }, { x: 900, y: 640 }];
export const ICE_RADII = { rx: 104, ry: 54 };
export const VENT_SPOTS = [{ x: 300, y: 470 }, { x: 980, y: 470 }, { x: 640, y: 690 }];
export const CABLE_ROWS = [{ y: 300, x0: 180, x1: 700 }, { y: 520, x0: 560, x1: 1100 }, { y: 690, x0: 160, x1: 640 }];
export const BELTS = [{ y: 360, dir: 1 as const }, { y: 610, dir: -1 as const }];
