import { defineCombo } from '../../engine/define';
import { Combo, Item, Tag } from '../../engine/ids';

// Snow Cone Machine + Battery: soaked groceries get a small electric stagger when they enter the slush.
export default defineCombo({
  id: Combo.polarArc, requires: [Item.snowcone, Item.battery],
  tune: { stun: 0.25 },
  text: {
    en: {
      name: 'Polar Arc', short: 'Puddles shock soaked enemies',
      summary: 'Snow Cone Machine touching a Battery: frozen slush carries a charge.',
      detail: 'The first time an enemy enters each puddle, it is shocked for {stun|s}.',
    },
    de: {
      name: 'Polarer Lichtbogen', short: 'Pfützen schocken nasse Gegner',
      summary: 'Slush-Maschine berührt Batterie: gefrorener Matsch steht unter Strom.',
      detail: 'Wenn ein Gegner erstmals eine Pfütze betritt, wird er {stun|s} lang geschockt.',
    },
  },
  hooks: {
    'pattern:puddleEnter'(ev, ctx, c) {
      if (!ev.first || !c.touches(ev.stats.uid)) return;
      ctx.stun(ev.enemy, c.tune().stun, Tag.electric);
    },
  },
});
