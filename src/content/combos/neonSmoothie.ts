import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Blender + Battery: a charged blade storm reaches farther without duplicating the existing frost and shield combos.
export default defineCombo({
  id: Combo.neonSmoothie, requires: [Item.blender, Item.battery],
  tune: { rangeMult: 1.15 },
  text: {
    en: { name: 'Neon Smoothie', short: 'Charged blades reach farther', summary: 'Blender touching a Battery: the blades hum with static.', detail: 'Blade range is increased by {rangeMult|pct}.' },
    de: { name: 'Neon-Smoothie', short: 'Geladene Klingen reichen weiter', summary: 'Mixer berührt Batterie: Die Klingen knistern vor Strom.', detail: 'Die Reichweite der Klingen steigt um {rangeMult|pct}.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.range *= c.tune().rangeMult; } },
});
