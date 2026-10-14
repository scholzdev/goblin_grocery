import type Phaser from 'phaser';
import type { AudioKey } from '../data/assets';
import type { DepartmentId } from '../types';
import type { ModifierId } from '../data/modifiers';
import { settings } from '../state/settings';
import { store } from '../state/store';

// One looping track per department with a short crossfade. Volume follows the music slider.
// ponytail: no module-level import of sfx.ts (it imports this file).

const FADE_MS = 800;
const BASE = 0.5;
type Voice = { key: AudioKey; snd: Phaser.Sound.WebAudioSound; fade: number; dir: 1 | -1 };

let game: Phaser.Game | null = null;
let voices: Voice[] = [];
let timer = 0;
let last = 0;

export function initMusic(g: Phaser.Game): void {
  game = g;
  store.on('shop-open', () => playMusic('music_main'));
}

export function musicFor(dept: DepartmentId, boss = false, modifier: ModifierId = 'none'): AudioKey {
  return boss ? 'music_boss' : (`music_${modifier === 'clearance' ? 'clearance' : dept}` as AudioKey);
}

const vol = (v: Voice) => settings.master * settings.music * BASE * v.fade;

export function refreshMusic(): void {
  for (const v of voices) v.snd.setVolume(vol(v));
}

function tick(): void {
  const now = performance.now(), step = (now - last) / FADE_MS;
  last = now;
  for (const v of voices) v.fade = Math.min(1, Math.max(0, v.fade + v.dir * step));
  for (const v of voices.filter((x) => x.dir < 0 && x.fade <= 0)) v.snd.destroy();
  voices = voices.filter((x) => x.dir > 0 || x.fade > 0);
  refreshMusic();
  if (voices.every((x) => x.dir > 0 && x.fade >= 1)) { clearInterval(timer); timer = 0; }
}

/** Start `key` (crossfading from the current track). No-op if it is already playing or not loaded. */
export function playMusic(key: AudioKey): void {
  if (!game || !game.cache.audio.exists(key)) return;
  if (voices.some((v) => v.key === key && v.dir > 0)) return;
  for (const v of voices) v.dir = -1;
  const snd = game.sound.add(key, { loop: true, volume: 0 }) as Phaser.Sound.WebAudioSound;
  voices.push({ key, snd, fade: voices.length ? 0 : 1, dir: 1 });
  snd.play();
  last = performance.now();
  if (!timer) timer = window.setInterval(tick, 50);
  refreshMusic();
}

/** Debug/test hook: key of the track currently fading in or playing. */
export const currentMusic = (): AudioKey | null => voices.find((v) => v.dir > 0)?.key ?? null;
