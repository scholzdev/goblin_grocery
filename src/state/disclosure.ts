import { REACTION_IDS, type ReactionId } from '../engine/define';
import type { RunState } from '../types';
import { profile } from './profile';
import { saveSettings, settings } from './settings';
import { store } from './store';

// A new profile meets the build systems one at a time (docs/audit/mechanics.md, proposal 11). Each system it has met is a `sys:<id>` id in
// `settings.tutorialSeen` and stays for good. The Test Lab, sims and bot runs show everything and never record anything.
export type System = 'sets' | ReactionId;
export const SYSTEMS: readonly System[] = ['sets', ...REACTION_IDS];
const key = (id: System): string => `sys:${id}`;
/** Marks a profile that has loaded since disclosure exists. */
const TRACKED = 'sys';

export const introduced = (id: System): boolean => settings.tutorialSeen.includes(key(id));

function introduce(ids: readonly System[]): System[] {
  const fresh = ids.filter((id) => !introduced(id));
  if (fresh.length) {
    settings.tutorialSeen = [...settings.tutorialSeen, ...fresh.map(key)];
    saveSettings();
  }
  return fresh;
}

// A profile that finished runs before disclosure existed already knows every system.
if (!settings.tutorialSeen.includes(TRACKED)) {
  settings.tutorialSeen = [...settings.tutorialSeen, TRACKED, ...(profile.stats.runs > 0 ? SYSTEMS.map(key) : [])];
  saveSettings();
}

/** A set is at level 1 or more: two items of one set, or one ★2 item. */
export const setActive = (s: RunState): boolean => Object.values(s.build.sets).some((lv) => lv > 0);

/** Records the systems the run meets right now (an active set, each reaction that fired) and returns the ones new to the profile. */
export function disclose(s: RunState): System[] {
  if (s.lab || s.bot) return [];
  const fired: System[] = REACTION_IDS.filter((id) => s.stats.damage.reactions[id] > 0);
  return introduce(setActive(s) ? ['sets', ...fired] : fired);
}

/** Set panel, set chips and badges, set level-up card: once the profile has met sets, or as soon as a set is active (before the next `disclose`). */
export const setsShown = (s: RunState | null = store.state): boolean => introduced('sets') || (!!s && (!!s.lab || !!s.bot || setActive(s)));

/** Settings: "Show all systems". */
export const showAllSystems = (): void => void introduce(SYSTEMS);
export const allSystemsShown = (): boolean => SYSTEMS.every(introduced);
