import type { DepartmentId } from '../types';

/** Aisle events: at most one per aisle, never on the boss aisle. Chances are per department. */
export type EventKind = 'wetFloor' | 'outage';
type Chances = Partial<Record<DepartmentId, number>>;

export const EVENTS = {
  wetFloor: {
    chanceByDept: { main: 0.35, bakery: 0.35, clearance: 0.4, checkout: 0.3, frozen: 0.2, electronics: 0.2 } as Chances,
    minAisle: 2,
    startAt: [12, 35] as [number, number], // seconds into the aisle
    streaks: 3,             // max robot runs
    puddleR: 40,
    puddleSpacing: 125,      // gaps between puddles so a streak is dodgeable, not a river
    dryAfter: 12,           // seconds until a puddle is gone
    playerSlow: 0.35,
    enemySlow: 0.2,
    robotSpeed: 300,        // px/s
  },
  outage: {
    chanceByDept: { electronics: 0.6, frozen: 0.15, main: 0.12, clearance: 0.15, checkout: 0.15, bakery: 0.1 } as Chances,
    minAisle: 3,
    startAt: [15, 30] as [number, number],
    duration: 16,           // seconds of darkness
    durationPerShift: 2,
    flicker: 1.2,           // seconds of flicker before and after
    coneDeg: 70,
    coneRange: 380,
    glowR: 110,
    darkness: 0.88,
  },
} as const;
