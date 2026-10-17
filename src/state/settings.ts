// Per-player settings + best run, persisted in localStorage. Every access guarded.
import { setLang, systemLang, type Lang } from '../i18n/lang';
import { defaultKeys, sanitizeKeys, type KeyMap } from './keymap';

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  reducedMotion: boolean;
  shake: boolean;
  /** Damage numbers take the color of their damage type (and the run-end breakdown its element colors); off keeps the neutral scheme. */
  damageColors: boolean;
  hintSeen: boolean;
  tutorialDone: boolean;
  /** Ids of finished tutorial steps and one-time tips. */
  tutorialSeen: string[];
  fullscreen: boolean;
  language: Lang;
  /** Rebindable keyboard controls (KeyboardEvent.code per action, two slots each). */
  keys: KeyMap;
}

export interface BestRun { score: number; wave: number; won: boolean; date: string }

const KEY = 'goblin-grocery.settings.v1';
const BEST = 'goblin-grocery.best.v1';
const DEFAULTS: Settings = { master: 0.8, music: 0.45, sfx: 0.8, reducedMotion: false, shake: true, damageColors: true, hintSeen: false, tutorialDone: false, tutorialSeen: [], fullscreen: true, language: systemLang(), keys: defaultKeys() };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: settings just won't persist */
  }
}

export const settings: Settings = { ...DEFAULTS, ...(read<Partial<Settings>>(KEY) ?? {}) };
settings.keys = sanitizeKeys(settings.keys);
setLang(settings.language);
export const saveSettings = (): void => write(KEY, settings);

export const getBest = (): BestRun | null => read<BestRun>(BEST);
/** Stores the run if it beats the record; returns true when it's a new best. */
export function submitRun(run: BestRun): boolean {
  const best = getBest();
  if (best && best.score >= run.score) return false;
  write(BEST, run);
  return true;
}
