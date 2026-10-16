import { defineCombo } from '../../engine/define';

// Mop + Fuel Can: bigger puddles whose burn is doubled (it multiplies the Fuel Can burn the module phase left, no stacking). The flaming
// puddle sprite and the flame particles are drawn from `recipes` in the puddle pattern (phase 7).
export default defineCombo({
  id: 'greaseFire', requires: ['mop', 'fuel'],
  tune: { radiusMult: 1.4, burnMult: 2 },
  text: {
    en: {
      name: 'Grease Fire', short: 'Huge burning slicks',
      summary: 'Mop touching a Fuel Can: huge burning grease slicks.',
      detail: 'Puddles become grease fires: {radiusMult|pctup}% bigger, and their burn is doubled (Fuel Can burn ×{burnMult}, no stacking).',
    },
    de: {
      name: 'Fettbrand', short: 'Riesige brennende Lachen',
      summary: 'Wischmopp berührt Benzinkanister: riesige brennende Fettlachen.',
      detail: 'Pfützen werden zu Fettbränden: {radiusMult|pctup}% größer, und ihr Brand ist verdoppelt (Benzinkanister-Brand ×{burnMult}, kein Stapeln).',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.range *= t.radiusMult;
      if (w.burn) w.burn = { ...w.burn, dps: w.burn.dps * t.burnMult };
    },
  },
});
