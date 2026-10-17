import { defineCombo } from '../../engine/define';

// Mop + Ice Pack: the first time an enemy steps into a puddle it freezes (`first` of `pattern:puddleEnter`, before the puddle's slow and
// damage).
export default defineCombo({
  id: 'blackIce', requires: ['mop', 'ice'],
  tune: { freeze: 0.8 },
  text: {
    en: {
      name: 'Black Ice', short: 'Puddles freeze',
      summary: 'Mop touching an Ice Pack: puddles freeze over.',
      detail: 'The first time an enemy steps into a puddle it freezes solid for {freeze|s}.',
    },
    de: {
      name: 'Glatteis', short: 'Pfützen gefrieren',
      summary: 'Wischmopp berührt Kühlakku: Pfützen frieren zu.',
      detail: 'Wenn ein Gegner zum ersten Mal in eine Pfütze tritt, friert er {freeze|s} lang fest.',
    },
  },
  hooks: {
    'pattern:puddleEnter'(ev, ctx, c) {
      if (!ev.first || !c.touches(ev.stats.uid)) return;
      ctx.stun(ev.enemy, c.tune().freeze, 'frost');
      ctx.fx.frostBurst(ev.enemy.x, ev.enemy.y - 20, 4);
    },
  },
});
