import { defineSet } from '../../engine/define';

// Electric set: electrical weapons (except the Microwave, which already chains) arc to nearby enemies. Arrays are L1/L2/L3: the chance and
// the number of jumps grow with the level. `range` and `damageMult` (a share of the hit's incoming damage) are flat. Aura and puddle ticks
// never arc (too many rolls), and chained hits never arc again.
export default defineSet({
  id: 'electric',
  tune: { chance: [0.1, 0.2, 0.3], jumps: [1, 2, 3], range: 120, damageMult: 0.5 },
  text: {
    en: {
      name: 'Electric',
      bonus: [
        'Electric hits: {chance|pctn}% chance to arc to {jumps} enemy for {damageMult|pctn}%',
        'Electric hits: {chance|pctn}% chance to arc to {jumps} enemies for {damageMult|pctn}%',
        'Electric hits: {chance|pctn}% chance to arc to {jumps} enemies for {damageMult|pctn}%',
      ],
    },
    de: {
      name: 'Elektrisch',
      bonus: [
        'Elektro-Treffer: {chance|pctn} % Chance auf Blitz zu {jumps} Gegner für {damageMult|pctn} %',
        'Elektro-Treffer: {chance|pctn} % Chance auf Blitz zu {jumps} Gegnern für {damageMult|pctn} %',
        'Elektro-Treffer: {chance|pctn} % Chance auf Blitz zu {jumps} Gegnern für {damageMult|pctn} %',
      ],
    },
  },
  build: {
    phase: 'set', order: 60,
    weapon(w, c) {
      const def = c.def(w.type);
      if (!def.electrical || def.weapon!.pattern === 'zap') return;
      const t = c.tune();
      w.chainChance = t.chance; w.chainJumps = t.jumps;
    },
  },
  hooks: {
    // The chain reads the weapon's `chainChance` / `chainJumps` (WeaponStats, set by the hook above). One roll per qualifying hit, after the
    // Frost freeze roll (order 40 > 20). Draws nothing for the jumps themselves; the chained hits go through the full pipeline (their own crit
    // roll, statuses ...).
    order: 40,
    afterHit(hit, ctx, c) {
      const { stats, opts: o, enemy: e } = hit;
      if (!stats || !(stats.chainChance > 0) || o.isDot || stats.pattern === 'aura' || stats.pattern === 'puddle' || o.chained) return;
      if (!(ctx.rng() < stats.chainChance)) return;
      const t = c.tune();
      const seen = new Set([e.id]);
      let from = e;
      const pts = [{ x: e.x, y: e.y - 30 }];
      for (let j = 0; j < stats.chainJumps; j++) {
        const n = ctx.ricochetTarget(from, seen, t.range);
        if (!n) break;
        seen.add(n.id);
        ctx.fx.spark(n.x, n.y - 30, 4, 0x9be8ff);
        pts.push({ x: n.x, y: n.y - 30 });
        ctx.damage(n, hit.base * t.damageMult, stats, { chained: true, quiet: o.quiet });
        from = n;
      }
      if (pts.length > 1) ctx.arcFx(pts);
    },
  },
});
