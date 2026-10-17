import { defineSet } from '../../engine/define';
import { Set } from '../../engine/ids';

// Tools set: every weapon attacks faster (L1); L2 makes the dash hit harder and stun. Arrays are L1/L2/L3.
// `cooldownDiv` is a divisor (1.08 = +8% attack rate); the text shows `pctup` of it. `shredStacks` (L2 / L3) are the Shred stacks each dash hit leaves.
export default defineSet({
  id: Set.tools,
  tune: { cooldownDiv: [1.08, 1.08, 1.15], shoveDamageMult: [2, 2, 3], shoveStun: [0.3, 0.3, 0.45], shredStacks: [0, 2, 3] },
  text: {
    en: {
      name: 'Tools',
      bonus: [
        'All weapons +{cooldownDiv|pctup}% attack rate',
        'Dash damage ×{shoveDamageMult}, stuns {shoveStun} s, applies {shredStacks} Shred stacks',
        'All weapons +{cooldownDiv|pctup}% attack rate; dash damage ×{shoveDamageMult}, stuns {shoveStun} s, applies {shredStacks} Shred stacks',
      ],
    },
    de: {
      name: 'Werkzeug',
      bonus: [
        'Alle Waffen +{cooldownDiv|pctup} % Angriffstempo',
        'Dash-Schaden ×{shoveDamageMult}, betäubt {shoveStun} s, fügt {shredStacks} Stapel Aufreißen hinzu',
        'Alle Waffen +{cooldownDiv|pctup} % Angriffstempo; Dash-Schaden ×{shoveDamageMult}, betäubt {shoveStun} s, fügt {shredStacks} Stapel Aufreißen hinzu',
      ],
    },
  },
  build: {
    phase: 'set', order: 30,
    weapon(w, c) { w.cooldown /= c.tune().cooldownDiv; },
  },
  extraBuild: [{
    // The dash multiplier multiplies the finished total, Running Boot's bonus included (`(6 + boot + perk) * mult`): a final
    // player hook with an `order` above every item's (Boot 0, Expired Milk 100). The stun is the `onDashHit` hook below.
    phase: 'final', order: 200,
    player(b, c) {
      if (c.tier < 2) return;
      b.shoveDamage *= c.tune().shoveDamageMult;
    },
  }],
  hooks: {
    // Once per enemy the dash hits (after the item hooks: Tip Jar's roll, Sale Flag's mark). No rng.
    onDashHit(ev, ctx, c) {
      if (c.tier < 2) return;
      ctx.stun(ev.enemy, c.tune().shoveStun);
      ctx.shred(ev.enemy, c.tune().shredStacks); // the dash cracks armor open: 2 stacks at L2, 3 (the cap) at L3
      ctx.fx.ring('fx_pulse', ev.enemy.x, ev.enemy.y, 70, 220, 0xf5bd45);
    },
  },
});
