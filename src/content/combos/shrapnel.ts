import { defineCombo } from '../../engine/define';
import { Combo, Item } from '../../engine/ids';

// Pressure Cooker + Duct Tape: every explosion (lobbed, or Pot Slam's) fires `count` fragments in a ring. One rng draw per fragment (the
// ring's jitter), in order.
export default defineCombo({
  id: Combo.shrapnel, requires: [Item.cooker, Item.tape],
  tune: { count: 6, damageMult: 0.4, speed: 520, range: 260, pierce: 1 },
  text: {
    en: {
      name: 'Shrapnel', short: 'Blasts spray nails',
      summary: 'Pressure Cooker touching Duct Tape: the lid comes off. Hard.',
      detail: 'Each explosion fires {count} pot fragments outward ({damageMult|pct} damage, pierce {pierce}).',
    },
    de: {
      name: 'Splitterbombe', short: 'Explosionen versprühen Nägel',
      summary: 'Schnellkochtopf berührt Panzertape: der Deckel fliegt ab. Mit Schwung.',
      detail: 'Jede Explosion schleudert {count} Topfsplitter nach außen ({damageMult|pct} Schaden, Durchschlag {pierce}).',
    },
  },
  hooks: {
    'pattern:explode'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), st = ev.stats;
      for (let i = 0; i < t.count; i++) {
        const angle = (i / t.count) * Math.PI * 2 + ctx.rng() * 0.3;
        ctx.spawnShot({ key: 'proj_nail', x: ev.x, y: ev.y, angle, speed: t.speed, life: t.range / t.speed, damage: st.damage * t.damageMult, stats: st, maxHits: 1 + t.pierce });
      }
    },
  },
});
