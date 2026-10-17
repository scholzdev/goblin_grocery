/** Draw order of the arena layers. Pure data so the pattern code (src/engine/patterns) can use it; scenes/fx re-exports it. */
export const DEPTH = { floor: 0, decal: 2, telegraph: 4, world: 10, fx: 5000, bars: 6000, numbers: 7000 };
