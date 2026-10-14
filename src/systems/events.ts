import { EVENTS, type EventKind } from '../data/events';
import type { DepartmentId } from '../types';
import type { Rng } from './rng';

export interface EventRoll { kind: EventKind; startAt: number; duration: number }

export const outageDuration = (shift: number): number => EVENTS.outage.duration + EVENTS.outage.durationPerShift * shift;

/** Which event (if any) hits this aisle. `force` (Test Lab) skips the chance and aisle gate, never the boss aisle. */
export function rollEvent(dept: DepartmentId, aisle: number, shift: number, rng: Rng, boss: boolean, force: EventKind | 'none' | 'random' = 'random'): EventRoll | null {
  if (boss || dept === 'boss' || force === 'none') return null;
  const order: EventKind[] = dept === 'electronics' ? ['outage', 'wetFloor'] : ['wetFloor', 'outage'];
  const kind = force === 'random'
    ? order.find((k) => aisle >= EVENTS[k].minAisle && rng() < (EVENTS[k].chanceByDept[dept] ?? 0))
    : force;
  if (!kind) return null;
  const [a, b] = EVENTS[kind].startAt;
  return { kind, startAt: a + rng() * (b - a), duration: kind === 'outage' ? outageDuration(shift) : 0 };
}
