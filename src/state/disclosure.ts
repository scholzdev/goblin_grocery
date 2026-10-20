import { REACTION_IDS, type ReactionId } from '../engine/define';
import type { RunState } from '../types';
import { profile } from './profile';
import { saveSettings, settings } from './settings';
import { store } from './store';

// Each system a profile has met is a `sys:<id>` id in `settings.tutorialSeen` for good. The Test Lab, sims and bot runs show everything
// and record nothing.
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

// A profile from before disclosure that has finished runs already knows every system.
if (!settings.tutorialSeen.includes(TRACKED)) {
  settings.tutorialSeen = [...settings.tutorialSeen, TRACKED, ...(profile.stats.runs > 0 ? SYSTEMS.map(key) : [])];
  saveSettings();
}

export const setActive = (s: RunState): boolean => Object.values(s.build.sets).some((lv) => lv > 0);

/** Returns only the systems new to the profile. */
export function disclose(s: RunState): System[] {
  if (s.lab || s.bot) return [];
  const fired: System[] = REACTION_IDS.filter((id) => s.stats.damage.reactions[id] > 0);
  return introduce(setActive(s) ? ['sets', ...fired] : fired);
}

/** Also true while a set is active and `disclose` has not recorded it yet. */
export const setsShown = (s: RunState | null = store.state): boolean => introduced('sets') || (!!s && (!!s.lab || !!s.bot || setActive(s)));

export const showAllSystems = (): void => void introduce(SYSTEMS);
export const allSystemsShown = (): boolean => SYSTEMS.every(introduced);
