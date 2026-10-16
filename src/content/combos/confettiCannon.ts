import { defineCombo } from '../../engine/define';

// Fizz Cannon + Party Popper: every cap bounce goes off like a popper blast (never chains). With the Blast set the radius is multiplied by
// the set's level-1 `radiusMult` (the old behavior: the L3 radius is ignored here).
export default defineCombo({
  id: 'confettiCannon', requires: ['fizz', 'popper'],
  tune: { damageMult: 0.5, radius: 60 },
  text: {
    en: {
      name: 'Confetti Cannon', short: 'Bounces explode',
      summary: 'Fizz Cannon touching a Party Popper: every bounce is a party.',
      detail: 'Each cap bounce sets off a small confetti blast: {damageMult|pct} damage within {radius} (blasts never chain).',
    },
    de: {
      name: 'Konfettikanone', short: 'Abpraller explodieren',
      summary: 'Sprudelkanone berührt Partyknaller: jeder Abpraller ist eine Party.',
      detail: 'Jeder Kronkorken-Abpraller löst eine kleine Konfettiexplosion aus: {damageMult|pct} Schaden im Umkreis von {radius} (Explosionen lösen keine Kettenreaktion aus).',
    },
  },
  hooks: {
    'pattern:bounce'(ev, ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      const t = c.tune(), blast = ctx.build.sets.blast ? c.tuneOf('blast').radiusMult : 1;
      ctx.popperBlast(ev, { damage: ev.shot.damage * t.damageMult, radius: t.radius * blast });
    },
  },
});
