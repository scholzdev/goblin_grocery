import type Phaser from 'phaser';
import type { AudioKey } from '../data/assets';
import { settings } from '../state/settings';
import { initMusic, playMusic, refreshMusic } from './music';

// Throttled effect playback on top of Phaser's sound manager.
// Falls back to a tiny Web Audio blip when a sample failed to load.

const MIN_GAP: Partial<Record<AudioKey, number>> = {
  toast_pop: 0.07, nail_burst: 0.12, pan_clang: 0.09, vacuum_pulse: 0.15, coin: 0.045,
  enemy_death: 0.05, hurt: 0.2, spawn: 0.25, boss_hit: 0.08, bubble: 0.12, swipe_tell: 0.15, frost: 0.2, click: 0.03,
  zap: 0.15, blender: 0.22, cap_ping: 0.06, splash: 0.3, crit: 0.12, boom: 0.08, spray: 0.12, pop: 0.06, whistle: 0.3,
};
const MAX_VOICES = 4;
const BASE_VOL: Partial<Record<AudioKey, number>> = {
  toast_pop: 0.45, nail_burst: 0.4, pan_clang: 0.45, vacuum_pulse: 0.35, coin: 0.4, enemy_death: 0.45,
  hurt: 0.7, spawn: 0.3, click: 0.5, bubble: 0.35, swipe_tell: 0.4, frost: 0.4,
  zap: 0.5, blender: 0.3, cap_ping: 0.35, splash: 0.4, crit: 0.45, upgrade: 0.7, boom: 0.55, spray: 0.35, pop: 0.45, whistle: 0.25,
};

let game: Phaser.Game | null = null;
const lastPlayed = new Map<AudioKey, number>();
const voices = new Map<AudioKey, number>();
let wheel: Phaser.Sound.BaseSound | null = null;
let fallbackCtx: AudioContext | null = null;

export function initAudio(g: Phaser.Game): void {
  game = g;
  initMusic(g);
}

const sfxVol = () => settings.master * settings.sfx;

export function play(key: AudioKey, opts: { rate?: number; volume?: number } = {}): void {
  if (!game) return;
  const now = performance.now() / 1000;
  const gap = MIN_GAP[key] ?? 0.04;
  if (now - (lastPlayed.get(key) ?? -1) < gap) return;
  if ((voices.get(key) ?? 0) >= MAX_VOICES) return;
  lastPlayed.set(key, now);
  const volume = sfxVol() * (BASE_VOL[key] ?? 0.6) * (opts.volume ?? 1);
  if (volume <= 0) return;
  if (!game.cache.audio.exists(key)) return blip(volume);
  const detune = (Math.random() - 0.5) * 120;
  const s = game.sound.add(key, { volume, rate: opts.rate ?? 1, detune });
  voices.set(key, (voices.get(key) ?? 0) + 1);
  s.once('complete', () => {
    voices.set(key, (voices.get(key) ?? 1) - 1);
    s.destroy();
  });
  s.play();
}

/** ponytail: one generic blip as the fallback voice; per-key synth only if samples prove unreliable. */
function blip(volume: number): void {
  try {
    fallbackCtx ??= new AudioContext();
    const o = fallbackCtx.createOscillator();
    const g = fallbackCtx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(volume * 0.3, fallbackCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, fallbackCtx.currentTime + 0.08);
    o.connect(g).connect(fallbackCtx.destination);
    o.start();
    o.stop(fallbackCtx.currentTime + 0.09);
  } catch {
    /* no audio available */
  }
}

/** Cart wheel rattle, volume follows player speed (0..1). Single instance for the whole session. */
export function setWheel(speed01: number): void {
  if (!game || !game.cache.audio.exists('wheel_loop')) return;
  wheel ??= game.sound.add('wheel_loop', { loop: true, volume: 0 });
  if (!wheel.isPlaying && speed01 > 0.05) wheel.play();
  (wheel as Phaser.Sound.WebAudioSound).setVolume(sfxVol() * 0.35 * speed01);
}

export function startMusic(): void {
  playMusic('music_main');
}

export function refreshVolumes(): void {
  refreshMusic();
}

export function stopLoops(): void {
  wheel?.stop();
}
