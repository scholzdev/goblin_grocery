import { defineCombo } from '../../engine/define';

// Microwave + Lunchbox + Battery: the zap arcs to one more enemy and the Microwave fires faster. Chain links deal `chainMult` (the zap code
// starts every link at 1; Sparks Fly's hook, order 10, then overrides the links that are its own).
export default defineCombo({
  id: 'tvDinner', requires: ['microwave', 'lunchbox', 'battery'],
  tune: { chain: 1, cooldownMult: 0.92, chainMult: 0.6 },
  text: {
    en: {
      name: 'TV Dinner', short: 'Zaps chain to +{chain} enemy',
      summary: 'Microwave touching a Lunchbox AND a Battery: chain-zapping meals.',
      detail: 'Each zap arcs to {chain} more nearby enemy ({chainMult|pct} damage) and the Microwave fires {cooldownMult|pctdown}% faster (on top of the Battery).',
    },
    de: {
      name: 'Fertiggericht', short: 'Zaps springen auf +{chain} Gegner',
      summary: 'Mikrowelle berührt Brotdose UND Batterie: kettenzappende Mahlzeiten.',
      detail: 'Jeder Zap springt auf {chain} weiteren Gegner in der Nähe über ({chainMult|pct} Schaden) und die Mikrowelle feuert {cooldownMult|pctdown}% schneller (zusätzlich zur Batterie).',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.chain += t.chain; w.cooldown *= t.cooldownMult;
    },
  },
  hooks: {
    // Every chain link (not the first target) deals `chainMult`.
    'pattern:zap'(ev, _ctx, c) {
      if (ev.stage === 'before' && ev.link > 0 && c.touches(ev.stats.uid)) ev.damageMult = c.tune().chainMult;
    },
  },
});
