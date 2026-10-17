import { defineCombo } from '../../engine/define';

// Blender + Ice Pack: a wider, chilling blade storm. Replaces the Ice Pack slow for this weapon. The slower, pale spinning blades are this
// combo's `pattern:look` (cosmetic only).
export default defineCombo({
  id: 'brainFreeze', requires: ['blender', 'ice'],
  tune: { radiusMult: 1.25, pct: 0.4, duration: 0.6 },
  text: {
    en: {
      name: 'Brain Freeze', short: 'Wider, freezing blades',
      summary: 'Blender touching an Ice Pack: a chilling, wider blade storm.',
      detail: 'Blade radius +{radiusMult|pctup}% and every tick slows {pct|pct} for {duration|s}. Replaces the Ice Pack slow for this weapon (never added together).',
    },
    de: {
      name: 'Eiskopfschmerz', short: 'Breitere, frostige Klingen',
      summary: 'Mixer berührt Kühlakku: ein eisiger, breiterer Klingensturm.',
      detail: 'Klingenradius +{radiusMult|pctup}% und jeder Tick verlangsamt um {pct|pct} für {duration|s}. Ersetzt die Kühlakku-Verlangsamung für diese Waffe (nie addiert).',
    },
  },
  build: {
    phase: 'combo',
    weapon(w, c) {
      const t = c.tune();
      w.range *= t.radiusMult; w.slow = { pct: t.pct, duration: t.duration };
    },
  },
  hooks: {
    'pattern:look'(ev, _ctx, c) {
      if (!c.touches(ev.stats.uid)) return;
      ev.look.bladeSpin = 9;
      ev.look.bladeTint = 0xcff3ff;
    },
  },
});
