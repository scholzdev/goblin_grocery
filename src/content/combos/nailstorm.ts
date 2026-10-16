import { defineCombo } from '../../engine/define';

// Nail Gun + Magnet + Battery: piercing, curving nails. The steering runs in the shot-update loop (weapons.ts reads `homing*` from this
// tune; phase 7 moves it with the pattern). Ray Gun replaces it.
export default defineCombo({
  id: 'nailstorm', requires: ['nailgun', 'magnet', 'battery'],
  tune: { extraPierce: 1, homingTurn: 7 /* rad/s */, homingRange: 200 },
  text: {
    en: {
      name: 'Nailstorm', short: 'Nails pierce and curve',
      summary: 'Nail Gun touching a Magnet AND a Battery: piercing, curving nails.',
      detail: 'Each nail pierces one extra enemy and curves toward a nearby target after its first hit. Battery attack rate still applies.',
    },
    de: {
      name: 'Nagelsturm', short: 'Nägel durchschlagen und kurven',
      summary: 'Nagelpistole berührt Magnet UND Batterie: durchschlagende, kurvende Nägel.',
      detail: 'Jeder Nagel durchschlägt einen weiteren Gegner und kurvt nach dem ersten Treffer auf ein nahes Ziel zu. Das Batterie-Angriffstempo gilt weiterhin.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { w.pierce += c.tune().extraPierce; w.homing = true; },
  },
});
