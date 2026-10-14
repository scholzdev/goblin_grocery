// Procedural SFX/music synthesizer for Goblin Grocery. Zero deps, deterministic.
// Usage: node tools/gen-audio.mjs   -> public/assets/audio/<key>.wav (16-bit mono PCM)
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;
const TAU = Math.PI * 2;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');

// ---------- DSP helpers ----------
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const N = (s) => Math.round(s * SR);
const buf = (s) => new Float32Array(N(s));
const WAVES = {
  sine: (p) => Math.sin(TAU * p),
  square: (p) => (p < 0.5 ? 1 : -1),
  tri: (p) => 4 * Math.abs(p - 0.5) - 1,
  saw: (p) => 2 * p - 1,
};
// Phase-accumulating oscillator. hz(t) and amp(t) are functions of seconds.
function tone(dur, hz, wave = 'sine', amp = () => 1) {
  const out = buf(dur), w = WAVES[wave]; let ph = 0;
  for (let i = 0; i < out.length; i++) { const t = i / SR; out[i] = w(ph) * amp(t); ph += hz(t) / SR; ph -= Math.floor(ph); }
  return out;
}
// Envelopes
const decay = (rate, att = 0.003) => (t) => (t < att ? 0.5 - 0.5 * Math.cos((Math.PI * t) / att) : 1) * Math.exp(-rate * (t - att > 0 ? t - att : 0));
const adsr = (a, d, s, r, dur) => (t) => (t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : t < dur - r ? s : Math.max(0, (s * (dur - t)) / r));
const sweep = (f0, f1, dur) => (t) => f0 * Math.pow(f1 / f0, Math.min(1, t / dur)); // exponential pitch sweep
// Noise
function white(dur, r) { const o = buf(dur); for (let i = 0; i < o.length; i++) o[i] = r() * 2 - 1; return o; }
function pink(dur, r) { // Paul Kellet
  const o = buf(dur); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < o.length; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return o;
}
// One-pole filters (fc may be a number or fn(t))
const coef = (fc) => 1 - Math.exp((-TAU * Math.min(fc, SR * 0.45)) / SR);
function lp(x, fc) { const o = new Float32Array(x.length); let y = 0; for (let i = 0; i < x.length; i++) { y += coef(typeof fc === 'function' ? fc(i / SR) : fc) * (x[i] - y); o[i] = y; } return o; }
function hp(x, fc) { const l = lp(x, fc); return x.map((v, i) => v - l[i]); }
const bp = (x, lo, hi) => hp(lp(x, hi), lo);
// Mixing / shaping
function mix(dst, src, at = 0, g = 1, wrap = false) {
  const s0 = Math.round(at * SR);
  for (let i = 0; i < src.length; i++) { let j = s0 + i; if (j >= dst.length) { if (!wrap) break; j %= dst.length; } dst[j] += src[i] * g; }
  return dst;
}
const mul = (x, f) => x.map((v, i) => v * f(i / SR));
const gainf = (x, g) => x.map((v) => v * g);
// FM bell: partial list [ratio, amp, decayRate]
function bell(dur, f0, parts, fmIdx = 0, att = 0.002) {
  const o = buf(dur);
  for (const [ratio, amp, rate] of parts) {
    const f = f0 * ratio, e = decay(rate, att);
    const p = tone(dur, (t) => f * (1 + (fmIdx ? fmIdx * Math.exp(-30 * t) * 0.3 * Math.sin(TAU * f * 1.41 * t) : 0)), 'sine', (t) => amp * e(t));
    mix(o, p);
  }
  return o;
}
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function finish(x, { peak = -3, loop = false, drive = 1.3, rms } = {}) {
  const o = Float32Array.from(x, (v) => Math.tanh(v * drive));
  if (!loop) {
    const fi = Math.min(N(0.002), o.length >> 2), fo = Math.min(N(0.012), o.length >> 2);
    for (let i = 0; i < fi; i++) o[i] *= i / fi;
    for (let i = 0; i < fo; i++) o[o.length - 1 - i] *= i / fo;
  }
  if (rms !== undefined) { // loudness-match music: scale to target RMS, soft-knee above 0.85 so peak stays < 0.95
    let sq = 0; for (const v of o) sq += v * v;
    const k = Math.pow(10, rms / 20) / Math.sqrt(sq / o.length);
    return o.map((v) => { v *= k; const a = Math.abs(v); return a < 0.85 ? v : Math.sign(v) * (0.85 + 0.1 * Math.tanh((a - 0.85) / 0.1)); });
  }
  let m = 0; for (const v of o) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? Math.pow(10, peak / 20) / m : 1;
  return o.map((v) => v * g);
}

// ---------- Sounds ----------
const sounds = {};
const S = (key, fn, opts) => (sounds[key] = { fn, opts });

S('toast_pop', () => {
  const r = rng(1), o = buf(0.18);
  mix(o, tone(0.18, sweep(160, 45, 0.08), 'sine', decay(30)), 0, 1);
  mix(o, lp(white(0.03, r), 1200).map((v, i, a) => v * Math.exp(-i / 150)), 0, 0.8);
  mix(o, tone(0.1, sweep(350, 1000, 0.06), 'tri', decay(28, 0.004)), 0.02, 0.6);
  mix(o, tone(0.12, (t) => 520 + 160 * Math.sin(TAU * 38 * t) * Math.exp(-14 * t), 'sine', decay(22, 0.004)), 0.06, 0.45);
  return o;
}, { peak: -3 });

S('pan_clang', () => {
  const r = rng(2), o = bell(0.3, 330, [[1, 1, 14], [2.76, 0.8, 18], [5.4, 0.5, 26], [8.93, 0.25, 40]], 2.5);
  mix(o, hp(white(0.01, r), 2000), 0, 0.5);
  return lp(o, 5500);
});

S('nail_burst', () => {
  const r = rng(3), o = buf(0.26);
  for (let k = 0; k < 3; k++) {
    const b = bp(white(0.035, r), 1200, 6500).map((v, i) => v * Math.exp(-i / 160));
    mix(o, b, k * 0.08, 1 - k * 0.1);
    mix(o, tone(0.01, () => 1800 - k * 150, 'sine', decay(300, 0.0005)), k * 0.08, 0.6);
  }
  return o;
});

S('vacuum_pulse', () => {
  const r = rng(4), d = 0.35;
  const n = lp(pink(d, r), (t) => 3200 * Math.exp(-5.5 * t) + 250);
  mul(n, (t) => Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08)).forEach((v, i) => (n[i] = v));
  const o = gainf(n, 2.2);
  mix(o, tone(d, sweep(130, 70, d), 'sine', (t) => 0.35 * Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08)));
  mix(o, tone(d, sweep(260, 140, d), 'tri', (t) => 0.1 * Math.min(1, (d - t) / 0.08)));
  return o;
});

S('coin', () => {
  const o = buf(0.15);
  mix(o, tone(0.15, () => 987.77, 'tri', (t) => (t < 0.055 ? decay(25, 0.004)(t) : 0)), 0, 0.8);
  mix(o, tone(0.15, () => 1975.5, 'sine', (t) => (t < 0.055 ? decay(30, 0.004)(t) : 0)), 0, 0.2);
  mix(o, tone(0.1, () => 1318.5, 'tri', decay(24, 0.004)), 0.05, 0.9);
  mix(o, tone(0.1, () => 2637, 'sine', decay(30, 0.004)), 0.05, 0.25);
  return o;
});

S('ding', () => bell(0.6, 1568, [[1, 1, 7], [2, 0.35, 11], [3.01, 0.2, 16], [4.2, 0.1, 24], [0.5, 0.15, 6]]));

S('click', () => {
  const r = rng(6), o = buf(0.04);
  mix(o, tone(0.04, () => 1700, 'sine', decay(130, 0.0005)), 0, 0.8);
  mix(o, hp(white(0.01, r), 2500).map((v, i) => v * Math.exp(-i / 60)), 0, 0.5);
  return o;
});

S('hurt', () => {
  const r = rng(7), d = 0.2;
  const f = (t) => sweep(380, 130, d)(t) * (1 + 0.02 * Math.sin(TAU * 28 * t));
  const e = (t) => decay(9, 0.006)(t) * Math.min(1, (d - t) / 0.03);
  const o = mix(tone(d, f, 'saw', e), tone(d, (t) => f(t) * 0.5, 'square', e), 0, 0.5);
  mix(o, white(d, r), 0, 0.12);
  return lp(o, (t) => 2800 - 1800 * (t / d));
});

S('enemy_death', () => {
  const r = rng(8), d = 0.22;
  const o = lp(white(0.1, r), 1800).map((v, i) => v * Math.exp(-i / 700));
  const out = buf(d);
  mix(out, o, 0, 1.4);
  mix(out, tone(d, (t) => sweep(520, 110, 0.18)(t) * (1 + 0.08 * Math.sin(TAU * 30 * t)), 'sine', decay(11, 0.004)), 0, 0.9);
  mix(out, lp(white(0.04, r), 900).map((v, i) => v * Math.exp(-i / 200)), 0.13, 0.9);
  return out;
});

S('shove', () => {
  const r = rng(9), d = 0.25, o = buf(d);
  const env = (t) => Math.sin(Math.PI * Math.min(1, t / d)) ** 1.5;
  const rattle = mul(hp(white(d, r), 1400), (t) => (Math.sin(TAU * 55 * t) > 0.2 ? 1 : 0.15) * env(t));
  mix(o, lp(rattle, 6000), 0, 0.7);
  mix(o, mul(lp(pink(d, r), (t) => 400 + 2500 * Math.sin(Math.PI * t / d)), env), 0, 1.6);
  for (const t0 of [0.03, 0.09, 0.15, 0.2]) mix(o, tone(0.03, () => 2200 + r() * 800, 'sine', decay(100, 0.0008)), t0, 0.2);
  return o;
});

S('spawn', () => {
  const o = buf(0.2);
  mix(o, tone(0.1, () => 659, 'tri', adsr(0.01, 0.02, 0.7, 0.04, 0.1)), 0, 0.9);
  mix(o, tone(0.1, () => 880, 'tri', adsr(0.01, 0.02, 0.7, 0.05, 0.1)), 0.1, 0.9);
  return o;
});

S('boss_hit', () => {
  const r = rng(11), o = buf(0.2);
  mix(o, tone(0.2, sweep(110, 40, 0.12), 'sine', decay(16, 0.002)), 0, 1.1);
  mix(o, lp(white(0.06, r), 700).map((v, i) => v * Math.exp(-i / 300)), 0, 1.2);
  mix(o, bell(0.1, 1250, [[1, 1, 60], [2.7, 0.6, 80]], 2), 0.005, 0.35);
  return o;
});

S('victory', () => {
  const o = buf(1.6);
  const pl = (m, t0, len, g = 0.5) => {
    const f = midi(m);
    mix(o, tone(len, () => f, 'tri', decay(6, 0.005)), t0, g);
    mix(o, tone(len, () => f * 2, 'sine', decay(9, 0.005)), t0, g * 0.3);
  };
  [72, 76, 79, 84].forEach((m, i) => pl(m, i * 0.11, 0.3));
  [79, 84, 88, 91].forEach((m, i) => pl(m, 0.5 + i * 0.09, 0.3));
  [84, 88, 91].forEach((m) => pl(m, 0.9, 0.7, 0.4));
  mix(o, bell(0.7, 2093, [[1, 1, 6], [2, 0.3, 10], [3.01, 0.15, 15]]), 0.9, 0.5);
  return o;
});

S('defeat', () => {
  const o = buf(1.4);
  const note = (t0, len, f0, f1, vib) => {
    const x = tone(len, (t) => (f0 + (f1 - f0) * (t / len) ** 2) * (1 + vib * Math.sin(TAU * 5.5 * t)), 'saw', adsr(0.03, 0.05, 0.85, 0.08, len));
    mix(o, lp(x, (t) => 500 + 900 * Math.sin(Math.PI * Math.min(1, t / len))), t0, 0.8);
  };
  note(0, 0.34, midi(58), midi(58) * 0.99, 0);
  note(0.4, 0.34, midi(57), midi(57) * 0.99, 0);
  note(0.8, 0.6, midi(56), midi(56) * 0.8, 0.012);
  return o;
}, { peak: -4 });

S('wheel_loop', () => {
  // everything uses integer-Hz components over exactly 1.0 s => seamless
  const r = rng(13), d = 1, o = buf(d);
  const am = (t) => 0.55 + 0.45 * Math.max(0, Math.sin(TAU * 9 * t)) ** 2; // 9 rattle bumps/s
  for (let k = 0; k < 60; k++) { // periodic "noise": sum of integer-Hz sines, 600..3600 Hz
    const f = 600 + Math.floor(r() * 3000), ph = r() * TAU;
    for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] += Math.sin(TAU * f * t + ph) * am(t) * 0.12; }
  }
  for (let i = 0; i < o.length; i++) { // low rumble + squeak
    const t = i / SR;
    o[i] += 0.5 * Math.sin(TAU * 18 * t) * am(t);
    const sq = Math.max(0, Math.sin(TAU * 2 * t)) ** 3;
    o[i] += 0.35 * sq * Math.sin(TAU * 1800 * t + 3 * Math.sin(TAU * 4 * t));
  }
  return o;
}, { peak: -18, loop: true, drive: 1 });

S('frost', () => {
  const r = rng(14), d = 0.35, o = buf(d);
  const env = (t) => Math.min(1, t / 0.02) * Math.exp(-5 * t);
  mix(o, mul(tone(d, () => 3000, 'sine', () => 1), (t) => env(t) * 0.25 * (0.6 + 0.4 * Math.sin(TAU * 40 * t))));
  mix(o, mul(tone(d, () => 4207, 'sine', () => 1), (t) => env(t) * 0.18));
  for (let k = 0; k < 7; k++) mix(o, tone(0.08, () => 2800 + r() * 3500, 'sine', decay(45, 0.002)), 0.01 + r() * 0.25, 0.3);
  for (let k = 0; k < 14; k++) mix(o, hp(white(0.008, r), 3500).map((v, i) => v * Math.exp(-i / 40)), r() * 0.3, 0.5);
  return o;
});

S('swipe_tell', () => {
  const r = rng(15), d = 0.25;
  const env = (t) => Math.min(1, t / 0.02) * Math.pow(t / d, 1.5) * Math.min(1, (d - t) / 0.015);
  const n = mul(lp(white(d, r), (t) => 500 * Math.pow(10, t / d)), env);
  const o = gainf(hp(n, 400), 2.5);
  mix(o, mul(tone(d, sweep(300, 950, d), 'tri', () => 1), (t) => env(t) * 0.35));
  return o;
});

S('bubble', () => {
  const d = 0.15;
  return tone(d, (t) => sweep(280, 800, 0.1)(t) * (1 + 0.03 * Math.sin(TAU * 40 * t)), 'sine', (t) => decay(22, 0.008)(t) * (1 - 0.4 * (t / d)));
});

S('buy', () => {
  const r = rng(17), o = buf(0.4);
  mix(o, hp(white(0.03, r), 1500).map((v, i) => v * Math.exp(-i / 130)), 0, 0.9);
  mix(o, tone(0.03, () => 900, 'square', decay(150, 0.0005)), 0, 0.25);
  mix(o, tone(0.03, () => 650, 'square', decay(150, 0.0005)), 0.05, 0.25);
  mix(o, bell(0.3, 2349, [[1, 1, 11], [2.01, 0.4, 16], [3.0, 0.18, 22], [0.5, 0.2, 9]]), 0.09, 0.75);
  return o;
});

S('sell', () => {
  const r = rng(18), o = buf(0.25);
  mix(o, mul(hp(white(0.08, r), 2000), (t) => (t / 0.08) ** 2 * 0.5));
  mix(o, tone(0.15, () => 1760, 'tri', decay(20, 0.004)), 0.08, 0.7);
  mix(o, tone(0.15, () => 2637, 'sine', decay(26, 0.004)), 0.1, 0.4);
  return o;
}, { peak: -5 });

S('zap', () => {
  const r = rng(21), o = buf(0.25), jit = Array.from({ length: 40 }, () => 0.3 + r() * 0.7);
  mix(o, tone(0.12, (t) => 180 + 40 * Math.sin(TAU * 60 * t), 'saw', (t) => jit[Math.floor(t * 300) % 40] * Math.min(1, (0.12 - t) / 0.02)), 0, 0.5);
  mix(o, hp(white(0.12, r), 2500).map((v, i) => v * (i % 40 < 14 ? 1 : 0.2) * Math.exp(-i / 1500)), 0, 0.6);
  mix(o, bell(0.14, 2637, [[1, 1, 18], [2.01, 0.3, 26]]), 0.1, 0.7);
  return lp(o, 7000);
});

S('blender', () => {
  const r = rng(22), d = 0.16, env = (t) => Math.min(1, t / 0.015) * Math.min(1, (d - t) / 0.03);
  const n = mul(bp(white(d, r), 400, 3500), (t) => env(t) * (0.6 + 0.4 * Math.sin(TAU * 70 * t)));
  const o = gainf(n, 1.5);
  mix(o, tone(d, sweep(140, 320, d), 'saw', (t) => 0.25 * env(t)));
  return lp(o, 4500);
}, { peak: -9 });

S('cap_ping', () => {
  const o = buf(0.12), e = decay(32, 0.001);
  for (const [ra, a] of [[1, 1], [2.4, 0.6], [4.1, 0.3]])
    mix(o, tone(0.12, (t) => 2300 * ra * (1 - 0.06 * Math.min(1, t / 0.06)) * (1 + 0.1 * Math.exp(-40 * t) * Math.sin(TAU * 3100 * t)), 'sine', (t) => a * e(t) ** ra));
  return lp(o, 8000);
});

S('splash', () => {
  const r = rng(24), d = 0.25, o = buf(d);
  mix(o, lp(white(d, r), (t) => 4500 * Math.exp(-14 * t) + 300).map((v, i) => v * Math.exp(-i / 1500)), 0, 1.8);
  for (const [t0, f] of [[0.06, 420], [0.11, 560], [0.17, 380]]) mix(o, tone(0.06, sweep(f, f * 2.2, 0.05), 'sine', decay(40, 0.004)), t0, 0.4);
  return o;
});

S('crit', () => {
  const r = rng(25), o = buf(0.22);
  mix(o, hp(white(0.02, r), 1800).map((v, i) => v * Math.exp(-i / 60)), 0, 0.9);
  mix(o, tone(0.02, () => 1300, 'square', decay(200, 0.0005)), 0, 0.25);
  mix(o, bell(0.15, 1568, [[1, 1, 14], [2, 0.3, 20]]), 0.04, 0.7);
  mix(o, bell(0.15, 2093, [[1, 1, 12], [2.01, 0.3, 18]]), 0.09, 0.8);
  return o;
});

S('upgrade', () => {
  const r = rng(26), o = buf(0.7);
  [72, 76, 79].forEach((m, i) => { const f = midi(m); mix(o, tone(0.25, () => f, 'tri', decay(9, 0.004)), i * 0.09, 0.6); mix(o, tone(0.2, () => f * 2, 'sine', decay(12, 0.004)), i * 0.09, 0.2); });
  for (let k = 0; k < 8; k++) mix(o, tone(0.08, () => 3000 + r() * 3000, 'sine', decay(40, 0.002)), 0.1 + k * 0.045, 0.12);
  mix(o, bell(0.45, 2093, [[1, 1, 7], [2, 0.3, 11], [3.01, 0.15, 16]]), 0.27, 0.6);
  return o;
});

S('boom', () => {
  const r = rng(31), d = 0.4, o = buf(d);
  mix(o, tone(d, sweep(130, 38, 0.25), 'sine', decay(8, 0.004)), 0, 1.1);
  mix(o, lp(white(d, r), (t) => 2200 * Math.exp(-9 * t) + 150).map((v, i) => v * Math.exp(-i / 2500)), 0, 2);
  for (let k = 0; k < 12; k++) mix(o, lp(white(0.012, r), 3500).map((v, i) => v * Math.exp(-i / 50)), 0.05 + r() * 0.3, 0.3);
  return o;
});

S('spray', () => {
  const r = rng(32), d = 0.14;
  return gainf(mul(bp(white(d, r), 2000, 6500), (t) => Math.min(1, t / 0.008) * Math.exp(-14 * Math.max(0, t - 0.04))), 2);
}, { peak: -10 });

S('pop', () => {
  const r = rng(33), o = buf(0.18);
  mix(o, hp(white(0.025, r), 800).map((v, i) => v * Math.exp(-i / 80)), 0, 1);
  mix(o, tone(0.04, sweep(500, 120, 0.03), 'sine', decay(60, 0.001)), 0, 0.8);
  for (let k = 0; k < 10; k++) mix(o, tone(0.05, () => 2500 + r() * 3500, 'sine', decay(55, 0.002)), 0.03 + r() * 0.12, 0.25);
  return o;
});

S('whistle', () => {
  const r = rng(34), d = 0.5, env = (t) => Math.min(1, t / 0.04) * Math.min(1, (d - t) / 0.08);
  const f = (t) => 900 + 700 * Math.sin(Math.PI * t / d) + 12 * Math.sin(TAU * 30 * t);
  const o = tone(d, f, 'sine', env);
  mix(o, mul(bp(white(d, r), 1200, 3500), (t) => env(t) * 0.18));
  return o;
});

// ---------- Music: one loop per department, all finished to the same RMS ----------
const MUSIC_RMS = -24;
S('music_main', () => {
  const BPM = 112, beat = 60 / BPM, bars = 16, d = bars * 4 * beat;
  const o = new Float32Array(Math.round(d * SR));
  const r = rng(99);
  const note = (t0, len, hz, wave, g, { cut = 3000, vib = 0, rate = 4, att = 0.006 } = {}) => {
    const e = decay(rate, att);
    const x = tone(len + 0.1, (t) => hz * (1 + vib * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.25)), wave, e);
    mix(o, lp(x, cut), t0, g, true);
  };
  // chords as [root midi, third, fifth] (bass root) per bar
  const C = [48, 52, 55], Am = [45, 48, 52], F = [41, 45, 48], G = [43, 47, 50], Em = [40, 43, 47];
  const prog = [C, Am, F, G, C, Am, F, G, F, G, Em, Am, C, Am, F, G];
  prog.forEach((ch, b) => {
    const t = b * 4 * beat;
    for (let i = 0; i < 8; i++) { // bouncy bass: root, 5th-octave alternation on eighths
      const m = i % 4 === 3 ? ch[0] + 7 : i % 2 === 0 ? ch[0] : ch[0] + 12;
      if (i % 4 === 1) continue;
      note(t + i * beat / 2, beat * 0.45, midi(m - 12), 'tri', 0.7, { cut: 900, rate: 7 });
    }
    for (const off of [1.5, 3.5]) // plucky offbeat chords
      ch.forEach((m) => note(t + off * beat, beat * 0.5, midi(m + 12), 'square', 0.11, { cut: 1800, rate: 9, att: 0.003 }));
    for (let i = 0; i < 8; i++) { // hats
      const h = hp(white(0.03, r), 6000).map((v, k) => v * Math.exp(-k / (i % 2 ? 90 : 55)));
      mix(o, h, t + i * beat / 2, i % 2 ? 0.28 : 0.14, true);
    }
    if (b % 2 === 0) mix(o, tone(0.12, sweep(120, 45, 0.08), 'sine', decay(20, 0.002)), t, 0.5, true); // soft kick on beat 1
    if (b % 2 === 0) mix(o, tone(0.12, sweep(120, 45, 0.08), 'sine', decay(20, 0.002)), t + 2 * beat, 0.4, true);
  });
  // melody: [beat within 16-beat phrase, midi, length in beats]
  const A = [[0, 76, 1], [1, 79, 1], [2, 76, .5], [2.5, 74, .5], [3, 72, 1], [4, 72, 1], [5, 76, .5], [5.5, 81, 1.5], [7, 79, .5], [8, 77, 1], [9, 81, 1], [10, 77, .5], [10.5, 76, .5], [11, 74, 1], [12, 74, 1], [13, 77, .5], [13.5, 79, 1], [15, 71, 1]];
  const A2 = [[0, 76, .5], [.5, 79, .5], [1, 84, 1], [2, 79, 1], [3, 76, 1], [4, 81, 1.5], [5.5, 79, .5], [6, 76, 1], [7, 72, 1], [8, 77, 1], [9, 74, .5], [9.5, 77, .5], [10, 81, 1], [11, 77, 1], [12, 79, 1.5], [13.5, 77, .5], [14, 74, 1], [15, 71, 1]];
  const B = [[0, 77, 1], [1, 81, 1], [2, 84, 1], [3, 81, 1], [4, 79, 1], [5, 83, 1], [6, 86, 1], [7, 83, 1], [8, 76, 1], [9, 79, 1], [10, 83, 1], [11, 79, 1], [12, 81, 1.5], [13.5, 79, .5], [14, 76, 1], [15, 79, 1]];
  const Aend = [...A.slice(0, -1), [15, 74, 1]];
  [[0, A], [16, A2], [32, B], [48, Aend]].forEach(([b0, ph]) =>
    ph.forEach(([b, m, l]) => note((b0 + b) * beat, l * beat * 0.9, midi(m), 'tri', 0.5, { cut: 3500, vib: 0.006, rate: 2.5, att: 0.012 })));
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });
// Shared music kit: one wrap-around buffer per track (tails wrap => seamless loop), plus tiny drum voices.
const IV = { M: [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11] };
const ch = (r, ty) => IV[ty].map((i) => r + i); // chord midis from root
const scl = (root, iv, lo, hi) => { const a = []; for (let m = lo; m <= hi; m++) if (iv.includes(((m - root) % 12 + 12) % 12)) a.push(m); return a; };
const MAJ = [0, 2, 4, 5, 7, 9, 11], MINP = [0, 3, 5, 7, 10], PHRY = [0, 1, 3, 5, 7, 8, 10];
function kit(BPM, bars, seed) {
  const beat = 60 / BPM, o = new Float32Array(Math.round(bars * 4 * beat * SR)), r = rng(seed);
  const note = (t0, len, m, wave, g, { cut = 3000, vib = 0, rate = 4, att = 0.006, to = o } = {}) => {
    const hz = midi(m);
    mix(to, lp(tone(len + 0.1, (t) => hz * (1 + vib * Math.sin(TAU * 5.2 * t) * Math.min(1, t / 0.25)), wave, decay(rate, att)), cut), t0, g, true);
  };
  const bellAt = (t0, m, g, parts, dur = 0.8, to = o) => mix(to, bell(dur, midi(m), parts), t0, g, true);
  const kick = (t, g = 0.5) => mix(o, tone(0.14, sweep(130, 45, 0.08), 'sine', decay(18, 0.002)), t, g, true);
  const hat = (t, g = 0.2, ring = 60) => mix(o, hp(white(0.04, r), 6500).map((v, k) => v * Math.exp(-k / ring)), t, g, true);
  const snare = (t, g = 0.3) => { mix(o, bp(white(0.15, r), 1500, 6000).map((v, k) => v * Math.exp(-k / 500)), t, g, true); mix(o, tone(0.1, sweep(220, 150, 0.05), 'tri', decay(30)), t, g * 0.6, true); };
  const brush = (t, g = 0.1, len = 0.1) => mix(o, bp(white(len, r), 3000, 8000).map((v, k) => v * Math.min(1, k / 200) * Math.exp(-k / (len * SR * 0.35))), t, g, true);
  return { beat, o, r, note, bellAt, kick, hat, snare, brush };
}
// Deterministic random-walk melody: same seed = same motif (reused for A-A-B-A form); strong beats snap to chord tones.
function melody(seed, beats, b0, scale, chordAt, start, durs = [0.5, 0.5, 1, 0.5, 1, 1.5], rest = 0.15) {
  const rr = rng(seed), out = []; let i = start, t = 0;
  while (t < beats) {
    const d = Math.min(durs[Math.floor(rr() * durs.length)], beats - t);
    i = Math.max(0, Math.min(scale.length - 1, i + Math.floor(rr() * 5) - 2));
    if (t % 2 === 0) {
      const cs = chordAt(b0 + t).map((m) => m % 12); let bj = i, bd = 99;
      scale.forEach((m, j) => { if (cs.includes(m % 12) && Math.abs(j - i) < bd) { bd = Math.abs(j - i); bj = j; } });
      i = bj;
    }
    if (rr() >= rest) out.push([b0 + t, scale[i], d]);
    t += d;
  }
  return out;
}
const phrases = (K, bars, sc, chordAt, seeds, start, durs, rest) => // 4-bar phrases, seeds[] cycles (e.g. [1,1,2,1])
  Array.from({ length: bars / 4 }, (_, p) => melody(seeds[p % seeds.length], 16, p * 16, sc, chordAt, start, durs, rest)).flat();
const barOf = (cs) => (b) => cs[Math.floor(b / 4) % cs.length];

S('music_frozen', () => { // 96 BPM, A minor: glassy celesta arps, airy pad, sparse soft beat
  const K = kit(96, 12, 201), { beat, o, note, bellAt } = K;
  const cs = [ch(57, 'm7'), ch(53, 'M7'), ch(48, 'M7'), ch(52, 'm7'), ch(57, 'm7'), ch(53, 'M7'), ch(55, '7'), ch(52, 'm7'), ch(50, 'm7'), ch(53, 'M7'), ch(52, '7'), ch(57, 'm7')];
  const CEL = [[1, 1, 7], [4, 0.35, 13], [6.3, 0.18, 22]];
  cs.forEach((c, b) => {
    const t = b * 4 * beat;
    c.forEach((m, k) => note(t, 4 * beat, m + (k ? 12 : 0), 'sine', 0.22, { cut: 1800, rate: 0.5, att: 1.1, vib: 0.003 }));
    note(t, 4 * beat, c[0] - 12, 'sine', 0.5, { cut: 400, rate: 0.6, att: 0.4 });
    const pat = [0, 1, 2, 3, 2, 1, 2, 3];
    pat.forEach((k, i) => bellAt(t + i * beat / 2, c[k] + 24, i % 2 ? 0.17 : 0.24, CEL));
    if (b % 2 === 0) K.kick(t, 0.28); K.kick(t + 2 * beat, 0.2);
    K.hat(t + 3 * beat, 0.1, 40);
    for (let i = 0; i < 8; i++) K.brush(t + i * beat / 2, 0.035, 0.07);
  });
  phrases(K, 12, scl(57, MINP, 79, 100), barOf(cs), [1, 2, 1], 3, [1, 1.5, 2, 1], 0.3)
    .forEach(([b, m, l]) => bellAt(b * beat, m, 0.3, [[1, 1, 3.5], [2.76, 0.4, 8], [5.4, 0.2, 14]], 1.6));
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });

S('music_bakery', () => { // 118 BPM swung, C major: oom-pah bass, accordion-ish detuned squares
  const K = kit(118, 16, 202), { beat, o, note } = K, sw = beat / 6;
  const cs = [ch(48, 'M'), ch(45, 'm'), ch(50, 'm7'), ch(43, '7'), ch(48, 'M'), ch(45, 'm'), ch(53, 'M'), ch(43, '7'),
    ch(48, 'M'), ch(52, '7'), ch(45, 'm'), ch(43, '7'), ch(53, 'M'), ch(53, 'm'), ch(48, 'M'), ch(43, '7')];
  const swing = (b) => b * beat + (b % 1 ? sw : 0); // offbeat 8ths pushed late
  cs.forEach((c, b) => {
    const t = b * 4 * beat;
    for (let i = 0; i < 4; i++) {
      const bt = t + i * beat;
      if (i % 2 === 0) note(bt, beat * 0.5, (i === 2 && b % 2 ? c[2] : c[0]) - 12, 'tri', 0.9, { cut: 800, rate: 9 }); // oom
      else c.forEach((m) => note(bt + sw, beat * 0.3, m, 'square', 0.1, { cut: 1700, rate: 14, att: 0.003 })); // pah
      K.hat(bt + sw, 0.1, 50);
    }
    K.kick(t, 0.35); K.kick(t + 2 * beat, 0.3); K.snare(t + beat + sw, 0.1); K.snare(t + 3 * beat + sw, 0.1);
  });
  const lead = phrases(K, 16, scl(48, MAJ, 67, 88), barOf(cs), [3, 3, 4, 3], 6, [0.5, 0.5, 1, 0.5, 1], 0.12);
  lead.forEach(([b, m, l]) => { const t = swing(b), len = l * beat * 0.9; // two slightly detuned squares = reedy
    note(t, len, m, 'square', 0.16, { cut: 2300, vib: 0.007, rate: 2, att: 0.02 });
    note(t, len, m + 0.08, 'square', 0.12, { cut: 1500, vib: 0.007, rate: 2, att: 0.02 }); });
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });

S('music_electronics', () => { // 124 BPM, A minor synthwave: saw arps, 4-on-floor, sidechain pump on pad+bass
  const K = kit(124, 16, 203), { beat, o } = K;
  const L = new Float32Array(o.length), s16 = beat / 4;
  const cs = Array.from({ length: 16 }, (_, b) => [ch(57, 'm'), ch(53, 'M'), ch(48, 'M'), ch(55, 'M')][b % 4]);
  cs[13] = ch(53, 'M'); cs[14] = ch(55, 'M'); cs[15] = ch(52, 'M');
  cs.forEach((c, b) => {
    const t = b * 4 * beat;
    c.forEach((m) => { K.note(t, 4 * beat, m, 'saw', 0.1, { cut: 1500, rate: 0.3, att: 0.05, to: L }); K.note(t, 4 * beat, m + 0.1, 'saw', 0.08, { cut: 1200, rate: 0.3, att: 0.05, to: L }); });
    for (let i = 0; i < 16; i++) { // rolling 16th bass, octave pops
      const m = c[0] - 24 + (i % 8 === 6 ? 12 : 0);
      K.note(t + i * s16, s16 * 0.9, m, 'saw', 0.5, { cut: 600, rate: 14, att: 0.002, to: L });
    }
    for (let i = 0; i < 16; i++) K.note(t + i * s16, s16, c[[0, 1, 2, 1][i % 4]] + 24 + (i % 8 >= 4 ? 12 : 0), 'saw', 0.12, { cut: 3800, rate: 10, att: 0.002 });
    for (let i = 0; i < 4; i++) K.kick(t + i * beat, 0.7);
    K.snare(t + beat, 0.28); K.snare(t + 3 * beat, 0.28);
    for (let i = 0; i < 4; i++) K.hat(t + i * beat + beat / 2, 0.22, 70);
  });
  mix(o, mul(L, (t) => 0.25 + 0.75 * (1 - Math.exp(-6 * ((t % beat) / beat)))), 0, 1); // pump
  phrases(K, 16, scl(57, MINP, 69, 93), barOf(cs), [5, 6, 5, 7], 5, [1, 0.5, 0.5, 1.5, 2], 0.2)
    .forEach(([b, m, l]) => K.note(b * beat, l * beat * 0.85, m, 'square', 0.17, { cut: 3200, vib: 0.005, rate: 3, att: 0.005 }));
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });

S('music_checkout', () => { // 132 BPM, scanner-beep melody over a driving groove
  const K = kit(132, 16, 204), { beat, o } = K, s16 = beat / 4;
  const cs = Array.from({ length: 16 }, (_, b) => [ch(48, 'M'), ch(43, 'M'), ch(45, 'm'), ch(53, 'M')][b % 4]);
  cs[15] = ch(43, '7');
  const beep = (t, m, g) => { // scanner beep: bright square+sine, ~60 ms
    mix(o, lp(tone(0.08, () => midi(m), 'square', decay(40, 0.001)), 4500), t, g * 0.5, true);
    mix(o, tone(0.08, () => midi(m), 'sine', decay(40, 0.001)), t, g, true);
  };
  cs.forEach((c, b) => {
    const t = b * 4 * beat;
    for (let i = 0; i < 8; i++) K.note(t + i * beat / 2, beat * 0.4, c[0] - 12 + (i % 4 === 3 ? 7 : 0), 'square', 0.4, { cut: 700, rate: 10 });
    for (let i = 0; i < 4; i++) K.kick(t + i * beat, 0.5);
    K.snare(t + beat, 0.2); K.snare(t + 3 * beat, 0.2);
    for (let i = 0; i < 16; i++) K.hat(t + i * s16, i % 4 === 2 ? 0.22 : 0.1, i % 2 ? 30 : 50);
    [0.5, 1.5, 2.5, 3.5].forEach((off) => c.forEach((m) => K.note(t + off * beat, beat * 0.25, m + 12, 'square', 0.05, { cut: 1500, rate: 18, att: 0.002 })));
  });
  const BEEP = [[0, 0], [0.5, 0], [1, 2], [1.75, 4], [2.5, 2], [3, 0]]; // motif: bar-local beats -> chord-tone idx
  cs.forEach((c, b) => BEEP.forEach(([off, k], n) => {
    if (b % 4 === 3 && n > 3) return; // breathe at phrase ends
    beep((b * 4 + off) * beat, c[k % c.length] + 60 + (b % 8 >= 4 ? 7 : 0), 0.2);
  }));
  cs.forEach((c, b) => { if (b % 4 === 3) for (let i = 0; i < 4; i++) beep((b * 4 + 3 + i * 0.25) * beat, 84 + i * 2, 0.2); }); // rising "item scanned" run
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });

S('music_clearance', () => { // 100 BPM swung lounge: 7th chords, walking bass, brushes, vibes
  const K = kit(100, 12, 205), { beat, o, note, bellAt } = K, sw = beat / 6;
  const cs = [ch(50, 'm7'), ch(43, '7'), ch(48, 'M7'), ch(45, 'm7'), ch(50, 'm7'), ch(43, '7'), ch(48, 'M7'), ch(45, '7'), ch(50, 'm7'), ch(43, '7'), ch(48, 'M7'), ch(43, '7')];
  const EP = [[1, 1, 3], [2, 0.3, 6], [4, 0.1, 10]];
  cs.forEach((c, b) => {
    const t = b * 4 * beat, next = cs[(b + 1) % cs.length][0];
    [c[0], c[1], c[2], next + (next > c[0] ? -1 : 1)].forEach((m, i) => note(t + i * beat, beat * 0.9, m - 12, 'tri', 0.9, { cut: 700, rate: 3.5, att: 0.01 })); // walk
    c.forEach((m) => bellAt(t, m + 12, 0.16, EP, 1.4));
    c.forEach((m) => bellAt(t + 1.5 * beat + sw, m + 12, 0.12, EP, 0.6));
    [0, 1, 2, 3, 3.67].forEach((off, i) => K.brush(t + off * beat + (off % 1 ? sw : 0), i % 2 ? 0.1 : 0.07, 0.12)); // ride-ish swish
    K.hat(t + beat, 0.08, 40); K.hat(t + 3 * beat, 0.08, 40);
    K.kick(t, 0.12);
  });
  phrases(K, 12, scl(48, MAJ, 69, 88), barOf(cs), [8, 9, 8], 6, [1, 1.5, 0.5, 2, 1], 0.25)
    .forEach(([b, m, l]) => { const t = (b % 1 ? b * beat + sw : b * beat);
      note(t, l * beat * 0.95, m, 'sine', 0.26, { cut: 4000, vib: 0.009, rate: 1.6, att: 0.015 });
      bellAt(t, m, 0.12, [[1, 1, 4], [4, 0.25, 9]], 1.2); });
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });

S('music_boss', () => { // 140 BPM, E phrygian: low saw ostinato, stabs, industrial hits, riser into the wrap
  const K = kit(140, 18, 206), { beat, o, note } = K, s8 = beat / 2;
  const roots = [40, 40, 40, 40, 36, 36, 38, 38, 40, 40, 40, 40, 43, 41, 40, 40, 35, 35];
  const OST = [0, 0, 12, 0, 0, 7, 0, 6]; // semitones per 8th: tritone growl
  roots.forEach((r0, b) => {
    const t = b * 4 * beat, tri = ch(r0 + 24, r0 === 35 ? 'M' : 'm');
    OST.forEach((i, k) => note(t + k * s8, s8 * 0.9, r0 - 12 + i, 'saw', 0.55, { cut: 520, rate: 11, att: 0.003 }));
    for (let i = 0; i < 4; i++) K.kick(t + i * beat, 0.75);
    K.kick(t + 1.75 * beat, 0.4); K.kick(t + 3.5 * beat, 0.4);
    K.snare(t + beat, 0.4); K.snare(t + 3 * beat, 0.4);
    for (let i = 0; i < 16; i++) K.hat(t + i * beat / 4, i % 2 ? 0.07 : 0.14, 35);
    if (b % 2 === 1) [0, 0.75, 1.5, 3].forEach((off) => tri.forEach((m) => note(t + off * beat, beat * 0.3, m, 'saw', 0.07, { cut: 2600, rate: 12, att: 0.002 }))); // stabs
    if (b % 4 === 3) mix(o, mul(bp(white(4 * beat, K.r), 400, 5000), (tt) => (tt / (4 * beat)) ** 2 * 0.3), t, 1, true); // riser
  });
  phrases(K, 16, scl(40, PHRY, 64, 88), (b) => ch(roots[Math.floor(b / 4)], 'm'), [11, 12, 11, 13], 4, [0.5, 0.5, 1, 1.5], 0.45)
    .forEach(([b, m, l]) => { if (b >= 32) note(b * beat, l * beat * 0.8, m, 'saw', 0.14, { cut: 2400, vib: 0.01, rate: 3, att: 0.01 }); });
  return o;
}, { rms: MUSIC_RMS, loop: true, drive: 1 });

// ---------- Render, write, verify ----------
function wav(x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return b;
}
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity).toFixed(1);

mkdirSync(OUT, { recursive: true });
let total = 0;
console.log('key'.padEnd(14) + 'dur(s)'.padStart(8) + 'peak dBFS'.padStart(11) + 'rms dBFS'.padStart(10) + 'silent50ms'.padStart(12) + 'edge-jump'.padStart(11) + 'bytes'.padStart(9));
for (const [key, { fn, opts }] of Object.entries(sounds)) {
  const x = finish(fn(), opts);
  const file = join(OUT, key + '.wav');
  writeFileSync(file, wav(x));
  // verify by re-reading the file
  const rb = readFileSync(file);
  if (rb.toString('ascii', 0, 4) !== 'RIFF' || rb.toString('ascii', 8, 12) !== 'WAVE' || rb.readUInt32LE(24) !== SR) throw new Error('bad wav ' + key);
  const n = (rb.length - 44) / 2; let pk = 0, sq = 0, silent = 0, win = 0, ws = 0, wc = 0;
  for (let i = 0; i < n; i++) {
    const v = rb.readInt16LE(44 + i * 2) / 32768; pk = Math.max(pk, Math.abs(v)); sq += v * v; ws += v * v; wc++;
    if (wc === N(0.05)) { if (Math.sqrt(ws / wc) < 0.001) silent++; ws = 0; wc = 0; win++; }
  }
  total += rb.length;
  const edge = Math.abs(x[0] - x[x.length - 1]).toFixed(4);
  console.log(key.padEnd(14) + (n / SR).toFixed(3).padStart(8) + db(pk).padStart(11) + db(Math.sqrt(sq / n)).padStart(10) + String(silent).padStart(12) + edge.padStart(11) + String(rb.length).padStart(9));
}
console.log(`total ${(total / 1e6).toFixed(2)} MB`);
