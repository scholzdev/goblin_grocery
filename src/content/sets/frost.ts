import { defineSet } from '../../engine/define';

// Frost set: every slow gets stronger up to a cap (L1); L2 lets direct hits on well-slowed enemies freeze them briefly. Arrays are L1/L2/L3.
// The freeze skips aura and puddle ticks (0.3-0.5 s apart: too many rolls). `slowCap` also caps the puddle slow (weapons.ts reads it through `contentSetTune`).
export default defineSet({
  id: 'frost',
  tune: { slowBonus: [0.1, 0.1, 0.15], slowCap: [0.6, 0.6, 0.7], stunMinSlow: 0.35, stunChance: [0.1, 0.1, 0.2], stun: [0.5, 0.5, 0.7] },
  text: {
    en: {
      name: 'Frost',
      bonus: [
        'Slow +{slowBonus|pctn} points (max {slowCap|pctn}%)',
        'Hits on slowed (≥{stunMinSlow|pctn}%) enemies freeze {stun} s ({stunChance|pctn}%)',
        'Slow +{slowBonus|pctn} points (max {slowCap|pctn}%); hits on slowed enemies freeze {stun} s ({stunChance|pctn}%)',
      ],
    },
    de: {
      name: 'Frost',
      bonus: [
        'Verlangsamung +{slowBonus|pctn} Punkte (max. {slowCap|pctn} %)',
        'Treffer auf verlangsamte (≥{stunMinSlow|pctn} %) Gegner frieren {stun} s ein ({stunChance|pctn} %)',
        'Verlangsamung +{slowBonus|pctn} Punkte (max. {slowCap|pctn} %); Treffer auf verlangsamte Gegner frieren {stun} s ein ({stunChance|pctn} %)',
      ],
    },
  },
  build: {
    // After the combos (Cold Storage and Brain Freeze set `slow`) and after every post-combo item hook: `order` 1000.
    phase: 'post-combo', order: 1000,
    weapon(w, c) {
      if (!w.slow) return;
      const t = c.tune();
      w.slow = { ...w.slow, pct: Math.min(t.slowCap, w.slow.pct + t.slowBonus) };
    },
  },
  hooks: {
    // Needs the slow of this very hit, so it runs after the engine applied it (afterHit). One rng draw, only when every condition holds.
    order: 20,
    afterHit(hit, ctx, c) {
      const { stats, opts: o, enemy: e, now } = hit;
      if (!stats || c.tier < 2 || o.isDot || stats.pattern === 'aura' || stats.pattern === 'puddle') return;
      const t = c.tune();
      if (!(e.status.slowUntil > now && e.status.slowPct >= t.stunMinSlow && ctx.rng() < t.stunChance)) return;
      ctx.stun(e, t.stun);
      if (e.alive && e.def.behavior !== 'boss') { e.frozenT = t.stun; ctx.sound('frost', { rate: 1.3, volume: 0.5 }); } // the ice block is drawn from frozenT
    },
  },
});
