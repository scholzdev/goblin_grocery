import { defineCombo } from '../../engine/define';

// Vacuum + Battery: each damage tick also zaps up to `targets` random enemies inside the suction. Rng: one draw per comparator call of the
// shuffle, exactly the old `sort(() => rng() - 0.5)` over the same list.
export default defineCombo({
  id: 'staticCling', requires: ['vacuum', 'battery'],
  tune: { targets: 3, damageMult: 1.5 },
  text: {
    en: {
      name: 'Static Cling', short: 'Ticks zap {targets}',
      summary: 'Vacuum touching a Battery: the suction throws out lightning.',
      detail: 'Each damage tick also zaps up to {targets} enemies inside the suction radius for {damageMult|pct} tick damage.',
    },
    de: {
      name: 'Statische Aufladung', short: 'Ticks zappen {targets}',
      summary: 'Staubsauger berührt Batterie: der Sog schleudert Blitze.',
      detail: 'Jeder Schadenstick zappt zusätzlich bis zu {targets} Gegner im Sogradius für {damageMult|pct} Tickschaden.',
    },
  },
  hooks: {
    'pattern:pulse'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), st = ev.stats;
      for (const e of [...ev.inside].sort(() => ctx.rng() - 0.5).slice(0, t.targets)) {
        ctx.boltFx(e.x, e.y, true);
        ctx.damage(e, st.damage * t.damageMult, st, {});
      }
      if (ev.inside.length) ctx.sound('zap', { rate: 1.3, volume: 0.6 });
    },
  },
});
