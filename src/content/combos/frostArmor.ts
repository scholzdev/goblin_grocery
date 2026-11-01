import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Snow Cone Machine + Blanket: a cold padded cart buys breathing room after a hit.
export default defineCombo({
  id: Combo.frostArmor, requires: [Item.snowcone, Item.blanket],
  tune: { invuln: 0.2 },
  text: {
    en: {
      name: 'Frost Armor', short: 'Extra invulnerability after hits',
      summary: 'Snow Cone Machine touching a Blanket: frozen padding cushions the cart.',
      detail: 'Taking a hit grants an extra {invuln|s} of invulnerability.',
    },
    de: {
      name: 'Frostpanzer', short: 'Mehr Unverwundbarkeit nach Treffern',
      summary: 'Slush-Maschine berührt Decke: gefrorene Polsterung schützt den Wagen.',
      detail: 'Nach einem Treffer erhältst du zusätzlich {invuln|s} Unverwundbarkeit.',
    },
  },
  hooks: {
    onPlayerHit(ev, _ctx, c) { ev.invuln += c.tune().invuln; },
  },
});
