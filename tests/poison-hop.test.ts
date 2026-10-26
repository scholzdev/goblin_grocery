import { describe, expect, it } from 'vitest';
import { HOP, hopAmplitude, poisonHop, type HopInput } from '../src/systems/poisonHop';

const base: HopInput = { now: 0, id: 1, radius: 17, boss: false, poisoned: true, reducedMotion: false };
const frames = (o: Partial<HopInput> = {}, seconds = 2, fps = 120) =>
  Array.from({ length: seconds * fps }, (_, i) => poisonHop({ ...base, ...o, now: i / fps }));

describe('poison hop', () => {
  it('does nothing while the enemy is not poisoned', () => {
    for (const h of frames({ poisoned: false })) expect(h).toEqual({ lift: 0, squash: 0, shadow: 1 });
  });

  it('does nothing with reduced motion on, however poisoned', () => {
    for (const h of frames({ reducedMotion: true })) expect(h).toEqual({ lift: 0, squash: 0, shadow: 1 });
  });

  it('a poisoned enemy hops: never below the ground, never above its cap, and it does leave the ground', () => {
    const cap = hopAmplitude(base.radius, false);
    const hs = frames();
    for (const h of hs) { expect(h.lift).toBeGreaterThanOrEqual(0); expect(h.lift).toBeLessThanOrEqual(cap + 1e-9); }
    expect(Math.max(...hs.map((h) => h.lift))).toBeGreaterThan(cap * 0.95);
    expect(Math.min(...hs.map((h) => h.lift))).toBeLessThan(0.3);
  });

  it('lands about HOP.hz times a second', () => {
    const seconds = 4, hs = frames({}, seconds, 240);
    let landings = 0;
    for (let i = 1; i < hs.length - 1; i++) if (hs[i].lift < hs[i - 1].lift && hs[i].lift <= hs[i + 1].lift) landings++;
    expect(landings).toBeGreaterThanOrEqual(seconds * HOP.hz - 1);
    expect(landings).toBeLessThanOrEqual(seconds * HOP.hz + 1);
  });

  it('squashes on the ground only, and shrinks the shadow in the air', () => {
    for (const h of frames()) {
      expect(h.squash).toBeGreaterThanOrEqual(0);
      expect(h.squash).toBeLessThanOrEqual(HOP.squash);
      expect(h.shadow).toBeLessThanOrEqual(1);
      expect(h.shadow).toBeGreaterThanOrEqual(1 - HOP.shadowShrink);
      if (h.lift > hopAmplitude(base.radius, false) * 0.3) expect(h.squash).toBe(0);
    }
    const hs = frames();
    expect(Math.max(...hs.map((h) => h.squash))).toBeGreaterThan(0);
    expect(Math.min(...hs.map((h) => h.shadow))).toBeLessThan(1);
  });

  it('different enemies are out of phase, so a crowd does not hop in lockstep', () => {
    for (const t of [0.05, 0.3, 1.1]) {
      const lifts = [1, 2, 3, 4, 5, 6].map((id) => poisonHop({ ...base, id, now: t }).lift);
      expect(new Set(lifts.map((l) => l.toFixed(3))).size).toBeGreaterThanOrEqual(5);
    }
  });

  it('a bigger enemy hops higher, but small ones keep a visible hop and bosses stay capped', () => {
    expect(hopAmplitude(5, false)).toBe(HOP.minLift);
    expect(hopAmplitude(30, false)).toBeGreaterThan(hopAmplitude(17, false));
    expect(hopAmplitude(500, false)).toBe(HOP.maxLift);
    expect(hopAmplitude(48, true)).toBe(HOP.maxLiftBoss);
    expect(HOP.maxLiftBoss).toBeLessThanOrEqual(12);
  });
});
