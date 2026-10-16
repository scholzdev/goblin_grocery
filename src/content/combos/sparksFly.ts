import { defineCombo } from '../../engine/define';

// Microwave + Tin Foil Hat + Battery: the zap arcs to `chain` more enemies. The last `chain` links deal `chainMult` (after TV Dinner's
// links: this hook has order 10 and overrides its `damageMult`), and every enemy a chain link damages rolls a stun (`hit` stage of
// `pattern:zap`, so the draws stay between the enemies' own).
export default defineCombo({
  id: 'sparksFly', requires: ['microwave', 'tinfoilhat', 'battery'],
  tune: { chain: 2, chainMult: 0.5, stunChance: 0.25, stun: 0.3 },
  text: {
    en: {
      name: 'Sparks Fly', short: 'Zaps chain +{chain}, may stun',
      summary: 'Microwave touching a Tin Foil Hat AND a Battery: the sparks go everywhere.',
      detail: 'Each zap arcs to {chain} more nearby enemies for {chainMult|pct} damage, and every chained hit has a {stunChance|pct} chance to stun for {stun|s}. Stacks with TV Dinner.',
    },
    de: {
      name: 'Funkenflug', short: 'Zaps springen +{chain}, können betäuben',
      summary: 'Mikrowelle berührt Aluhut UND Batterie: die Funken fliegen überallhin.',
      detail: 'Jeder Zap springt auf {chain} weitere Gegner in der Nähe über ({chainMult|pct} Schaden), und jeder Kettentreffer betäubt mit {stunChance|pct} Chance für {stun|s}. Stapelt sich mit TV-Dinner.',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) { w.chain += c.tune().chain; },
  },
  hooks: {
    order: 10,
    'pattern:zap'(ev, ctx, c) {
      if (ev.link < 1 || !c.touches(ev.stats.uid)) return;
      const t = c.tune();
      if (ev.stage === 'before') { if (ev.link > ev.stats.chain - t.chain) ev.damageMult = t.chainMult; }
      else if (ev.stage === 'hit' && ev.enemy!.alive && ctx.rng() < t.stunChance) ctx.stun(ev.enemy!, t.stun);
    },
  },
});
