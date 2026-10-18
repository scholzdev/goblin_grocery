import { defineCombo } from '../../engine/define';
import { Combo, Item, Set } from '../../engine/ids';

// Pressure Cooker + Sparklers: every explosion also sets off `count` blasts evenly spaced on a ring around it. One rng draw per explosion (the ring's
// start angle). Popper blasts never chain; with the Blast set the radius is multiplied by its level-1 `radiusMult` like Confetti Cannon.
export default defineCombo({
  id: Combo.fireworksShow, requires: [Item.cooker, Item.sparklers],
  tune: { count: 6, damageMult: 0.4, ring: 110, radius: 45 },
  text: {
    en: {
      name: 'Fireworks Show', short: 'Pot blasts burst into fireworks',
      summary: 'Pressure Cooker touching Sparklers: the lid comes off. Festively.',
      detail: 'Each explosion sets off {count} more blasts in a ring of {ring} around it: {damageMult|pct} damage within {radius} (blasts never chain).',
    },
    de: {
      name: 'Feuerwerk', short: 'Topfexplosionen platzen zu Feuerwerk',
      summary: 'Schnellkochtopf berührt Wunderkerzen: der Deckel fliegt ab. Festlich.',
      detail: 'Jede Explosion löst {count} weitere Explosionen in einem Ring von {ring} um sie herum aus: {damageMult|pct} Schaden im Umkreis von {radius} (Explosionen lösen keine Kettenreaktion aus).',
    },
  },
  hooks: {
    'pattern:explode'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), blast = ctx.build.sets.blast ? c.tuneOf(Set.blast).radiusMult : 1, start = ctx.rng() * Math.PI * 2;
      for (let i = 0; i < t.count; i++) {
        const a = start + (i / t.count) * Math.PI * 2;
        ctx.popperBlast({ x: ev.x + Math.cos(a) * t.ring, y: ev.y + Math.sin(a) * t.ring }, { damage: ev.stats.damage * t.damageMult, radius: t.radius * blast });
      }
    },
  },
});
