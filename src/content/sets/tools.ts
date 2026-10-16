import { defineSet } from '../../engine/define';

// Tools set: every weapon attacks faster (L1); L2 makes the dash hit harder and stun. Arrays are L1/L2/L3.
// `cooldownDiv` is a divisor (1.08 = +8% attack rate); the text shows `pctup` of it.
export default defineSet({
  id: 'tools',
  tune: { cooldownDiv: [1.08, 1.08, 1.15], shoveDamageMult: [2, 2, 3], shoveStun: [0.3, 0.3, 0.45] },
  text: {
    en: {
      name: 'Tools',
      bonus: [
        'All weapons +{cooldownDiv|pctup}% attack rate',
        'Dash damage ×{shoveDamageMult}, stuns {shoveStun} s',
        'All weapons +{cooldownDiv|pctup}% attack rate; dash damage ×{shoveDamageMult}, stuns {shoveStun} s',
      ],
    },
    de: {
      name: 'Werkzeug',
      bonus: [
        'Alle Waffen +{cooldownDiv|pctup} % Angriffstempo',
        'Dash-Schaden ×{shoveDamageMult}, betäubt {shoveStun} s',
        'Alle Waffen +{cooldownDiv|pctup} % Angriffstempo; Dash-Schaden ×{shoveDamageMult}, betäubt {shoveStun} s',
      ],
    },
  },
  build: {
    phase: 'set', order: 30,
    weapon(w, c) { w.cooldown /= c.tune().cooldownDiv; },
  },
  extraBuild: [{
    // The dash multiplier multiplies the finished total, Running Boot's bonus included (the legacy `(6 + boot + perk) * mult`): a final
    // player hook with an `order` above every item's (Boot 0, Expired Milk 100). `shoveStun` is the golden-snapshot field; the arena
    // reads the stun from the `onDashHit` hook below, not from the build.
    phase: 'final', order: 200,
    player(b, c) {
      if (c.tier < 2) return;
      const t = c.tune();
      b.shoveStun = t.shoveStun;
      b.shoveDamage *= t.shoveDamageMult;
    },
  }],
  hooks: {
    // Once per enemy the dash hits (after the item hooks: Tip Jar's roll, Sale Flag's mark). No rng.
    onDashHit(ev, ctx, c) {
      if (c.tier < 2) return;
      ctx.stun(ev.enemy, c.tune().shoveStun);
      ctx.fx.ring('fx_pulse', ev.enemy.x, ev.enemy.y, 70, 220, 0xf5bd45);
    },
  },
});
