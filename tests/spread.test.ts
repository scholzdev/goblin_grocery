import { describe, expect, it } from 'vitest';
import { SPREAD, clampPoint, spreadPoint, spreadPoints } from '../src/systems/spread';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('spread helpers', () => {
  const c = { x: 600, y: 400 };
  it('a cluster starts on the centre and never overlaps its neighbours', () => {
    const ps = spreadPoints('cluster', 12, c);
    expect(ps[0]).toEqual(c);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) expect(dist(ps[i], ps[j])).toBeGreaterThan(SPREAD.spacing * 0.7);
    expect(Math.max(...ps.map((p) => dist(p, c)))).toBeLessThan(SPREAD.spacing * Math.sqrt(12));
  });
  it('a ring is evenly spaced at the radius, first point straight right', () => {
    const ps = spreadPoints('ring', 4, c, { radius: 100 });
    expect(ps[0].x).toBeCloseTo(700); expect(ps[0].y).toBeCloseTo(400);
    expect(ps[1].x).toBeCloseTo(600); expect(ps[1].y).toBeCloseTo(500);
    for (const p of ps) expect(dist(p, c)).toBeCloseTo(100);
  });
  it('is pure: same inputs, same points; spreadPoints = spreadPoint per index', () => {
    expect(spreadPoints('ring', 5, c)).toEqual(spreadPoints('ring', 5, c));
    expect(spreadPoints('cluster', 5, c)[3]).toEqual(spreadPoint('cluster', 3, 5, c));
  });
  it('a single ring point and an empty group are fine', () => {
    expect(spreadPoints('ring', 1, c)).toHaveLength(1);
    expect(spreadPoints('cluster', 0, c)).toEqual([]);
  });
  it('clampPoint pulls points inside the box minus the margin', () => {
    const box = { left: 0, right: 100, top: 0, bottom: 50 };
    expect(clampPoint({ x: -20, y: 80 }, box, 10)).toEqual({ x: 10, y: 40 });
    expect(clampPoint({ x: 30, y: 20 }, box, 10)).toEqual({ x: 30, y: 20 });
  });
});
