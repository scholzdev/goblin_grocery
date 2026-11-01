import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Blender + Lunchbox: a prepared blade cycle is more reliable, a utility combo that does not compete with Brain Freeze or Smoothie Shield.
export default defineCombo({
  id: Combo.prepLine, requires: [Item.blender, Item.lunchbox],
  tune: { cooldownMult: 0.88 },
  text: {
    en: { name: 'Prep Line', short: 'Blades spin faster', summary: 'Blender touching a Lunchbox: the prep line keeps the motor fed.', detail: 'Blender cooldown is reduced by {cooldownMult|pctdown}.' },
    de: { name: 'Vorbereitungsstation', short: 'Klingen drehen schneller', summary: 'Mixer berührt Lunchbox: Die Vorbereitung hält den Motor am Laufen.', detail: 'Der Mixer-Cooldown sinkt um {cooldownMult|pctdown}.' },
  },
  build: { phase: 'combo', weapon(w, c) { w.cooldown *= c.tune().cooldownMult; } },
});
