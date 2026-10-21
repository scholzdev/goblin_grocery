import { EVENTS, EVENT_LEAD, SET_EVENT, SET_EVENTS, SET_EVENT_KINDS, type EventKind, type SetEventKind } from '../data/events';
import { waveDef } from '../data/waves';
import type { DepartmentId, SetId } from '../types';
import type { Rng } from './rng';

export interface EventRoll { kind: EventKind; startAt: number; duration: number }

export const outageDuration = (shift: number): number => EVENTS.outage.duration + EVENTS.outage.durationPerShift * shift;

/** Which event (if any) hits this aisle. `force` (Test Lab) skips the chance and aisle gate, never the boss aisle. */
export function rollEvent(dept: DepartmentId, aisle: number, shift: number, rng: Rng, boss: boolean, force: EventKind | 'none' | 'random' = 'random', sets?: Record<SetId, number>): EventRoll | null {
  if (boss || dept === 'boss' || force === 'none') return null;
  const order: ('wetFloor' | 'outage')[] = dept === 'electronics' ? ['outage', 'wetFloor'] : ['wetFloor', 'outage'];
  let kind: EventKind | undefined = force === 'random' ? order.find((k) => aisle >= EVENTS[k].minAisle && rng() < (EVENTS[k].chanceByDept[dept] ?? 0)) : force;
  // Set events: one roll each (x3 with the matching set), only if nothing else hit.
  if (!kind && force === 'random' && aisle >= SET_EVENT.minAisle) {
    kind = SET_EVENT_KINDS.find((k) => rng() < SET_EVENT.chance * ((sets?.[SET_EVENTS[k]] ?? 0) >= 1 ? SET_EVENT.setWeight : 1));
  }
  if (!kind) return null;
  const [a, b] = isSetEvent(kind) ? SET_EVENT.startAt : EVENTS[kind].startAt;
  const end = Math.min(b, waveDef(aisle).duration - EVENT_LEAD);
  return { kind, startAt: a + rng() * (end - a), duration: kind === 'outage' ? outageDuration(shift) : isSetEvent(kind) ? EVENTS[kind].duration : 0 };
}

export const isSetEvent = (k: EventKind): k is SetEventKind => k in SET_EVENTS;
