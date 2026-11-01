import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Blender + Blanket: a heavier smoothie slows enemies in the blade ring, giving the weapon a defensive role without adding another projectile shield.
export default defineCombo({
  id: Combo.thickSmoothie, requires: [Item.blender, Item.blanket],
  tune: { pct: 0.3, duration: 0.8 },
  text: {
    en: { name: 'Thick Smoothie', short: 'Blades slow enemies', summary: 'Blender touching a Blanket: the smoothie sticks to anything it hits.', detail: 'Blade hits slow enemies by {pct|pct} for {duration|s}.' },
    de: { name: 'Dicker Smoothie', short: 'Klingen verlangsamen Gegner', summary: 'Mixer berührt Decke: Der Smoothie klebt an allem, was er trifft.', detail: 'Klingentreffer verlangsamen Gegner um {pct|pct} für {duration|s}.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.slow = { pct: c.tune().pct, duration: c.tune().duration }; } },
});
