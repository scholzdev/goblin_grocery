import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Spray Bottle + Battery: a narrow jet. The arc is `arcDeg` plus the arc Duct Tape added before the combos (`c.tapeArc`, a snapshot, so
// Mist Machine's arc does not leak in).
export default defineCombo({
  id: Combo.pressureWasher, requires: [Item.spray, Item.battery],
  tune: { arcDeg: 25, rangeMult: 2, damageMult: 2.5 },
  text: {
    en: {
      name: 'Pressure Washer', short: 'Long hard jet',
      summary: 'Spray Bottle touching a Battery: motorized jet.',
      detail: 'The spray becomes a narrow jet: {arcDeg|deg} wide, twice the reach, {damageMult|x} damage.',
    },
    de: {
      name: 'Hochdruckreiniger', short: 'Langer, harter Strahl',
      summary: 'Sprühflasche berührt Batterie: motorisierter Strahl.',
      detail: 'Der Sprühstoß wird zum schmalen Strahl: {arcDeg|deg} breit, doppelte Reichweite, {damageMult|x} Schaden.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.arcDeg = t.arcDeg + c.tapeArc; w.range *= t.rangeMult; w.damage *= t.damageMult;
    },
  },
});
