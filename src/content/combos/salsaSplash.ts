import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Tomato + Desk Fan: a direct hit splashes a little of the poison onto nearby groceries.
export default defineCombo({
  id: Combo.salsaSplash,
  requires: [Item.tomato, Item.fan],
  tune: { radius: 70, dps: 2, duration: 3 },
  text: {
    en: {
      name: 'Salsa Splash', short: 'Poison splashes nearby',
      summary: 'Rotten Tomato touching a Desk Fan: every hit sprays sour poison around the target.',
      detail: 'Direct tomato hits poison nearby enemies within {radius} for {dps|ps} over {duration|s}.',
    },
    de: {
      name: 'Salsa-Spritzer', short: 'Gift spritzt auf Nachbarn',
      summary: 'Faule Tomate berührt Tischventilator: jeder Treffer spritzt saures Gift um das Ziel.',
      detail: 'Direkte Tomatentreffer vergiften nahe Gegner im Umkreis von {radius} für {dps|ps} über {duration|s}.',
    },
  },
  hooks: {
    'pattern:shotHit'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid) || ev.stats.type !== Item.tomato || !ev.enemy.alive) return;
      const t = c.tune();
      for (const e of ctx.inRadius(ev.enemy, t.radius)) if (e !== ev.enemy) ctx.poison(e, t.dps, t.duration);
    },
  },
});
